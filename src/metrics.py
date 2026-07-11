"""Principled, dependency-light scoring helpers for evaluation.

These replace the original substring heuristics ("is the word ``value_counts``
in the code?") with structural analysis: the generated chart code is parsed
into an AST and scored on the *calls it actually makes*, and QA answers are
grounded against the data numerically (with tolerance) rather than by raw
string containment. Everything here is pure and unit-testable with no API calls.
"""

import ast
import re
from typing import List, Set

# Plot calls that legitimately implement each canonical chart type. Names are
# the attribute tail of a call, e.g. ``plt.bar(...)`` -> "bar",
# ``sns.lineplot(...)`` -> "lineplot".
PLOT_CALLS = {
    "bar": {"bar", "barh", "barplot", "countplot"},
    "pie": {"pie"},
    "line": {"plot", "lineplot"},
    "scatter": {"scatter", "scatterplot"},
    "radar": {"plot", "fill", "fill_between"},
    "heatmap": {"heatmap", "imshow", "pcolormesh"},
    "box": {"boxplot"},
    "violin": {"violinplot"},
    "histogram": {"hist", "histplot"},
    "area": {"stackplot", "fill_between"},
    "donut": {"pie"},
    "treemap": {"plot"},  # e.g. squarify.plot(...)
    "time_series": {"plot", "lineplot"},
}

TITLE_CALLS = {"title", "set_title", "suptitle"}
XLABEL_CALLS = {"xlabel", "set_xlabel"}
YLABEL_CALLS = {"ylabel", "set_ylabel"}
LEGEND_CALLS = {"legend"}
RENDER_CALLS = {"show", "savefig"}
SAMPLING_CALLS = {"sample", "choice", "randint", "rand", "shuffle", "permutation"}

_NUMBER_RE = re.compile(r"-?\d[\d,]*\.?\d*")


def extract_call_names(code: str) -> Set[str]:
    """Return the set of function/method names called in ``code``.

    Uses the attribute tail (``plt.bar`` -> "bar", ``df.sample`` -> "sample")
    or the bare name for plain function calls. Raises ``SyntaxError`` if the
    code does not parse.
    """
    tree = ast.parse(code)
    names: Set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Attribute):
                names.add(func.attr)
            elif isinstance(func, ast.Name):
                names.add(func.id)
    return names


def score_chart_correctness(calls: Set[str], chart_type: str) -> float:
    """0.5 for using a plotting call appropriate to the chart type, plus 0.5
    for rendering the figure (show/savefig)."""
    score = 0.0
    if calls & PLOT_CALLS.get(chart_type, set()):
        score += 0.5
    if calls & RENDER_CALLS:
        score += 0.5
    return score


def score_chart_completeness(calls: Set[str], code: str) -> float:
    """Reward titles, axis labels, and a legend/percentage labels."""
    score = 0.0
    if calls & TITLE_CALLS:
        score += 0.3
    if calls & XLABEL_CALLS:
        score += 0.3
    if calls & YLABEL_CALLS:
        score += 0.3
    if (calls & LEGEND_CALLS) or ("autopct" in code):
        score += 0.1
    return min(score, 1.0)


def score_chart_diversity(calls: Set[str], n_numeric: int, n_categorical: int) -> float:
    """0.5 for random sampling of rows/columns, 0.5 for having enough columns
    to vary across charts."""
    score = 0.0
    if calls & SAMPLING_CALLS:
        score += 0.5
    if n_numeric > 2 or n_categorical > 2:
        score += 0.5
    return score


def extract_numbers(text: str) -> List[float]:
    """Extract numeric literals from free text (handles thousands separators)."""
    out: List[float] = []
    for match in _NUMBER_RE.findall(text or ""):
        cleaned = match.replace(",", "").rstrip(".")
        try:
            out.append(float(cleaned))
        except ValueError:
            continue
    return out


def numbers_match(answer_numbers: List[float], data_numbers: List[float], rel_tol: float = 0.01) -> bool:
    """True if any answer number matches any data number within ``rel_tol``."""
    for a in answer_numbers:
        for d in data_numbers:
            denom = max(abs(a), abs(d), 1e-9)
            if abs(a - d) / denom <= rel_tol:
                return True
    return False
