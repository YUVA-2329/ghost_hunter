-- =====================================================================
-- SQL GHOST HUNTER  |  11_transactions.sql
-- PURPOSE : Show that related changes succeed or fail TOGETHER.
-- CONCEPTS: START TRANSACTION, COMMIT, ROLLBACK, SAVEPOINT,
--           ROLLBACK TO SAVEPOINT, autocommit, isolation level, ACID,
--           atomic stored procedures with an EXIT HANDLER.
-- =====================================================================
USE ghost_hunter;

-- T1. Current transaction settings
SELECT @@autocommit AS autocommit, @@transaction_isolation AS isolation_level;
-- [[OUTPUT]]
--   +------------+-----------------+
--   | autocommit | isolation_level |
--   +------------+-----------------+
--   | 1          | REPEATABLE-READ |
--   +------------+-----------------+
--   1 row(s)
-- [[/OUTPUT]]

SET @app_investigator_id = 2, @app_client_ip = '127.0.0.1';   -- acting as Vikram (lead)

-- ---------------------------------------------------------------------
-- T2. COMMIT - change the priority of CASE-004 and make it permanent.
--     The audit row written by the trigger is part of the SAME transaction.
-- ---------------------------------------------------------------------
SELECT case_code, priority FROM cases WHERE case_id = 4;
-- [[OUTPUT]]
--   +-----------+----------+
--   | case_code | priority |
--   +-----------+----------+
--   | CASE-004  | MEDIUM   |
--   +-----------+----------+
--   1 row(s)
-- [[/OUTPUT]]
START TRANSACTION;
  UPDATE cases SET priority = IF(priority = 'HIGH', 'MEDIUM', 'HIGH') WHERE case_id = 4;
COMMIT;
SELECT case_code, priority FROM cases WHERE case_id = 4;
-- [[OUTPUT]]
--   +-----------+----------+
--   | case_code | priority |
--   +-----------+----------+
--   | CASE-004  | HIGH     |
--   +-----------+----------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- T3. ROLLBACK - an accidental bulk change is undone completely.
--     Count audit rows before / during / after: the trigger's audit rows
--     are rolled back too, because nothing was ever committed.
-- ---------------------------------------------------------------------
SET @audit_before = (SELECT COUNT(*) FROM audit_logs);
START TRANSACTION;
  UPDATE cases SET case_status = 'CLOSED' WHERE case_status <> 'CLOSED';   -- oops: closes everything
  SELECT COUNT(*) AS open_cases_inside_transaction FROM cases WHERE case_status <> 'CLOSED';
-- [[OUTPUT]]
--   +-------------------------------+
--   | open_cases_inside_transaction |
--   +-------------------------------+
--   | 0                             |
--   +-------------------------------+
--   1 row(s)
-- [[/OUTPUT]]
  SELECT COUNT(*) - @audit_before AS audit_rows_added_inside_transaction FROM audit_logs;
-- [[OUTPUT]]
--   +-------------------------------------+
--   | audit_rows_added_inside_transaction |
--   +-------------------------------------+
--   | 4                                   |
--   +-------------------------------------+
--   1 row(s)
-- [[/OUTPUT]]
ROLLBACK;
SELECT COUNT(*) AS open_cases_after_rollback,
       (SELECT COUNT(*) FROM audit_logs) - @audit_before AS audit_rows_kept
  FROM cases WHERE case_status <> 'CLOSED';
-- [[OUTPUT]]
--   +---------------------------+-----------------+
--   | open_cases_after_rollback | audit_rows_kept |
--   +---------------------------+-----------------+
--   | 4                         | 0               |
--   +---------------------------+-----------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- T4. SAVEPOINT - keep the first change, undo only the second.
-- ---------------------------------------------------------------------
START TRANSACTION;
  UPDATE cases SET case_description = CONCAT(case_description, ' [reviewed]')
   WHERE case_id = 4 AND case_description NOT LIKE '%[reviewed]';
  SAVEPOINT after_review_note;
  UPDATE cases SET case_status = 'ON_HOLD' WHERE case_id = 4;       -- second change
  ROLLBACK TO SAVEPOINT after_review_note;                          -- undo only this one
COMMIT;
SELECT case_code, case_status, RIGHT(case_description, 30) AS description_end
  FROM cases WHERE case_id = 4;
-- [[OUTPUT]]
--   +-----------+-------------+--------------------------------+
--   | case_code | case_status | description_end                |
--   +-----------+-------------+--------------------------------+
--   | CASE-004  | IN_PROGRESS | al harvesting page. [reviewed] |
--   +-----------+-------------+--------------------------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- T5. ATOMIC PROCEDURE - sp_transfer_custody FIRST inserts an
--     integrity_checks row and THEN the custody row, inside one transaction.
--     Here the custody insert fails (reason 'n/a' violates the CHECK
--     constraint chk_custody_reason, minimum 5 characters). The EXIT
--     HANDLER rolls back, so the already-written integrity row disappears
--     too: all or nothing (Atomicity).
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS tmp_try_transfer;
DELIMITER $$
CREATE PROCEDURE tmp_try_transfer()
BEGIN
  DECLARE v_msg TEXT DEFAULT 'transfer succeeded';
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
  SET @checks_before = (SELECT COUNT(*) FROM integrity_checks);
  CALL sp_transfer_custody(4, 4, 'n/a',
       '2ac481fcbcda1e2e9863e5c808048ca9af4d45f5761180c17e222c0d7223933a', 3, @tid);
  SELECT v_msg AS result,
         (SELECT COUNT(*) FROM integrity_checks) - @checks_before AS integrity_rows_added;
END$$
DELIMITER ;
SET @app_investigator_id = 3;   -- acting as Priya
CALL tmp_try_transfer();
-- [[OUTPUT]]
--   +----------------------------------------------------+----------------------+
--   | result                                             | integrity_rows_added |
--   +----------------------------------------------------+----------------------+
--   | Check constraint 'chk_custody_reason' is violated. | 0                    |
--   +----------------------------------------------------+----------------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]
DROP PROCEDURE tmp_try_transfer;

-- ---------------------------------------------------------------------
-- T6. A successful atomic procedure call: an integrity verification
--     (sp_record_integrity_check = INSERT integrity_checks + UPDATE evidence
--     committed together). Evidence 8 still matches its original hash.
-- ---------------------------------------------------------------------
SET @app_investigator_id = 4;   -- acting as Rahul (assigned to CASE-004)
CALL sp_record_integrity_check(8, '9c784f317950ca8e292cedb2e7c551fadb038c094eb749d95b371bae770c2fc0', 4, 'MANUAL', @result);
SELECT @result AS verification_result,
       (SELECT COUNT(*) FROM integrity_checks WHERE evidence_id = 8) AS checks_for_evidence_8;
-- [[OUTPUT]]
--   +---------------------+-----------------------+
--   | verification_result | checks_for_evidence_8 |
--   +---------------------+-----------------------+
--   | VERIFIED            | 2                     |
--   +---------------------+-----------------------+
--   1 row(s)
-- [[/OUTPUT]]

SET @app_investigator_id = NULL, @app_client_ip = NULL;
