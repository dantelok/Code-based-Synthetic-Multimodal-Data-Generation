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
