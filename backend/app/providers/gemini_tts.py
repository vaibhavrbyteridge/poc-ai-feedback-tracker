import base64

from google import genai
from google.genai import types

from app.config import get_settings
from app.providers.protocols import VoiceConfig


class GeminiUtteranceTTS:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = genai.Client(api_key=settings.gemini_api_key)

    async def synthesize(self, text: str, voice_config: VoiceConfig) -> bytes:
        response = await self._client.aio.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_config.tts_voice_name or "Charon",
                        )
                    )
                ),
            ),
        )

        if not response.candidates:
            return b""

        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                data = part.inline_data.data
                if isinstance(data, str):
                    return base64.b64decode(data)
                return data

        return b""
