"""Tests for the AST-based chart metrics and numeric grounding helpers."""

import pytest

from src.metrics import (
    extract_call_names,
    extract_numbers,
    numbers_match,
    score_chart_completeness,
    score_chart_correctness,
    score_chart_diversity,
)


def test_extract_call_names():
    code = "import matplotlib.pyplot as plt\nplt.bar([1], [2])\ndf.sample(3)\nprint('x')\n"
    calls = extract_call_names(code)
    assert {"bar", "sample", "print"} <= calls


def test_extract_call_names_syntax_error():
    with pytest.raises(SyntaxError):
        extract_call_names("plt.bar(  # unclosed")


def test_score_chart_correctness_matches_type():
    assert score_chart_correctness({"bar", "show"}, "bar") == 1.0
    assert score_chart_correctness({"bar"}, "bar") == 0.5          # no render call
    assert score_chart_correctness({"pie", "show"}, "bar") == 0.5  # wrong plot call
    assert score_chart_correctness({"lineplot", "savefig"}, "line") == 1.0


def test_score_chart_completeness():
    assert score_chart_completeness({"title", "xlabel", "ylabel", "legend"}, "") == pytest.approx(1.0)
    assert score_chart_completeness({"title"}, "") == pytest.approx(0.3)
    assert score_chart_completeness(set(), "plt.pie(x, autopct='%1.1f%%')") == pytest.approx(0.1)


def test_score_chart_diversity():
    assert score_chart_diversity({"sample"}, n_numeric=3, n_categorical=0) == 1.0
    assert score_chart_diversity(set(), n_numeric=1, n_categorical=1) == 0.0
    assert score_chart_diversity({"choice"}, n_numeric=1, n_categorical=1) == 0.5


def test_extract_numbers():
    assert extract_numbers("The value is 1,234.5 and -6") == [1234.5, -6.0]
    assert extract_numbers("no numbers here") == []


def test_numbers_match_within_tolerance():
    assert numbers_match([100.0], [100.4], rel_tol=0.01) is True
    assert numbers_match([100.0], [130.0], rel_tol=0.01) is False
    assert numbers_match([], [1.0, 2.0]) is False
