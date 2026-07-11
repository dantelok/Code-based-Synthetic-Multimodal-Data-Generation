"""Tests for the programmatic ground-truth QA generator (no API key needed)."""

import pandas as pd

from src.qa_templates import generate_grounded_qa


def _sample_df():
    return pd.DataFrame({"region": ["A", "B", "C"], "cases": [100, 250, 400]})


def _all_pairs(df, seed=0):
    # Request more than exist so we get the full candidate set, then index by op.
    pairs = generate_grounded_qa(df, max_pairs=999, seed=seed)
    return pairs


def test_answers_are_ground_truth():
    """Every generated answer must equal a fresh recomputation from the data."""
    df = _sample_df()
    grouped = df.groupby("region")["cases"].sum()
    expected = {
        "sum": "750",
        "mean": "250",
        "max": "400",
        "min": "100",
        "range": "300",
        "nunique": "3",
        "count_rows": "3",
        "argmax": grouped.idxmax(),   # "C"
        "argmin": grouped.idxmin(),   # "A"
    }
    by_op = {}
    for p in _all_pairs(df):
        by_op.setdefault(p["meta"]["op"], p["answer"])

    for op, want in expected.items():
        assert by_op[op] == want, f"{op}: got {by_op.get(op)!r}, want {want!r}"


def test_critic_aggregation_examples():
    """The exact failure modes of the old loose-matching metric are now correct."""
    df = _sample_df()
    by_op = {p["meta"]["op"]: p["answer"] for p in _all_pairs(df)}
    # "Total cases?" -> 750 (not a cell value; the old check called this wrong)
    assert by_op["sum"] == "750"
    # "Max cases?" -> 400 (the old check would accept "250" because it's a cell value)
    assert by_op["max"] == "400"
    assert by_op["max"] != "250"


def test_deterministic_with_seed():
    df = _sample_df()
    a = generate_grounded_qa(df, max_pairs=5, seed=42)
    b = generate_grounded_qa(df, max_pairs=5, seed=42)
    assert a == b


def test_respects_max_pairs_and_shape():
    df = _sample_df()
    pairs = generate_grounded_qa(df, max_pairs=4, seed=1)
    assert len(pairs) == 4
    for p in pairs:
        assert set(p) == {"question", "answer", "meta"}
        assert isinstance(p["question"], str) and p["question"]
        assert isinstance(p["answer"], str) and p["answer"]


def test_float_formatting():
    df = pd.DataFrame({"x": [1.0, 2.0]})  # mean 1.5, sum 3.0 -> "3" not "3.0"
    by_op = {p["meta"]["op"]: p["answer"] for p in generate_grounded_qa(df, max_pairs=999)}
    assert by_op["sum"] == "3"
    assert by_op["mean"] == "1.5"


def test_numeric_only_and_categorical_only():
    numeric_only = generate_grounded_qa(pd.DataFrame({"n": [1, 2, 3]}), max_pairs=999)
    assert any(p["meta"]["op"] == "sum" for p in numeric_only)
    cat_only = generate_grounded_qa(pd.DataFrame({"c": ["x", "y", "y"]}), max_pairs=999)
    assert any(p["meta"]["op"] == "nunique" for p in cat_only)
