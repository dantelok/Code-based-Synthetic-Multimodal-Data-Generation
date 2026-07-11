import json
from typing import Any


def clean_code_block(generated_code: str) -> str:
    """
    Removes markdown code fences (like ```python and ```) from a code block.
    """
    lines = generated_code.strip().splitlines()

    # Remove starting and ending triple backticks
    if lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]

    return "\n".join(lines)


def extract_json(text: str) -> Any:
    """Parse a JSON value from an LLM response, tolerating markdown fences.

    Handles ```json ... ``` / ``` ... ``` wrappers and leading prose by
    falling back to the outermost ``{...}`` or ``[...]`` span. Raises
    ``json.JSONDecodeError`` (or ``ValueError``) if nothing parses.
    """
    stripped = text.strip()

    # Fast path: already valid JSON.
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Strip a leading ```json / ``` fence and a trailing ``` fence.
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[1] if "\n" in stripped else ""
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
        stripped = stripped.strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

    # Last resort: grab the outermost bracketed span.
    starts = [i for i in (stripped.find("{"), stripped.find("[")) if i != -1]
    ends = [i for i in (stripped.rfind("}"), stripped.rfind("]")) if i != -1]
    if starts and ends:
        candidate = stripped[min(starts): max(ends) + 1]
        return json.loads(candidate)

    raise ValueError("No JSON value found in text.")
