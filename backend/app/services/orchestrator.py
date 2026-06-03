import asyncio
import base64

from app.db import save_turn, get_classification_corrections
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

        customer_audio, copilot_result = await asyncio.gather(
            self._tts.synthesize(customer_text, voice_config),
            self._copilot_llm.collector_suggestions(
                messages=messages,
                collector_utterance=collector_transcript,
                customer_utterance=customer_text,
                rag_context=rag_context,
                company_name=session.company_name,
                corrections=get_classification_corrections(session.customer_id),
            ),
        )

        suggestions = copilot_result.get("suggestions", [])
        classification = copilot_result.get("classification", "")
        confidence = copilot_result.get("confidence", 0.0)
        reasoning = copilot_result.get("reasoning", "")
        current_phase = copilot_result.get("current_phase", "intro")
        phases_completed = copilot_result.get("phases_completed", [])
        next_step = copilot_result.get("next_step", "")
        alerts = copilot_result.get("alerts", [])
        compliance_disclosed = copilot_result.get("compliance_disclosed", False)
        identity_verified = copilot_result.get("identity_verified", False)

        turn = Turn(
            collector_transcript=collector_transcript,
            customer_text=customer_text,
            suggestions=suggestions,
            classification=classification,
            confidence=confidence,
            reasoning=reasoning,
        )
        session.messages = messages
        session.turns.append(turn)
        session_store.update(session)

        # Persist turn to SQLite
        save_turn(
            session_id=session_id,
            turn_number=len(session.turns),
            collector_transcript=collector_transcript,
            customer_text=customer_text,
            suggestions=suggestions,
            classification=classification,
            confidence=confidence,
            reasoning=reasoning,
        )

        audio_mime = (
            "audio/wav"
            if len(customer_audio) >= 4 and customer_audio[:4] == b"RIFF"
            else "audio/mpeg"
        )

        return {
            "collector_transcript": collector_transcript,
            "customer_text": customer_text,
            "customer_audio_base64": base64.b64encode(customer_audio).decode("ascii"),
            "customer_audio_mime": audio_mime,
            "suggestions": suggestions,
            "classification": classification,
            "confidence": confidence,
            "reasoning": reasoning,
            "current_phase": current_phase,
            "phases_completed": phases_completed,
            "next_step": next_step,
            "alerts": alerts,
            "compliance_disclosed": compliance_disclosed,
            "identity_verified": identity_verified,
        }


orchestrator = Orchestrator()
