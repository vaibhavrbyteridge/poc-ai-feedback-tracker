-- Add language_preference flag column to call_edit_flags table
-- Run this migration against the performance_coaching database

USE performance_coaching;

ALTER TABLE call_edit_flags
ADD COLUMN flag_language_preference BOOLEAN NOT NULL DEFAULT FALSE;
