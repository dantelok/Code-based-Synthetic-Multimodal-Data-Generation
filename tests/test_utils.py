"""Tests for src.utils.clean_code_block (no API key required)."""

from src.utils import clean_code_block


def test_strips_python_fence():
    raw = "```python\nprint('hi')\n```"
    assert clean_code_block(raw) == "print('hi')"


def test_strips_bare_fence():
    raw = "```\nx = 1\n```"
    assert clean_code_block(raw) == "x = 1"


def test_leaves_unfenced_code_untouched():
    raw = "x = 1\ny = 2"
    assert clean_code_block(raw) == "x = 1\ny = 2"


def test_handles_leading_and_trailing_whitespace():
    raw = "\n\n```python\nfoo()\n```\n\n"
    assert clean_code_block(raw) == "foo()"


def test_preserves_inner_blank_lines():
    raw = "```python\na = 1\n\nb = 2\n```"
    assert clean_code_block(raw) == "a = 1\n\nb = 2"
