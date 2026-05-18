"""Run with: cd backend && PYTHONPATH=. python3 -m pytest tests/ -q"""
import asyncio
import base64

import pytest

from app.domain.models import Session
from app.domain.session_store import session_store
from app.services.orchestrator import Orchestrator


@pytest.fixture
def session_id():
    sid = session_store.new_id()
    session_store.create(
        Session(
            session_id=sid,
            customer_id="cust_001",
            customer_name="Marcus Chen",
            personality_id="defensive",
            company_name="Acme Collections",
        )
    )
    return sid


@pytest.mark.asyncio
async def test_mock_turn(session_id):
    orch = Orchestrator()
    # minimal webm-like blob
    audio = b"\x00" * 1000
    result = await orch.process_turn(session_id, audio, "audio/webm")
    assert result["collector_transcript"]
    assert result["customer_text"]
    assert result["suggestions"]
    assert len(result["suggestions"]) <= 3
    decoded = base64.b64decode(result["customer_audio_base64"])
    assert len(decoded) > 0
