import edge_tts

from app.providers.protocols import VoiceConfig

# AssemblyAI has no standalone utterance TTS API (only inside Voice Agent).
# Edge TTS is used so STT (AssemblyAI) + LLM (Groq) work without a third paid key.
_DEFAULT_VOICE = "en-US-GuyNeural"


class EdgeUtteranceTTS:
    async def synthesize(self, text: str, voice_config: VoiceConfig) -> bytes:
        voice = voice_config.tts_voice_name or _DEFAULT_VOICE
        communicate = edge_tts.Communicate(text, voice)
        chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        return b"".join(chunks)
