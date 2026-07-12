"""Tests for deterministic chart rendering (no API key needed)."""

from src.render import render_bar, render_line, render_pie, render_scatter

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _is_png(path) -> bool:
    with open(path, "rb") as f:
        return f.read(8) == _PNG_MAGIC


def test_render_bar(tmp_path):
    p = tmp_path / "bar.png"
    render_bar(["a", "b", "c"], [1, 2, 3], "cat", "val", "Bar", str(p))
    assert p.exists() and _is_png(p) and p.stat().st_size > 0


def test_render_pie(tmp_path):
    p = tmp_path / "pie.png"
    render_pie(["a", "b"], [3, 7], "Pie", str(p))
    assert _is_png(p)


def test_render_line(tmp_path):
    p = tmp_path / "line.png"
    render_line(["2019", "2020", "2021"], [1.0, 2.5, 2.0], "year", "val", "Line", str(p))
    assert _is_png(p)


def test_render_scatter(tmp_path):
    p = tmp_path / "scatter.png"
    render_scatter([1, 2, 3], [4, 5, 6], "x", "y", "Scatter", str(p))
    assert _is_png(p)
