-- SQLite schema for poc-ai-feedback-tracker (performance coaching).
--
-- Self-contained schema reconstructed from the application's actual data
-- access (app/db.py and app/api/auth.py). This is a SINGLE-collector POC:
-- there is no login/authentication. The users table exists to (a) satisfy the
-- call_sessions.user_id foreign key and (b) store the collector's AI feedback.
-- Exactly one row is seeded: the demo collector with id = 5, which matches
-- COLLECTOR_ID in the backend/frontend and owns all call history.
--
-- Notes on SQLite dialect choices:
--   * AUTO_INCREMENT       -> INTEGER PRIMARY KEY AUTOINCREMENT
--   * BOOLEAN              -> INTEGER (0/1)
--   * JSON columns         -> TEXT (app does json.dumps/json.loads)
--   * NOW()/CURDATE()      -> handled in SQL as CURRENT_TIMESTAMP / DATE('now')
--   * ON DELETE CASCADE    -> requires "PRAGMA foreign_keys = ON" per connection

CREATE TABLE IF NOT EXISTS users (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name               TEXT NOT NULL,
    email                   TEXT,
    ai_feedback             TEXT DEFAULT NULL,
    ai_feedback_updated_at  TIMESTAMP DEFAULT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_sessions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              TEXT NOT NULL UNIQUE,
    user_id                 INTEGER NOT NULL,
    customer_id             TEXT NOT NULL,
    customer_name           TEXT NOT NULL,
    personality_id          TEXT NOT NULL,
    company_name            TEXT NOT NULL DEFAULT 'Acme Collections',
    turn_count              INTEGER NOT NULL DEFAULT 0,
    call_duration_seconds   INTEGER NOT NULL DEFAULT 0,
    ai_score                REAL DEFAULT NULL,
    scoring_result          TEXT DEFAULT NULL,
    comparison_result       TEXT DEFAULT NULL,
    dialed_phone            TEXT DEFAULT NULL,
    disposition             TEXT DEFAULT NULL,
    call_type               TEXT DEFAULT NULL,
    disposition_notes       TEXT DEFAULT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS call_turns (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              TEXT NOT NULL,
    turn_number             INTEGER NOT NULL,
    collector_transcript    TEXT NOT NULL,
    customer_text           TEXT NOT NULL,
    suggestions             TEXT,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES call_sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_feedback (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                 INTEGER NOT NULL,
    session_id              TEXT DEFAULT NULL,
    feedback_text           TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'open',
    target_date             DATE DEFAULT NULL,
    accepted                INTEGER NOT NULL DEFAULT 1,
    rejected_reason         TEXT DEFAULT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at            TIMESTAMP DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS action_items (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              TEXT NOT NULL,
    user_id                 INTEGER NOT NULL,
    customer_id             TEXT NOT NULL,
    action_text             TEXT NOT NULL DEFAULT '',
    field_category          TEXT DEFAULT NULL,
    field_name              TEXT DEFAULT NULL,
    field_value             TEXT DEFAULT NULL,
    status                  TEXT NOT NULL DEFAULT 'pending',
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at            TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS call_edit_flags (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id                  TEXT NOT NULL UNIQUE,
    user_id                     INTEGER NOT NULL,
    customer_id                 TEXT NOT NULL,
    dialed_phone                TEXT DEFAULT NULL,
    flag_phone                  INTEGER NOT NULL DEFAULT 0,
    flag_email                  INTEGER NOT NULL DEFAULT 0,
    flag_address                INTEGER NOT NULL DEFAULT 0,
    flag_timezone               INTEGER NOT NULL DEFAULT 0,
    flag_account_type           INTEGER NOT NULL DEFAULT 0,
    flag_days_past_due          INTEGER NOT NULL DEFAULT 0,
    flag_status                 INTEGER NOT NULL DEFAULT 0,
    flag_total_loan_amount      INTEGER NOT NULL DEFAULT 0,
    flag_principal              INTEGER NOT NULL DEFAULT 0,
    flag_interest               INTEGER NOT NULL DEFAULT 0,
    flag_monthly_payment        INTEGER NOT NULL DEFAULT 0,
    flag_do_not_call            INTEGER NOT NULL DEFAULT 0,
    flag_do_not_text            INTEGER NOT NULL DEFAULT 0,
    flag_do_not_email           INTEGER NOT NULL DEFAULT 0,
    flag_disposition            INTEGER NOT NULL DEFAULT 0,
    flag_call_type              INTEGER NOT NULL DEFAULT 0,
    flag_cease_all_contact      INTEGER NOT NULL DEFAULT 0,
    flag_language_preference    INTEGER NOT NULL DEFAULT 0,
    suggested_values            TEXT DEFAULT NULL,
    flag_reasons                TEXT DEFAULT NULL,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_contact_preferences (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id             TEXT NOT NULL UNIQUE,
    cease_all_calls         INTEGER NOT NULL DEFAULT 0,
    cease_all_texts         INTEGER NOT NULL DEFAULT 0,
    cease_all_emails        INTEGER NOT NULL DEFAULT 0,
    cease_all_contact       INTEGER NOT NULL DEFAULT 0,
    reason                  TEXT DEFAULT NULL,
    requested_date          DATE DEFAULT NULL,
    requested_in_session    TEXT DEFAULT NULL,
    set_by_user_id          INTEGER DEFAULT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON call_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_turns_session ON call_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON agent_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_session ON action_items(session_id);
CREATE INDEX IF NOT EXISTS idx_action_items_customer ON action_items(user_id, customer_id);

-- Seed the single hardcoded collector with id = 5 so it matches COLLECTOR_ID.
INSERT OR IGNORE INTO users (id, full_name, email) VALUES
(5, 'Demo Collector', 'demo.collector@acmecollections.com');
