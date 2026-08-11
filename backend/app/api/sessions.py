import json

from fastapi import APIRouter, HTTPException

from app.domain.models import Session, SessionCreate, SessionResponse
from app.domain.session_store import session_store
from app.config import get_settings
from app.paths import data_dir
from app.services.personality_loader import personality_loader

router = APIRouter(prefix="/api", tags=["sessions"])

_settings = get_settings()
DATA_PATH = data_dir() / ("debt_data_sample_dummy.json" if _settings.use_dummy_data else "debt_data_sample.json")


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


@router.get("/sessions/{session_id}/opening-suggestions")
async def get_opening_suggestions(session_id: str):
    """Generate opening suggestions for how to begin the call."""
    from app.providers.factory import get_copilot_llm
    from app.rag.factory import get_retriever

    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    retriever = get_retriever()
    chunks = await retriever.retrieve(session.customer_id, "opening call")
    rag_context = "\n".join(c.text for c in chunks)

    copilot = get_copilot_llm()
    result = await copilot.collector_suggestions(
        messages=[],
        collector_utterance="",
        customer_utterance="(Call has not started yet — customer just picked up)",
        rag_context=rag_context,
        company_name=session.company_name,
    )
    return {"suggestions": result.get("suggestions", [])}


# ─── Phone Number Update (writes back to JSON) ──────────────────────────

from pydantic import BaseModel as _BaseModel
from typing import List


class PhoneNumberUpdate(_BaseModel):
    phone: str
    contact_name: str
    email: str = ""
    type: str
    status: str
    timezone: str
    do_not_call: bool = False
    do_not_text: bool = False
    do_not_email: bool = False


@router.put("/customers/{customer_id}/phone-numbers")
async def update_phone_numbers(customer_id: str, body: List[PhoneNumberUpdate]):
    """Update phone numbers for a customer — writes back to the JSON file."""
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        customers_list = json.load(f)

    found = False
    for customer in customers_list:
        if customer["accountInfo"]["accountNumber"] == customer_id:
            customer["phone_numbers"] = [pn.model_dump() for pn in body]
            # Sync main phone number's email/phone back to basicInfo
            main_pn = next((pn for pn in customer["phone_numbers"] if pn.get("is_main")), None)
            if main_pn:
                customer["basicInfo"]["cPhone"] = main_pn["phone"]
                if main_pn.get("email"):
                    customer["basicInfo"]["email"] = main_pn["email"]
                if main_pn.get("timezone"):
                    customer["basicInfo"]["timezone"] = main_pn["timezone"]
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Customer not found")

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(customers_list, f, indent=2, ensure_ascii=False)

    return {"message": "Phone numbers updated"}


class BankruptcyCaseUpdate(_BaseModel):
    caseNumber: str
    chapter: str
    petitionDate: str
    status: str
    dischargeDate: str = ""


@router.put("/customers/{customer_id}/bankruptcy-cases")
async def update_bankruptcy_cases(customer_id: str, body: List[BankruptcyCaseUpdate]):
    """Update bankruptcy cases for a customer — writes back to the JSON file."""
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        customers_list = json.load(f)

    found = False
    for customer in customers_list:
        if customer["accountInfo"]["accountNumber"] == customer_id:
            customer["bankruptcyCases"] = [bc.model_dump() for bc in body]
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Customer not found")

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(customers_list, f, indent=2, ensure_ascii=False)

    return {"message": "Bankruptcy cases updated"}


@router.put("/customers/{customer_id}/info")
async def update_customer_info(customer_id: str, body: dict):
    """Update customer basic info, account info, or loan details — writes back to JSON."""
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        customers_list = json.load(f)

    found = False
    for customer in customers_list:
        if customer["accountInfo"]["accountNumber"] == customer_id:
            # Merge updates into existing data
            if "basicInfo" in body:
                customer["basicInfo"].update(body["basicInfo"])
                # Sync email/phone to the main phone_numbers entry
                phone_numbers = customer.get("phone_numbers", [])
                main_pn = next((pn for pn in phone_numbers if pn.get("is_main")), None)
                if main_pn:
                    if "email" in body["basicInfo"]:
                        main_pn["email"] = body["basicInfo"]["email"]
                    if "cPhone" in body["basicInfo"]:
                        main_pn["phone"] = str(body["basicInfo"]["cPhone"])
                    if "timezone" in body["basicInfo"]:
                        main_pn["timezone"] = body["basicInfo"]["timezone"]
            if "accountInfo" in body:
                for key, val in body["accountInfo"].items():
                    if key == "loanDetails":
                        customer["accountInfo"]["loanDetails"].update(val)
                    elif key == "paymentPlan":
                        customer["accountInfo"]["paymentPlan"].update(val)
                    else:
                        customer["accountInfo"][key] = val
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Customer not found")

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(customers_list, f, indent=2, ensure_ascii=False)

    return {"message": "Customer info updated"}
