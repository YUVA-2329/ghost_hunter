-- =====================================================================
-- SQL GHOST HUNTER  |  13_security_privileges.sql
-- PURPOSE : Least-privilege MySQL account for the web application.
-- CONCEPTS: CREATE USER, GRANT, REVOKE, principle of least privilege.
--
-- The application connects as ghost_app, NOT as root. ghost_app:
--   * can READ every table (SELECT)
--   * can EXECUTE stored procedures/functions
--   * has NO UPDATE / DELETE on audit_logs, integrity_checks or
--     custody_transfers, and NO direct INSERT on them either: those rows
--     are only written by triggers and stored procedures (which run with
--     their DEFINER's rights).
--   => an application bug or a stolen application password cannot be
--      used to rewrite the audit trail.
--
-- IMPORTANT: replace CHANGE_ME_APP_PASSWORD with the value of
-- DB_APP_PASSWORD from your .env (backend/scripts/setup_database.py does
-- this automatically). Never commit real passwords.
-- =====================================================================
USE ghost_hunter;

CREATE USER IF NOT EXISTS 'ghost_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';
CREATE USER IF NOT EXISTS 'ghost_app'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';
CREATE USER IF NOT EXISTS 'ghost_app'@'%' IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';
ALTER USER 'ghost_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';
ALTER USER 'ghost_app'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';
ALTER USER 'ghost_app'@'%' IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';

-- A new account starts with NO privileges (only USAGE = may connect).
-- The GRANTs below are idempotent, so this script can be re-run safely.

-- read access + stored routines (localhost, loopback, and container bridge network %)
GRANT SELECT, EXECUTE                 ON ghost_hunter.*                 TO 'ghost_app'@'localhost', 'ghost_app'@'127.0.0.1', 'ghost_app'@'%';

-- narrowly scoped write access
GRANT INSERT, UPDATE                  ON ghost_hunter.investigators     TO 'ghost_app'@'localhost', 'ghost_app'@'127.0.0.1', 'ghost_app'@'%';
GRANT UPDATE                          ON ghost_hunter.cases             TO 'ghost_app'@'localhost', 'ghost_app'@'127.0.0.1', 'ghost_app'@'%';
GRANT INSERT                          ON ghost_hunter.login_attempts    TO 'ghost_app'@'localhost', 'ghost_app'@'127.0.0.1', 'ghost_app'@'%';
GRANT INSERT, UPDATE                  ON ghost_hunter.app_sessions      TO 'ghost_app'@'localhost', 'ghost_app'@'127.0.0.1', 'ghost_app'@'%';
GRANT INSERT, UPDATE                  ON ghost_hunter.ai_alerts         TO 'ghost_app'@'localhost', 'ghost_app'@'127.0.0.1', 'ghost_app'@'%';
GRANT UPDATE                          ON ghost_hunter.detection_rules   TO 'ghost_app'@'localhost', 'ghost_app'@'127.0.0.1', 'ghost_app'@'%';

-- NOT granted (on purpose):
--   audit_logs        : no INSERT/UPDATE/DELETE (triggers + sp_log_app_event only)
--   integrity_checks  : no INSERT/UPDATE/DELETE (sp_record_integrity_check only)
--   custody_transfers : no INSERT/UPDATE/DELETE (sp_transfer_custody only)
--   evidence          : no INSERT/UPDATE/DELETE (sp_register_evidence & co. only)
--   case_assignments  : no direct writes      (sp_assign_investigator & co. only)
--   any DROP / ALTER / CREATE / TRIGGER privilege

FLUSH PRIVILEGES;

-- Verify (expected: SELECT, EXECUTE on ghost_hunter.* plus the table grants above)
SHOW GRANTS FOR 'ghost_app'@'localhost';
