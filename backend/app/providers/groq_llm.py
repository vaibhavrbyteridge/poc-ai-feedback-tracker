import json
import re

import httpx
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

from app.config import get_settings
from app.domain.models import Message
from app.utils.llm_output import strip_reasoning_content

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _http_error_detail(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict):
                return str(err.get("message", err))
            if isinstance(err, str):
                return err
    except Exception:
        pass
    return (resp.text or "").strip()[:500] or resp.reason_phrase


class GroqLLM:
    """Customer + copilot LLM via Groq OpenAI-compatible chat completions."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.groq_api_key.strip()
        self._model = settings.groq_model
        self._jinja = Environment(
            loader=FileSystemLoader(str(PROMPTS_DIR)),
            autoescape=False,
        )

    async def _chat(
        self,
        messages: list[dict],
        *,
        temperature: float,
        max_tokens: int,
        json_mode: bool = False,
    ) -> str:
        body: dict = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        if resp.is_error:
            raise RuntimeError(
                f"Groq chat failed ({resp.status_code}): {_http_error_detail(resp)}"
            )
        data = resp.json()
        content = (data["choices"][0]["message"]["content"] or "").strip()
        return strip_reasoning_content(content)

    def _to_chat_messages(self, messages: list[Message]) -> list[dict]:
        out: list[dict] = []
        for m in messages:
            role = "user" if m.role == "user" else "assistant"
            out.append({"role": role, "content": m.content})
        return out

    async def customer_response(
        self,
        messages: list[Message],
        system_prompt: str,
        rag_context: str | None,
    ) -> str:
        prompt = system_prompt
        if rag_context:
            prompt += (
                "\n\n## Account context (stay in character; do not read aloud)\n"
                f"{rag_context}"
            )

        chat_messages: list[dict] = [{"role": "system", "content": prompt}]
        chat_messages.extend(self._to_chat_messages(messages))
        if len(chat_messages) == 1:
            chat_messages.append(
                {
                    "role": "user",
                    "content": "The collector is on the line.",
                }
            )

        return await self._chat(
            chat_messages,
            temperature=0.9,
            max_tokens=256,
        )

    async def collector_suggestions(
        self,
        messages: list[Message],
        collector_utterance: str,
        customer_utterance: str,
        rag_context: str | None,
        company_name: str,
        corrections: list[dict] | None = None,
    ) -> dict:
        template = self._jinja.get_template("copilot_system.j2")
        system_prompt = template.render(company_name=company_name)

        # Inject past corrections as few-shot examples
        if corrections:
            corrections_block = "\n\n## Past classification corrections for this customer (learn from these):\n"
            for c in corrections:
                corrections_block += (
                    f'- Customer said: "{c["customer_text"][:100]}"\n'
                    f'  AI classified: {c["ai_classification"]} → Collector corrected to: {c["collector_correction"]}\n'
                )
            corrections_block += "\nAdjust your classification based on these corrections.\n"
            system_prompt += corrections_block

        user_block = f"""Recent exchange:
Collector: {collector_utterance}
Customer: {customer_utterance}

"""
        if rag_context:
            user_block += f"Customer account context:\n{rag_context}\n\n"
        user_block += (
            'Respond with JSON only: {"current_phase": "intro|probe|negotiate|close", '
            '"phases_completed": [...], "next_step": "...", "alerts": [...], '
            '"compliance_disclosed": bool, "identity_verified": bool, '
            '"classification": "...", "confidence": 0.0-1.0, '
            '"reasoning": "...", "suggestions": [{"text": "...", "tone": "empathetic|firm|neutral"}, ...]} '
            "(detect phase, classify customer statement, and provide max 3 suggestions)."
        )

        raw = await self._chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_block},
            ],
            temperature=0.7,
            max_tokens=700,
            json_mode=True,
        )

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                data = {}

        # Extract classification
        valid_categories = {
            "financial_hardship", "intentional_delay", "dispute", "confusion", "cooperative"
        }
        classification = data.get("classification", "confusion")
        if classification not in valid_categories:
            classification = "confusion"
        confidence = data.get("confidence", 0.5)
        if not isinstance(confidence, (int, float)):
            confidence = 0.5
        confidence = max(0.0, min(1.0, float(confidence)))
        reasoning = data.get("reasoning", "")

        # Extract phase detection
        valid_phases = {"intro", "probe", "negotiate", "close"}
        current_phase = data.get("current_phase", "intro")
        if current_phase not in valid_phases:
            current_phase = "intro"
        phases_completed = data.get("phases_completed", [])
        if not isinstance(phases_completed, list):
            phases_completed = []
        phases_completed = [p for p in phases_completed if p in valid_phases]
        next_step = data.get("next_step", "")
        alerts = data.get("alerts", [])
        if not isinstance(alerts, list):
            alerts = []
        compliance_disclosed = bool(data.get("compliance_disclosed", False))
        identity_verified = bool(data.get("identity_verified", False))

        # Extract suggestions
        suggestions_raw = data.get("suggestions", [])
        normalized: list[dict] = []
        for s in suggestions_raw:
            if isinstance(s, dict) and "text" in s:
                tone = s.get("tone", "neutral")
                if tone not in ("empathetic", "firm", "neutral"):
                    tone = "neutral"
                normalized.append({"text": s["text"], "tone": tone})
            elif isinstance(s, str) and s.strip():
                normalized.append({"text": s, "tone": "neutral"})

        return {
            "classification": classification,
            "confidence": confidence,
            "reasoning": reasoning,
            "suggestions": normalized[:3],
            "current_phase": current_phase,
            "phases_completed": phases_completed,
            "next_step": next_step,
            "alerts": alerts,
            "compliance_disclosed": compliance_disclosed,
            "identity_verified": identity_verified,
        }
