-- Create database if not exists
CREATE DATABASE IF NOT EXISTS performance_coaching;
USE performance_coaching;

-- Users table (admin + agents)
DROP TABLE IF EXISTS call_turns;
DROP TABLE IF EXISTS call_sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'agent') NOT NULL DEFAULT 'agent',
    email VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
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

-- Seed data: admin + agents (password: 1234 hashed with bcrypt)
-- We'll use plaintext for now and hash in the app
INSERT INTO users (username, password_hash, full_name, role, email) VALUES
('admin', '1234', 'Administrator', 'admin', 'admin@acmecollections.com'),
('vaibhav', '1234', 'Vaibhav Rokde', 'agent', 'vaibhav.rokde@acmecollections.com'),
('priya', '1234', 'Priya Sharma', 'agent', 'priya.sharma@acmecollections.com'),
('rahul', '1234', 'Rahul Mehta', 'agent', 'rahul.mehta@acmecollections.com');
