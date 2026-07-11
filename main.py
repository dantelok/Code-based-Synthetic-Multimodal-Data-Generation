"""Command-line entrypoint for the synthetic multimodal data pipeline.

Examples
--------
Generate charts and QA pairs, then evaluate them, for the sample dataset::

    python main.py run --csv data/covid-19-dataset/usa_county_wise.csv

Just generate bar and line charts::

    python main.py charts --chart-types "Bar Chart" "Line Chart" --output-size 4

Evaluate artifacts that were generated in a previous run::

    python main.py evaluate

Requires COHERE_API_KEY in the environment or a .env file (see .env.example).
"""

import argparse
import json
import logging
import sys

from src.evaluation import DEFAULT_VLM_MODEL
from src.generation import DEFAULT_TEXT_MODEL, ensure_api_key
from src.pipeline import generate_charts, generate_qa, run_evaluation

DEFAULT_CSV = "data/covid-19-dataset/usa_county_wise.csv"
DEFAULT_CHART_TYPES = ["Radar Chart", "Bar Chart", "Pie Chart", "Line Chart"]


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--csv", default=DEFAULT_CSV, help="Path to the source CSV dataset.")
    parser.add_argument("--output-dir", default="generated", help="Directory for generated artifacts.")
    parser.add_argument("--batch-size", type=int, default=32, help="Rows sampled per chart / QA context.")
    parser.add_argument("--output-size", type=int, default=8, help="Number of charts / QA pairs to generate.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="main.py",
        description="Generate and evaluate synthetic multimodal (chart + QA) data.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging.")
    sub = parser.add_subparsers(dest="command", required=True)

    # charts
    p_charts = sub.add_parser("charts", help="Generate and render chart images.")
    _add_common(p_charts)
    p_charts.add_argument("--chart-types", nargs="+", default=DEFAULT_CHART_TYPES, help="Chart types to generate.")
    p_charts.add_argument("--model", default=DEFAULT_TEXT_MODEL, help="Cohere text model for code generation.")
    p_charts.add_argument("--max-retries", type=int, default=5, help="Retries per chart type on failure.")
    p_charts.add_argument("--seed", type=int, default=None, help="Seed for local RNGs (reproducibility).")

    # qa
    p_qa = sub.add_parser("qa", help="Generate question-answer pairs.")
    _add_common(p_qa)
    p_qa.add_argument("--qa-method", choices=["grounded", "llm"], default="grounded",
                      help="grounded = answers computed from data (ground truth, no API key); "
                           "llm = model writes answers (not guaranteed correct).")
    p_qa.add_argument("--model", default=DEFAULT_TEXT_MODEL, help="Cohere text model (llm method only).")
    p_qa.add_argument("--max-retries", type=int, default=5, help="Retries on failure (llm method only).")
    p_qa.add_argument("--seed", type=int, default=None, help="Seed for deterministic grounded QA.")

    # evaluate
    p_eval = sub.add_parser("evaluate", help="Evaluate previously generated artifacts.")
    _add_common(p_eval)
    p_eval.add_argument("--vlm-model", default=DEFAULT_VLM_MODEL, help="Cohere vision model used as judge.")

    # run (full pipeline)
    p_run = sub.add_parser("run", help="Full pipeline: charts -> qa -> evaluate.")
    _add_common(p_run)
    p_run.add_argument("--chart-types", nargs="+", default=DEFAULT_CHART_TYPES, help="Chart types to generate.")
    p_run.add_argument("--qa-method", choices=["grounded", "llm"], default="grounded",
                       help="QA answer source (see the `qa` command).")
    p_run.add_argument("--model", default=DEFAULT_TEXT_MODEL, help="Cohere text model.")
    p_run.add_argument("--vlm-model", default=DEFAULT_VLM_MODEL, help="Cohere vision model used as judge.")
    p_run.add_argument("--max-retries", type=int, default=5, help="Retries per generation step.")
    p_run.add_argument("--seed", type=int, default=None, help="Seed for local RNGs (reproducibility).")

    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Fail fast with a friendly message if a command that calls the API is
    # missing a key. Grounded QA runs fully offline, so `qa --qa-method grounded`
    # is exempt.
    qa_needs_key = args.command == "qa" and getattr(args, "qa_method", "grounded") == "llm"
    if args.command in {"charts", "evaluate", "run"} or qa_needs_key:
        try:
            ensure_api_key()
        except RuntimeError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1

    if args.command == "charts":
        generate_charts(
            args.csv, args.chart_types, args.batch_size, args.output_size,
            output_dir=args.output_dir, model=args.model,
            max_retries=args.max_retries, seed=args.seed,
        )
    elif args.command == "qa":
        generate_qa(
            args.csv, args.batch_size, args.output_size,
            output_dir=args.output_dir, model=args.model, max_retries=args.max_retries,
            method=args.qa_method, seed=args.seed,
        )
    elif args.command == "evaluate":
        report = run_evaluation(
            args.csv, args.batch_size, args.output_size,
            output_dir=args.output_dir, vlm_model=args.vlm_model,
        )
        print(json.dumps({k: v for k, v in report.items() if k != "vlm"}, indent=2, default=str))
    elif args.command == "run":
        generate_charts(
            args.csv, args.chart_types, args.batch_size, args.output_size,
            output_dir=args.output_dir, model=args.model,
            max_retries=args.max_retries, seed=args.seed,
        )
        generate_qa(
            args.csv, args.batch_size, args.output_size,
            output_dir=args.output_dir, model=args.model, max_retries=args.max_retries,
            method=args.qa_method, seed=args.seed,
        )
        report = run_evaluation(
            args.csv, args.batch_size, args.output_size,
            output_dir=args.output_dir, vlm_model=args.vlm_model,
        )
        print(json.dumps({k: v for k, v in report.items() if k != "vlm"}, indent=2, default=str))

    return 0


if __name__ == "__main__":
    sys.exit(main())
