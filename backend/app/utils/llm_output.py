import re

# Qwen, DeepSeek, and similar models emit chain-of-thought in tagged blocks.
_REASONING_BLOCK_RE = re.compile(
    r"<(?:redacted_)?think(?:ing)?>[\s\S]*?</(?:redacted_)?think(?:ing)?>",
    re.IGNORECASE,
)
_REASONING_OPEN_RE = re.compile(
    r"<(?:redacted_)?think(?:ing)?>[\s\S]*",
    re.IGNORECASE,
)
_REASONING_TAG_RE = re.compile(r"</?(?:redacted_)?think(?:ing)?>", re.IGNORECASE)


def strip_reasoning_content(text: str) -> str:
    """Remove model reasoning / thinking blocks; keep spoken dialogue only."""
    if not text:
        return ""
    cleaned = _REASONING_BLOCK_RE.sub("", text)
    cleaned = _REASONING_OPEN_RE.sub("", cleaned)
    cleaned = _REASONING_TAG_RE.sub("", cleaned)
    return cleaned.strip()
