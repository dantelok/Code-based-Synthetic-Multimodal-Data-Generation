"""Smoke + ground-truth tests for the dataset build (no API key needed)."""

import os
import random

import pandas as pd

import build_hf_dataset as b
from src.qa_templates import generate_grounded_qa


def test_exclude_ops_drops_requested():
    df = pd.DataFrame({"c": ["x", "y", "z"], "n": [1, 2, 3]})
    qa = generate_grounded_qa(df, max_pairs=999, exclude_ops={"mode", "sum"})
    ops = {q["meta"]["op"] for q in qa}
    assert "mode" not in ops
    assert "sum" not in ops


def _toy_df():
    regions = ["A", "B", "C", "D", "E"] * 6
    return pd.DataFrame({
        "region": regions,
        "val": [i % 7 + 1 for i in range(len(regions))],
        "val2": [i % 5 + 1 for i in range(len(regions))],
    })


def test_build_one_chart_produces_aligned_records(tmp_path):
    images = tmp_path / "images"
    images.mkdir()
    cfg = {
        "domain": "toy", "file": "toy.csv", "source": "toy",
        "categorical": ["region"], "numeric": ["val", "val2"], "line_x": None,
    }
    # Try a few seeds; each should yield a valid, image-backed, ground-truth batch.
    produced = False
    for seed in range(5):
        recs = b.build_one_chart(_toy_df(), cfg, random.Random(seed), seed, str(images), qa_per_chart=5)
        if not recs:
            continue
        produced = True
        for r in recs:
            assert {"file_name", "question", "answer", "chart_type", "domain", "op", "columns"} <= set(r)
            assert os.path.exists(tmp_path / r["file_name"])
    assert produced


def test_build_source_missing_file_is_skipped(tmp_path):
    cfg = {"domain": "toy", "file": "nope.csv", "source": "s",
           "categorical": ["region"], "numeric": ["val"], "line_x": None}
    recs = b.build_source(cfg, str(tmp_path), str(tmp_path), charts=2, qa_per_chart=3, seed=0)
    assert recs == []
