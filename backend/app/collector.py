"""Single hardcoded collector for this POC.

This application supports exactly ONE collector/agent. There is no login,
authentication, registration, or multi-user management. Wherever a
collector/agent reference is needed, use these constants.

COLLECTOR_ID matches the demo collector row seeded in setup_db.sql, so the
call_sessions.user_id foreign key and all existing seeded call history,
scores, and performance data continue to work.
"""

COLLECTOR_ID = 5
COLLECTOR_NAME = "Demo Collector"
