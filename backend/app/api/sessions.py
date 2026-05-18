import json

from fastapi import APIRouter, HTTPException

from app.domain.models import Session, SessionCreate, SessionResponse
from app.domain.session_store import session_store
from app.paths import data_dir
from app.services.personality_loader import personality_loader

router = APIRouter(prefix="/api", tags=["sessions"])

DATA_PATH = data_dir() / "seed_customers.json"


def _load_customers() -> dict:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


@router.get("/customers")
async def list_customers():
    customers = _load_customers()
    return [
        {"id": cid, "name": c["name"]}
        for cid, c in customers.items()
    ]


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
        customer_name=customers[body.customer_id]["name"],
        personality_id=body.personality_id,
        company_name=body.company_name,
    )
    session_store.create(session)
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
