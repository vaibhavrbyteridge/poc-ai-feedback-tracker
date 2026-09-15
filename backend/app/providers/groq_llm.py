import json
import re

import httpx
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

from app.config import get_settings
from app.domain.models import Message
from app.utils.llm_output import reasoning_params as _reasoning_params
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
        self._reasoning_effort = settings.groq_reasoning_effort
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
        # gpt-oss reasoning models emit chain-of-thought in a separate `reasoning`
        # field. Exclude it so the response stays fast and the `content` field holds
        # only the final answer. `reasoning_effort` tunes latency vs. quality.
        body.update(_reasoning_params(self._model, self._reasoning_effort))
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

        user_block = f"""Recent exchange:
Collector: {collector_utterance}
Customer: {customer_utterance}

"""
        if rag_context:
            user_block += f"Customer account context:\n{rag_context}\n\n"
        user_block += (
            'Respond with JSON only: {"suggestions": [{"text": "...", "tone": "empathetic|firm|neutral"}, ...]} '
            "(provide max 3 suggestions)."
        )

        raw = await self._chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_block},
            ],
            temperature=0.7,
            max_tokens=350,
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

        return {"suggestions": normalized[:3]}
