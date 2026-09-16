-- Create database if not exists
CREATE DATABASE IF NOT EXISTS performance_coaching;
USE performance_coaching;

-- Collector table.
-- This is a SINGLE-collector POC: there is no login, authentication, or
-- multi-user management. This table exists only to (a) satisfy the
-- call_sessions.user_id foreign key and (b) store the collector's AI feedback.
-- Exactly one row is seeded: the demo collector with id = 5, which matches
-- COLLECTOR_ID in the backend/frontend and owns all seeded call history.
DROP TABLE IF EXISTS call_turns;
DROP TABLE IF EXISTS call_sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    ai_feedback TEXT DEFAULT NULL,
    ai_feedback_updated_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Call sessions table
CREATE TABLE call_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    personality_id VARCHAR(50) NOT NULL,
    company_name VARCHAR(100) NOT NULL DEFAULT 'Acme Collections',
    turn_count INT NOT NULL DEFAULT 0,
    ai_score DECIMAL(4,1) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Call turns table
CREATE TABLE call_turns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    turn_number INT NOT NULL,
    collector_transcript TEXT NOT NULL,
    customer_text TEXT NOT NULL,
    suggestions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES call_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON call_sessions(user_id);
CREATE INDEX idx_turns_session ON call_turns(session_id);

-- Seed the single hardcoded collector with id = 5 so it matches COLLECTOR_ID
-- in the app and owns all seeded call history (seed_calls.sql / seed_calls_2.sql).
INSERT INTO users (id, full_name, email) VALUES
(5, 'Demo Collector', 'demo.collector@acmecollections.com');
