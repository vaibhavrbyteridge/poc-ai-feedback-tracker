import re

_VALID_REASONING_EFFORT = {"none", "default", "low", "medium", "high"}


def _is_gpt_oss(model: str) -> bool:
    """gpt-oss reasoning models on Groq use `include_reasoning` / `reasoning_effort`."""
    return "gpt-oss" in (model or "").lower()


def reasoning_params(model: str, effort: str | None = None) -> dict:
    """Build request params that keep reasoning out of `content` for reasoning models.

    For gpt-oss models Groq places chain-of-thought in a separate `reasoning` field.
    We set `include_reasoning=false` so `content` holds only the final answer (which
    is also required alongside JSON mode, since `reasoning_format=raw` is rejected).
    Non-reasoning models (e.g. llama-3.3) ignore these params, so we omit them.
    """
    if not _is_gpt_oss(model):
        return {}
    params: dict = {"include_reasoning": False}
    if effort and effort in _VALID_REASONING_EFFORT and effort != "default":
        params["reasoning_effort"] = effort
    return params


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


def extract_message_content(resp_json: dict) -> str:
    """Pull the assistant text from a Groq chat response, guarding failure modes.

    gpt-oss reasoning models spend part of the `max_tokens` budget on hidden
    reasoning before emitting an answer. If the budget runs out first, the API
    returns `finish_reason == "length"` with empty `content`, which then fails
    downstream JSON parsing with an opaque error. Raise a clear error instead so
    the cause (raise max_tokens / lower reasoning_effort) is obvious.
    """
    try:
        choice = resp_json["choices"][0]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Malformed LLM response: {resp_json}") from exc

    finish_reason = choice.get("finish_reason")
    content = (choice.get("message", {}).get("content") or "").strip()

    if finish_reason == "length" and not content:
        raise RuntimeError(
            "LLM response was truncated before any answer was produced "
            "(finish_reason=length). The reasoning tokens likely consumed the "
            "entire max_tokens budget — increase max_tokens or lower "
            "reasoning_effort."
        )
    if not content:
        raise RuntimeError(
            f"LLM returned empty content (finish_reason={finish_reason})."
        )
    return strip_reasoning_content(content)


def strip_reasoning_content(text: str) -> str:
    """Remove model reasoning / thinking blocks; keep spoken dialogue only."""
    if not text:
        return ""
    cleaned = _REASONING_BLOCK_RE.sub("", text)
    cleaned = _REASONING_OPEN_RE.sub("", cleaned)
    cleaned = _REASONING_TAG_RE.sub("", cleaned)
    return cleaned.strip()
