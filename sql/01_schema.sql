-- =====================================================================
-- SQL GHOST HUNTER  |  01_schema.sql
-- "Every Database Change Leaves a Trace."
--
-- PURPOSE : Creates the ghost_hunter database and all relational tables
--           with PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, CHECK and
--           DEFAULT constraints, plus reference data (detection rules).
--
-- CONCEPTS: CREATE DATABASE, CREATE TABLE, constraints, normalization
--           (3NF), JSON columns, referential integrity.
--
-- RUN ORDER FOR A FRESH INSTALL (see README):
--   01_schema -> 09_procedures_functions -> 10_triggers -> 08_views_indexes
--   -> 13_security_privileges -> 02_sample_data
--   The remaining scripts (03-07, 11, 12) are demonstration scripts.
--
-- WARNING : This script RECREATES the database (fresh install).
-- =====================================================================

DROP DATABASE IF EXISTS ghost_hunter;
CREATE DATABASE ghost_hunter
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE ghost_hunter;

-- ---------------------------------------------------------------------
-- TABLE 1: investigators  (application users)
-- One row per person. Role is a constrained domain (CHECK).
-- password_hash stores a bcrypt hash, never the password itself.
-- ---------------------------------------------------------------------
CREATE TABLE investigators (
  investigator_id   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  investigator_name VARCHAR(100)     NOT NULL,
  email             VARCHAR(150)     NOT NULL,
  role              VARCHAR(20)      NOT NULL DEFAULT 'INVESTIGATOR',
  password_hash     VARCHAR(255)     NOT NULL,
  is_active         TINYINT(1)       NOT NULL DEFAULT 1,
  created_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_investigators PRIMARY KEY (investigator_id),
  CONSTRAINT uq_investigators_email UNIQUE (email),
  CONSTRAINT chk_investigators_role
    CHECK (role IN ('ADMIN','LEAD_INVESTIGATOR','INVESTIGATOR','AUDITOR')),
  CONSTRAINT chk_investigators_email CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_investigators_name  CHECK (CHAR_LENGTH(TRIM(investigator_name)) >= 2),
  CONSTRAINT chk_investigators_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 2: cases  (investigations)
-- case_code is a human-friendly unique business key (CASE-001).
-- ---------------------------------------------------------------------
CREATE TABLE cases (
  case_id          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  case_code        VARCHAR(20)    NOT NULL,
  case_title       VARCHAR(200)   NOT NULL,
  case_description TEXT           NULL,
  case_status      VARCHAR(20)    NOT NULL DEFAULT 'OPEN',
  priority         VARCHAR(10)    NOT NULL DEFAULT 'MEDIUM',
  created_by       INT UNSIGNED   NOT NULL,
  created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME       NULL     DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_cases PRIMARY KEY (case_id),
  CONSTRAINT uq_cases_code UNIQUE (case_code),
  CONSTRAINT fk_cases_created_by FOREIGN KEY (created_by)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_cases_status
    CHECK (case_status IN ('OPEN','IN_PROGRESS','ON_HOLD','CLOSED')),
  CONSTRAINT chk_cases_priority
    CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT chk_cases_title CHECK (CHAR_LENGTH(TRIM(case_title)) >= 5)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 3: evidence  (digital evidence registered against a case)
-- original_hash is written once at registration and is IMMUTABLE
-- (enforced by trigger trg_evidence_protect_original_hash).
-- current_hash / integrity_status / last_verified_at cache the result
-- of the most recent integrity check (full history: integrity_checks).
-- ---------------------------------------------------------------------
CREATE TABLE evidence (
  evidence_id       INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  case_id           INT UNSIGNED     NOT NULL,
  evidence_name     VARCHAR(255)     NOT NULL,
  evidence_type     VARCHAR(10)      NOT NULL,
  description       VARCHAR(500)     NULL,
  file_path         VARCHAR(500)     NOT NULL,
  file_size_bytes   BIGINT UNSIGNED  NOT NULL,
  original_hash     CHAR(64)         NOT NULL,
  current_hash      CHAR(64)         NULL,
  integrity_status  VARCHAR(12)      NOT NULL DEFAULT 'VERIFIED',
  last_verified_at  DATETIME         NULL,
  uploaded_by       INT UNSIGNED     NOT NULL,
  uploaded_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_evidence PRIMARY KEY (evidence_id),
  CONSTRAINT uq_evidence_file_path UNIQUE (file_path),
  CONSTRAINT fk_evidence_case FOREIGN KEY (case_id)
    REFERENCES cases (case_id) ON DELETE RESTRICT,
  CONSTRAINT fk_evidence_uploaded_by FOREIGN KEY (uploaded_by)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_evidence_type
    CHECK (evidence_type IN ('PDF','PNG','JPEG','TXT','CSV','JSON','LOG')),
  CONSTRAINT chk_evidence_status
    CHECK (integrity_status IN ('VERIFIED','TAMPERED','MISSING')),
  CONSTRAINT chk_evidence_size CHECK (file_size_bytes > 0),
  CONSTRAINT chk_evidence_original_hash CHECK (REGEXP_LIKE(original_hash, '^[0-9a-f]{64}$', 'c')),
  CONSTRAINT chk_evidence_current_hash
    CHECK (current_hash IS NULL OR REGEXP_LIKE(current_hash, '^[0-9a-f]{64}$', 'c'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 4: custody_transfers  (chain of custody, append-only)
-- transferred_from IS NULL means initial acquisition at registration.
-- The CURRENT custodian is derived (fn_current_custodian), not stored,
-- so it can never disagree with the history (normalization).
-- ---------------------------------------------------------------------
CREATE TABLE custody_transfers (
  transfer_id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  evidence_id         INT UNSIGNED  NOT NULL,
  transferred_from    INT UNSIGNED  NULL,
  transferred_to      INT UNSIGNED  NOT NULL,
  transfer_reason     VARCHAR(300)  NOT NULL,
  transfer_timestamp  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_status VARCHAR(12)   NOT NULL DEFAULT 'UNVERIFIED',
  hash_at_transfer    CHAR(64)      NULL,
  performed_by        INT UNSIGNED  NOT NULL,
  CONSTRAINT pk_custody_transfers PRIMARY KEY (transfer_id),
  -- composite index: custody history of one item in time order (also serves the FK)
  INDEX idx_custody_evidence_time (evidence_id, transfer_timestamp),
  CONSTRAINT fk_custody_evidence FOREIGN KEY (evidence_id)
    REFERENCES evidence (evidence_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custody_from FOREIGN KEY (transferred_from)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custody_to FOREIGN KEY (transferred_to)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custody_performed_by FOREIGN KEY (performed_by)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_custody_verification
    CHECK (verification_status IN ('VERIFIED','TAMPERED','UNVERIFIED')),
  CONSTRAINT chk_custody_reason CHECK (CHAR_LENGTH(TRIM(transfer_reason)) >= 5),
  CONSTRAINT chk_custody_not_self
    CHECK (transferred_from IS NULL OR transferred_from <> transferred_to)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 5: integrity_checks  (every SHA-256 verification, append-only)
-- actual_hash IS NULL when the stored file could not be found (MISSING).
-- ---------------------------------------------------------------------
CREATE TABLE integrity_checks (
  check_id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  evidence_id         INT UNSIGNED  NOT NULL,
  expected_hash       CHAR(64)      NOT NULL,
  actual_hash         CHAR(64)      NULL,
  verification_result VARCHAR(12)   NOT NULL,
  check_context       VARCHAR(20)   NOT NULL DEFAULT 'MANUAL',
  checked_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_by          INT UNSIGNED  NOT NULL,
  CONSTRAINT pk_integrity_checks PRIMARY KEY (check_id),
  INDEX idx_integrity_evidence_time (evidence_id, checked_at),
  CONSTRAINT fk_integrity_evidence FOREIGN KEY (evidence_id)
    REFERENCES evidence (evidence_id) ON DELETE RESTRICT,
  CONSTRAINT fk_integrity_checked_by FOREIGN KEY (checked_by)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_integrity_result
    CHECK (verification_result IN ('VERIFIED','TAMPERED','MISSING')),
  CONSTRAINT chk_integrity_context
    CHECK (check_context IN ('REGISTRATION','MANUAL','CUSTODY_TRANSFER','SCHEDULED')),
  -- a VERIFIED result is only valid when both hashes are present and equal
  CONSTRAINT chk_integrity_consistent
    CHECK ( (verification_result = 'VERIFIED' AND actual_hash = expected_hash)
         OR (verification_result = 'TAMPERED' AND actual_hash IS NOT NULL AND actual_hash <> expected_hash)
         OR (verification_result = 'MISSING'  AND actual_hash IS NULL) )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 6: audit_logs  (forensic trail, append-only)
-- Written by database TRIGGERS (INSERT/UPDATE/DELETE on business tables)
-- and by sp_log_app_event (logins, downloads, reports ...).
-- investigator_id is NULL when no authenticated application identity
-- was present (direct database access or system activity).
-- related_case_id intentionally has NO foreign key: an audit record must
-- survive even if the case it describes is later deleted.
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  log_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  investigator_id INT UNSIGNED    NULL,
  action_type     VARCHAR(30)     NOT NULL,
  event_source    VARCHAR(12)     NOT NULL DEFAULT 'TRIGGER',
  table_name      VARCHAR(64)     NULL,
  record_id       BIGINT UNSIGNED NULL,
  related_case_id INT UNSIGNED    NULL,
  old_values      JSON            NULL,
  new_values      JSON            NULL,
  ip_address      VARCHAR(45)     NULL,
  db_user         VARCHAR(120)    NULL,
  `timestamp`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  risk_level      VARCHAR(10)     NOT NULL DEFAULT 'LOW',
  details         VARCHAR(500)    NULL,
  CONSTRAINT pk_audit_logs PRIMARY KEY (log_id),
  -- composite index: "what did investigator X do and when" (also serves the FK)
  INDEX idx_audit_actor_time (investigator_id, `timestamp`),
  CONSTRAINT fk_audit_investigator FOREIGN KEY (investigator_id)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_audit_action CHECK (action_type IN
    ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','EVIDENCE_DOWNLOAD',
     'INTEGRITY_CHECK','REPORT_GENERATED','AI_QUERY','ANALYSIS_RUN')),
  CONSTRAINT chk_audit_source CHECK (event_source IN ('TRIGGER','APPLICATION')),
  CONSTRAINT chk_audit_risk CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 7: case_assignments  (M:N between cases and investigators)
-- Removing someone from a case sets assignment_status = 'REMOVED'
-- (history is kept). UNIQUE prevents duplicate assignments.
-- ---------------------------------------------------------------------
CREATE TABLE case_assignments (
  assignment_id     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  case_id           INT UNSIGNED  NOT NULL,
  investigator_id   INT UNSIGNED  NOT NULL,
  assignment_role   VARCHAR(20)   NOT NULL DEFAULT 'MEMBER',
  assigned_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assignment_status VARCHAR(12)   NOT NULL DEFAULT 'ACTIVE',
  assigned_by       INT UNSIGNED  NULL,
  CONSTRAINT pk_case_assignments PRIMARY KEY (assignment_id),
  CONSTRAINT uq_case_assignment UNIQUE (case_id, investigator_id),
  CONSTRAINT fk_assign_case FOREIGN KEY (case_id)
    REFERENCES cases (case_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assign_investigator FOREIGN KEY (investigator_id)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assign_assigned_by FOREIGN KEY (assigned_by)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_assign_role CHECK (assignment_role IN ('LEAD','MEMBER','REVIEWER')),
  CONSTRAINT chk_assign_status CHECK (assignment_status IN ('ACTIVE','REMOVED'))
) ENGINE=InnoDB;

-- =====================================================================
-- SUPPORTING TABLES (each provides real functionality)
-- =====================================================================

-- TABLE 8: login_attempts - every login attempt (success or failure).
-- Used for brute-force lockout and the FAILED_LOGINS anomaly rule.
CREATE TABLE login_attempts (
  attempt_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email           VARCHAR(150)    NOT NULL,
  investigator_id INT UNSIGNED    NULL,
  ip_address      VARCHAR(45)     NULL,
  attempted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  success         TINYINT(1)      NOT NULL DEFAULT 0,
  failure_reason  VARCHAR(50)     NULL,
  CONSTRAINT pk_login_attempts PRIMARY KEY (attempt_id),
  CONSTRAINT fk_login_investigator FOREIGN KEY (investigator_id)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_login_success CHECK (success IN (0,1)),
  CONSTRAINT chk_login_reason CHECK (success = 1 OR failure_reason IS NOT NULL)
) ENGINE=InnoDB;

-- TABLE 9: app_sessions - server-side login sessions.
-- Only a SHA-256 of the session token is stored; the browser holds the
-- token in an HttpOnly cookie. The backend resolves the investigator
-- from this table (never from browser-supplied IDs).
CREATE TABLE app_sessions (
  session_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  investigator_id INT UNSIGNED    NOT NULL,
  token_hash      CHAR(64)        NOT NULL,
  ip_address      VARCHAR(45)     NULL,
  user_agent      VARCHAR(255)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME        NOT NULL,
  revoked_at      DATETIME        NULL,
  CONSTRAINT pk_app_sessions PRIMARY KEY (session_id),
  CONSTRAINT uq_app_sessions_token UNIQUE (token_hash),
  CONSTRAINT fk_session_investigator FOREIGN KEY (investigator_id)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_session_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB;

-- TABLE 10: detection_rules - configurable anomaly-detection rules.
-- Thresholds, windows and scores are data, so risk scoring is
-- configurable without code changes (admins edit them in the UI).
CREATE TABLE detection_rules (
  rule_code        VARCHAR(40)   NOT NULL,
  rule_name        VARCHAR(120)  NOT NULL,
  description      VARCHAR(500)  NOT NULL,
  detection_method VARCHAR(12)   NOT NULL DEFAULT 'RULE',
  threshold        DECIMAL(10,2) NOT NULL,
  window_minutes   INT UNSIGNED  NOT NULL DEFAULT 60,
  base_score       TINYINT UNSIGNED NOT NULL,
  is_enabled       TINYINT(1)    NOT NULL DEFAULT 1,
  params           JSON          NULL,
  updated_at       DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_detection_rules PRIMARY KEY (rule_code),
  CONSTRAINT chk_rule_method CHECK (detection_method IN ('RULE','STATISTICAL','ML')),
  CONSTRAINT chk_rule_score CHECK (base_score BETWEEN 0 AND 100),
  CONSTRAINT chk_rule_threshold CHECK (threshold > 0),
  CONSTRAINT chk_rule_window CHECK (window_minutes BETWEEN 1 AND 10080),
  CONSTRAINT chk_rule_enabled CHECK (is_enabled IN (0,1))
) ENGINE=InnoDB;

-- TABLE 11: ai_alerts - findings produced by the anomaly-detection engine.
-- fingerprint makes analysis idempotent: re-running it never duplicates
-- an alert for the same underlying events.
CREATE TABLE ai_alerts (
  alert_id                BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  rule_code               VARCHAR(40)      NOT NULL,
  detection_method        VARCHAR(12)      NOT NULL,
  severity                VARCHAR(10)      NOT NULL,
  risk_score              TINYINT UNSIGNED NOT NULL,
  title                   VARCHAR(200)     NOT NULL,
  explanation             TEXT             NOT NULL,
  supporting_facts        JSON             NULL,
  related_case_id         INT UNSIGNED     NULL,
  related_investigator_id INT UNSIGNED     NULL,
  related_evidence_id     INT UNSIGNED     NULL,
  fingerprint             CHAR(64)         NOT NULL,
  status                  VARCHAR(14)      NOT NULL DEFAULT 'OPEN',
  first_event_at          DATETIME         NULL,
  last_event_at           DATETIME         NULL,
  created_at              DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by             INT UNSIGNED     NULL,
  reviewed_at             DATETIME         NULL,
  CONSTRAINT pk_ai_alerts PRIMARY KEY (alert_id),
  CONSTRAINT uq_ai_alerts_fingerprint UNIQUE (fingerprint),
  CONSTRAINT fk_alert_rule FOREIGN KEY (rule_code)
    REFERENCES detection_rules (rule_code) ON DELETE RESTRICT,
  CONSTRAINT fk_alert_case FOREIGN KEY (related_case_id)
    REFERENCES cases (case_id) ON DELETE RESTRICT,
  CONSTRAINT fk_alert_investigator FOREIGN KEY (related_investigator_id)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT fk_alert_evidence FOREIGN KEY (related_evidence_id)
    REFERENCES evidence (evidence_id) ON DELETE RESTRICT,
  CONSTRAINT fk_alert_reviewed_by FOREIGN KEY (reviewed_by)
    REFERENCES investigators (investigator_id) ON DELETE RESTRICT,
  CONSTRAINT chk_alert_method CHECK (detection_method IN ('RULE','STATISTICAL','ML')),
  CONSTRAINT chk_alert_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT chk_alert_score CHECK (risk_score BETWEEN 0 AND 100),
  CONSTRAINT chk_alert_status CHECK (status IN ('OPEN','ACKNOWLEDGED','DISMISSED','ESCALATED'))
) ENGINE=InnoDB;

-- =====================================================================
-- REFERENCE DATA: default detection rules (configurable later)
-- =====================================================================
INSERT INTO detection_rules
  (rule_code, rule_name, description, detection_method, threshold, window_minutes, base_score, is_enabled, params)
VALUES
  ('INTEGRITY_FAILURE', 'Evidence integrity failure',
   'A SHA-256 verification produced a hash that differs from the original hash recorded at registration, or the file is missing.',
   'RULE', 1, 1440, 90, 1, NULL),
  ('REPEATED_DELETE', 'Repeated DELETE operations',
   'The same actor deleted several records within a short window.',
   'RULE', 3, 60, 55, 1, NULL),
  ('BULK_UPDATE', 'Unusually many UPDATE operations',
   'The same actor performed many UPDATE operations within a short window.',
   'RULE', 10, 30, 45, 1, NULL),
  ('FAILED_LOGINS', 'Multiple failed login attempts',
   'Several failed logins for the same account within a short window (possible password guessing).',
   'RULE', 5, 15, 50, 1, NULL),
  ('OFF_HOURS_ACTIVITY', 'Activity outside working hours',
   'Data-modifying operations performed outside configured working hours.',
   'RULE', 1, 120, 30, 1, JSON_OBJECT('start_hour', 8, 'end_hour', 20)),
  ('DIRECT_DB_CHANGE', 'Modification outside the application',
   'A business table was changed with no authenticated application identity (direct database access that bypassed the application).',
   'RULE', 1, 60, 60, 1, NULL),
  ('SENSITIVE_MODIFICATION', 'Change to a sensitive record',
   'Evidence metadata, investigator roles or detection rules were modified.',
   'RULE', 1, 60, 45, 1, NULL),
  ('REPEATED_RECORD_CHANGE', 'Repeated changes to the same record',
   'The same record was modified several times within a short window.',
   'RULE', 3, 60, 45, 1, NULL),
  ('EVIDENCE_ACCESS_BURST', 'Suspicious evidence access pattern',
   'An investigator downloaded many evidence files within a short window.',
   'RULE', 4, 30, 45, 1, NULL),
  ('HIGH_ACTIVITY_ZSCORE', 'Unusually high database activity (statistical)',
   'Hourly activity of an actor is far above that actor''s own baseline (z-score test).',
   'STATISTICAL', 3.00, 60, 40, 1, JSON_OBJECT('min_events', 5)),
  ('ISOLATION_FOREST', 'Unusual activity profile (machine learning, optional)',
   'Unsupervised IsolationForest over per-actor hourly activity features. Runs only if scikit-learn is installed. Findings are hints, not proof.',
   'ML', 0.05, 60, 30, 1, JSON_OBJECT('min_samples', 20));
