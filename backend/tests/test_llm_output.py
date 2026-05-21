from app.utils.llm_output import strip_reasoning_content


def test_strip_redacted_thinking_block():
    raw = (
        '<think> Okay, plan the reply. </think>\n'
        "Hello! How can I assist you today?"
    )
    assert strip_reasoning_content(raw) == "Hello! How can I assist you today?"


def test_strip_think_block_case_insensitive():
    open_tag, close_tag = "<think>", "</think>"
    raw = f"{open_tag}internal{close_tag}\nSure, I can pay fifty a month."
    assert strip_reasoning_content(raw) == "Sure, I can pay fifty a month."


def test_strip_unclosed_thinking():
    raw = "<thinking>still planning\nVisible line only."
    assert strip_reasoning_content(raw) == "Visible line only."
