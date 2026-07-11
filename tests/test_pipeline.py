"""Tests for pipeline helpers and the code sandbox. No API key required."""

import os
import tempfile

import pytest

from src.pipeline import _canonical_chart_key, _slug, run_generated_code


@pytest.mark.parametrize(
    "slug,expected",
    [
        ("bar_chart", "bar"),
        ("line_chart", "line"),
        ("radar_chart", "radar"),
        ("pie_chart", "pie"),
        ("time_series", "time_series"),
        ("something_else", "something_else"),
    ],
)
def test_canonical_chart_key(slug, expected):
    assert _canonical_chart_key(slug) == expected


def test_slug():
    assert _slug("Bar Chart") == "bar_chart"
    assert _slug("Time-Series Plot!") == "time_series_plot"


def test_sandbox_success_injects_batch_size():
    out = os.path.join(tempfile.mkdtemp(), "ok.txt")
    run_generated_code(f"open({out!r}, 'w').write(str(batch_size))", batch_size=7)
    assert open(out).read() == "7"


def test_sandbox_has_matplotlib_agg_preamble():
    # Should not raise: Agg backend is injected before any user import.
    run_generated_code("import matplotlib.pyplot as plt\nplt.plot([1, 2]); plt.show()", batch_size=1)


def test_sandbox_raises_on_error():
    with pytest.raises(RuntimeError):
        run_generated_code("raise ValueError('boom')", batch_size=1)


def test_sandbox_times_out():
    with pytest.raises(TimeoutError):
        run_generated_code("while True:\n    pass", batch_size=1, timeout=2)
