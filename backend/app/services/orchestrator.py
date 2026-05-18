import asyncio
import base64

from app.domain.models import Message, Session, Turn
from app.domain.session_store import session_store
from app.providers.factory import get_copilot_llm, get_customer_llm, get_stt, get_tts
from app.rag.factory import get_retriever
from app.services.personality_loader import personality_loader


class Orchestrator:
    def __init__(self) -> None:
        self._stt = get_stt()
        self._customer_llm = get_customer_llm()
        self._copilot_llm = get_copilot_llm()
        self._tts = get_tts()
        self._retriever = get_retriever()

    async def process_turn(
        self, session_id: str, audio_bytes: bytes, mime_type: str
    ) -> dict:
        session = session_store.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        collector_transcript = await self._stt.transcribe_utterance(
            audio_bytes, mime_type
        )

        chunks = await self._retriever.retrieve(
            session.customer_id, collector_transcript
        )
        rag_context = "\n".join(c.text for c in chunks)

        system_prompt, voice_config = personality_loader.render(
            session.personality_id
        )

        messages = list(session.messages)
        messages.append(Message(role="user", content=collector_transcript))

        customer_text = await self._customer_llm.customer_response(
            messages=messages,
            system_prompt=system_prompt,
            rag_context=rag_context,
        )

        messages.append(Message(role="assistant", content=customer_text))

        customer_audio, suggestions = await asyncio.gather(
            self._tts.synthesize(customer_text, voice_config),
            self._copilot_llm.collector_suggestions(
                messages=messages,
                collector_utterance=collector_transcript,
                customer_utterance=customer_text,
                rag_context=rag_context,
                company_name=session.company_name,
            ),
        )

        turn = Turn(
            collector_transcript=collector_transcript,
            customer_text=customer_text,
            suggestions=suggestions,
        )
        session.messages = messages
        session.turns.append(turn)
        session_store.update(session)

        return {
            "collector_transcript": collector_transcript,
            "customer_text": customer_text,
            "customer_audio_base64": base64.b64encode(customer_audio).decode("ascii"),
            "customer_audio_mime": "audio/wav",
            "suggestions": suggestions,
        }


orchestrator = Orchestrator()
