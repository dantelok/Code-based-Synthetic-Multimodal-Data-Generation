"""Tests for src.utils (no API key required)."""

import pytest

from src.utils import clean_code_block, extract_json


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


def test_extract_json_plain():
    assert extract_json('[{"question": "q", "answer": "a"}]') == [{"question": "q", "answer": "a"}]


def test_extract_json_fenced():
    raw = '```json\n{"a": 1, "b": [2, 3]}\n```'
    assert extract_json(raw) == {"a": 1, "b": [2, 3]}


def test_extract_json_with_leading_prose():
    raw = 'Here are the pairs:\n[{"q": 1}]\nThanks!'
    assert extract_json(raw) == [{"q": 1}]


def test_extract_json_raises_when_absent():
    with pytest.raises((ValueError, Exception)):
        extract_json("no json at all")
