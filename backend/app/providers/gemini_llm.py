import json
import re

from google import genai
from google.genai import types

from app.config import get_settings
from app.domain.models import Message
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


class GeminiLLM:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = "gemini-2.0-flash"
        self._jinja = Environment(
            loader=FileSystemLoader(str(PROMPTS_DIR)),
            autoescape=False,
        )

    def _history_to_contents(self, messages: list[Message]) -> list[types.Content]:
        contents = []
        for m in messages:
            role = "user" if m.role == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=m.content)],
                )
            )
        return contents

    async def customer_response(
        self,
        messages: list[Message],
        system_prompt: str,
        rag_context: str | None,
    ) -> str:
        prompt = system_prompt
        if rag_context:
            prompt += f"\n\n## Account context (stay in character; do not read aloud)\n{rag_context}"

        config = types.GenerateContentConfig(
            system_instruction=prompt,
            temperature=0.9,
            max_output_tokens=256,
        )
        contents = self._history_to_contents(messages)
        if not contents:
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text="The collector is on the line.")],
                )
            ]

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=contents,
            config=config,
        )
        return (response.text or "").strip()

    async def collector_suggestions(
        self,
        messages: list[Message],
        collector_utterance: str,
        customer_utterance: str,
        rag_context: str | None,
        company_name: str,
    ) -> list[str]:
        template = self._jinja.get_template("copilot_system.j2")
        system_prompt = template.render(company_name=company_name)

        user_block = f"""Recent exchange:
Collector: {collector_utterance}
Customer: {customer_utterance}

"""
        if rag_context:
            user_block += f"Customer account context:\n{rag_context}\n\n"
        user_block += (
            'Respond with JSON only: {"suggestions": ["...", "...", "..."]} '
            "(max 3 short lines the collector could say next)."
        )

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=512,
            response_mime_type="application/json",
        )

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=user_block)])],
            config=config,
        )
        raw = (response.text or "").strip()
        try:
            data = json.loads(raw)
            suggestions = data.get("suggestions", [])
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group())
                suggestions = data.get("suggestions", [])
            else:
                suggestions = [line.strip("- ") for line in raw.split("\n") if line.strip()][:3]

        return [s for s in suggestions if s][:3]
