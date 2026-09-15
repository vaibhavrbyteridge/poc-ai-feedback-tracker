"""AI-powered call scoring service using Groq."""

import json
import re

import httpx
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

from app.config import get_settings
from app.utils.llm_output import extract_message_content, reasoning_params

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


async def score_call(turns: list[dict], dialed_phone: str = "") -> dict:
    """Score a call transcript using AI.
    
    Args:
        turns: list of {collector: str, customer: str}
        dialed_phone: the phone number used for this call
    
    Returns:
        Scoring result dict with all dimensions + ideal responses
    """
    settings = get_settings()
    api_key = settings.groq_api_key.strip()
    model = settings.groq_model

    jinja = Environment(loader=FileSystemLoader(str(PROMPTS_DIR)), autoescape=False)
    template = jinja.get_template("scoring_system.j2")
    system_prompt = template.render()

    # Build transcript text
    transcript_lines = []
    if dialed_phone:
        transcript_lines.append(f"[Call made to phone number: {dialed_phone}]")
        transcript_lines.append("")
    for i, turn in enumerate(turns, 1):
        transcript_lines.append(f"Turn {i}:")
        transcript_lines.append(f"  Collector: {turn.get('collector', '')}")
        transcript_lines.append(f"  Customer: {turn.get('customer', '')}")
    transcript_text = "\n".join(transcript_lines)

    user_prompt = f"""Here is the call transcript to evaluate:

{transcript_text}

Respond with JSON only. Score each dimension and provide ideal responses for every collector utterance.
{"Note: The call was made to phone number " + dialed_phone + ". If the customer requests Do Not Call/Text/Email, it applies to THIS specific phone number." if dialed_phone else ""}"""

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        # gpt-oss reasoning tokens are drawn from this budget before any answer
        # is produced. Scoring emits a large JSON payload (6 dimensions + ideal
        # responses per turn), so the budget must cover reasoning + output.
        "max_tokens": 8000,
        "response_format": {"type": "json_object"},
        # Scoring is quality-sensitive and runs post-call (not real-time). Use
        # medium effort — enough reasoning for good scores without exhausting the
        # budget the way "high" did (which produced empty output → 400).
        **reasoning_params(model, "medium"),
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            GROQ_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )

    if resp.is_error:
        raise RuntimeError(f"Groq scoring failed ({resp.status_code}): {resp.text[:500]}")

    content = extract_message_content(resp.json())

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            raise RuntimeError("Failed to parse scoring response")

    # Validate and normalize
    dimensions = ["compliance", "communication", "empathy", "negotiation", "objection_handling", "closure"]
    max_scores = {"compliance": 25, "communication": 20, "empathy": 15, "negotiation": 20, "objection_handling": 10, "closure": 10}

    for dim in dimensions:
        if dim not in result or not isinstance(result[dim], dict):
            result[dim] = {"score": 0, "max": max_scores[dim]}
        result[dim]["max"] = max_scores[dim]
        result[dim]["score"] = min(result[dim].get("score", 0), max_scores[dim])

    # Calculate overall
    total = sum(result[dim]["score"] for dim in dimensions)
    result["overall_score"] = total

    # Ensure lists
    if not isinstance(result.get("what_went_well"), list):
        result["what_went_well"] = []
    if not isinstance(result.get("areas_of_improvement"), list):
        result["areas_of_improvement"] = []
    if not isinstance(result.get("ideal_responses"), list):
        result["ideal_responses"] = []

    return result


async def check_feedback_achievements(turns: list[dict], pending_feedbacks: list[dict]) -> list[dict]:
    """Check if any pending feedback goals were achieved in this call."""
    if not pending_feedbacks:
        return []

    settings = get_settings()
    api_key = settings.groq_api_key.strip()
    model = settings.groq_model

    transcript_lines = []
    for i, turn in enumerate(turns, 1):
        transcript_lines.append(f"Turn {i}: Collector: {turn.get('collector', '')} | Customer: {turn.get('customer', '')}")
    transcript_text = "\n".join(transcript_lines)

    feedback_list = "\n".join([f"- [ID:{f['id']}] {f['feedback_text']}" for f in pending_feedbacks])

    user_prompt = f"""Given this call transcript:
{transcript_text}

And these pending improvement goals for the agent:
{feedback_list}

For each goal, determine if the agent demonstrated improvement in this call. Return JSON:
{{"achievements": [{{"feedback_id": 1, "achieved": true, "evidence": "brief explanation"}}]}}

Only mark as achieved if there is clear evidence in the transcript."""

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You analyze call transcripts to determine if agents achieved their improvement goals. Be strict — only mark achieved if clearly demonstrated."},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        # Reasoning tokens share this budget; 500 was too tight for gpt-oss and
        # would truncate before the JSON was complete.
        "max_tokens": 2500,
        "response_format": {"type": "json_object"},
        **reasoning_params(model, settings.groq_reasoning_effort),
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GROQ_CHAT_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        )

    if resp.is_error:
        return []

    try:
        content = extract_message_content(resp.json())
        data = json.loads(content)
        return data.get("achievements", [])
    except Exception:
        return []


async def generate_agent_feedback(performance: dict, pending_goals: list[dict]) -> str:
    """Generate a paragraph of AI coaching feedback based on agent's overall scores."""
    settings = get_settings()
    api_key = settings.groq_api_key.strip()
    model = settings.groq_model

    perf_summary = f"""Agent Performance Summary:
- Total calls scored: {performance.get('total_calls_scored', 0)}
- Overall score: {performance.get('overall_score', 0)}/100
- Compliance: {performance.get('compliance', {}).get('score', 0)}/25
- Communication: {performance.get('communication', {}).get('score', 0)}/20
- Empathy: {performance.get('empathy', {}).get('score', 0)}/15
- Negotiation: {performance.get('negotiation', {}).get('score', 0)}/20
- Objection Handling: {performance.get('objection_handling', {}).get('score', 0)}/10
- Call Closure: {performance.get('closure', {}).get('score', 0)}/10"""

    goals_text = ""
    if pending_goals:
        goals_text = "\n\nCurrent improvement goals:\n" + "\n".join([f"- {g['feedback_text']}" for g in pending_goals])

    prompt = f"""{perf_summary}{goals_text}

Write a concise coaching paragraph (3-5 sentences) for this debt collection agent. Be specific about:
1. Their strongest areas
2. Their weakest areas that need immediate attention
3. One actionable tip they can apply in their next call

Write in second person ("You..."). Be encouraging but honest. Do not use bullet points."""

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a debt collection performance coach. Write clear, actionable feedback paragraphs."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        # gpt-oss reasoning shares this budget; 300 could be fully consumed by
        # reasoning, leaving no room for the coaching paragraph.
        "max_tokens": 1500,
        **reasoning_params(model, settings.groq_reasoning_effort),
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GROQ_CHAT_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        )

    if resp.is_error:
        return "Unable to generate feedback at this time. Please try again later."

    try:
        return extract_message_content(resp.json())
    except RuntimeError:
        return "Unable to generate feedback at this time. Please try again later."
