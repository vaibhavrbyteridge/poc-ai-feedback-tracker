import json

from fastapi import APIRouter, HTTPException

from app.db import save_session, get_session_log, list_sessions as db_list_sessions, get_customer_sessions, save_classification_override
from app.domain.models import Session, SessionCreate, SessionResponse
from app.domain.session_store import session_store
from app.paths import data_dir
from app.services.personality_loader import personality_loader

router = APIRouter(prefix="/api", tags=["sessions"])

DATA_PATH = data_dir() / "debt_data_sample.json"


def _load_customers() -> dict:
    """Load customers from debt_data_sample.json (array format) and return
    a dict keyed by accountNumber for easy lookup."""
    with open(DATA_PATH, encoding="utf-8") as f:
        customers_list = json.load(f)
    return {
        c["accountInfo"]["accountNumber"]: c
        for c in customers_list
    }


@router.get("/customers")
async def list_customers():
    customers = _load_customers()
    return [
        {"id": cid, "name": c["basicInfo"]["fullName"]}
        for cid, c in customers.items()
    ]


@router.get("/customers/details")
async def list_customers_details():
    """Return full customer data for the UI list/detail views."""
    customers = _load_customers()
    return list(customers.values())


@router.get("/personalities")
async def list_personalities():
    return [{"id": pid} for pid in personality_loader.list_personalities()]


@router.post("/sessions", response_model=SessionResponse)
async def create_session(body: SessionCreate):
    customers = _load_customers()
    if body.customer_id not in customers:
        raise HTTPException(status_code=400, detail="Unknown customer_id")
    if body.personality_id not in personality_loader.list_personalities():
        raise HTTPException(status_code=400, detail="Unknown personality_id")

    session_id = session_store.new_id()
    session = Session(
        session_id=session_id,
        customer_id=body.customer_id,
        customer_name=customers[body.customer_id]["basicInfo"]["fullName"],
        personality_id=body.personality_id,
        company_name=body.company_name,
    )
    session_store.create(session)
    save_session(
        session_id=session_id,
        customer_id=body.customer_id,
        customer_name=session.customer_name,
        personality_id=body.personality_id,
        company_name=body.company_name,
    )
    return SessionResponse(
        session_id=session_id,
        customer_id=body.customer_id,
        customer_name=session.customer_name,
        personality_id=body.personality_id,
        company_name=body.company_name,
    )


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/{session_id}/log")
async def get_session_log_endpoint(session_id: str):
    """Retrieve the full persisted conversation log for a session."""
    log = get_session_log(session_id)
    if not log:
        raise HTTPException(status_code=404, detail="Session log not found")
    return log


@router.get("/logs")
async def list_all_sessions():
    """List all persisted sessions with turn counts."""
    return db_list_sessions()


@router.get("/customers/{customer_id}/conversations")
async def get_customer_conversations(customer_id: str):
    """Get all previous conversations for a specific customer."""
    return get_customer_sessions(customer_id)


@router.get("/sessions/{session_id}/opening-suggestions")
async def get_opening_suggestions(session_id: str):
    """Generate opening suggestions for how to begin the call."""
    from app.providers.factory import get_copilot_llm
    from app.rag.factory import get_retriever
    from app.db import get_classification_corrections

    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    retriever = get_retriever()
    chunks = await retriever.retrieve(session.customer_id, "opening call")
    rag_context = "\n".join(c.text for c in chunks)

    corrections = get_classification_corrections(session.customer_id)

    copilot = get_copilot_llm()
    result = await copilot.collector_suggestions(
        messages=[],
        collector_utterance="",
        customer_utterance="(Call has not started yet — customer just picked up)",
        rag_context=rag_context,
        company_name=session.company_name,
        corrections=corrections,
    )
    return {
        "suggestions": result.get("suggestions", []),
        "classification": result.get("classification", ""),
        "confidence": result.get("confidence", 0.0),
        "reasoning": result.get("reasoning", ""),
        "current_phase": result.get("current_phase", "intro"),
        "phases_completed": result.get("phases_completed", []),
        "next_step": result.get("next_step", ""),
        "alerts": result.get("alerts", []),
        "compliance_disclosed": result.get("compliance_disclosed", False),
        "identity_verified": result.get("identity_verified", False),
    }


from pydantic import BaseModel as _BaseModel


class OverrideRequest(_BaseModel):
    turn_number: int
    classification: str


@router.post("/sessions/{session_id}/override-classification")
async def override_classification(session_id: str, body: OverrideRequest):
    """Allow collector to override the AI's classification for a turn."""
    valid_categories = {
        "financial_hardship", "intentional_delay", "dispute", "confusion", "cooperative"
    }
    if body.classification not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid classification. Must be one of: {', '.join(sorted(valid_categories))}"
        )

    updated = save_classification_override(
        session_id=session_id,
        turn_number=body.turn_number,
        collector_override=body.classification,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Turn not found")

    return {"message": "Classification overridden", "classification": body.classification}
