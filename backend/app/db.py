"""SQLite database for persisting conversation sessions and turns."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "conversations.db"


def _get_connection() -> sqlite3.Connection:
    """Get a SQLite connection with row factory enabled."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = _get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            personality_id TEXT NOT NULL,
            company_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS turns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL REFERENCES sessions(session_id),
            turn_number INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            collector_transcript TEXT NOT NULL,
            customer_text TEXT NOT NULL,
            suggestions TEXT NOT NULL,
            classification TEXT NOT NULL DEFAULT '',
            confidence REAL NOT NULL DEFAULT 0.0,
            reasoning TEXT NOT NULL DEFAULT '',
            collector_override TEXT NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
    """)
    conn.commit()
    conn.close()


def save_session(
    session_id: str,
    customer_id: str,
    customer_name: str,
    personality_id: str,
    company_name: str,
) -> None:
    """Persist a new session record."""
    conn = _get_connection()
    conn.execute(
        """INSERT OR IGNORE INTO sessions
           (session_id, customer_id, customer_name, personality_id, company_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            session_id,
            customer_id,
            customer_name,
            personality_id,
            company_name,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    conn.close()


def save_turn(
    session_id: str,
    turn_number: int,
    collector_transcript: str,
    customer_text: str,
    suggestions: list[dict],
    classification: str = "",
    confidence: float = 0.0,
    reasoning: str = "",
) -> None:
    """Persist a single conversation turn."""
    conn = _get_connection()
    conn.execute(
        """INSERT INTO turns
           (session_id, turn_number, timestamp, collector_transcript, customer_text, suggestions, classification, confidence, reasoning)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            session_id,
            turn_number,
            datetime.now(timezone.utc).isoformat(),
            collector_transcript,
            customer_text,
            json.dumps(suggestions),
            classification,
            confidence,
            reasoning,
        ),
    )
    conn.commit()
    conn.close()


def get_session_log(session_id: str) -> dict | None:
    """Retrieve full session with all turns."""
    conn = _get_connection()

    session_row = conn.execute(
        "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
    ).fetchone()

    if not session_row:
        conn.close()
        return None

    turns_rows = conn.execute(
        "SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number",
        (session_id,),
    ).fetchall()

    conn.close()

    return {
        "session_id": session_row["session_id"],
        "customer_id": session_row["customer_id"],
        "customer_name": session_row["customer_name"],
        "personality_id": session_row["personality_id"],
        "company_name": session_row["company_name"],
        "created_at": session_row["created_at"],
        "turns": [
            {
                "turn_number": t["turn_number"],
                "timestamp": t["timestamp"],
                "collector_transcript": t["collector_transcript"],
                "customer_text": t["customer_text"],
                "suggestions": json.loads(t["suggestions"]),
            }
            for t in turns_rows
        ],
    }


def list_sessions() -> list[dict]:
    """List all sessions with turn counts."""
    conn = _get_connection()
    rows = conn.execute("""
        SELECT s.*, COUNT(t.id) as turn_count
        FROM sessions s
        LEFT JOIN turns t ON s.session_id = t.session_id
        GROUP BY s.session_id
        ORDER BY s.created_at DESC
    """).fetchall()
    conn.close()

    return [
        {
            "session_id": r["session_id"],
            "customer_id": r["customer_id"],
            "customer_name": r["customer_name"],
            "personality_id": r["personality_id"],
            "company_name": r["company_name"],
            "created_at": r["created_at"],
            "turn_count": r["turn_count"],
        }
        for r in rows
    ]


def get_customer_sessions(customer_id: str) -> list[dict]:
    """Get all sessions for a specific customer with their turns."""
    conn = _get_connection()
    session_rows = conn.execute(
        """SELECT s.*, COUNT(t.id) as turn_count
           FROM sessions s
           LEFT JOIN turns t ON s.session_id = t.session_id
           WHERE s.customer_id = ?
           GROUP BY s.session_id
           ORDER BY s.created_at DESC""",
        (customer_id,),
    ).fetchall()

    results = []
    for s in session_rows:
        turns_rows = conn.execute(
            "SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number",
            (s["session_id"],),
        ).fetchall()

        results.append({
            "session_id": s["session_id"],
            "customer_name": s["customer_name"],
            "personality_id": s["personality_id"],
            "company_name": s["company_name"],
            "created_at": s["created_at"],
            "turn_count": s["turn_count"],
            "turns": [
                {
                    "turn_number": t["turn_number"],
                    "timestamp": t["timestamp"],
                    "collector_transcript": t["collector_transcript"],
                    "customer_text": t["customer_text"],
                    "suggestions": json.loads(t["suggestions"]),
                }
                for t in turns_rows
            ],
        })

    conn.close()
    return results


def save_classification_override(
    session_id: str,
    turn_number: int,
    collector_override: str,
) -> bool:
    """Save a collector's override of the AI classification for a specific turn."""
    conn = _get_connection()
    cursor = conn.execute(
        """UPDATE turns SET collector_override = ?
           WHERE session_id = ? AND turn_number = ?""",
        (collector_override, session_id, turn_number),
    )
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated


def get_classification_corrections(customer_id: str) -> list[dict]:
    """Get all turns where the collector overrode the AI classification for a customer.
    Used as few-shot examples to improve future classifications."""
    conn = _get_connection()
    rows = conn.execute(
        """SELECT t.customer_text, t.classification, t.collector_override
           FROM turns t
           JOIN sessions s ON t.session_id = s.session_id
           WHERE s.customer_id = ?
             AND t.collector_override != ''
             AND t.collector_override != t.classification
           ORDER BY t.timestamp DESC
           LIMIT 10""",
        (customer_id,),
    ).fetchall()
    conn.close()

    return [
        {
            "customer_text": r["customer_text"],
            "ai_classification": r["classification"],
            "collector_correction": r["collector_override"],
        }
        for r in rows
    ]


# Initialize DB on module import
init_db()
