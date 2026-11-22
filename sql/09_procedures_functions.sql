-- =====================================================================
-- SQL GHOST HUNTER  |  09_procedures_functions.sql
-- PURPOSE : Stored FUNCTIONS (return one value) and stored PROCEDURES
--           (multi-step business operations wrapped in TRANSACTIONS).
-- CONCEPTS: CREATE FUNCTION, CREATE PROCEDURE, IN/OUT parameters,
--           DECLARE, IF/CASE, SIGNAL (custom errors), EXIT HANDLER,
--           START TRANSACTION / COMMIT / ROLLBACK, SELECT ... FOR UPDATE.
--
-- WHY PROCEDURES? The application database account (ghost_app) has NO
-- direct INSERT/UPDATE/DELETE rights on audit_logs, integrity_checks or
-- custody_transfers. It may only change them by calling these procedures,
-- which enforce the forensic rules (append-only history, immutable
-- original hash, authorised custody transfers) inside the database.
--
-- Run after 01_schema.sql.
-- =====================================================================
USE ghost_hunter;

DROP FUNCTION  IF EXISTS fn_risk_level;
DROP FUNCTION  IF EXISTS fn_risk_rank;
DROP FUNCTION  IF EXISTS fn_max_risk;
DROP FUNCTION  IF EXISTS fn_escalate_risk;
DROP FUNCTION  IF EXISTS fn_audit_risk;
DROP FUNCTION  IF EXISTS fn_is_off_hours;
DROP FUNCTION  IF EXISTS fn_current_custodian;
DROP FUNCTION  IF EXISTS fn_case_evidence_count;
DROP FUNCTION  IF EXISTS fn_case_risk_score;
DROP FUNCTION  IF EXISTS fn_has_case_access;
DROP PROCEDURE IF EXISTS sp_log_app_event;
DROP PROCEDURE IF EXISTS sp_create_case;
DROP PROCEDURE IF EXISTS sp_update_case_status;
DROP PROCEDURE IF EXISTS sp_assign_investigator;
DROP PROCEDURE IF EXISTS sp_remove_assignment;
DROP PROCEDURE IF EXISTS sp_apply_integrity_check;
DROP PROCEDURE IF EXISTS sp_record_integrity_check;
DROP PROCEDURE IF EXISTS sp_register_evidence;
DROP PROCEDURE IF EXISTS sp_transfer_custody;
DROP PROCEDURE IF EXISTS sp_delete_empty_case;
DROP PROCEDURE IF EXISTS sp_case_risk_summary;

DELIMITER $$

-- =====================================================================
-- STORED FUNCTIONS
-- =====================================================================

-- fn_risk_level: converts a 0-100 risk score into a risk level.
-- Example: SELECT fn_risk_level(92);  -> 'CRITICAL'
CREATE FUNCTION fn_risk_level(p_score INT)
RETURNS VARCHAR(10)
DETERMINISTIC NO SQL
BEGIN
  RETURN CASE
           WHEN p_score >= 85 THEN 'CRITICAL'
           WHEN p_score >= 60 THEN 'HIGH'
           WHEN p_score >= 35 THEN 'MEDIUM'
           ELSE 'LOW'
         END;
END$$

-- fn_risk_rank: numeric rank of a level so levels can be compared/sorted.
CREATE FUNCTION fn_risk_rank(p_level VARCHAR(10))
RETURNS TINYINT
DETERMINISTIC NO SQL
BEGIN
  RETURN CASE p_level WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END;
END$$

-- fn_max_risk: the more severe of two levels.
CREATE FUNCTION fn_max_risk(p_a VARCHAR(10), p_b VARCHAR(10))
RETURNS VARCHAR(10)
DETERMINISTIC NO SQL
BEGIN
  RETURN IF(fn_risk_rank(p_a) >= fn_risk_rank(p_b), p_a, p_b);
END$$

-- fn_escalate_risk: raises a level by one step (used when a change was
-- made with no authenticated application identity).
CREATE FUNCTION fn_escalate_risk(p_level VARCHAR(10))
RETURNS VARCHAR(10)
DETERMINISTIC NO SQL
BEGIN
  RETURN CASE p_level WHEN 'LOW' THEN 'MEDIUM' WHEN 'MEDIUM' THEN 'HIGH' ELSE 'CRITICAL' END;
END$$

-- fn_audit_risk: baseline risk of an audited data change. Used by triggers.
--   DELETE on evidence/investigators/history tables -> HIGH, other DELETE -> MEDIUM
--   UPDATE on evidence/investigators/detection_rules -> MEDIUM, else LOW
--   No application identity (direct DB access)        -> escalated one level
CREATE FUNCTION fn_audit_risk(p_action VARCHAR(30), p_table VARCHAR(64), p_actor INT UNSIGNED)
RETURNS VARCHAR(10)
DETERMINISTIC NO SQL
BEGIN
  DECLARE v_level VARCHAR(10) DEFAULT 'LOW';
  IF p_action = 'DELETE' THEN
    SET v_level = IF(p_table IN ('evidence','investigators','custody_transfers','integrity_checks'), 'HIGH', 'MEDIUM');
  ELSEIF p_action = 'UPDATE' AND p_table IN ('evidence','investigators','detection_rules') THEN
    SET v_level = 'MEDIUM';
  END IF;
  IF p_actor IS NULL THEN
    SET v_level = fn_escalate_risk(v_level);
  END IF;
  RETURN v_level;
END$$

-- fn_is_off_hours: 1 if the time is outside the configured working hours
-- (read from the OFF_HOURS_ACTIVITY detection rule; default 08:00-20:00).
CREATE FUNCTION fn_is_off_hours(p_time DATETIME)
RETURNS TINYINT
READS SQL DATA
BEGIN
  DECLARE v_start INT DEFAULT 8;
  DECLARE v_end   INT DEFAULT 20;
  SELECT COALESCE(JSON_EXTRACT(params, '$.start_hour'), 8),
         COALESCE(JSON_EXTRACT(params, '$.end_hour'), 20)
    INTO v_start, v_end
    FROM detection_rules WHERE rule_code = 'OFF_HOURS_ACTIVITY';
  RETURN IF(HOUR(p_time) < v_start OR HOUR(p_time) >= v_end, 1, 0);
END$$

-- fn_current_custodian: investigator who currently holds an evidence item
-- = the receiver of the most recent custody transfer.
CREATE FUNCTION fn_current_custodian(p_evidence_id INT UNSIGNED)
RETURNS INT UNSIGNED
READS SQL DATA
BEGIN
  DECLARE v_holder INT UNSIGNED DEFAULT NULL;
  SELECT transferred_to INTO v_holder
    FROM custody_transfers
   WHERE evidence_id = p_evidence_id
   ORDER BY transfer_timestamp DESC, transfer_id DESC
   LIMIT 1;
  RETURN v_holder;
END$$

-- fn_case_evidence_count: number of evidence items registered for a case.
CREATE FUNCTION fn_case_evidence_count(p_case_id INT UNSIGNED)
RETURNS INT
READS SQL DATA
BEGIN
  DECLARE v_count INT DEFAULT 0;
  SELECT COUNT(*) INTO v_count FROM evidence WHERE case_id = p_case_id;
  RETURN v_count;
END$$

-- fn_case_risk_score: highest risk score among unresolved alerts of a case,
-- with +5 for each additional unresolved alert (capped at 100).
CREATE FUNCTION fn_case_risk_score(p_case_id INT UNSIGNED)
RETURNS INT
READS SQL DATA
BEGIN
  DECLARE v_max INT DEFAULT 0;
  DECLARE v_cnt INT DEFAULT 0;
  SELECT COALESCE(MAX(risk_score), 0), COUNT(*) INTO v_max, v_cnt
    FROM ai_alerts
   WHERE related_case_id = p_case_id AND status IN ('OPEN','ESCALATED');
  RETURN LEAST(100, v_max + GREATEST(v_cnt - 1, 0) * 5);
END$$

-- fn_has_case_access: 1 if an investigator may see a case.
-- ADMIN, LEAD_INVESTIGATOR and AUDITOR see all cases; INVESTIGATOR sees
-- cases they created or are actively assigned to.
CREATE FUNCTION fn_has_case_access(p_investigator_id INT UNSIGNED, p_case_id INT UNSIGNED)
RETURNS TINYINT
READS SQL DATA
BEGIN
  DECLARE v_role VARCHAR(20) DEFAULT NULL;
  SELECT role INTO v_role FROM investigators
   WHERE investigator_id = p_investigator_id AND is_active = 1;
  IF v_role IS NULL THEN RETURN 0; END IF;
  IF v_role IN ('ADMIN','LEAD_INVESTIGATOR','AUDITOR') THEN RETURN 1; END IF;
  RETURN IF(EXISTS (SELECT 1 FROM case_assignments
                     WHERE case_id = p_case_id AND investigator_id = p_investigator_id
                       AND assignment_status = 'ACTIVE')
            OR EXISTS (SELECT 1 FROM cases WHERE case_id = p_case_id AND created_by = p_investigator_id),
            1, 0);
END$$

-- =====================================================================
-- STORED PROCEDURES
-- =====================================================================

-- sp_log_app_event: records an APPLICATION-level forensic event
-- (login, logout, evidence download, report generation, AI query ...).
-- Data changes (INSERT/UPDATE/DELETE) can only be logged by triggers.
CREATE PROCEDURE sp_log_app_event(
  IN p_investigator_id INT UNSIGNED,
  IN p_action          VARCHAR(30),
  IN p_table           VARCHAR(64),
  IN p_record_id       BIGINT UNSIGNED,
  IN p_case_id         INT UNSIGNED,
  IN p_details         VARCHAR(500),
  IN p_ip              VARCHAR(45),
  IN p_risk            VARCHAR(10))
BEGIN
  IF p_action IN ('INSERT','UPDATE','DELETE') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Data-change events can only be written by audit triggers';
  END IF;
  INSERT INTO audit_logs
    (investigator_id, action_type, event_source, table_name, record_id, related_case_id,
     old_values, new_values, ip_address, db_user, risk_level, details)
  VALUES
    (p_investigator_id, p_action, 'APPLICATION', p_table, p_record_id, p_case_id,
     NULL, NULL, p_ip, USER(), COALESCE(p_risk, 'LOW'), p_details);
END$$

-- sp_create_case: creates a case with the next CASE-nnn code and assigns
-- the creator as LEAD - both rows or neither (transaction).
CREATE PROCEDURE sp_create_case(
  IN  p_title       VARCHAR(200),
  IN  p_description TEXT,
  IN  p_priority    VARCHAR(10),
  IN  p_created_by  INT UNSIGNED,
  OUT p_case_id     INT UNSIGNED)
BEGIN
  DECLARE v_role VARCHAR(20);
  DECLARE v_next INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT role INTO v_role FROM investigators
   WHERE investigator_id = p_created_by AND is_active = 1;
  IF v_role IS NULL OR v_role NOT IN ('ADMIN','LEAD_INVESTIGATOR') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an ADMIN or LEAD_INVESTIGATOR can create cases';
  END IF;

  START TRANSACTION;
    -- lock existing codes so two concurrent calls cannot get the same number
    SELECT COALESCE(MAX(CAST(SUBSTRING(case_code, 6) AS UNSIGNED)), 0) + 1
      INTO v_next FROM cases FOR UPDATE;
    INSERT INTO cases (case_code, case_title, case_description, case_status, priority, created_by)
    VALUES (CONCAT('CASE-', LPAD(v_next, 3, '0')), p_title, p_description, 'OPEN',
            COALESCE(p_priority, 'MEDIUM'), p_created_by);
    SET p_case_id = LAST_INSERT_ID();
    INSERT INTO case_assignments (case_id, investigator_id, assignment_role, assignment_status, assigned_by)
    VALUES (p_case_id, p_created_by, 'LEAD', 'ACTIVE', p_created_by);
  COMMIT;
END$$

-- sp_update_case_status: validated status change. Only ADMIN may reopen
-- a CLOSED case.
CREATE PROCEDURE sp_update_case_status(
  IN p_case_id    INT UNSIGNED,
  IN p_new_status VARCHAR(20),
  IN p_changed_by INT UNSIGNED)
BEGIN
  DECLARE v_role VARCHAR(20);
  DECLARE v_old  VARCHAR(20);
  SELECT role INTO v_role FROM investigators WHERE investigator_id = p_changed_by AND is_active = 1;
  SELECT case_status INTO v_old FROM cases WHERE case_id = p_case_id;
  IF v_old IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Case not found';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('ADMIN','LEAD_INVESTIGATOR') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an ADMIN or LEAD_INVESTIGATOR can change case status';
  END IF;
  IF v_old = 'CLOSED' AND p_new_status <> 'CLOSED' AND v_role <> 'ADMIN' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an ADMIN can reopen a closed case';
  END IF;
  IF v_old <> p_new_status THEN
    UPDATE cases SET case_status = p_new_status WHERE case_id = p_case_id;
  END IF;
END$$

-- sp_assign_investigator: adds (or re-activates) an investigator on a case.
CREATE PROCEDURE sp_assign_investigator(
  IN p_case_id         INT UNSIGNED,
  IN p_investigator_id INT UNSIGNED,
  IN p_role            VARCHAR(20),
  IN p_assigned_by     INT UNSIGNED)
BEGIN
  DECLARE v_by_role     VARCHAR(20);
  DECLARE v_target_role VARCHAR(20);
  DECLARE v_status      VARCHAR(20);
  DECLARE v_existing    VARCHAR(12);

  SELECT role INTO v_by_role FROM investigators WHERE investigator_id = p_assigned_by AND is_active = 1;
  IF v_by_role IS NULL OR v_by_role NOT IN ('ADMIN','LEAD_INVESTIGATOR') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an ADMIN or LEAD_INVESTIGATOR can assign investigators';
  END IF;
  SELECT role INTO v_target_role FROM investigators WHERE investigator_id = p_investigator_id AND is_active = 1;
  IF v_target_role IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Investigator not found or inactive';
  END IF;
  IF v_target_role = 'AUDITOR' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Auditors are read-only and cannot be assigned to cases';
  END IF;
  SELECT case_status INTO v_status FROM cases WHERE case_id = p_case_id;
  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Case not found';
  END IF;
  IF v_status = 'CLOSED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot assign investigators to a closed case';
  END IF;

  SELECT assignment_status INTO v_existing FROM case_assignments
   WHERE case_id = p_case_id AND investigator_id = p_investigator_id;
  IF v_existing = 'ACTIVE' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Investigator is already assigned to this case';
  ELSEIF v_existing = 'REMOVED' THEN
    UPDATE case_assignments
       SET assignment_status = 'ACTIVE', assignment_role = COALESCE(p_role, 'MEMBER'),
           assigned_at = NOW(), assigned_by = p_assigned_by
     WHERE case_id = p_case_id AND investigator_id = p_investigator_id;
  ELSE
    INSERT INTO case_assignments (case_id, investigator_id, assignment_role, assignment_status, assigned_by)
    VALUES (p_case_id, p_investigator_id, COALESCE(p_role, 'MEMBER'), 'ACTIVE', p_assigned_by);
  END IF;
END$$

-- sp_remove_assignment: marks an assignment REMOVED (history is kept).
-- Refused while the investigator still holds custody of case evidence.
CREATE PROCEDURE sp_remove_assignment(
  IN p_case_id         INT UNSIGNED,
  IN p_investigator_id INT UNSIGNED,
  IN p_removed_by      INT UNSIGNED)
BEGIN
  DECLARE v_by_role VARCHAR(20);
  SELECT role INTO v_by_role FROM investigators WHERE investigator_id = p_removed_by AND is_active = 1;
  IF v_by_role IS NULL OR v_by_role NOT IN ('ADMIN','LEAD_INVESTIGATOR') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an ADMIN or LEAD_INVESTIGATOR can remove assignments';
  END IF;
  IF EXISTS (SELECT 1 FROM evidence e
              WHERE e.case_id = p_case_id
                AND fn_current_custodian(e.evidence_id) = p_investigator_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Investigator still holds custody of evidence in this case; transfer it first';
  END IF;
  UPDATE case_assignments SET assignment_status = 'REMOVED'
   WHERE case_id = p_case_id AND investigator_id = p_investigator_id AND assignment_status = 'ACTIVE';
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No active assignment found';
  END IF;
END$$

-- sp_apply_integrity_check (internal, no transaction of its own):
-- compares the freshly computed hash with the ORIGINAL hash, appends an
-- integrity_checks row and refreshes the cached status on evidence.
-- The original hash is never modified.
CREATE PROCEDURE sp_apply_integrity_check(
  IN  p_evidence_id INT UNSIGNED,
  IN  p_actual_hash CHAR(64),
  IN  p_checked_by  INT UNSIGNED,
  IN  p_context     VARCHAR(20),
  OUT p_result      VARCHAR(12))
BEGIN
  DECLARE v_expected CHAR(64) DEFAULT NULL;
  DECLARE v_actual   CHAR(64) DEFAULT LOWER(p_actual_hash);

  SELECT original_hash INTO v_expected FROM evidence
   WHERE evidence_id = p_evidence_id FOR UPDATE;
  IF v_expected IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Evidence not found';
  END IF;

  SET p_result = CASE
                   WHEN v_actual IS NULL       THEN 'MISSING'
                   WHEN v_actual = v_expected  THEN 'VERIFIED'
                   ELSE 'TAMPERED'
                 END;

  INSERT INTO integrity_checks
    (evidence_id, expected_hash, actual_hash, verification_result, check_context, checked_by)
  VALUES (p_evidence_id, v_expected, v_actual, p_result, p_context, p_checked_by);

  UPDATE evidence
     SET current_hash = v_actual, integrity_status = p_result, last_verified_at = NOW()
   WHERE evidence_id = p_evidence_id;
END$$

-- sp_record_integrity_check: public, transactional integrity verification.
CREATE PROCEDURE sp_record_integrity_check(
  IN  p_evidence_id INT UNSIGNED,
  IN  p_actual_hash CHAR(64),
  IN  p_checked_by  INT UNSIGNED,
  IN  p_context     VARCHAR(20),
  OUT p_result      VARCHAR(12))
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  IF fn_has_case_access(p_checked_by, (SELECT case_id FROM evidence WHERE evidence_id = p_evidence_id)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not authorised to verify this evidence';
  END IF;
  START TRANSACTION;
    CALL sp_apply_integrity_check(p_evidence_id, p_actual_hash, p_checked_by,
                                  COALESCE(p_context, 'MANUAL'), p_result);
  COMMIT;
END$$

-- sp_register_evidence: registers a stored file. In ONE transaction:
--   1) evidence row with the immutable original SHA-256 hash
--   2) initial chain-of-custody entry (acquired by the uploader)
--   3) baseline integrity check (REGISTRATION)
CREATE PROCEDURE sp_register_evidence(
  IN  p_case_id     INT UNSIGNED,
  IN  p_name        VARCHAR(255),
  IN  p_type        VARCHAR(10),
  IN  p_description VARCHAR(500),
  IN  p_file_path   VARCHAR(500),
  IN  p_size        BIGINT UNSIGNED,
  IN  p_sha256      CHAR(64),
  IN  p_uploaded_by INT UNSIGNED,
  OUT p_evidence_id INT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_role   VARCHAR(20);
  DECLARE v_hash   CHAR(64) DEFAULT LOWER(p_sha256);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT case_status INTO v_status FROM cases WHERE case_id = p_case_id;
  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Case not found';
  END IF;
  IF v_status = 'CLOSED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot register evidence on a closed case';
  END IF;
  SELECT role INTO v_role FROM investigators WHERE investigator_id = p_uploaded_by AND is_active = 1;
  IF v_role IS NULL OR v_role = 'AUDITOR' OR fn_has_case_access(p_uploaded_by, p_case_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not authorised to register evidence for this case';
  END IF;

  START TRANSACTION;
    INSERT INTO evidence
      (case_id, evidence_name, evidence_type, description, file_path, file_size_bytes,
       original_hash, current_hash, integrity_status, last_verified_at, uploaded_by)
    VALUES
      (p_case_id, p_name, p_type, p_description, p_file_path, p_size,
       v_hash, v_hash, 'VERIFIED', NOW(), p_uploaded_by);
    SET p_evidence_id = LAST_INSERT_ID();

    INSERT INTO custody_transfers
      (evidence_id, transferred_from, transferred_to, transfer_reason,
       verification_status, hash_at_transfer, performed_by)
    VALUES
      (p_evidence_id, NULL, p_uploaded_by, 'Initial acquisition and registration of evidence',
       'VERIFIED', v_hash, p_uploaded_by);

    INSERT INTO integrity_checks
      (evidence_id, expected_hash, actual_hash, verification_result, check_context, checked_by)
    VALUES
      (p_evidence_id, v_hash, v_hash, 'VERIFIED', 'REGISTRATION', p_uploaded_by);
  COMMIT;
END$$

-- sp_transfer_custody: authorised hand-over of evidence. The file hash is
-- re-verified at the moment of transfer and stored with the transfer.
--   * only the current custodian, an ADMIN or a LEAD may transfer
--   * the receiver must be active, not an AUDITOR, and on the case
CREATE PROCEDURE sp_transfer_custody(
  IN  p_evidence_id  INT UNSIGNED,
  IN  p_to           INT UNSIGNED,
  IN  p_reason       VARCHAR(300),
  IN  p_actual_hash  CHAR(64),
  IN  p_performed_by INT UNSIGNED,
  OUT p_transfer_id  INT UNSIGNED)
BEGIN
  DECLARE v_current   INT UNSIGNED;
  DECLARE v_case      INT UNSIGNED;
  DECLARE v_by_role   VARCHAR(20);
  DECLARE v_to_role   VARCHAR(20);
  DECLARE v_result    VARCHAR(12);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT case_id INTO v_case FROM evidence WHERE evidence_id = p_evidence_id;
  IF v_case IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Evidence not found';
  END IF;
  SET v_current = fn_current_custodian(p_evidence_id);

  SELECT role INTO v_by_role FROM investigators WHERE investigator_id = p_performed_by AND is_active = 1;
  IF v_by_role IS NULL OR v_by_role = 'AUDITOR'
     OR (p_performed_by <> v_current AND v_by_role NOT IN ('ADMIN','LEAD_INVESTIGATOR')) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Only the current custodian, an ADMIN or a LEAD_INVESTIGATOR may transfer this evidence';
  END IF;
  IF p_to = v_current THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Receiver already holds this evidence';
  END IF;
  SELECT role INTO v_to_role FROM investigators WHERE investigator_id = p_to AND is_active = 1;
  IF v_to_role IS NULL OR v_to_role = 'AUDITOR' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Receiver must be an active, non-auditor investigator';
  END IF;
  IF v_to_role NOT IN ('ADMIN','LEAD_INVESTIGATOR')
     AND NOT EXISTS (SELECT 1 FROM case_assignments
                      WHERE case_id = v_case AND investigator_id = p_to AND assignment_status = 'ACTIVE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Receiver is not assigned to this case';
  END IF;

  START TRANSACTION;
    CALL sp_apply_integrity_check(p_evidence_id, p_actual_hash, p_performed_by, 'CUSTODY_TRANSFER', v_result);
    INSERT INTO custody_transfers
      (evidence_id, transferred_from, transferred_to, transfer_reason,
       verification_status, hash_at_transfer, performed_by)
    VALUES
      (p_evidence_id, v_current, p_to, p_reason,
       CASE v_result WHEN 'VERIFIED' THEN 'VERIFIED' WHEN 'TAMPERED' THEN 'TAMPERED' ELSE 'UNVERIFIED' END,
       LOWER(p_actual_hash), p_performed_by);
    SET p_transfer_id = LAST_INSERT_ID();
  COMMIT;
END$$

-- sp_delete_empty_case: ADMIN-only removal of a case created by mistake.
-- Refused if the case has evidence or alerts. Assignments are deleted
-- explicitly (not via ON DELETE CASCADE) because MySQL does NOT fire
-- triggers for cascaded foreign-key actions - explicit deletes are audited.
CREATE PROCEDURE sp_delete_empty_case(
  IN p_case_id    INT UNSIGNED,
  IN p_deleted_by INT UNSIGNED)
BEGIN
  DECLARE v_role VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  SELECT role INTO v_role FROM investigators WHERE investigator_id = p_deleted_by AND is_active = 1;
  IF v_role IS NULL OR v_role <> 'ADMIN' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an ADMIN can delete a case';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cases WHERE case_id = p_case_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Case not found';
  END IF;
  IF fn_case_evidence_count(p_case_id) > 0
     OR EXISTS (SELECT 1 FROM ai_alerts WHERE related_case_id = p_case_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Case has evidence or alerts and cannot be deleted';
  END IF;
  START TRANSACTION;
    DELETE FROM case_assignments WHERE case_id = p_case_id;
    DELETE FROM cases WHERE case_id = p_case_id;
  COMMIT;
END$$

-- sp_case_risk_summary: returns a one-row risk summary for a case
-- (procedure that returns a result set).
CREATE PROCEDURE sp_case_risk_summary(IN p_case_id INT UNSIGNED)
BEGIN
  SELECT c.case_code,
         c.case_title,
         c.case_status,
         fn_case_evidence_count(c.case_id)                             AS evidence_items,
         (SELECT COUNT(*) FROM evidence e
           WHERE e.case_id = c.case_id AND e.integrity_status <> 'VERIFIED') AS compromised_items,
         (SELECT COUNT(*) FROM audit_logs a
           WHERE a.related_case_id = c.case_id)                         AS audit_events,
         (SELECT COUNT(*) FROM audit_logs a
           WHERE a.related_case_id = c.case_id
             AND a.risk_level IN ('HIGH','CRITICAL'))                   AS high_risk_events,
         fn_case_risk_score(c.case_id)                                  AS risk_score,
         fn_risk_level(fn_case_risk_score(c.case_id))                   AS risk_level
    FROM cases c
   WHERE c.case_id = p_case_id;
END$$

DELIMITER ;
