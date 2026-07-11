"""Orchestration for the synthetic multimodal data pipeline.

Wraps the low-level generation/evaluation functions with retry loops, logging,
and on-disk output layout so they can be driven from the command line
(see ``main.py``).

Output layout under ``output_dir`` (default: ``generated/``)::

    generated/
    ├── cohere_chart_datasets/   # rendered chart images (.png)
    ├── chart_code/              # the LLM-generated code for each chart type
    └── qa_pairs.json            # generated question-answer pairs

.. warning::
   ``generate_charts`` executes LLM-generated Python with ``exec()`` in the
   current process. It is *not* sandboxed. Only run it on data and prompts you
   trust. Hardening this is tracked on the project roadmap.
"""

import json
import logging
import os
import random
from typing import Dict, List, Optional

import matplotlib

matplotlib.use("Agg")  # headless: never try to open a GUI window on plt.show()

import numpy as np
import pandas as pd

from src.evaluation import (
    DEFAULT_VLM_MODEL,
    evaluate_charts,
    evaluate_qa_pairs,
    vlm_evaluation,
)
from src.generation import (
    DEFAULT_TEXT_MODEL,
    generate_code_block,
    generate_qa_pairs,
)
from src.utils import clean_code_block

logger = logging.getLogger("pipeline")

CHART_SUBDIR = "cohere_chart_datasets"
CODE_SUBDIR = "chart_code"
QA_FILENAME = "qa_pairs.json"


def _seed_everything(seed: Optional[int]) -> None:
    """Best-effort determinism for the local (non-LLM) randomness."""
    if seed is None:
        return
    random.seed(seed)
    np.random.seed(seed)
    logger.info("Seeded local RNGs with seed=%s (LLM sampling is still non-deterministic)", seed)


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in text).strip("_").lower()


# Canonical keys understood by evaluate_charts(). Generation uses friendly names
# like "Bar Chart"; this maps a slug back to the key the evaluator expects.
_CANONICAL_CHART_KEYS = [
    "time_series", "scatter", "heatmap", "violin", "treemap", "donut",
    "radar", "line", "bar", "pie", "box",
]


def _canonical_chart_key(slug: str) -> str:
    for key in _CANONICAL_CHART_KEYS:
        if key in slug:
            return key
    return slug


def generate_charts(
    csv_path: str,
    chart_types: List[str],
    batch_size: int,
    output_size: int,
    output_dir: str = "generated",
    model: str = DEFAULT_TEXT_MODEL,
    max_retries: int = 5,
    seed: Optional[int] = None,
) -> Dict[str, bool]:
    """Generate and render charts for each chart type, with retries.

    Returns a mapping of ``chart_type -> success``.
    """
    _seed_everything(seed)
    image_dir = os.path.join(output_dir, CHART_SUBDIR)
    code_dir = os.path.join(output_dir, CODE_SUBDIR)
    os.makedirs(image_dir, exist_ok=True)
    os.makedirs(code_dir, exist_ok=True)

    results: Dict[str, bool] = {}
    for chart_type in chart_types:
        logger.info("Generating %s (%d chart(s))...", chart_type, output_size)
        success = False
        for attempt in range(1, max_retries + 1):
            try:
                raw_code = generate_code_block(
                    csv_path,
                    chart_type,
                    batch_size,
                    output_size,
                    output_dir=image_dir + os.sep,
                    model=model,
                )
                clean_code = clean_code_block(raw_code)

                # Persist the generated code so it can be evaluated later.
                code_path = os.path.join(code_dir, f"{_slug(chart_type)}.py")
                with open(code_path, "w") as fh:
                    fh.write(clean_code)

                # Execute in a dedicated namespace (NOT a security sandbox).
                exec_globals = {"__builtins__": __builtins__, "batch_size": batch_size}
                exec(clean_code, exec_globals)  # noqa: S102 - see module warning

                logger.info("  ✓ %s succeeded on attempt %d", chart_type, attempt)
                success = True
                break
            except Exception as exc:  # noqa: BLE001 - LLM output is inherently unpredictable
                logger.warning("  ✗ %s attempt %d/%d failed: %s", chart_type, attempt, max_retries, exc)
        if not success:
            logger.error("  %s failed after %d attempts.", chart_type, max_retries)
        results[chart_type] = success

    ok = sum(results.values())
    logger.info("Chart generation complete: %d/%d chart types succeeded.", ok, len(chart_types))
    return results


def generate_qa(
    csv_path: str,
    batch_size: int,
    output_size: int,
    output_dir: str = "generated",
    model: str = DEFAULT_TEXT_MODEL,
    max_retries: int = 5,
) -> List[Dict]:
    """Generate QA pairs from the dataset, parse them, and save to disk."""
    os.makedirs(output_dir, exist_ok=True)
    qa_path = os.path.join(output_dir, QA_FILENAME)
    df = pd.read_csv(csv_path)

    for attempt in range(1, max_retries + 1):
        try:
            raw = generate_qa_pairs(df, batch_size, output_size, model=model)
            cleaned = raw.strip().strip("```json").strip("```").strip()
            qa_pairs = json.loads(cleaned)
            with open(qa_path, "w") as fh:
                json.dump(qa_pairs, fh, indent=4)
            logger.info("Generated %d QA pairs -> %s (attempt %d)", len(qa_pairs), qa_path, attempt)
            return qa_pairs
        except Exception as exc:  # noqa: BLE001
            logger.warning("QA generation attempt %d/%d failed: %s", attempt, max_retries, exc)

    raise RuntimeError(f"QA generation failed after {max_retries} attempts.")


def run_evaluation(
    csv_path: str,
    batch_size: int,
    output_size: int,
    output_dir: str = "generated",
    vlm_model: str = DEFAULT_VLM_MODEL,
) -> Dict:
    """Run heuristic QA/chart evaluation plus the VLM-as-judge pass.

    Reads previously generated artifacts from ``output_dir``.
    """
    image_dir = os.path.join(output_dir, CHART_SUBDIR)
    code_dir = os.path.join(output_dir, CODE_SUBDIR)
    qa_path = os.path.join(output_dir, QA_FILENAME)

    report: Dict = {"charts": {}, "qa_pairs": None, "vlm": None}

    # Heuristic chart evaluation, per persisted code block.
    if os.path.isdir(code_dir):
        for code_file in sorted(os.listdir(code_dir)):
            if not code_file.endswith(".py"):
                continue
            chart_type = os.path.splitext(code_file)[0]
            with open(os.path.join(code_dir, code_file)) as fh:
                generated_code = fh.read()
            report["charts"][chart_type] = evaluate_charts(
                csv_path, _canonical_chart_key(chart_type), batch_size, output_size, generated_code
            )
    else:
        logger.warning("No chart code found at %s; skipping heuristic chart evaluation.", code_dir)

    # Load QA pairs for the remaining evaluations.
    if not os.path.exists(qa_path):
        logger.warning("No QA pairs found at %s; skipping QA and VLM evaluation.", qa_path)
        return report

    with open(qa_path) as fh:
        qa_pairs = json.load(fh)

    report["qa_pairs"] = evaluate_qa_pairs(csv_path, batch_size, output_size, qa_pairs)

    if os.path.isdir(image_dir) and os.listdir(image_dir):
        report["vlm"] = vlm_evaluation(csv_path, batch_size, image_dir, qa_pairs, model=vlm_model)
    else:
        logger.warning("No chart images found at %s; skipping VLM evaluation.", image_dir)

    return report
