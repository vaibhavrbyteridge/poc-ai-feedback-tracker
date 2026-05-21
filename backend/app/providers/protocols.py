from dataclasses import dataclass
from typing import Protocol

from app.domain.models import Message


@dataclass
class VoiceConfig:
    tts_voice_name: str = "en-US-GuyNeural"


class UtteranceSTT(Protocol):
    async def transcribe_utterance(self, audio: bytes, mime_type: str) -> str: ...


class CustomerLLM(Protocol):
    async def customer_response(
        self,
        messages: list[Message],
        system_prompt: str,
        rag_context: str | None,
    ) -> str: ...


class CopilotLLM(Protocol):
    async def collector_suggestions(
        self,
        messages: list[Message],
        collector_utterance: str,
        customer_utterance: str,
        rag_context: str | None,
        company_name: str,
    ) -> list[str]: ...


class UtteranceTTS(Protocol):
    async def synthesize(self, text: str, voice_config: VoiceConfig) -> bytes: ...
