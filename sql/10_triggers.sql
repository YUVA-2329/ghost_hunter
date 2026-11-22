-- =====================================================================
-- SQL GHOST HUNTER  |  10_triggers.sql
-- PURPOSE : Automatic database auditing and evidence protection.
--
-- CONCEPTS: AFTER INSERT / AFTER UPDATE / AFTER DELETE triggers,
--           BEFORE UPDATE / BEFORE DELETE triggers, OLD and NEW row
--           references, JSON_OBJECT(), SIGNAL.
--
-- HOW IDENTITY REACHES A TRIGGER
--   The backend authenticates the investigator from a server-side
--   session, then runs on the SAME connection:
--       SET @app_investigator_id = <id>, @app_client_ip = '<ip>';
--   Every trigger copies @app_investigator_id into audit_logs.
--   If the variable is NULL the change did NOT come through the
--   application (e.g. someone used MySQL Workbench directly). That is
--   recorded as investigator_id = NULL, the MySQL account in db_user,
--   and the risk level is escalated.
--
-- NO RECURSION: triggers write only to audit_logs, and audit_logs has
--   no trigger that writes anywhere. Its own triggers only BLOCK changes.
--
-- Run after 09_procedures_functions.sql (triggers use fn_* functions).
-- =====================================================================
USE ghost_hunter;

DROP TRIGGER IF EXISTS trg_investigators_after_insert;
DROP TRIGGER IF EXISTS trg_investigators_after_update;
DROP TRIGGER IF EXISTS trg_investigators_after_delete;
DROP TRIGGER IF EXISTS trg_cases_after_insert;
DROP TRIGGER IF EXISTS trg_cases_after_update;
DROP TRIGGER IF EXISTS trg_cases_after_delete;
DROP TRIGGER IF EXISTS trg_evidence_protect_original_hash;
DROP TRIGGER IF EXISTS trg_evidence_after_insert;
DROP TRIGGER IF EXISTS trg_evidence_after_update;
DROP TRIGGER IF EXISTS trg_evidence_after_delete;
DROP TRIGGER IF EXISTS trg_assignments_after_insert;
DROP TRIGGER IF EXISTS trg_assignments_after_update;
DROP TRIGGER IF EXISTS trg_assignments_after_delete;
DROP TRIGGER IF EXISTS trg_custody_after_insert;
DROP TRIGGER IF EXISTS trg_custody_block_update;
DROP TRIGGER IF EXISTS trg_custody_block_delete;
DROP TRIGGER IF EXISTS trg_integrity_after_insert;
DROP TRIGGER IF EXISTS trg_integrity_block_update;
DROP TRIGGER IF EXISTS trg_integrity_block_delete;
DROP TRIGGER IF EXISTS trg_rules_after_update;
DROP TRIGGER IF EXISTS trg_alerts_after_update;
DROP TRIGGER IF EXISTS trg_audit_block_update;
DROP TRIGGER IF EXISTS trg_audit_block_delete;

DELIMITER $$

-- =====================================================================
-- investigators  (password_hash is NEVER copied into the audit log)
-- =====================================================================
CREATE TRIGGER trg_investigators_after_insert
AFTER INSERT ON investigators FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'INSERT', 'investigators', NEW.investigator_id, NULL,
          JSON_OBJECT('investigator_id', NEW.investigator_id, 'investigator_name', NEW.investigator_name,
                      'email', NEW.email, 'role', NEW.role, 'is_active', NEW.is_active),
          @app_client_ip, USER(),
          fn_max_risk('MEDIUM', fn_audit_risk('INSERT', 'investigators', @app_investigator_id)));
END$$

CREATE TRIGGER trg_investigators_after_update
AFTER UPDATE ON investigators FOR EACH ROW
BEGIN
  DECLARE v_risk VARCHAR(10);
  SET v_risk = fn_audit_risk('UPDATE', 'investigators', @app_investigator_id);
  IF NOT (OLD.role <=> NEW.role) THEN
    SET v_risk = fn_max_risk(v_risk, 'HIGH');            -- privilege change
  END IF;
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'UPDATE', 'investigators', NEW.investigator_id,
          JSON_OBJECT('investigator_name', OLD.investigator_name, 'email', OLD.email,
                      'role', OLD.role, 'is_active', OLD.is_active),
          JSON_OBJECT('investigator_name', NEW.investigator_name, 'email', NEW.email,
                      'role', NEW.role, 'is_active', NEW.is_active,
                      'password_changed', NOT (OLD.password_hash <=> NEW.password_hash)),
          @app_client_ip, USER(), v_risk);
END$$

CREATE TRIGGER trg_investigators_after_delete
AFTER DELETE ON investigators FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'DELETE', 'investigators', OLD.investigator_id,
          JSON_OBJECT('investigator_id', OLD.investigator_id, 'investigator_name', OLD.investigator_name,
                      'email', OLD.email, 'role', OLD.role, 'is_active', OLD.is_active),
          NULL, @app_client_ip, USER(),
          fn_audit_risk('DELETE', 'investigators', @app_investigator_id));
END$$

-- =====================================================================
-- cases
-- =====================================================================
CREATE TRIGGER trg_cases_after_insert
AFTER INSERT ON cases FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'INSERT', 'cases', NEW.case_id, NEW.case_id, NULL,
          JSON_OBJECT('case_id', NEW.case_id, 'case_code', NEW.case_code, 'case_title', NEW.case_title,
                      'case_description', NEW.case_description, 'case_status', NEW.case_status,
                      'priority', NEW.priority, 'created_by', NEW.created_by),
          @app_client_ip, USER(), fn_audit_risk('INSERT', 'cases', @app_investigator_id));
END$$

CREATE TRIGGER trg_cases_after_update
AFTER UPDATE ON cases FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'UPDATE', 'cases', NEW.case_id, NEW.case_id,
          JSON_OBJECT('case_code', OLD.case_code, 'case_title', OLD.case_title,
                      'case_description', OLD.case_description, 'case_status', OLD.case_status,
                      'priority', OLD.priority, 'created_by', OLD.created_by),
          JSON_OBJECT('case_code', NEW.case_code, 'case_title', NEW.case_title,
                      'case_description', NEW.case_description, 'case_status', NEW.case_status,
                      'priority', NEW.priority, 'created_by', NEW.created_by),
          @app_client_ip, USER(), fn_audit_risk('UPDATE', 'cases', @app_investigator_id));
END$$

CREATE TRIGGER trg_cases_after_delete
AFTER DELETE ON cases FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'DELETE', 'cases', OLD.case_id, OLD.case_id,
          JSON_OBJECT('case_id', OLD.case_id, 'case_code', OLD.case_code, 'case_title', OLD.case_title,
                      'case_description', OLD.case_description, 'case_status', OLD.case_status,
                      'priority', OLD.priority, 'created_by', OLD.created_by),
          NULL, @app_client_ip, USER(), fn_audit_risk('DELETE', 'cases', @app_investigator_id));
END$$

-- =====================================================================
-- evidence
-- =====================================================================

-- PROTECTION: the original hash, size, uploader and upload time are
-- write-once. Any attempt to change them is rejected.
CREATE TRIGGER trg_evidence_protect_original_hash
BEFORE UPDATE ON evidence FOR EACH ROW
BEGIN
  IF NOT (OLD.original_hash <=> NEW.original_hash) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FORENSIC VIOLATION: original_hash is immutable once evidence is registered';
  END IF;
  IF NOT (OLD.file_size_bytes <=> NEW.file_size_bytes)
     OR NOT (OLD.uploaded_by <=> NEW.uploaded_by)
     OR NOT (OLD.uploaded_at <=> NEW.uploaded_at) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FORENSIC VIOLATION: registration details of evidence are immutable';
  END IF;
END$$

CREATE TRIGGER trg_evidence_after_insert
AFTER INSERT ON evidence FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'INSERT', 'evidence', NEW.evidence_id, NEW.case_id, NULL,
          JSON_OBJECT('evidence_id', NEW.evidence_id, 'case_id', NEW.case_id,
                      'evidence_name', NEW.evidence_name, 'evidence_type', NEW.evidence_type,
                      'file_path', NEW.file_path, 'file_size_bytes', NEW.file_size_bytes,
                      'original_hash', NEW.original_hash, 'integrity_status', NEW.integrity_status,
                      'uploaded_by', NEW.uploaded_by),
          @app_client_ip, USER(), fn_audit_risk('INSERT', 'evidence', @app_investigator_id));
END$$

CREATE TRIGGER trg_evidence_after_update
AFTER UPDATE ON evidence FOR EACH ROW
BEGIN
  DECLARE v_risk VARCHAR(10) DEFAULT 'LOW';
  -- 1) integrity status became bad
  IF NEW.integrity_status = 'TAMPERED' AND OLD.integrity_status <> 'TAMPERED' THEN
    SET v_risk = 'CRITICAL';
  ELSEIF NEW.integrity_status = 'MISSING' AND OLD.integrity_status <> 'MISSING' THEN
    SET v_risk = 'HIGH';
  END IF;
  -- 2) descriptive / location metadata of evidence edited
  IF NOT (OLD.file_path <=> NEW.file_path) OR NOT (OLD.case_id <=> NEW.case_id)
     OR NOT (OLD.evidence_name <=> NEW.evidence_name) OR NOT (OLD.evidence_type <=> NEW.evidence_type)
     OR NOT (OLD.description <=> NEW.description) THEN
    SET v_risk = fn_max_risk(v_risk, 'HIGH');
  END IF;
  -- 3) no application identity -> escalate
  IF @app_investigator_id IS NULL THEN
    SET v_risk = fn_escalate_risk(v_risk);
  END IF;
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'UPDATE', 'evidence', NEW.evidence_id, NEW.case_id,
          JSON_OBJECT('case_id', OLD.case_id, 'evidence_name', OLD.evidence_name,
                      'evidence_type', OLD.evidence_type, 'description', OLD.description,
                      'file_path', OLD.file_path, 'current_hash', OLD.current_hash,
                      'integrity_status', OLD.integrity_status, 'last_verified_at', OLD.last_verified_at),
          JSON_OBJECT('case_id', NEW.case_id, 'evidence_name', NEW.evidence_name,
                      'evidence_type', NEW.evidence_type, 'description', NEW.description,
                      'file_path', NEW.file_path, 'current_hash', NEW.current_hash,
                      'integrity_status', NEW.integrity_status, 'last_verified_at', NEW.last_verified_at),
          @app_client_ip, USER(), v_risk);
END$$

CREATE TRIGGER trg_evidence_after_delete
AFTER DELETE ON evidence FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'DELETE', 'evidence', OLD.evidence_id, OLD.case_id,
          JSON_OBJECT('evidence_id', OLD.evidence_id, 'case_id', OLD.case_id,
                      'evidence_name', OLD.evidence_name, 'file_path', OLD.file_path,
                      'original_hash', OLD.original_hash, 'integrity_status', OLD.integrity_status,
                      'uploaded_by', OLD.uploaded_by),
          NULL, @app_client_ip, USER(), fn_audit_risk('DELETE', 'evidence', @app_investigator_id));
END$$

-- =====================================================================
-- case_assignments
-- =====================================================================
CREATE TRIGGER trg_assignments_after_insert
AFTER INSERT ON case_assignments FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'INSERT', 'case_assignments', NEW.assignment_id, NEW.case_id, NULL,
          JSON_OBJECT('assignment_id', NEW.assignment_id, 'case_id', NEW.case_id,
                      'investigator_id', NEW.investigator_id, 'assignment_role', NEW.assignment_role,
                      'assignment_status', NEW.assignment_status, 'assigned_by', NEW.assigned_by),
          @app_client_ip, USER(), fn_audit_risk('INSERT', 'case_assignments', @app_investigator_id));
END$$

CREATE TRIGGER trg_assignments_after_update
AFTER UPDATE ON case_assignments FOR EACH ROW
BEGIN
  DECLARE v_risk VARCHAR(10);
  SET v_risk = fn_audit_risk('UPDATE', 'case_assignments', @app_investigator_id);
  IF NEW.assignment_status = 'REMOVED' AND OLD.assignment_status <> 'REMOVED' THEN
    SET v_risk = fn_max_risk(v_risk, 'MEDIUM');
  END IF;
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'UPDATE', 'case_assignments', NEW.assignment_id, NEW.case_id,
          JSON_OBJECT('case_id', OLD.case_id, 'investigator_id', OLD.investigator_id,
                      'assignment_role', OLD.assignment_role, 'assignment_status', OLD.assignment_status),
          JSON_OBJECT('case_id', NEW.case_id, 'investigator_id', NEW.investigator_id,
                      'assignment_role', NEW.assignment_role, 'assignment_status', NEW.assignment_status),
          @app_client_ip, USER(), v_risk);
END$$

CREATE TRIGGER trg_assignments_after_delete
AFTER DELETE ON case_assignments FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'DELETE', 'case_assignments', OLD.assignment_id, OLD.case_id,
          JSON_OBJECT('assignment_id', OLD.assignment_id, 'case_id', OLD.case_id,
                      'investigator_id', OLD.investigator_id, 'assignment_role', OLD.assignment_role,
                      'assignment_status', OLD.assignment_status),
          NULL, @app_client_ip, USER(), fn_audit_risk('DELETE', 'case_assignments', @app_investigator_id));
END$$

-- =====================================================================
-- custody_transfers  (append-only)
-- =====================================================================
CREATE TRIGGER trg_custody_after_insert
AFTER INSERT ON custody_transfers FOR EACH ROW
BEGIN
  DECLARE v_risk VARCHAR(10);
  SET v_risk = CASE NEW.verification_status
                 WHEN 'TAMPERED'   THEN 'CRITICAL'
                 WHEN 'UNVERIFIED' THEN 'MEDIUM'
                 ELSE 'LOW' END;
  IF @app_investigator_id IS NULL THEN SET v_risk = fn_escalate_risk(v_risk); END IF;
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level)
  VALUES (@app_investigator_id, 'INSERT', 'custody_transfers', NEW.transfer_id,
          (SELECT case_id FROM evidence WHERE evidence_id = NEW.evidence_id), NULL,
          JSON_OBJECT('transfer_id', NEW.transfer_id, 'evidence_id', NEW.evidence_id,
                      'transferred_from', NEW.transferred_from, 'transferred_to', NEW.transferred_to,
                      'transfer_reason', NEW.transfer_reason,
                      'verification_status', NEW.verification_status,
                      'hash_at_transfer', NEW.hash_at_transfer, 'performed_by', NEW.performed_by),
          @app_client_ip, USER(), v_risk);
END$$

CREATE TRIGGER trg_custody_block_update
BEFORE UPDATE ON custody_transfers FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chain-of-custody history is append-only and cannot be edited';
END$$

CREATE TRIGGER trg_custody_block_delete
BEFORE DELETE ON custody_transfers FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chain-of-custody history is append-only and cannot be deleted';
END$$

-- =====================================================================
-- integrity_checks  (append-only)
-- =====================================================================
CREATE TRIGGER trg_integrity_after_insert
AFTER INSERT ON integrity_checks FOR EACH ROW
BEGIN
  DECLARE v_risk VARCHAR(10);
  SET v_risk = CASE NEW.verification_result
                 WHEN 'TAMPERED' THEN 'CRITICAL'
                 WHEN 'MISSING'  THEN 'HIGH'
                 ELSE 'LOW' END;
  IF @app_investigator_id IS NULL THEN SET v_risk = fn_escalate_risk(v_risk); END IF;
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                          old_values, new_values, ip_address, db_user, risk_level, details)
  VALUES (@app_investigator_id, 'INSERT', 'integrity_checks', NEW.check_id,
          (SELECT case_id FROM evidence WHERE evidence_id = NEW.evidence_id), NULL,
          JSON_OBJECT('check_id', NEW.check_id, 'evidence_id', NEW.evidence_id,
                      'expected_hash', NEW.expected_hash, 'actual_hash', NEW.actual_hash,
                      'verification_result', NEW.verification_result,
                      'check_context', NEW.check_context, 'checked_by', NEW.checked_by),
          @app_client_ip, USER(), v_risk,
          CONCAT('SHA-256 verification of evidence ', NEW.evidence_id, ': ', NEW.verification_result));
END$$

CREATE TRIGGER trg_integrity_block_update
BEFORE UPDATE ON integrity_checks FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Integrity check history is append-only and cannot be edited';
END$$

CREATE TRIGGER trg_integrity_block_delete
BEFORE DELETE ON integrity_checks FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Integrity check history is append-only and cannot be deleted';
END$$

-- =====================================================================
-- detection_rules  (changing detection settings is itself sensitive)
-- =====================================================================
CREATE TRIGGER trg_rules_after_update
AFTER UPDATE ON detection_rules FOR EACH ROW
BEGIN
  DECLARE v_risk VARCHAR(10);
  SET v_risk = fn_audit_risk('UPDATE', 'detection_rules', @app_investigator_id);
  IF OLD.is_enabled = 1 AND NEW.is_enabled = 0 THEN
    SET v_risk = fn_max_risk(v_risk, 'HIGH');           -- a detector was switched off
  END IF;
  INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id,
                          old_values, new_values, ip_address, db_user, risk_level, details)
  VALUES (@app_investigator_id, 'UPDATE', 'detection_rules', NULL,
          JSON_OBJECT('rule_code', OLD.rule_code, 'threshold', OLD.threshold, 'window_minutes', OLD.window_minutes,
                      'base_score', OLD.base_score, 'is_enabled', OLD.is_enabled, 'params', OLD.params),
          JSON_OBJECT('rule_code', NEW.rule_code, 'threshold', NEW.threshold, 'window_minutes', NEW.window_minutes,
                      'base_score', NEW.base_score, 'is_enabled', NEW.is_enabled, 'params', NEW.params),
          @app_client_ip, USER(), v_risk, CONCAT('Detection rule changed: ', NEW.rule_code));
END$$

-- =====================================================================
-- ai_alerts  (dismissing or escalating an alert is recorded)
-- =====================================================================
CREATE TRIGGER trg_alerts_after_update
AFTER UPDATE ON ai_alerts FOR EACH ROW
BEGIN
  IF NOT (OLD.status <=> NEW.status) THEN
    INSERT INTO audit_logs (investigator_id, action_type, table_name, record_id, related_case_id,
                            old_values, new_values, ip_address, db_user, risk_level, details)
    VALUES (@app_investigator_id, 'UPDATE', 'ai_alerts', NEW.alert_id, NEW.related_case_id,
            JSON_OBJECT('status', OLD.status, 'severity', OLD.severity, 'rule_code', OLD.rule_code),
            JSON_OBJECT('status', NEW.status, 'severity', NEW.severity, 'rule_code', NEW.rule_code),
            @app_client_ip, USER(),
            IF(NEW.status = 'DISMISSED' AND OLD.severity IN ('HIGH','CRITICAL'), 'MEDIUM', 'LOW'),
            CONCAT('Alert ', NEW.alert_id, ' status ', OLD.status, ' -> ', NEW.status));
  END IF;
END$$

-- =====================================================================
-- audit_logs  (the audit trail itself is append-only)
-- =====================================================================
CREATE TRIGGER trg_audit_block_update
BEFORE UPDATE ON audit_logs FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only and cannot be modified';
END$$

CREATE TRIGGER trg_audit_block_delete
BEFORE DELETE ON audit_logs FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only and cannot be deleted';
END$$

DELIMITER ;
