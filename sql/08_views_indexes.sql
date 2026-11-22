-- =====================================================================
-- SQL GHOST HUNTER  |  08_views_indexes.sql
-- PURPOSE : VIEWS (saved queries used by the application and reports)
--           and INDEXES (speed up the most frequent forensic look-ups).
-- CONCEPTS: CREATE OR REPLACE VIEW, CREATE INDEX, composite indexes,
--           DROP INDEX, EXPLAIN.
-- Safe to re-run: views are replaced, indexes are dropped first if present.
-- =====================================================================
USE ghost_hunter;

-- ---------------------------------------------------------------------
-- INDEXES
-- Foreign-key columns are indexed automatically by InnoDB. Three composite
-- indexes that also serve foreign keys are declared inside CREATE TABLE in
-- 01_schema.sql (idx_audit_actor_time, idx_custody_evidence_time,
-- idx_integrity_evidence_time). The indexes below support the filters the
-- Audit Log and AI pages use constantly.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS tmp_drop_index_if_exists;
DELIMITER $$
CREATE PROCEDURE tmp_drop_index_if_exists(IN p_table VARCHAR(64), IN p_index VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.statistics
              WHERE table_schema = DATABASE() AND table_name = p_table AND index_name = p_index) THEN
    SET @ddl = CONCAT('DROP INDEX ', p_index, ' ON ', p_table);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL tmp_drop_index_if_exists('audit_logs', 'idx_audit_timestamp');
CREATE INDEX idx_audit_timestamp      ON audit_logs (`timestamp`);           -- date-range filters

CALL tmp_drop_index_if_exists('audit_logs', 'idx_audit_table_record');
CREATE INDEX idx_audit_table_record   ON audit_logs (table_name, record_id);  -- "who modified this record"

CALL tmp_drop_index_if_exists('audit_logs', 'idx_audit_case_time');
CREATE INDEX idx_audit_case_time      ON audit_logs (related_case_id, `timestamp`); -- case timelines

CALL tmp_drop_index_if_exists('audit_logs', 'idx_audit_action_risk');
CREATE INDEX idx_audit_action_risk    ON audit_logs (action_type, risk_level);

CALL tmp_drop_index_if_exists('evidence', 'idx_evidence_status');
CREATE INDEX idx_evidence_status      ON evidence (integrity_status);

CALL tmp_drop_index_if_exists('login_attempts', 'idx_login_email_time');
CREATE INDEX idx_login_email_time     ON login_attempts (email, attempted_at);

CALL tmp_drop_index_if_exists('ai_alerts', 'idx_alerts_status_severity');
CREATE INDEX idx_alerts_status_severity ON ai_alerts (status, severity);

CALL tmp_drop_index_if_exists('cases', 'idx_cases_status');
CREATE INDEX idx_cases_status         ON cases (case_status);

DROP PROCEDURE tmp_drop_index_if_exists;

-- List the indexes of audit_logs (PRIMARY, FK/composite and the ones above)
SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns, non_unique
  FROM information_schema.statistics
 WHERE table_schema = DATABASE() AND table_name = 'audit_logs'
 GROUP BY index_name, non_unique;

-- ---------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------

-- vw_evidence_overview: one row per evidence item with case, uploader,
-- current custodian (derived from custody history) and check counts.
CREATE OR REPLACE VIEW vw_evidence_overview AS
SELECT e.evidence_id,
       CONCAT('EV-', LPAD(e.evidence_id, 4, '0'))     AS evidence_code,
       e.case_id,
       c.case_code,
       c.case_title,
       e.evidence_name,
       e.evidence_type,
       e.description,
       e.file_size_bytes,
       e.original_hash,
       e.current_hash,
       e.integrity_status,
       e.last_verified_at,
       e.uploaded_by,
       up.investigator_name                            AS uploaded_by_name,
       e.uploaded_at,
       fn_current_custodian(e.evidence_id)             AS custodian_id,
       cu.investigator_name                            AS custodian_name,
       (SELECT COUNT(*) FROM integrity_checks ic WHERE ic.evidence_id = e.evidence_id) AS check_count,
       (SELECT COUNT(*) FROM integrity_checks ic
         WHERE ic.evidence_id = e.evidence_id AND ic.verification_result <> 'VERIFIED') AS failed_checks
  FROM evidence e
  JOIN cases c          ON c.case_id = e.case_id
  JOIN investigators up ON up.investigator_id = e.uploaded_by
  LEFT JOIN investigators cu ON cu.investigator_id = fn_current_custodian(e.evidence_id);

-- vw_audit_trail: audit events with the investigator's name and case code.
-- LEFT JOINs keep events with no investigator (direct DB access).
CREATE OR REPLACE VIEW vw_audit_trail AS
SELECT a.log_id,
       a.`timestamp`,
       a.action_type,
       a.event_source,
       a.table_name,
       a.record_id,
       a.related_case_id,
       c.case_code,
       a.investigator_id,
       COALESCE(i.investigator_name, 'UNIDENTIFIED (outside application)') AS investigator_name,
       i.role                                          AS investigator_role,
       a.old_values,
       a.new_values,
       a.ip_address,
       a.db_user,
       a.risk_level,
       a.details
  FROM audit_logs a
  LEFT JOIN investigators i ON i.investigator_id = a.investigator_id
  LEFT JOIN cases c         ON c.case_id = a.related_case_id;

-- vw_case_summary: one row per case with workload and risk figures.
CREATE OR REPLACE VIEW vw_case_summary AS
SELECT c.case_id,
       c.case_code,
       c.case_title,
       c.case_description,
       c.case_status,
       c.priority,
       c.created_by,
       cr.investigator_name                            AS created_by_name,
       c.created_at,
       c.updated_at,
       (SELECT COUNT(*) FROM evidence e WHERE e.case_id = c.case_id)                AS evidence_count,
       (SELECT COUNT(*) FROM evidence e
         WHERE e.case_id = c.case_id AND e.integrity_status = 'VERIFIED')           AS verified_count,
       (SELECT COUNT(*) FROM evidence e
         WHERE e.case_id = c.case_id AND e.integrity_status <> 'VERIFIED')          AS compromised_count,
       (SELECT COUNT(*) FROM case_assignments ca
         WHERE ca.case_id = c.case_id AND ca.assignment_status = 'ACTIVE')          AS active_members,
       (SELECT COUNT(*) FROM ai_alerts al
         WHERE al.related_case_id = c.case_id AND al.status IN ('OPEN','ESCALATED')) AS open_alerts,
       fn_case_risk_score(c.case_id)                   AS risk_score,
       fn_risk_level(fn_case_risk_score(c.case_id))    AS risk_level
  FROM cases c
  JOIN investigators cr ON cr.investigator_id = c.created_by;

-- vw_custody_history: readable chain of custody (names instead of IDs).
CREATE OR REPLACE VIEW vw_custody_history AS
SELECT t.transfer_id,
       t.evidence_id,
       CONCAT('EV-', LPAD(t.evidence_id, 4, '0'))     AS evidence_code,
       e.evidence_name,
       e.case_id,
       c.case_code,
       t.transferred_from,
       COALESCE(f.investigator_name, '(initial acquisition)') AS from_name,
       t.transferred_to,
       r.investigator_name                             AS to_name,
       t.transfer_reason,
       t.transfer_timestamp,
       t.verification_status,
       t.hash_at_transfer,
       t.performed_by,
       p.investigator_name                             AS performed_by_name
  FROM custody_transfers t
  JOIN evidence e            ON e.evidence_id = t.evidence_id
  JOIN cases c               ON c.case_id = e.case_id
  LEFT JOIN investigators f  ON f.investigator_id = t.transferred_from
  JOIN investigators r       ON r.investigator_id = t.transferred_to
  JOIN investigators p       ON p.investigator_id = t.performed_by;

-- vw_integrity_history: every verification with names.
CREATE OR REPLACE VIEW vw_integrity_history AS
SELECT ic.check_id,
       ic.evidence_id,
       CONCAT('EV-', LPAD(ic.evidence_id, 4, '0'))    AS evidence_code,
       e.evidence_name,
       e.case_id,
       ic.expected_hash,
       ic.actual_hash,
       ic.verification_result,
       ic.check_context,
       ic.checked_at,
       ic.checked_by,
       i.investigator_name                             AS checked_by_name
  FROM integrity_checks ic
  JOIN evidence e      ON e.evidence_id = ic.evidence_id
  JOIN investigators i ON i.investigator_id = ic.checked_by;

-- vw_dashboard_stats: single-row live statistics for the dashboard.
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT (SELECT COUNT(*) FROM cases)                                          AS total_cases,
       (SELECT COUNT(*) FROM cases WHERE case_status <> 'CLOSED')            AS open_cases,
       (SELECT COUNT(*) FROM evidence)                                       AS total_evidence,
       (SELECT COUNT(*) FROM evidence WHERE integrity_status = 'VERIFIED')   AS verified_evidence,
       (SELECT COUNT(*) FROM evidence WHERE integrity_status <> 'VERIFIED')  AS compromised_evidence,
       (SELECT COUNT(*) FROM audit_logs)                                     AS total_audit_events,
       (SELECT COUNT(*) FROM audit_logs WHERE risk_level IN ('HIGH','CRITICAL')) AS high_risk_events,
       (SELECT COUNT(*) FROM ai_alerts WHERE status IN ('OPEN','ESCALATED')) AS open_alerts,
       (SELECT COUNT(*) FROM ai_alerts
         WHERE status IN ('OPEN','ESCALATED') AND severity IN ('HIGH','CRITICAL')) AS high_risk_alerts,
       (SELECT COUNT(*) FROM custody_transfers)                              AS custody_transfers,
       (SELECT COUNT(*) FROM integrity_checks)                               AS integrity_checks;

-- vw_investigator_activity: activity totals per investigator.
CREATE OR REPLACE VIEW vw_investigator_activity AS
SELECT i.investigator_id,
       i.investigator_name,
       i.role,
       COUNT(a.log_id)                                                     AS total_events,
       SUM(a.action_type IN ('INSERT','UPDATE','DELETE'))                  AS data_changes,
       SUM(a.action_type = 'DELETE')                                       AS deletes,
       SUM(a.risk_level IN ('HIGH','CRITICAL'))                            AS high_risk_events,
       MAX(a.`timestamp`)                                                  AS last_activity
  FROM investigators i
  LEFT JOIN audit_logs a ON a.investigator_id = i.investigator_id
 GROUP BY i.investigator_id, i.investigator_name, i.role;

-- ---------------------------------------------------------------------
-- EXPLAIN: shows that the "who modified this record" lookup uses the
-- composite index idx_audit_table_record instead of a full table scan.
-- Expected: key = idx_audit_table_record, type = ref
-- ---------------------------------------------------------------------
EXPLAIN SELECT log_id, action_type, investigator_id, `timestamp`
          FROM audit_logs
         WHERE table_name = 'evidence' AND record_id = 7;
