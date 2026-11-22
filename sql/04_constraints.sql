-- =====================================================================
-- SQL GHOST HUNTER  |  04_constraints.sql
-- PURPOSE : Shows each constraint defined in 01_schema.sql and PROVES it
--           is enforced by attempting statements that violate it.
-- CONCEPTS: PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, CHECK, DEFAULT,
--           plus trigger-enforced rules (immutable hash, append-only logs).
--
-- Violations normally abort a script, so each attempt runs through the
-- helper procedure tmp_try(), which executes the statement, catches the
-- error with a CONTINUE HANDLER and reports ACCEPTED / REJECTED.
-- =====================================================================
USE ghost_hunter;

DROP PROCEDURE IF EXISTS tmp_try;
DELIMITER $$
CREATE PROCEDURE tmp_try(IN p_test VARCHAR(80), IN p_sql TEXT)
BEGIN
  DECLARE v_code INT DEFAULT 0;
  DECLARE v_msg  TEXT DEFAULT 'statement succeeded';
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    GET DIAGNOSTICS CONDITION 1 v_code = MYSQL_ERRNO, v_msg = MESSAGE_TEXT;
  SET @tmp_sql = p_sql;
  PREPARE tmp_stmt FROM @tmp_sql;
  IF v_code = 0 THEN
    EXECUTE tmp_stmt;
    DEALLOCATE PREPARE tmp_stmt;
  END IF;
  SELECT p_test AS test, IF(v_code = 0, 'ACCEPTED', 'REJECTED') AS outcome,
         v_code AS mysql_error, LEFT(v_msg, 110) AS message;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- C1. List the declared constraints of the evidence table
--     (information_schema is MySQL's own catalogue of metadata)
-- ---------------------------------------------------------------------
SELECT constraint_name, constraint_type
  FROM information_schema.table_constraints
 WHERE table_schema = DATABASE() AND table_name = 'evidence'
 ORDER BY constraint_type, constraint_name;
-- [[OUTPUT]]
--   +----------------------------+-----------------+
--   | CONSTRAINT_NAME            | CONSTRAINT_TYPE |
--   +----------------------------+-----------------+
--   | chk_evidence_current_hash  | CHECK           |
--   | chk_evidence_original_hash | CHECK           |
--   | chk_evidence_size          | CHECK           |
--   | chk_evidence_status        | CHECK           |
--   | chk_evidence_type          | CHECK           |
--   | fk_evidence_case           | FOREIGN KEY     |
--   | fk_evidence_uploaded_by    | FOREIGN KEY     |
--   | PRIMARY                    | PRIMARY KEY     |
--   | uq_evidence_file_path      | UNIQUE          |
--   +----------------------------+-----------------+
--   9 row(s)
-- [[/OUTPUT]]

-- C2. CHECK constraint definitions for evidence
SELECT cc.constraint_name, cc.check_clause
  FROM information_schema.check_constraints cc
  JOIN information_schema.table_constraints tc
    ON tc.constraint_schema = cc.constraint_schema AND tc.constraint_name = cc.constraint_name
 WHERE tc.table_schema = DATABASE() AND tc.table_name = 'evidence';
-- [[OUTPUT]]
--   +----------------------------+------------------------------------------------------------------+
--   | CONSTRAINT_NAME            | CHECK_CLAUSE                                                     |
--   +----------------------------+------------------------------------------------------------------+
--   | chk_evidence_current_hash  | ((`current_hash` is null) or regexp_like(`current_hash`,_utf8... |
--   | chk_evidence_original_hash | regexp_like(`original_hash`,_utf8mb4\'^[0-9a-f]{64}$\',_utf8m... |
--   | chk_evidence_size          | (`file_size_bytes` > 0)                                          |
--   | chk_evidence_status        | (`integrity_status` in (_utf8mb4\'VERIFIED\',_utf8mb4\'TAMPER... |
--   | chk_evidence_type          | (`evidence_type` in (_utf8mb4\'PDF\',_utf8mb4\'PNG\',_utf8mb4... |
--   +----------------------------+------------------------------------------------------------------+
--   5 row(s)
-- [[/OUTPUT]]

-- C3. Foreign keys and the tables they reference
SELECT table_name, column_name, referenced_table_name, referenced_column_name, constraint_name
  FROM information_schema.key_column_usage
 WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
 ORDER BY table_name, column_name;
-- [[OUTPUT]]
--   +-------------------+-------------------------+-----------------------+------------------------+-------------------------+
--   | TABLE_NAME        | COLUMN_NAME             | REFERENCED_TABLE_NAME | REFERENCED_COLUMN_NAME | CONSTRAINT_NAME         |
--   +-------------------+-------------------------+-----------------------+------------------------+-------------------------+
--   | ai_alerts         | related_case_id         | cases                 | case_id                | fk_alert_case           |
--   | ai_alerts         | related_evidence_id     | evidence              | evidence_id            | fk_alert_evidence       |
--   | ai_alerts         | related_investigator_id | investigators         | investigator_id        | fk_alert_investigator   |
--   | ai_alerts         | reviewed_by             | investigators         | investigator_id        | fk_alert_reviewed_by    |
--   | ai_alerts         | rule_code               | detection_rules       | rule_code              | fk_alert_rule           |
--   | app_sessions      | investigator_id         | investigators         | investigator_id        | fk_session_investigator |
--   | audit_logs        | investigator_id         | investigators         | investigator_id        | fk_audit_investigator   |
--   | case_assignments  | assigned_by             | investigators         | investigator_id        | fk_assign_assigned_by   |
--   | case_assignments  | case_id                 | cases                 | case_id                | fk_assign_case          |
--   | case_assignments  | investigator_id         | investigators         | investigator_id        | fk_assign_investigator  |
--   | cases             | created_by              | investigators         | investigator_id        | fk_cases_created_by     |
--   | custody_transfers | evidence_id             | evidence              | evidence_id            | fk_custody_evidence     |
--   | custody_transfers | performed_by            | investigators         | investigator_id        | fk_custody_performed_by |
--   | custody_transfers | transferred_from        | investigators         | investigator_id        | fk_custody_from         |
--   | custody_transfers | transferred_to          | investigators         | investigator_id        | fk_custody_to           |
--   +-------------------+-------------------------+-----------------------+------------------------+-------------------------+
--   20 row(s) (showing first 15)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- Enforcement tests (all inside a transaction that is rolled back, so
-- nothing is left behind even when a statement is accepted)
-- ---------------------------------------------------------------------
SET @app_investigator_id = 1, @app_client_ip = '127.0.0.1';
START TRANSACTION;

-- C4. PRIMARY KEY - duplicate investigator_id
CALL tmp_try('PRIMARY KEY: duplicate investigator_id = 1',
  'INSERT INTO investigators (investigator_id, investigator_name, email, role, password_hash)
   VALUES (1, ''Duplicate Person'', ''dup@ghosthunter.local'', ''INVESTIGATOR'', ''x'')');
-- [[OUTPUT]]
--   +--------------------------------------------+----------+-------------+-----------------------------------------------------+
--   | test                                       | outcome  | mysql_error | message                                             |
--   +--------------------------------------------+----------+-------------+-----------------------------------------------------+
--   | PRIMARY KEY: duplicate investigator_id = 1 | REJECTED | 1062        | Duplicate entry '1' for key 'investigators.PRIMARY' |
--   +--------------------------------------------+----------+-------------+-----------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C5. UNIQUE - an e-mail that already exists
CALL tmp_try('UNIQUE: duplicate e-mail',
  'INSERT INTO investigators (investigator_name, email, role, password_hash)
   VALUES (''Another Admin'', ''admin@ghosthunter.local'', ''ADMIN'', ''x'')');
-- [[OUTPUT]]
--   +--------------------------+----------+-------------+------------------------------------------------------------------+
--   | test                     | outcome  | mysql_error | message                                                          |
--   +--------------------------+----------+-------------+------------------------------------------------------------------+
--   | UNIQUE: duplicate e-mail | REJECTED | 1062        | Duplicate entry 'admin@ghosthunter.local' for key 'investigat... |
--   +--------------------------+----------+-------------+------------------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C6. NOT NULL - a case without a title
CALL tmp_try('NOT NULL: case_title missing',
  'INSERT INTO cases (case_code, case_title, created_by) VALUES (''CASE-950'', NULL, 1)');
-- [[OUTPUT]]
--   +------------------------------+----------+-------------+------------------------------------+
--   | test                         | outcome  | mysql_error | message                            |
--   +------------------------------+----------+-------------+------------------------------------+
--   | NOT NULL: case_title missing | REJECTED | 1048        | Column 'case_title' cannot be null |
--   +------------------------------+----------+-------------+------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C7. CHECK - role outside the allowed list
CALL tmp_try('CHECK: invalid role SUPERUSER',
  'INSERT INTO investigators (investigator_name, email, role, password_hash)
   VALUES (''Mallory'', ''mallory@ghosthunter.local'', ''SUPERUSER'', ''x'')');
-- [[OUTPUT]]
--   +-------------------------------+----------+-------------+--------------------------------------------------------+
--   | test                          | outcome  | mysql_error | message                                                |
--   +-------------------------------+----------+-------------+--------------------------------------------------------+
--   | CHECK: invalid role SUPERUSER | REJECTED | 3819        | Check constraint 'chk_investigators_role' is violated. |
--   +-------------------------------+----------+-------------+--------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C8. CHECK - a SHA-256 hash must be exactly 64 lowercase hex characters
CALL tmp_try('CHECK: malformed original_hash',
  'INSERT INTO evidence (case_id, evidence_name, evidence_type, file_path, file_size_bytes, original_hash, uploaded_by)
   VALUES (1, ''x.txt'', ''TXT'', ''evidence/x.txt'', 10, ''not-a-hash'', 1)');
-- [[OUTPUT]]
--   +--------------------------------+----------+-------------+------------------------------------------------------------+
--   | test                           | outcome  | mysql_error | message                                                    |
--   +--------------------------------+----------+-------------+------------------------------------------------------------+
--   | CHECK: malformed original_hash | REJECTED | 3819        | Check constraint 'chk_evidence_original_hash' is violated. |
--   +--------------------------------+----------+-------------+------------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C9. CHECK (multi-column) - a VERIFIED integrity check must have equal hashes
CALL tmp_try('CHECK: VERIFIED result with different hashes',
  CONCAT('INSERT INTO integrity_checks (evidence_id, expected_hash, actual_hash, verification_result, checked_by) VALUES (1, ''',
         REPEAT('a', 64), ''', ''', REPEAT('b', 64), ''', ''VERIFIED'', 1)'));
-- [[OUTPUT]]
--   +----------------------------------------------+----------+-------------+----------------------------------------------------------+
--   | test                                         | outcome  | mysql_error | message                                                  |
--   +----------------------------------------------+----------+-------------+----------------------------------------------------------+
--   | CHECK: VERIFIED result with different hashes | REJECTED | 3819        | Check constraint 'chk_integrity_consistent' is violated. |
--   +----------------------------------------------+----------+-------------+----------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C10. FOREIGN KEY - evidence for a case that does not exist
CALL tmp_try('FOREIGN KEY: evidence for case 999',
  CONCAT('INSERT INTO evidence (case_id, evidence_name, evidence_type, file_path, file_size_bytes, original_hash, uploaded_by) VALUES (999, ''x.txt'', ''TXT'', ''evidence/x.txt'', 10, ''',
         REPEAT('c', 64), ''', 1)'));
-- [[OUTPUT]]
--   +------------------------------------+----------+-------------+------------------------------------------------------------------+
--   | test                               | outcome  | mysql_error | message                                                          |
--   +------------------------------------+----------+-------------+------------------------------------------------------------------+
--   | FOREIGN KEY: evidence for case 999 | REJECTED | 1452        | Cannot add or update a child row: a foreign key constraint fa... |
--   +------------------------------------+----------+-------------+------------------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C11. FOREIGN KEY (ON DELETE RESTRICT) - cannot delete a case that has evidence
CALL tmp_try('FOREIGN KEY RESTRICT: delete CASE-001',
  'DELETE FROM cases WHERE case_id = 1');
-- [[OUTPUT]]
--   +---------------------------------------+----------+-------------+------------------------------------------------------------------+
--   | test                                  | outcome  | mysql_error | message                                                          |
--   +---------------------------------------+----------+-------------+------------------------------------------------------------------+
--   | FOREIGN KEY RESTRICT: delete CASE-001 | REJECTED | 1451        | Cannot delete or update a parent row: a foreign key constrain... |
--   +---------------------------------------+----------+-------------+------------------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C12. DEFAULT - insert a case giving only the required columns ...
CALL tmp_try('DEFAULT: insert minimal case',
  'INSERT INTO cases (case_code, case_title, created_by) VALUES (''CASE-951'', ''Defaults demonstration'', 1)');
-- [[OUTPUT]]
--   +------------------------------+----------+-------------+---------------------+
--   | test                         | outcome  | mysql_error | message             |
--   +------------------------------+----------+-------------+---------------------+
--   | DEFAULT: insert minimal case | ACCEPTED | 0           | statement succeeded |
--   +------------------------------+----------+-------------+---------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]
-- ... and see the DEFAULT values MySQL filled in (status, priority, created_at)
SELECT case_code, case_status, priority, created_at IS NOT NULL AS created_at_filled
  FROM cases WHERE case_code = 'CASE-951';
-- [[OUTPUT]]
--   +-----------+-------------+----------+-------------------+
--   | case_code | case_status | priority | created_at_filled |
--   +-----------+-------------+----------+-------------------+
--   | CASE-951  | OPEN        | MEDIUM   | 1                 |
--   +-----------+-------------+----------+-------------------+
--   1 row(s)
-- [[/OUTPUT]]

-- C13. TRIGGER-ENFORCED RULE - the original hash can never be changed
CALL tmp_try('TRIGGER: overwrite original_hash',
  CONCAT('UPDATE evidence SET original_hash = ''', REPEAT('d', 64), ''' WHERE evidence_id = 7'));
-- [[OUTPUT]]
--   +----------------------------------+----------+-------------+------------------------------------------------------------------+
--   | test                             | outcome  | mysql_error | message                                                          |
--   +----------------------------------+----------+-------------+------------------------------------------------------------------+
--   | TRIGGER: overwrite original_hash | REJECTED | 1644        | FORENSIC VIOLATION: original_hash is immutable once evidence ... |
--   +----------------------------------+----------+-------------+------------------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C14. TRIGGER-ENFORCED RULE - audit history is append-only
CALL tmp_try('TRIGGER: delete audit history',
  'DELETE FROM audit_logs WHERE log_id = 1');
-- [[OUTPUT]]
--   +-------------------------------+----------+-------------+----------------------------------------------------+
--   | test                          | outcome  | mysql_error | message                                            |
--   +-------------------------------+----------+-------------+----------------------------------------------------+
--   | TRIGGER: delete audit history | REJECTED | 1644        | Audit history is append-only and cannot be deleted |
--   +-------------------------------+----------+-------------+----------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- C15. TRIGGER-ENFORCED RULE - custody history cannot be edited
CALL tmp_try('TRIGGER: rewrite custody record',
  'UPDATE custody_transfers SET transferred_to = 5 WHERE transfer_id = 1');
-- [[OUTPUT]]
--   +---------------------------------+----------+-------------+--------------------------------------------------------------+
--   | test                            | outcome  | mysql_error | message                                                      |
--   +---------------------------------+----------+-------------+--------------------------------------------------------------+
--   | TRIGGER: rewrite custody record | REJECTED | 1644        | Chain-of-custody history is append-only and cannot be edited |
--   +---------------------------------+----------+-------------+--------------------------------------------------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

ROLLBACK;   -- undo the accepted DEFAULT demonstration row (and its audit row)
SET @app_investigator_id = NULL, @app_client_ip = NULL;

-- C16. Confirm the rollback: the demonstration case does not exist
SELECT COUNT(*) AS cases_named_CASE_951 FROM cases WHERE case_code = 'CASE-951';
-- [[OUTPUT]]
--   +----------------------+
--   | cases_named_CASE_951 |
--   +----------------------+
--   | 0                    |
--   +----------------------+
--   1 row(s)
-- [[/OUTPUT]]

DROP PROCEDURE tmp_try;
