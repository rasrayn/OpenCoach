-- =============================================================================
-- Rollback: 001_initial_schema
-- Description: Drops all tables created in 001_initial_schema.sql
-- Order matters: drop tables with foreign-key references first
-- =============================================================================

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS coach_profiles;
DROP TABLE IF EXISTS users;
