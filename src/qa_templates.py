"""Programmatic, ground-truth QA generation.

The dataset's value proposition is *verifiable* labels. Letting an LLM write the
answers cannot guarantee that (it may miscompute an aggregation), so instead we
**compute** every answer from the data with pandas and fill a question template.
The answer is therefore correct by construction — e.g. for a column
``cases = [100, 250, 400]`` the total is 750 and the max is 400, no matter what
a language model would have guessed.

This mirrors how established chart-QA datasets (DVQA, FigureQA, PlotQA) are built:
questions/answers are generated programmatically from the underlying data.

The output matches the existing ``{"question": str, "answer": str}`` shape, with
an extra ``meta`` field recording the operation and columns used (useful for a
dataset card, filtering, or difficulty stratification).
"""

import math
import random
from typing import Dict, List, Optional, Sequence

import pandas as pd


def _fmt(value) -> str:
    """Format a scalar answer: integers without a decimal, floats to 2 places."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return str(value)
    if math.isnan(f):
        return "N/A"
    if f.is_integer():
        return str(int(f))
    return str(round(f, 2))


def generate_grounded_qa(
    df: pd.DataFrame,
    max_pairs: int = 8,
    seed: Optional[int] = None,
    columns: Optional[Sequence[str]] = None,
) -> List[Dict]:
    """Generate up to ``max_pairs`` question-answer pairs with computed answers.

    Args:
        df: The data slice the chart is drawn from.
        max_pairs: Maximum number of QA pairs to return.
        seed: Seed for deterministic template selection/ordering.
        columns: Restrict generation to these columns (e.g. the plotted ones).

    Returns:
        A list of ``{"question", "answer", "meta"}`` dicts. Every answer is
        computed from ``df`` and is therefore ground truth for that slice.
    """
    rng = random.Random(seed)

    if columns:
        keep = [c for c in columns if c in df.columns]
        if keep:
            df = df[keep]

    numeric = df.select_dtypes(include="number").columns.tolist()
    categorical = [c for c in df.columns if c not in numeric]

    candidates: List[Dict] = []

    def add(question: str, answer: str, op: str, cols: Sequence[str]) -> None:
        candidates.append({"question": question, "answer": answer, "meta": {"op": op, "columns": list(cols)}})

    # Whole-column numeric aggregations.
    for num in numeric:
        series = df[num].dropna()
        if series.empty:
            continue
        add(f"What is the total {num} across all rows?", _fmt(series.sum()), "sum", [num])
        add(f"What is the average {num}?", _fmt(series.mean()), "mean", [num])
        add(f"What is the maximum {num}?", _fmt(series.max()), "max", [num])
        add(f"What is the minimum {num}?", _fmt(series.min()), "min", [num])
        add(
            f"What is the difference between the highest and lowest {num}?",
            _fmt(series.max() - series.min()), "range", [num],
        )

    # Categorical structure.
    for cat in categorical:
        add(f"How many distinct {cat} values are shown?", _fmt(df[cat].nunique(dropna=True)), "nunique", [cat])
        mode = df[cat].mode()
        if not mode.empty:
            add(f"Which {cat} value appears most frequently?", _fmt(mode.iloc[0]), "mode", [cat])

    add("How many data points are shown?", _fmt(len(df)), "count_rows", [])

    # Category x numeric: grouped comparisons (how a bar chart aggregates).
    for cat in categorical:
        for num in numeric:
            grouped = df.groupby(cat)[num].sum()
            grouped = grouped.dropna()
            if grouped.empty:
                continue
            add(f"Which {cat} has the highest total {num}?", _fmt(grouped.idxmax()), "argmax", [cat, num])
            add(f"Which {cat} has the lowest total {num}?", _fmt(grouped.idxmin()), "argmin", [cat, num])
            first = grouped.index[0]
            add(f"What is the total {num} for {cat} '{first}'?", _fmt(grouped.loc[first]), "lookup", [cat, num])
            if grouped.shape[0] >= 2:
                a, b = grouped.index[0], grouped.index[1]
                answer = "Yes" if grouped.loc[a] > grouped.loc[b] else "No"
                add(f"Does {cat} '{a}' have a higher total {num} than '{b}'?", answer, "compare", [cat, num])

    # Deterministic, de-duplicated selection.
    rng.shuffle(candidates)
    seen = set()
    out: List[Dict] = []
    for cand in candidates:
        if cand["question"] in seen:
            continue
        seen.add(cand["question"])
        out.append(cand)
        if len(out) >= max_pairs:
            break
    return out
