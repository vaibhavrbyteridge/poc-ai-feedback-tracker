"""SQLite database operations for call persistence, scoring, and performance.

Single-collector POC: no authentication or agent-management operations live
here. The ``user_id`` columns simply scope records to the one hardcoded
collector (see app.collector).

This module replaces the previous MySQL implementation. It uses Python's
standard-library ``sqlite3`` driver, so there is no external database server
or third-party driver dependency. The database file is created and initialized
automatically on first use (see ``_get_connection`` / ``init_db``).
"""

import json
import sqlite3
import threading
from datetime import datetime, timezone

from app.config import get_settings
from app.paths import data_dir

_SCHEMA_PATH = __import__("pathlib").Path(__file__).resolve().parent / "schema.sql"

_init_lock = threading.Lock()
_initialized = False


def _db_path() -> str:
    """Resolve the SQLite database file path.

    Uses the configured ``sqlite_path`` when set; otherwise defaults to
    ``<data_dir>/app.db`` so the file lives alongside the customer JSON data.
    """
    settings = get_settings()
    configured = getattr(settings, "sqlite_path", "") or ""
    if configured:
        return configured
    return str(data_dir() / "app.db")


def init_db() -> None:
    """Create the database file and schema if they do not already exist."""
    global _initialized
    with _init_lock:
        if _initialized:
            return
        conn = sqlite3.connect(_db_path())
        try:
            conn.execute("PRAGMA foreign_keys = ON")
            with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
            conn.commit()
        finally:
            conn.close()
        _initialized = True


def _get_connection() -> sqlite3.Connection:
    """Open a SQLite connection, initializing the database on first use.

    ``row_factory`` is set to ``sqlite3.Row`` so callers can access columns by
    name (mirroring the old pymysql ``DictCursor`` behavior). ``isolation_level``
    is ``None`` for autocommit semantics (matching the previous MySQL config).
    """
    if not _initialized:
        init_db()
    conn = sqlite3.connect(_db_path(), timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


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
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO call_sessions "
            "(session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count, call_duration_seconds) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count, call_duration_seconds),
        )
        for i, turn in enumerate(turns, 1):
            cur.execute(
                "INSERT INTO call_turns "
                "(session_id, turn_number, collector_transcript, customer_text, suggestions) "
                "VALUES (?, ?, ?, ?, ?)",
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
        cur = conn.cursor()
        cur.execute(
            "SELECT id, session_id, customer_id, customer_name, personality_id, "
            "company_name, turn_count, ai_score, dialed_phone, created_at "
            "FROM call_sessions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_call_session_turns(session_id: str) -> list[dict]:
    """Get all turns for a specific call session."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT turn_number, collector_transcript, customer_text, suggestions "
            "FROM call_turns WHERE session_id = ? ORDER BY turn_number",
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
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM call_sessions WHERE session_id = ? AND user_id = ?",
            (session_id, user_id),
        )
        return cur.rowcount > 0
    finally:
        conn.close()


def save_call_score(session_id: str, scoring_result: dict) -> None:
    """Save AI scoring result for a call session."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE call_sessions SET ai_score = ?, scoring_result = ? WHERE session_id = ?",
            (scoring_result.get("overall_score", 0), json.dumps(scoring_result), session_id),
        )
    finally:
        conn.close()


def get_call_score(session_id: str) -> dict | None:
    """Get the scoring result for a call session."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT scoring_result FROM call_sessions WHERE session_id = ?",
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
        cur = conn.cursor()
        cur.execute(
            "UPDATE call_sessions SET ai_score = NULL, scoring_result = NULL WHERE session_id = ?",
            (session_id,),
        )
        return cur.rowcount > 0
    finally:
        conn.close()


def get_agent_performance(user_id: int) -> dict:
    """Calculate aggregate performance scores across all scored calls for an agent."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT scoring_result FROM call_sessions "
            "WHERE user_id = ? AND scoring_result IS NOT NULL",
            (user_id,),
        )
        rows = cur.fetchall()
    finally:
        conn.close()

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


# ─── Feedback Goals ──────────────────────────────────────────────────────

def create_feedback(user_id: int, session_id: str | None, feedback_text: str, target_days: int = 30) -> dict:
    """Create a feedback goal for an agent."""
    from datetime import timedelta
    conn = _get_connection()
    try:
        target_date = (datetime.now(timezone.utc) + timedelta(days=target_days)).date()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO agent_feedback (user_id, session_id, feedback_text, target_date, accepted) "
            "VALUES (?, ?, ?, ?, 1)",
            (user_id, session_id, feedback_text, str(target_date)),
        )
        return {"id": cur.lastrowid, "feedback_text": feedback_text, "status": "open", "target_date": str(target_date)}
    finally:
        conn.close()


def get_agent_feedbacks(user_id: int) -> list[dict]:
    """Get all feedback goals for an agent."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, session_id, feedback_text, status, target_date, accepted, rejected_reason, created_at, completed_at "
            "FROM agent_feedback WHERE user_id = ? "
            "ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, created_at DESC",
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_pending_feedbacks(user_id: int) -> list[dict]:
    """Get open/in_progress feedback goals — used by AI to check achievements."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, feedback_text, status FROM agent_feedback "
            "WHERE user_id = ? AND status IN ('open', 'in_progress') AND accepted = 1",
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def update_feedback_status(feedback_id: int, status: str) -> bool:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        completed_at = datetime.now(timezone.utc).isoformat() if status == "completed" else None
        cur.execute(
            "UPDATE agent_feedback SET status = ?, completed_at = ? WHERE id = ?",
            (status, completed_at, feedback_id),
        )
        return cur.rowcount > 0
    finally:
        conn.close()


def reject_feedback(feedback_id: int, reason: str) -> bool:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE agent_feedback SET accepted = 0, rejected_reason = ? WHERE id = ?",
            (reason, feedback_id),
        )
        return cur.rowcount > 0
    finally:
        conn.close()


def save_comparison_result(session_id: str, comparison: dict) -> None:
    """Save the comparison of call score vs overall agent average."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE call_sessions SET comparison_result = ? WHERE session_id = ?",
            (json.dumps(comparison), session_id),
        )
    finally:
        conn.close()


# ─── Weekly Performance Graph ────────────────────────────────────────────

def get_weekly_performance(user_id: int) -> list[dict]:
    """Get call scores grouped by week for the graph."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT
                strftime('%Y%W', created_at) as week_num,
                MIN(DATE(created_at)) as week_start,
                AVG(ai_score) as avg_score,
                COUNT(*) as call_count,
                SUM(call_duration_seconds) as total_duration
            FROM call_sessions
            WHERE user_id = ? AND ai_score IS NOT NULL
            GROUP BY strftime('%Y%W', created_at)
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
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET ai_feedback = ?, ai_feedback_updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (feedback, user_id),
        )
    finally:
        conn.close()


def get_ai_feedback(user_id: int) -> dict | None:
    """Get stored AI feedback for an agent."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT ai_feedback, ai_feedback_updated_at FROM users WHERE id = ?",
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
        cur = conn.cursor()
        cur.execute(
            """SELECT session_id, customer_name, ai_score, created_at
            FROM call_sessions
            WHERE user_id = ? AND ai_score IS NOT NULL
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
        cur = conn.cursor()
        cur.execute(
            "UPDATE call_sessions SET disposition = ?, call_type = ?, disposition_notes = ? WHERE session_id = ?",
            (disposition, call_type, notes, session_id),
        )
        return cur.rowcount > 0
    finally:
        conn.close()


def get_call_disposition(session_id: str) -> dict | None:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT disposition, call_type, disposition_notes FROM call_sessions WHERE session_id = ?",
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
        cur = conn.cursor()
        # Remove old pending items for this session
        cur.execute("DELETE FROM action_items WHERE session_id = ? AND status = 'pending'", (session_id,))
        for item in items:
            cur.execute(
                "INSERT INTO action_items (session_id, user_id, customer_id, action_text, field_category, field_name, field_value) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (session_id, user_id, customer_id, item.get("action_text", ""), item.get("field_category", ""), item.get("field_name", ""), item.get("field_value", "")),
            )
    finally:
        conn.close()


def get_action_items_for_session(session_id: str) -> list[dict]:
    """Get action items for a specific call session."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, action_text, field_category, field_name, field_value, status, created_at, completed_at "
            "FROM action_items WHERE session_id = ? ORDER BY status ASC, created_at DESC",
            (session_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_pending_action_items_for_customer(user_id: int, customer_id: str) -> list[dict]:
    """Get all pending action items for a customer (shown as ! in UI)."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, action_text, field_category, field_name, field_value, session_id "
            "FROM action_items WHERE user_id = ? AND customer_id = ? AND status = 'pending' "
            "ORDER BY created_at DESC",
            (user_id, customer_id),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def complete_action_item(item_id: int) -> bool:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE action_items SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
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
        cur = conn.cursor()
        cur.execute("SELECT id FROM call_edit_flags WHERE session_id = ?", (session_id,))
        exists = cur.fetchone()
        if exists:
            set_parts = []
            params = []
            for col, val in flags.items():
                set_parts.append(f"{col} = ?")
                params.append(1 if val else 0)
            set_parts.append("suggested_values = ?")
            params.append(json.dumps(suggested_values))
            set_parts.append("flag_reasons = ?")
            params.append(json.dumps(flag_reasons))
            set_parts.append("dialed_phone = ?")
            params.append(dialed_phone)
            params.append(session_id)
            cur.execute(f"UPDATE call_edit_flags SET {', '.join(set_parts)} WHERE session_id = ?", params)
        else:
            cols = ["session_id", "user_id", "customer_id", "dialed_phone"]
            vals = [session_id, user_id, customer_id, dialed_phone]
            for col, val in flags.items():
                cols.append(col)
                vals.append(1 if val else 0)
            cols.extend(["suggested_values", "flag_reasons"])
            vals.extend([json.dumps(suggested_values), json.dumps(flag_reasons)])
            placeholders = ", ".join(["?"] * len(vals))
            cur.execute(f"INSERT INTO call_edit_flags ({', '.join(cols)}) VALUES ({placeholders})", vals)
    finally:
        conn.close()


def get_edit_flags_for_customer(user_id: int, customer_id: str) -> list[dict]:
    """Get all pending edit flags for a customer (any flag = 1)."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM call_edit_flags WHERE user_id = ? AND customer_id = ? "
            "AND (flag_phone = 1 OR flag_email = 1 OR flag_address = 1 OR flag_timezone = 1 OR "
            "flag_account_type = 1 OR flag_days_past_due = 1 OR flag_status = 1 OR "
            "flag_total_loan_amount = 1 OR flag_principal = 1 OR flag_interest = 1 OR "
            "flag_monthly_payment = 1 OR flag_do_not_call = 1 OR flag_do_not_text = 1 OR "
            "flag_do_not_email = 1 OR flag_disposition = 1 OR flag_call_type = 1 OR "
            "flag_cease_all_contact = 1 OR flag_language_preference = 1)",
            (user_id, customer_id),
        )
        rows = [dict(r) for r in cur.fetchall()]
        for row in rows:
            if isinstance(row.get("suggested_values"), str):
                row["suggested_values"] = json.loads(row["suggested_values"])
            if isinstance(row.get("flag_reasons"), str):
                row["flag_reasons"] = json.loads(row["flag_reasons"])
        return rows
    finally:
        conn.close()


def clear_edit_flag(session_id: str, flag_name: str) -> bool:
    """Set a specific flag to 0 after agent completes the action."""
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
        cur = conn.cursor()
        cur.execute(f"UPDATE call_edit_flags SET {flag_name} = 0 WHERE session_id = ?", (session_id,))
        return cur.rowcount > 0
    finally:
        conn.close()


# ─── Customer Contact Preferences ───────────────────────────────────────

def get_contact_preferences(customer_id: str) -> dict | None:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM customer_contact_preferences WHERE customer_id = ?", (customer_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def save_contact_preferences(customer_id: str, user_id: int, session_id: str, cease_calls: bool, cease_texts: bool, cease_emails: bool, cease_all: bool, reason: str) -> None:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM customer_contact_preferences WHERE customer_id = ?", (customer_id,))
        if cur.fetchone():
            cur.execute(
                "UPDATE customer_contact_preferences SET cease_all_calls=?, cease_all_texts=?, cease_all_emails=?, cease_all_contact=?, reason=?, requested_date=DATE('now'), requested_in_session=?, set_by_user_id=? WHERE customer_id=?",
                (1 if cease_calls else 0, 1 if cease_texts else 0, 1 if cease_emails else 0, 1 if cease_all else 0, reason, session_id, user_id, customer_id),
            )
        else:
            cur.execute(
                "INSERT INTO customer_contact_preferences (customer_id, cease_all_calls, cease_all_texts, cease_all_emails, cease_all_contact, reason, requested_date, requested_in_session, set_by_user_id) VALUES (?,?,?,?,?,?,DATE('now'),?,?)",
                (customer_id, 1 if cease_calls else 0, 1 if cease_texts else 0, 1 if cease_emails else 0, 1 if cease_all else 0, reason, session_id, user_id),
            )
    finally:
        conn.close()
