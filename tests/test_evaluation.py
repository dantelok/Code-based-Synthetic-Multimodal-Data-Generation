"""Tests for the heuristic (non-LLM) evaluators. No API key required."""

import pandas as pd
import pytest

from src.evaluation import evaluate_charts, evaluate_qa_pairs


@pytest.fixture
def chart_csv(tmp_path):
    csv = tmp_path / "chart.csv"
    pd.DataFrame(
        {"cat": ["a", "b", "c"], "n1": [1, 2, 3], "n2": [4, 5, 6], "n3": [7, 8, 9]}
    ).to_csv(csv, index=False)
    return str(csv)


# Code that makes the actual calls the AST-based scorer looks for: a bar plot,
# a render call, titles/labels/legend, and a real sampling call.
GOOD_BAR_CODE = """
import matplotlib.pyplot as plt
import random
rows = random.sample(range(100), 3)
vals = [1, 2, 3]
plt.title('t'); plt.xlabel('x'); plt.ylabel('y')
plt.bar(['a', 'b', 'c'], vals)
plt.legend(['v'])
plt.show()
"""


def test_evaluate_charts_full_score(chart_csv):
    result = evaluate_charts(chart_csv, "bar", batch_size=3, output_size=1, generated_code=GOOD_BAR_CODE)
    assert result["correctness"] == 1.0
    assert result["completeness"] == pytest.approx(1.0)
    assert result["diversity"] == 1.0


def test_evaluate_charts_wrong_plot_call(chart_csv):
    # A pie() call for a 'bar' chart should not earn the plot-type correctness point.
    pie_code = "import matplotlib.pyplot as plt\nplt.pie([1, 2, 3])\nplt.show()\n"
    result = evaluate_charts(chart_csv, "bar", 3, 1, pie_code)
    assert result["correctness"] == 0.5  # render call only, no matching plot call


def test_evaluate_charts_syntax_error(chart_csv):
    result = evaluate_charts(chart_csv, "bar", 3, 1, "plt.bar(  # unclosed")
    assert result["correctness"] == 0.0
    assert any("does not parse" in c for c in result["comments"])


def test_evaluate_charts_unsupported_type(chart_csv):
    result = evaluate_charts(chart_csv, "nonsense", 3, 1, GOOD_BAR_CODE)
    assert any("Unsupported chart type" in c for c in result["comments"])


def test_evaluate_charts_insufficient_columns(tmp_path):
    csv = tmp_path / "numeric_only.csv"
    pd.DataFrame({"n1": [1, 2], "n2": [3, 4]}).to_csv(csv, index=False)
    # 'bar' needs a categorical column; there is none.
    result = evaluate_charts(str(csv), "bar", 2, 1, GOOD_BAR_CODE)
    assert any("Insufficient columns" in c for c in result["comments"])


@pytest.fixture
def qa_csv(tmp_path):
    csv = tmp_path / "qa.csv"
    pd.DataFrame({"country": ["Foo", "Bar"], "cases": [10, 20]}).to_csv(csv, index=False)
    return str(csv)


def test_evaluate_qa_pairs_scores(qa_csv):
    qa = [{"question": "What is the country?", "answer": "Foo"}]
    result = evaluate_qa_pairs(qa_csv, batch_size=5, output_size=1, qa_pairs=qa)
    assert result["correctness"] == 1.0
    assert result["relevance"] == 1.0
    assert 0.0 < result["diversity"] <= 1.0


def test_evaluate_qa_pairs_count_mismatch(qa_csv):
    qa = [{"question": "What is the country?", "answer": "Foo"}]
    result = evaluate_qa_pairs(qa_csv, batch_size=5, output_size=3, qa_pairs=qa)
    assert any("Expected 3 QA pairs" in c for c in result["comments"])
