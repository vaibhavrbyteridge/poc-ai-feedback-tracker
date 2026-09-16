"""MySQL database operations for call persistence, scoring, and performance.

Single-collector POC: no authentication or agent-management operations live
here. The ``user_id`` columns simply scope records to the one hardcoded
collector (see app.collector).
"""

import json
import pymysql
from datetime import datetime, timezone

from app.config import get_settings


def _get_connection() -> pymysql.Connection:
    settings = get_settings()
    return pymysql.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=settings.mysql_database,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


# ─── Call Sessions ───────────────────────────────────────────────────────

def save_call_session(
    session_id: str,
    user_id: int,
    customer_id: str,
    customer_name: str,
    personality_id: str,
    company_name: str,
    turn_count: int,
    turns: list[dict],
    call_duration_seconds: int = 0,
) -> None:
    """Save a completed call session with all its turns."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO call_sessions "
                "(session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count, call_duration_seconds) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count, call_duration_seconds),
            )
            for i, turn in enumerate(turns, 1):
                cur.execute(
                    "INSERT INTO call_turns "
                    "(session_id, turn_number, collector_transcript, customer_text, suggestions) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (
                        session_id,
                        i,
                        turn.get("collector", ""),
                        turn.get("customer", ""),
                        json.dumps(turn.get("suggestions", [])),
                    ),
                )
    finally:
        conn.close()


def get_user_call_sessions(user_id: int) -> list[dict]:
    """Get all call sessions for a user."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, session_id, customer_id, customer_name, personality_id, "
                "company_name, turn_count, ai_score, dialed_phone, created_at "
                "FROM call_sessions WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def get_call_session_turns(session_id: str) -> list[dict]:
    """Get all turns for a specific call session."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT turn_number, collector_transcript, customer_text, suggestions "
                "FROM call_turns WHERE session_id = %s ORDER BY turn_number",
                (session_id,),
            )
            rows = cur.fetchall()
            return [
                {
                    "turn_number": r["turn_number"],
                    "collector": r["collector_transcript"],
                    "customer": r["customer_text"],
                    "suggestions": json.loads(r["suggestions"]) if r["suggestions"] else [],
                }
                for r in rows
            ]
    finally:
        conn.close()


def delete_call_session(session_id: str, user_id: int) -> bool:
    """Delete a call session (only if owned by the user)."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM call_sessions WHERE session_id = %s AND user_id = %s",
                (session_id, user_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


def save_call_score(session_id: str, scoring_result: dict) -> None:
    """Save AI scoring result for a call session."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE call_sessions SET ai_score = %s, scoring_result = %s WHERE session_id = %s",
                (scoring_result.get("overall_score", 0), json.dumps(scoring_result), session_id),
            )
    finally:
        conn.close()


def get_call_score(session_id: str) -> dict | None:
    """Get the scoring result for a call session."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT scoring_result FROM call_sessions WHERE session_id = %s",
                (session_id,),
            )
            row = cur.fetchone()
            if row and row["scoring_result"]:
                return json.loads(row["scoring_result"]) if isinstance(row["scoring_result"], str) else row["scoring_result"]
            return None
    finally:
        conn.close()


def delete_call_score(session_id: str) -> bool:
    """Delete the scoring result for a call session (reset ai_score and scoring_result)."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE call_sessions SET ai_score = NULL, scoring_result = NULL WHERE session_id = %s",
                (session_id,),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


def get_agent_performance(user_id: int) -> dict:
    """Calculate aggregate performance scores across all scored calls for an agent."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT scoring_result FROM call_sessions "
                "WHERE user_id = %s AND scoring_result IS NOT NULL",
                (user_id,),
            )
            rows = cur.fetchall()

        if not rows:
            return {
                "total_calls_scored": 0,
                "overall_score": 0,
                "compliance": {"score": 0, "max": 25},
                "communication": {"score": 0, "max": 20},
                "empathy": {"score": 0, "max": 15},
                "negotiation": {"score": 0, "max": 20},
                "objection_handling": {"score": 0, "max": 10},
                "closure": {"score": 0, "max": 10},
            }

        dimensions = ["compliance", "communication", "empathy", "negotiation", "objection_handling", "closure"]
        max_scores = {"compliance": 25, "communication": 20, "empathy": 15, "negotiation": 20, "objection_handling": 10, "closure": 10}
        totals = {d: 0.0 for d in dimensions}
        overall_total = 0.0
        count = len(rows)

        for row in rows:
            data = json.loads(row["scoring_result"]) if isinstance(row["scoring_result"], str) else row["scoring_result"]
            overall_total += data.get("overall_score", 0)
            for dim in dimensions:
                if isinstance(data.get(dim), dict):
                    totals[dim] += data[dim].get("score", 0)

        result = {
            "total_calls_scored": count,
            "overall_score": round(overall_total / count, 1),
        }
        for dim in dimensions:
            result[dim] = {"score": round(totals[dim] / count, 1), "max": max_scores[dim]}

        return result
    finally:
        conn.close()


# ─── Feedback Goals ──────────────────────────────────────────────────────

def create_feedback(user_id: int, session_id: str | None, feedback_text: str, target_days: int = 30) -> dict:
    """Create a feedback goal for an agent."""
    from datetime import timedelta
    conn = _get_connection()
    try:
        target_date = (datetime.now(timezone.utc) + timedelta(days=target_days)).date()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO agent_feedback (user_id, session_id, feedback_text, target_date, accepted) "
                "VALUES (%s, %s, %s, %s, TRUE)",
                (user_id, session_id, feedback_text, target_date),
            )
            return {"id": cur.lastrowid, "feedback_text": feedback_text, "status": "open", "target_date": str(target_date)}
    finally:
        conn.close()


def get_agent_feedbacks(user_id: int) -> list[dict]:
    """Get all feedback goals for an agent."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, session_id, feedback_text, status, target_date, accepted, rejected_reason, created_at, completed_at "
                "FROM agent_feedback WHERE user_id = %s ORDER BY FIELD(status, 'open', 'in_progress', 'completed'), created_at DESC",
                (user_id,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def get_pending_feedbacks(user_id: int) -> list[dict]:
    """Get open/in_progress feedback goals — used by AI to check achievements."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, feedback_text, status FROM agent_feedback "
                "WHERE user_id = %s AND status IN ('open', 'in_progress') AND accepted = TRUE",
                (user_id,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def update_feedback_status(feedback_id: int, status: str) -> bool:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            completed_at = datetime.now(timezone.utc).isoformat() if status == "completed" else None
            cur.execute(
                "UPDATE agent_feedback SET status = %s, completed_at = %s WHERE id = %s",
                (status, completed_at, feedback_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


def reject_feedback(feedback_id: int, reason: str) -> bool:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE agent_feedback SET accepted = FALSE, rejected_reason = %s WHERE id = %s",
                (reason, feedback_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


def save_comparison_result(session_id: str, comparison: dict) -> None:
    """Save the comparison of call score vs overall agent average."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE call_sessions SET comparison_result = %s WHERE session_id = %s",
                (json.dumps(comparison), session_id),
            )
    finally:
        conn.close()


# ─── Weekly Performance Graph ────────────────────────────────────────────

def get_weekly_performance(user_id: int) -> list[dict]:
    """Get call scores grouped by week for the graph."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT 
                    YEARWEEK(created_at, 1) as week_num,
                    MIN(DATE(created_at)) as week_start,
                    AVG(ai_score) as avg_score,
                    COUNT(*) as call_count,
                    SUM(call_duration_seconds) as total_duration
                FROM call_sessions 
                WHERE user_id = %s AND ai_score IS NOT NULL
                GROUP BY YEARWEEK(created_at, 1)
                ORDER BY week_num DESC
                LIMIT 8""",
                (user_id,),
            )
            rows = cur.fetchall()
            return [
                {
                    "week_start": str(r["week_start"]),
                    "avg_score": round(float(r["avg_score"]), 1) if r["avg_score"] else 0,
                    "call_count": r["call_count"],
                    "total_duration": r["total_duration"] or 0,
                }
                for r in reversed(rows)
            ]
    finally:
        conn.close()


# ─── AI Feedback ─────────────────────────────────────────────────────────

def save_ai_feedback(user_id: int, feedback: str) -> None:
    """Save AI-generated overall feedback for an agent."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET ai_feedback = %s, ai_feedback_updated_at = NOW() WHERE id = %s",
                (feedback, user_id),
            )
    finally:
        conn.close()


def get_ai_feedback(user_id: int) -> dict | None:
    """Get stored AI feedback for an agent."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT ai_feedback, ai_feedback_updated_at FROM users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if row and row["ai_feedback"]:
                return {"feedback": row["ai_feedback"], "updated_at": str(row["ai_feedback_updated_at"])}
            return None
    finally:
        conn.close()


def get_call_scores_timeline(user_id: int) -> list[dict]:
    """Get individual call scores in chronological order for the line graph."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT session_id, customer_name, ai_score, created_at
                FROM call_sessions 
                WHERE user_id = %s AND ai_score IS NOT NULL
                ORDER BY created_at ASC
                LIMIT 20""",
                (user_id,),
            )
            rows = cur.fetchall()
            return [
                {
                    "session_id": r["session_id"],
                    "customer_name": r["customer_name"],
                    "score": float(r["ai_score"]),
                    "date": str(r["created_at"]),
                }
                for r in rows
            ]
    finally:
        conn.close()


# ─── Call Disposition ────────────────────────────────────────────────────

def save_call_disposition(session_id: str, disposition: str, call_type: str, notes: str) -> bool:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE call_sessions SET disposition = %s, call_type = %s, disposition_notes = %s WHERE session_id = %s",
                (disposition, call_type, notes, session_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


def get_call_disposition(session_id: str) -> dict | None:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT disposition, call_type, disposition_notes FROM call_sessions WHERE session_id = %s",
                (session_id,),
            )
            row = cur.fetchone()
            if row and row["disposition"]:
                return {"disposition": row["disposition"], "call_type": row["call_type"], "notes": row["disposition_notes"] or ""}
            return None
    finally:
        conn.close()


# ─── Action Items ────────────────────────────────────────────────────────

def save_action_items(session_id: str, user_id: int, customer_id: str, items: list[dict]) -> None:
    """Save AI-generated action items for a call."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            # Remove old pending items for this session
            cur.execute("DELETE FROM action_items WHERE session_id = %s AND status = 'pending'", (session_id,))
            for item in items:
                cur.execute(
                    "INSERT INTO action_items (session_id, user_id, customer_id, action_text, field_category, field_name, field_value) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (session_id, user_id, customer_id, item.get("action_text", ""), item.get("field_category", ""), item.get("field_name", ""), item.get("field_value", "")),
                )
    finally:
        conn.close()


def get_action_items_for_session(session_id: str) -> list[dict]:
    """Get action items for a specific call session."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, action_text, field_category, field_name, field_value, status, created_at, completed_at "
                "FROM action_items WHERE session_id = %s ORDER BY status ASC, created_at DESC",
                (session_id,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def get_pending_action_items_for_customer(user_id: int, customer_id: str) -> list[dict]:
    """Get all pending action items for a customer (shown as ❗ in UI)."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, action_text, field_category, field_name, field_value, session_id "
                "FROM action_items WHERE user_id = %s AND customer_id = %s AND status = 'pending' "
                "ORDER BY created_at DESC",
                (user_id, customer_id),
            )
            return cur.fetchall()
    finally:
        conn.close()


def complete_action_item(item_id: int) -> bool:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE action_items SET status = 'completed', completed_at = NOW() WHERE id = %s",
                (item_id,),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


# ─── Call Edit Flags ─────────────────────────────────────────────────────

def save_edit_flags(session_id: str, user_id: int, customer_id: str, dialed_phone: str, flags: dict, suggested_values: dict, flag_reasons: dict) -> None:
    """Save or update edit flags for a call session."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM call_edit_flags WHERE session_id = %s", (session_id,))
            exists = cur.fetchone()
            if exists:
                set_parts = []
                params = []
                for col, val in flags.items():
                    set_parts.append(f"{col} = %s")
                    params.append(val)
                set_parts.append("suggested_values = %s")
                params.append(json.dumps(suggested_values))
                set_parts.append("flag_reasons = %s")
                params.append(json.dumps(flag_reasons))
                set_parts.append("dialed_phone = %s")
                params.append(dialed_phone)
                params.append(session_id)
                cur.execute(f"UPDATE call_edit_flags SET {', '.join(set_parts)} WHERE session_id = %s", params)
            else:
                cols = ["session_id", "user_id", "customer_id", "dialed_phone"]
                vals = [session_id, user_id, customer_id, dialed_phone]
                for col, val in flags.items():
                    cols.append(col)
                    vals.append(val)
                cols.extend(["suggested_values", "flag_reasons"])
                vals.extend([json.dumps(suggested_values), json.dumps(flag_reasons)])
                placeholders = ", ".join(["%s"] * len(vals))
                cur.execute(f"INSERT INTO call_edit_flags ({', '.join(cols)}) VALUES ({placeholders})", vals)
    finally:
        conn.close()


def get_edit_flags_for_customer(user_id: int, customer_id: str) -> list[dict]:
    """Get all pending edit flags for a customer (any flag = TRUE)."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM call_edit_flags WHERE user_id = %s AND customer_id = %s "
                "AND (flag_phone OR flag_email OR flag_address OR flag_timezone OR flag_account_type OR "
                "flag_days_past_due OR flag_status OR flag_total_loan_amount OR flag_principal OR "
                "flag_interest OR flag_monthly_payment OR flag_do_not_call OR flag_do_not_text OR "
                "flag_do_not_email OR flag_disposition OR flag_call_type OR flag_cease_all_contact OR flag_language_preference)",
                (user_id, customer_id),
            )
            rows = cur.fetchall()
            for row in rows:
                if isinstance(row.get("suggested_values"), str):
                    row["suggested_values"] = json.loads(row["suggested_values"])
                if isinstance(row.get("flag_reasons"), str):
                    row["flag_reasons"] = json.loads(row["flag_reasons"])
            return rows
    finally:
        conn.close()


def clear_edit_flag(session_id: str, flag_name: str) -> bool:
    """Set a specific flag to FALSE after agent completes the action."""
    valid_flags = {
        "flag_phone", "flag_email", "flag_address", "flag_timezone",
        "flag_account_type", "flag_days_past_due", "flag_status",
        "flag_total_loan_amount", "flag_principal", "flag_interest",
        "flag_monthly_payment", "flag_do_not_call", "flag_do_not_text",
        "flag_do_not_email", "flag_disposition", "flag_call_type", "flag_cease_all_contact",
        "flag_language_preference",
    }
    if flag_name not in valid_flags:
        return False
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE call_edit_flags SET {flag_name} = FALSE WHERE session_id = %s", (session_id,))
            return cur.rowcount > 0
    finally:
        conn.close()


# ─── Customer Contact Preferences ───────────────────────────────────────

def get_contact_preferences(customer_id: str) -> dict | None:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM customer_contact_preferences WHERE customer_id = %s", (customer_id,))
            return cur.fetchone()
    finally:
        conn.close()


def save_contact_preferences(customer_id: str, user_id: int, session_id: str, cease_calls: bool, cease_texts: bool, cease_emails: bool, cease_all: bool, reason: str) -> None:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM customer_contact_preferences WHERE customer_id = %s", (customer_id,))
            if cur.fetchone():
                cur.execute(
                    "UPDATE customer_contact_preferences SET cease_all_calls=%s, cease_all_texts=%s, cease_all_emails=%s, cease_all_contact=%s, reason=%s, requested_date=CURDATE(), requested_in_session=%s, set_by_user_id=%s WHERE customer_id=%s",
                    (cease_calls, cease_texts, cease_emails, cease_all, reason, session_id, user_id, customer_id),
                )
            else:
                cur.execute(
                    "INSERT INTO customer_contact_preferences (customer_id, cease_all_calls, cease_all_texts, cease_all_emails, cease_all_contact, reason, requested_date, requested_in_session, set_by_user_id) VALUES (%s,%s,%s,%s,%s,%s,CURDATE(),%s,%s)",
                    (customer_id, cease_calls, cease_texts, cease_emails, cease_all, reason, session_id, user_id),
                )
    finally:
        conn.close()
