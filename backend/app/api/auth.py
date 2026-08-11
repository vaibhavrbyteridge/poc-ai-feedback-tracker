"""Authentication and user management API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.mysql_db import (
    authenticate_user,
    list_agents,
    get_agent,
    create_agent,
    update_agent,
    delete_agent,
    save_call_session,
    get_user_call_sessions,
    get_call_session_turns,
    delete_call_session,
)

router = APIRouter(prefix="/api", tags=["auth"])


# ─── Auth ───────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
        "email": user["email"],
    }


# ─── Agent CRUD (admin) ─────────────────────────────────────────────────

@router.get("/agents")
async def list_all_agents():
    return list_agents()


class CreateAgentRequest(BaseModel):
    username: str
    password: str = "1234"
    full_name: str
    email: str = ""


@router.post("/agents")
async def create_new_agent(body: CreateAgentRequest):
    try:
        agent = create_agent(body.username, body.password, body.full_name, body.email)
        return agent
    except Exception as e:
        if "Duplicate" in str(e):
            raise HTTPException(status_code=400, detail="Username already exists")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateAgentRequest(BaseModel):
    full_name: str
    email: str = ""
    is_active: bool = True


@router.put("/agents/{agent_id}")
async def update_existing_agent(agent_id: int, body: UpdateAgentRequest):
    updated = update_agent(agent_id, body.full_name, body.email, body.is_active)
    if not updated:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent updated"}


@router.delete("/agents/{agent_id}")
async def delete_existing_agent(agent_id: int):
    deleted = delete_agent(agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent deleted"}


# ─── Call History ────────────────────────────────────────────────────────

class SaveCallRequest(BaseModel):
    session_id: str
    user_id: int
    customer_id: str
    customer_name: str
    personality_id: str
    company_name: str = "Acme Collections"
    call_duration_seconds: int = 0
    dialed_phone: str = ""
    turns: list[dict]


@router.post("/call-history")
async def save_call(body: SaveCallRequest):
    save_call_session(
        session_id=body.session_id,
        user_id=body.user_id,
        customer_id=body.customer_id,
        customer_name=body.customer_name,
        personality_id=body.personality_id,
        company_name=body.company_name,
        turn_count=len(body.turns),
        turns=body.turns,
        call_duration_seconds=body.call_duration_seconds,
    )
    # Store dialed phone
    if body.dialed_phone:
        from app.mysql_db import _get_connection
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE call_sessions SET dialed_phone = %s WHERE session_id = %s", (body.dialed_phone, body.session_id))
        finally:
            conn.close()
    return {"message": "Call saved"}


@router.get("/call-history/{user_id}")
async def get_call_history(user_id: int):
    return get_user_call_sessions(user_id)


@router.get("/call-history/{user_id}/{session_id}/turns")
async def get_call_turns(user_id: int, session_id: str):
    turns = get_call_session_turns(session_id)
    if not turns:
        raise HTTPException(status_code=404, detail="Call not found")
    return turns


@router.delete("/call-history/{user_id}/{session_id}")
async def delete_call(user_id: int, session_id: str):
    deleted = delete_call_session(session_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "Call deleted"}


# ─── Call Scoring ────────────────────────────────────────────────────────

class ScoreCallRequest(BaseModel):
    session_id: str
    user_id: int
    turns: list[dict]
    dialed_phone: str = ""


@router.post("/score-call")
async def score_call_endpoint(body: ScoreCallRequest):
    """Score a call using AI and persist the result."""
    from app.services.call_scorer import score_call
    from app.mysql_db import save_call_score, get_agent_performance, save_comparison_result, get_pending_feedbacks

    result = await score_call(body.turns, dialed_phone=body.dialed_phone)

    # Calculate comparison vs overall agent average
    perf = get_agent_performance(body.user_id)
    comparison = {}
    if perf["total_calls_scored"] > 0:
        dimensions = ["compliance", "communication", "empathy", "negotiation", "objection_handling", "closure"]
        for dim in dimensions:
            call_pct = (result[dim]["score"] / result[dim]["max"]) * 100
            avg_pct = (perf[dim]["score"] / perf[dim]["max"]) * 100 if perf[dim]["max"] > 0 else 0
            diff = round(call_pct - avg_pct, 1)
            comparison[dim] = {"diff": diff, "direction": "up" if diff >= 0 else "down"}
    result["comparison"] = comparison

    # Check pending feedback goals
    pending = get_pending_feedbacks(body.user_id)
    if pending:
        from app.services.call_scorer import check_feedback_achievements
        achievements = await check_feedback_achievements(body.turns, pending)
        result["feedback_achievements"] = achievements
    else:
        result["feedback_achievements"] = []

    # Persist
    save_call_score(body.session_id, result)
    save_comparison_result(body.session_id, comparison)

    # Save action items
    from app.mysql_db import save_action_items, save_edit_flags
    action_items = result.get("action_items", [])
    if action_items:
        # Need customer_id and dialed_phone — fetch from session
        from app.mysql_db import _get_connection
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT customer_id, dialed_phone FROM call_sessions WHERE session_id = %s", (body.session_id,))
                row = cur.fetchone()
                customer_id = row["customer_id"] if row else ""
                dialed_phone = row["dialed_phone"] if row else ""
        finally:
            conn.close()
        save_action_items(body.session_id, body.user_id, customer_id, action_items)

        # Generate edit flags from action items
        flag_mapping = {
            "phone": "flag_phone", "cPhone": "flag_phone", "preferred_contact_number": "flag_phone", "main_phone": "flag_phone", "contact_number": "flag_phone",
            "email": "flag_email", "email_address": "flag_email",
            "address": "flag_address", "customer_address": "flag_address",
            "timezone": "flag_timezone",
            "language_preference": "flag_language_preference", "language": "flag_language_preference", "langCode": "flag_language_preference",
            "accountType": "flag_account_type", "account_type": "flag_account_type",
            "daysPastDue": "flag_days_past_due", "days_past_due": "flag_days_past_due",
            "status": "flag_status", "account_status": "flag_status",
            "totalLoanAmount": "flag_total_loan_amount", "total_loan_amount": "flag_total_loan_amount",
            "principalAmount": "flag_principal", "principal": "flag_principal",
            "interestAmount": "flag_interest", "interest": "flag_interest",
            "monthlyInstallment": "flag_monthly_payment", "monthly_payment": "flag_monthly_payment",
            "do_not_call": "flag_do_not_call",
            "do_not_text": "flag_do_not_text",
            "do_not_email": "flag_do_not_email",
            "disposition": "flag_disposition",
            "call_type": "flag_call_type",
            "cease_all_contact": "flag_cease_all_contact",
        }
        flags = {}
        suggested_values = {}
        flag_reasons = {}
        # Normalize field_name to canonical key for suggested_values lookup in frontend
        canonical_key_mapping = {
            "email_address": "email",
            "customer_address": "address",
            "account_status": "status",
            "account_type": "accountType",
            "days_past_due": "daysPastDue",
            "total_loan_amount": "totalLoanAmount",
            "monthly_payment": "monthlyInstallment",
            "language": "language_preference",
            "langCode": "language_preference",
        }
        for item in action_items:
            fn = item.get("field_name", "")
            flag_col = flag_mapping.get(fn)
            if flag_col:
                flags[flag_col] = True
                if item.get("field_value"):
                    canonical = canonical_key_mapping.get(fn, fn)
                    suggested_values[canonical] = item["field_value"]
                flag_reasons[fn] = item.get("action_text", "")
            # Also check action_text for keywords
            text_lower = item.get("action_text", "").lower()
            if "monthly payment" in text_lower and "flag_monthly_payment" not in flags:
                flags["flag_monthly_payment"] = True
                flag_reasons["monthly_payment"] = item.get("action_text", "")
            if "disposition" in text_lower and "flag_disposition" not in flags:
                flags["flag_disposition"] = True
                flag_reasons["disposition"] = item.get("action_text", "")
            if "do not call" in text_lower and "flag_do_not_call" not in flags:
                flags["flag_do_not_call"] = True
                flag_reasons["do_not_call"] = item.get("action_text", "")
            if "language" in text_lower and "flag_language_preference" not in flags:
                flags["flag_language_preference"] = True
                flag_reasons["language_preference"] = item.get("action_text", "")

        if flags:
            save_edit_flags(body.session_id, body.user_id, customer_id, dialed_phone, flags, suggested_values, flag_reasons)

    return result


@router.get("/call-score/{session_id}")
async def get_call_score_endpoint(session_id: str):
    """Get the stored scoring result for a call."""
    from app.mysql_db import get_call_score
    result = get_call_score(session_id)
    if not result:
        return {"scored": False}
    return {"scored": True, **result}


@router.delete("/call-score/{session_id}")
async def delete_call_score_endpoint(session_id: str):
    """Delete the stored scoring result for a call, plus clear edit flags and action items."""
    from app.mysql_db import delete_call_score, _get_connection
    deleted = delete_call_score(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Score not found")
    # Clear edit flags and action items for this session
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM call_edit_flags WHERE session_id = %s", (session_id,))
            cur.execute("DELETE FROM action_items WHERE session_id = %s", (session_id,))
    finally:
        conn.close()
    return {"message": "Score, flags, and action items deleted"}


@router.get("/agent-performance/{user_id}")
async def get_agent_performance_endpoint(user_id: int):
    """Get aggregate performance scores for an agent."""
    from app.mysql_db import get_agent_performance
    return get_agent_performance(user_id)


# ─── Feedback Goals ──────────────────────────────────────────────────────

@router.get("/feedbacks/{user_id}")
async def get_feedbacks(user_id: int):
    from app.mysql_db import get_agent_feedbacks
    return get_agent_feedbacks(user_id)


class CreateFeedbackRequest(BaseModel):
    user_id: int
    session_id: str | None = None
    feedback_text: str
    target_days: int = 30


@router.post("/feedbacks")
async def create_feedback_endpoint(body: CreateFeedbackRequest):
    from app.mysql_db import create_feedback
    return create_feedback(body.user_id, body.session_id, body.feedback_text, body.target_days)


class UpdateFeedbackRequest(BaseModel):
    status: str  # open, in_progress, completed


@router.put("/feedbacks/{feedback_id}")
async def update_feedback_endpoint(feedback_id: int, body: UpdateFeedbackRequest):
    from app.mysql_db import update_feedback_status
    if body.status not in ("open", "in_progress", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    updated = update_feedback_status(feedback_id, body.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"message": "Updated"}


class RejectFeedbackRequest(BaseModel):
    reason: str


@router.post("/feedbacks/{feedback_id}/reject")
async def reject_feedback_endpoint(feedback_id: int, body: RejectFeedbackRequest):
    from app.mysql_db import reject_feedback
    rejected = reject_feedback(feedback_id, body.reason)
    if not rejected:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"message": "Rejected"}


# ─── Weekly Performance Graph ────────────────────────────────────────────

@router.get("/weekly-performance/{user_id}")
async def get_weekly_performance_endpoint(user_id: int):
    from app.mysql_db import get_call_scores_timeline
    return get_call_scores_timeline(user_id)


# ─── AI Feedback ─────────────────────────────────────────────────────────

@router.get("/ai-feedback/{user_id}")
async def get_ai_feedback_endpoint(user_id: int):
    from app.mysql_db import get_ai_feedback
    result = get_ai_feedback(user_id)
    if not result:
        return {"feedback": None, "updated_at": None}
    return result


@router.post("/ai-feedback/{user_id}/generate")
async def generate_ai_feedback_endpoint(user_id: int):
    """Generate AI feedback based on agent's overall performance."""
    from app.mysql_db import get_agent_performance, save_ai_feedback, get_pending_feedbacks
    from app.services.call_scorer import generate_agent_feedback

    perf = get_agent_performance(user_id)
    pending = get_pending_feedbacks(user_id)
    feedback = await generate_agent_feedback(perf, pending)
    save_ai_feedback(user_id, feedback)
    return {"feedback": feedback}


# ─── Call Disposition ────────────────────────────────────────────────────

class DispositionRequest(BaseModel):
    disposition: str
    call_type: str = "Outbound"
    notes: str = ""


@router.put("/call-disposition/{session_id}")
async def save_disposition(session_id: str, body: DispositionRequest):
    from app.mysql_db import save_call_disposition
    updated = save_call_disposition(session_id, body.disposition, body.call_type, body.notes)
    if not updated:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "Disposition saved"}


@router.get("/call-disposition/{session_id}")
async def get_disposition(session_id: str):
    from app.mysql_db import get_call_disposition
    result = get_call_disposition(session_id)
    return result or {"disposition": None, "call_type": "Outbound", "notes": ""}


# ─── Action Items ────────────────────────────────────────────────────────

@router.get("/action-items/{session_id}")
async def get_action_items(session_id: str):
    from app.mysql_db import get_action_items_for_session
    return get_action_items_for_session(session_id)


@router.get("/action-items/customer/{user_id}/{customer_id}")
async def get_customer_action_items(user_id: int, customer_id: str):
    from app.mysql_db import get_pending_action_items_for_customer
    return get_pending_action_items_for_customer(user_id, customer_id)


@router.put("/action-items/{item_id}/complete")
async def complete_action_item_endpoint(item_id: int):
    from app.mysql_db import complete_action_item, clear_edit_flag, _get_connection
    import json as _json

    # Get the action item details before completing
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT session_id, field_name, field_category FROM action_items WHERE id = %s", (item_id,))
            item = cur.fetchone()
    finally:
        conn.close()

    completed = complete_action_item(item_id)
    if not completed:
        raise HTTPException(status_code=404, detail="Action item not found")

    # Auto-clear corresponding edit flag
    if item:
        flag_mapping = {
            "phone": "flag_phone", "cPhone": "flag_phone", "preferred_contact_number": "flag_phone", "main_phone": "flag_phone", "contact_number": "flag_phone",
            "email": "flag_email", "email_address": "flag_email",
            "address": "flag_address", "customer_address": "flag_address",
            "timezone": "flag_timezone",
            "language_preference": "flag_language_preference", "language": "flag_language_preference", "langCode": "flag_language_preference",
            "accountType": "flag_account_type", "account_type": "flag_account_type",
            "daysPastDue": "flag_days_past_due", "days_past_due": "flag_days_past_due",
            "status": "flag_status", "account_status": "flag_status",
            "totalLoanAmount": "flag_total_loan_amount", "total_loan_amount": "flag_total_loan_amount",
            "principalAmount": "flag_principal", "principal": "flag_principal",
            "interestAmount": "flag_interest", "interest": "flag_interest",
            "monthlyInstallment": "flag_monthly_payment", "monthly_payment": "flag_monthly_payment",
            "do_not_call": "flag_do_not_call",
            "do_not_text": "flag_do_not_text",
            "do_not_email": "flag_do_not_email",
            "disposition": "flag_disposition",
            "call_type": "flag_call_type",
            "cease_all_contact": "flag_cease_all_contact",
        }
        flag_col = flag_mapping.get(item["field_name"])
        if flag_col:
            clear_edit_flag(item["session_id"], flag_col)
        # Also clear by category if field_name didn't match
        elif item["field_category"] == "disposition":
            clear_edit_flag(item["session_id"], "flag_disposition")
        elif item["field_category"] == "phone_numbers":
            if "call" in (item["field_name"] or "").lower():
                clear_edit_flag(item["session_id"], "flag_do_not_call")
            elif "text" in (item["field_name"] or "").lower():
                clear_edit_flag(item["session_id"], "flag_do_not_text")
            elif "email" in (item["field_name"] or "").lower():
                clear_edit_flag(item["session_id"], "flag_do_not_email")

    return {"message": "Completed"}


# ─── Edit Flags ──────────────────────────────────────────────────────────

@router.get("/edit-flags/{user_id}/{customer_id}")
async def get_edit_flags(user_id: int, customer_id: str):
    from app.mysql_db import get_edit_flags_for_customer
    return get_edit_flags_for_customer(user_id, customer_id)


@router.put("/edit-flags/{session_id}/clear/{flag_name}")
async def clear_flag(session_id: str, flag_name: str):
    from app.mysql_db import clear_edit_flag
    cleared = clear_edit_flag(session_id, flag_name)
    if not cleared:
        raise HTTPException(status_code=404, detail="Flag not found")
    return {"message": "Flag cleared"}


# ─── Contact Preferences ────────────────────────────────────────────────

@router.get("/contact-preferences/{customer_id}")
async def get_prefs(customer_id: str):
    from app.mysql_db import get_contact_preferences
    result = get_contact_preferences(customer_id)
    if not result:
        return {"cease_all_calls": False, "cease_all_texts": False, "cease_all_emails": False, "cease_all_contact": False}
    return result


class ContactPrefsRequest(BaseModel):
    user_id: int
    session_id: str = ""
    cease_all_calls: bool = False
    cease_all_texts: bool = False
    cease_all_emails: bool = False
    cease_all_contact: bool = False
    reason: str = ""


@router.put("/contact-preferences/{customer_id}")
async def save_prefs(customer_id: str, body: ContactPrefsRequest):
    from app.mysql_db import save_contact_preferences
    save_contact_preferences(customer_id, body.user_id, body.session_id, body.cease_all_calls, body.cease_all_texts, body.cease_all_emails, body.cease_all_contact, body.reason)
    return {"message": "Preferences saved"}


# ─── Accept All Action Items ─────────────────────────────────────────────

class AcceptAllRequest(BaseModel):
    session_id: str
    user_id: int
    customer_id: str


@router.post("/action-items/accept-all")
async def accept_all_action_items(body: AcceptAllRequest):
    """Apply all pending action items automatically and mark them as done."""
    from app.mysql_db import _get_connection, complete_action_item, clear_edit_flag, save_contact_preferences
    from app.paths import data_dir
    from app.config import get_settings
    import json as _json

    settings = get_settings()
    data_path = data_dir() / ("debt_data_sample_dummy.json" if settings.use_dummy_data else "debt_data_sample.json")

    # Get all pending action items for this session
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, action_text, field_category, field_name, field_value FROM action_items "
                "WHERE session_id = %s AND status = 'pending'",
                (body.session_id,),
            )
            pending_items = cur.fetchall()

            # Get dialed phone
            cur.execute("SELECT dialed_phone FROM call_sessions WHERE session_id = %s", (body.session_id,))
            session_row = cur.fetchone()
            dialed_phone = session_row["dialed_phone"] if session_row else ""
    finally:
        conn.close()

    if not pending_items:
        return {"message": "No pending items", "applied": 0}

    # Load customer data from JSON
    with open(data_path, "r", encoding="utf-8") as f:
        customers_list = _json.load(f)

    customer = None
    for c in customers_list:
        if c["accountInfo"]["accountNumber"] == body.customer_id:
            customer = c
            break

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    applied = 0
    for item in pending_items:
        field_cat = item["field_category"]
        field_name = item["field_name"] or ""
        field_value = item["field_value"] or ""

        try:
            if field_cat == "phone_numbers":
                # Handle do_not_call, do_not_text, do_not_email
                pns = customer.get("phone_numbers", [])
                if "do_not_call" in field_name.lower() or "do_not_call" == field_name:
                    for pn in pns:
                        if pn["phone"] == dialed_phone:
                            pn["do_not_call"] = True
                elif "do_not_text" in field_name.lower() or "do_not_text" == field_name:
                    for pn in pns:
                        if pn["phone"] == dialed_phone:
                            pn["do_not_text"] = True
                elif "do_not_email" in field_name.lower() or "do_not_email" == field_name:
                    for pn in pns:
                        if pn["phone"] == dialed_phone:
                            pn["do_not_email"] = True
                elif "preferred" in field_name.lower() or "main" in field_name.lower() or "contact_number" in field_name.lower():
                    # Set a different number as main
                    for pn in pns:
                        pn["is_main"] = False
                    # Find the number mentioned in field_value
                    for pn in pns:
                        if field_value and any(part in pn["phone"] for part in field_value.split() if part.isdigit() and len(part) >= 4):
                            pn["is_main"] = True
                            break

            elif field_cat == "account_info":
                if field_name in ("email", "email_address") and field_value:
                    customer["basicInfo"]["email"] = field_value
                    # Also update the main phone number's email
                    pns = customer.get("phone_numbers", [])
                    for pn in pns:
                        if pn.get("is_main"):
                            pn["email"] = field_value
                            break
                elif field_name in ("language_preference", "language", "langCode") and field_value:
                    customer["basicInfo"]["language"] = field_value
                elif field_name in ("address", "customer_address") and field_value:
                    customer["basicInfo"]["address"] = field_value
                elif field_name in ("status", "account_status") and field_value:
                    customer["accountInfo"]["status"] = field_value
                elif field_name in ("daysPastDue", "days_past_due") and field_value:
                    customer["accountInfo"]["daysPastDue"] = int(field_value) if field_value.isdigit() else customer["accountInfo"]["daysPastDue"]

            elif field_cat == "loan_details":
                if field_name in ("monthlyInstallment", "monthly_payment") and field_value:
                    try:
                        customer["accountInfo"]["paymentPlan"]["monthlyInstallment"] = float(field_value.replace("$", "").replace(",", ""))
                    except ValueError:
                        pass
                elif field_name in ("totalLoanAmount", "total_loan_amount") and field_value:
                    try:
                        customer["accountInfo"]["loanDetails"]["totalLoanAmount"] = float(field_value.replace("$", "").replace(",", ""))
                    except ValueError:
                        pass

            elif field_cat == "disposition":
                if field_value:
                    conn2 = _get_connection()
                    try:
                        with conn2.cursor() as cur2:
                            cur2.execute(
                                "UPDATE call_sessions SET disposition = %s WHERE session_id = %s",
                                (field_value, body.session_id),
                            )
                    finally:
                        conn2.close()

            # Mark as completed and clear flag
            complete_action_item(item["id"])
            applied += 1

        except Exception:
            pass  # Skip items that fail to apply

    # Save updated customer data back to JSON
    with open(data_path, "w", encoding="utf-8") as f:
        _json.dump(customers_list, f, indent=2, ensure_ascii=False)

    # Clear all edit flags for this session
    conn3 = _get_connection()
    try:
        with conn3.cursor() as cur3:
            cur3.execute("DELETE FROM call_edit_flags WHERE session_id = %s", (body.session_id,))
    finally:
        conn3.close()

    return {"message": f"Applied {applied} action items", "applied": applied}
