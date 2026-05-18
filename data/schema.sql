CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    personality_default VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS debts (
    customer_id VARCHAR(64) REFERENCES customers(id),
    principal DECIMAL(12, 2),
    interest DECIMAL(12, 2),
    due_date DATE,
    status VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS interactions (
    customer_id VARCHAR(64) REFERENCES customers(id),
    date TIMESTAMP,
    summary TEXT
);

CREATE TABLE IF NOT EXISTS company_scripts (
    id SERIAL PRIMARY KEY,
    category VARCHAR(64),
    text TEXT
);
