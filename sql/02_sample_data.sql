-- =====================================================================
-- SQL GHOST HUNTER  |  02_sample_data.sql
-- PURPOSE : Realistic demonstration data: 5 investigators, 5 cases,
--           10 evidence items, custody transfers, integrity checks,
--           login history and a suspicious incident.
--
-- HOW THE AUDIT HISTORY IS PRODUCED (important for honesty):
--   This script does NOT insert rows into audit_logs by hand.
--   It performs real INSERT/UPDATE/DELETE statements and stored-procedure
--   calls; the triggers from 10_triggers.sql write every audit record.
--   To give the demo a believable timeline, the session clock is moved
--   with  SET timestamp = ...  before each step, so NOW() and
--   CURRENT_TIMESTAMP (used by triggers and defaults) return that moment.
--   Dates are relative to the moment you run the script.
--
-- STORY
--   * Normal work: cases opened, evidence registered, hand-overs, checks.
--   * Yesterday ~02:00: 6 failed logins on Rahul's account, then a
--     successful login and a burst of evidence downloads.
--   * Yesterday ~02:40: someone with DIRECT database access (no
--     application identity) edits CASE-001 three times, changes evidence
--     metadata and deletes three of Priya's case assignments.
--   * The stored file of evidence 7 was altered on disk (simulated by the
--     shipped file in sample_evidence/). Today two verifications FAIL.
--
-- Requires: 01, 09, 10, 08 (and 13) to have been run.
-- Demo passwords are listed in README.md (local demonstration only).
-- =====================================================================
USE ghost_hunter;

SET @now0  = NOW();                          -- real time when the script starts
SET @today = CAST(CURDATE() AS DATETIME);    -- today 00:00
SET @app_investigator_id = NULL;
SET @app_client_ip = NULL;

-- ---------------------------------------------------------------------
-- D-40 09:05  Bootstrap: first administrator (no application identity
-- exists yet, so the trigger correctly records investigator_id = NULL).
-- ---------------------------------------------------------------------
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 40 DAY + INTERVAL '09:05' HOUR_MINUTE);
INSERT INTO investigators (investigator_name, email, role, password_hash) VALUES
 ('Ananya Rao', 'admin@ghosthunter.local', 'ADMIN',
  '$2b$12$JtjD1G3lTEmFoXrU8k13MuEaiMqNgRnxWCJAfamYcOmHQhDpaNTYy');

-- D-40 09:20  Ananya creates the other accounts through the application
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 40 DAY + INTERVAL '09:20' HOUR_MINUTE);
SET @app_investigator_id = 1, @app_client_ip = '10.10.1.11';
INSERT INTO investigators (investigator_name, email, role, password_hash) VALUES
 ('Vikram Mehta', 'vikram.mehta@ghosthunter.local', 'LEAD_INVESTIGATOR',
  '$2b$12$f5O/VKF3DWUS.aiMiWGSQOzI6XzKUU9oAAiytQS85QoTv5OK38XTW'),
 ('Priya Sharma', 'priya.sharma@ghosthunter.local', 'INVESTIGATOR',
  '$2b$12$Xhq7TZ//qKX9v93wm.3pFeohtVnKWfmvqdTPjONPVXP6z2ym6Jo4K'),
 ('Rahul Verma',  'rahul.verma@ghosthunter.local',  'INVESTIGATOR',
  '$2b$12$MnaspwKIsuVh3skqFsVfYOEofkVyEhjoak/60kPQZmZ9KHYdjl2V6'),
 ('Meera Iyer',   'meera.iyer@ghosthunter.local',   'AUDITOR',
  '$2b$12$2OZQGdMkricE4iR8j89fL.hGzUOtzOkBVWkiaev6q5DJJl8MXCSdS');

-- ---------------------------------------------------------------------
-- D-21  CASE-001 Payroll database tampering (Vikram, lead)
-- ---------------------------------------------------------------------
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 21 DAY + INTERVAL '09:58' HOUR_MINUTE);
INSERT INTO login_attempts (email, investigator_id, ip_address, attempted_at, success)
VALUES ('vikram.mehta@ghosthunter.local', 2, '10.10.1.22', NOW(), 1);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_log_app_event(2, 'LOGIN', NULL, NULL, NULL, 'Successful login', '10.10.1.22', 'LOW');

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 21 DAY + INTERVAL '10:00' HOUR_MINUTE);
CALL sp_create_case('Payroll Database Tampering',
  'Salary and bonus values of employee 1093 changed without HR approval; approval records missing.',
  'HIGH', 2, @c1);
CALL sp_assign_investigator(@c1, 3, 'MEMBER', 2);
CALL sp_assign_investigator(@c1, 4, 'MEMBER', 2);

-- D-21 10:30  Priya registers the first three evidence items
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 21 DAY + INTERVAL '10:30' HOUR_MINUTE);
SET @app_investigator_id = 3, @app_client_ip = '10.10.1.33';
CALL sp_register_evidence(@c1, 'payroll_export_march.csv', 'CSV',
  'Payroll export taken from the HR system on the day the anomaly was reported',
  'evidence/ev01_payroll_export_march.csv', 214,
  '261135e6e803c51123217e398601bb70f5c388092dfee11b79cac9b2df642899', 3, @e1);
CALL sp_register_evidence(@c1, 'db_server_audit_extract.txt', 'TXT',
  'MySQL general-log extract showing UPDATE/DELETE statements from svc_payroll',
  'evidence/ev02_db_server_audit_extract.txt', 383,
  '20eb2dce7d8d665ae1a854bde509747c6b18fd55e6c474fa00298db7dea87923', 3, @e2);
CALL sp_register_evidence(@c1, 'hr_approval_memo.pdf', 'PDF',
  'Signed HR memo with the approved salary revision for employee 1093',
  'evidence/ev03_hr_approval_memo.pdf', 816,
  '6fe424283f80776ce8a9e84c012125e7798a8056c2b92f9ff51620f269379630', 3, @e3);

-- ---------------------------------------------------------------------
-- D-18  CASE-002 Unauthorized customer record deletion
-- ---------------------------------------------------------------------
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 18 DAY + INTERVAL '11:00' HOUR_MINUTE);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_create_case('Unauthorized Customer Record Deletion',
  '214 GOLD-tier customer rows deleted from the South region by a temporary DBA account.',
  'HIGH', 2, @c2);
CALL sp_assign_investigator(@c2, 3, 'MEMBER', 2);
CALL sp_assign_investigator(@c2, 4, 'REVIEWER', 2);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 18 DAY + INTERVAL '11:40' HOUR_MINUTE);
SET @app_investigator_id = 3, @app_client_ip = '10.10.1.33';
CALL sp_register_evidence(@c2, 'customer_table_backup_diff.csv', 'CSV',
  'Row-level diff between last night''s backup and the live customers table',
  'evidence/ev04_customer_table_backup_diff.csv', 245,
  '2ac481fcbcda1e2e9863e5c808048ca9af4d45f5761180c17e222c0d7223933a', 3, @e4);
CALL sp_register_evidence(@c2, 'dba_console_screenshot.png', 'PNG',
  'Screenshot of the DBA console session captured from the jump server',
  'evidence/ev05_dba_console_screenshot.png', 12157,
  '1c8bc9618f6dbdd3853ee998fe53e0fbe0fd0ab5f37968c96fe8e6fc972906b8', 3, @e5);

-- ---------------------------------------------------------------------
-- D-15  CASE-003 Insider data exfiltration
-- ---------------------------------------------------------------------
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 15 DAY + INTERVAL '14:00' HOUR_MINUTE);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_create_case('Insider Data Exfiltration via CSV Exports',
  'Large client exports followed by uploads to a personal cloud drive after office hours.',
  'CRITICAL', 2, @c3);
CALL sp_assign_investigator(@c3, 4, 'MEMBER', 2);
CALL sp_assign_investigator(@c3, 3, 'MEMBER', 2);
CALL sp_update_case_status(@c1, 'IN_PROGRESS', 2);
CALL sp_update_case_status(@c2, 'IN_PROGRESS', 2);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 15 DAY + INTERVAL '14:20' HOUR_MINUTE);
SET @app_investigator_id = 4, @app_client_ip = '10.10.1.44';
CALL sp_register_evidence(@c3, 'vpn_access_log.txt', 'TXT',
  'VPN concentrator log for the night of the export',
  'evidence/ev06_vpn_access_log.txt', 303,
  '610132349301745a16f4cb91a2ca0eef91c2c52265bc32b0c39acb479a17e44c', 4, @e6);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 15 DAY + INTERVAL '14:30' HOUR_MINUTE);
SET @app_investigator_id = 3, @app_client_ip = '10.10.1.33';
-- original hash = hash of the file as acquired (3 client rows)
CALL sp_register_evidence(@c3, 'exported_records_sample.csv', 'CSV',
  'Sample of client records recovered from /tmp/clients.csv',
  'evidence/ev07_exported_records_sample.csv', 159,
  'e9a45f044149125217e6f60e484740e53b89065744da7fbb06b887991ab2e558', 3, @e7);

-- ---------------------------------------------------------------------
-- D-12  CASE-004 Phishing email investigation
-- ---------------------------------------------------------------------
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 12 DAY + INTERVAL '10:15' HOUR_MINUTE);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_create_case('Credential Phishing Campaign',
  'Finance team received look-alike IT support emails linking to a credential harvesting page.',
  'MEDIUM', 2, @c4);
CALL sp_assign_investigator(@c4, 4, 'MEMBER', 2);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 12 DAY + INTERVAL '11:05' HOUR_MINUTE);
SET @app_investigator_id = 4, @app_client_ip = '10.10.1.44';
CALL sp_register_evidence(@c4, 'phishing_email_headers.txt', 'TXT',
  'Full headers of the phishing email (SPF and DMARC fail)',
  'evidence/ev08_phishing_email_headers.txt', 299,
  '9c784f317950ca8e292cedb2e7c551fadb038c094eb749d95b371bae770c2fc0', 4, @e8);
CALL sp_register_evidence(@c4, 'suspicious_link_screenshot.jpg', 'JPEG',
  'Screenshot of the credential harvesting page',
  'evidence/ev09_suspicious_link_screenshot.jpg', 12836,
  '39ab34a7568e1123ac5bc860612888625a30557a69cfdb5d899401902f2d8517', 4, @e9);

-- ---------------------------------------------------------------------
-- D-10  CASE-005 Vendor invoice fraud (created by the administrator)
-- ---------------------------------------------------------------------
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 10 DAY + INTERVAL '15:00' HOUR_MINUTE);
SET @app_investigator_id = 1, @app_client_ip = '10.10.1.11';
CALL sp_create_case('Vendor Invoice Fraud',
  'Invoice INV-2291 carries a bank account that differs from the vendor master record.',
  'LOW', 1, @c5);
CALL sp_assign_investigator(@c5, 2, 'MEMBER', 1);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 10 DAY + INTERVAL '15:30' HOUR_MINUTE);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_register_evidence(@c5, 'vendor_invoice_INV-2291.pdf', 'PDF',
  'Invoice received by accounts payable',
  'evidence/ev10_vendor_invoice_INV-2291.pdf', 792,
  '3e913a62452475f5951c8d9fba4e0d2d04534e4a90011922a0de1508855f2f49', 2, @e10);

-- ---------------------------------------------------------------------
-- D-9 .. D-5  Chain-of-custody hand-overs and routine verifications
-- (each transfer re-verifies the hash of the stored file)
-- ---------------------------------------------------------------------
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 9 DAY + INTERVAL '10:10' HOUR_MINUTE);
SET @app_investigator_id = 3, @app_client_ip = '10.10.1.33';
CALL sp_transfer_custody(@e1, 4, 'Hand-over for forensic analysis of the payroll export',
  '261135e6e803c51123217e398601bb70f5c388092dfee11b79cac9b2df642899', 3, @t);
CALL sp_transfer_custody(@e5, 2, 'Lead review of the DBA console capture',
  '1c8bc9618f6dbdd3853ee998fe53e0fbe0fd0ab5f37968c96fe8e6fc972906b8', 3, @t);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 8 DAY + INTERVAL '16:45' HOUR_MINUTE);
SET @app_investigator_id = 4, @app_client_ip = '10.10.1.44';
CALL sp_transfer_custody(@e1, 2, 'Analysis complete - returned to case lead for review',
  '261135e6e803c51123217e398601bb70f5c388092dfee11b79cac9b2df642899', 4, @t);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 7 DAY + INTERVAL '11:30' HOUR_MINUTE);
CALL sp_transfer_custody(@e6, 3, 'Correlate VPN sessions with export timestamps',
  '610132349301745a16f4cb91a2ca0eef91c2c52265bc32b0c39acb479a17e44c', 4, @t);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 7 DAY + INTERVAL '12:00' HOUR_MINUTE);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_record_integrity_check(@e3, '6fe424283f80776ce8a9e84c012125e7798a8056c2b92f9ff51620f269379630', 2, 'MANUAL', @r);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 6 DAY + INTERVAL '17:10' HOUR_MINUTE);
SET @app_investigator_id = 1, @app_client_ip = '10.10.1.11';
CALL sp_update_case_status(@c5, 'CLOSED', 1);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 5 DAY + INTERVAL '09:40' HOUR_MINUTE);
SET @app_investigator_id = 3, @app_client_ip = '10.10.1.33';
CALL sp_record_integrity_check(@e2, '20eb2dce7d8d665ae1a854bde509747c6b18fd55e6c474fa00298db7dea87923', 3, 'MANUAL', @r);
CALL sp_record_integrity_check(@e7, 'e9a45f044149125217e6f60e484740e53b89065744da7fbb06b887991ab2e558', 3, 'MANUAL', @r);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 3 DAY + INTERVAL '10:00' HOUR_MINUTE);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_update_case_status(@c4, 'IN_PROGRESS', 2);

-- ---------------------------------------------------------------------
-- YESTERDAY 01:58-02:08  Password guessing against Rahul's account,
-- followed by a successful login from the same external address.
-- ---------------------------------------------------------------------
SET @app_investigator_id = NULL, @app_client_ip = NULL;
INSERT INTO login_attempts (email, investigator_id, ip_address, attempted_at, success, failure_reason) VALUES
 ('rahul.verma@ghosthunter.local', 4, '185.220.101.4', @today - INTERVAL 1 DAY + INTERVAL '01:58' HOUR_MINUTE, 0, 'BAD_PASSWORD'),
 ('rahul.verma@ghosthunter.local', 4, '185.220.101.4', @today - INTERVAL 1 DAY + INTERVAL '01:59' HOUR_MINUTE, 0, 'BAD_PASSWORD'),
 ('rahul.verma@ghosthunter.local', 4, '185.220.101.4', @today - INTERVAL 1 DAY + INTERVAL '02:01' HOUR_MINUTE, 0, 'BAD_PASSWORD'),
 ('rahul.verma@ghosthunter.local', 4, '185.220.101.4', @today - INTERVAL 1 DAY + INTERVAL '02:02' HOUR_MINUTE, 0, 'BAD_PASSWORD'),
 ('rahul.verma@ghosthunter.local', 4, '185.220.101.4', @today - INTERVAL 1 DAY + INTERVAL '02:04' HOUR_MINUTE, 0, 'BAD_PASSWORD'),
 ('rahul.verma@ghosthunter.local', 4, '185.220.101.4', @today - INTERVAL 1 DAY + INTERVAL '02:05' HOUR_MINUTE, 0, 'BAD_PASSWORD'),
 ('rahul.verma@ghosthunter.local', 4, '185.220.101.4', @today - INTERVAL 1 DAY + INTERVAL '02:08' HOUR_MINUTE, 1, NULL);

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:08' HOUR_MINUTE);
SET @app_investigator_id = 4, @app_client_ip = '185.220.101.4';
CALL sp_log_app_event(4, 'LOGIN', NULL, NULL, NULL, 'Successful login after 6 failed attempts', '185.220.101.4', 'MEDIUM');

-- 02:12-02:30  burst of evidence downloads across three cases
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:12' HOUR_MINUTE);
CALL sp_log_app_event(4, 'EVIDENCE_DOWNLOAD', 'evidence', @e1, @c1, 'Downloaded payroll_export_march.csv', '185.220.101.4', 'LOW');
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:16' HOUR_MINUTE);
CALL sp_log_app_event(4, 'EVIDENCE_DOWNLOAD', 'evidence', @e2, @c1, 'Downloaded db_server_audit_extract.txt', '185.220.101.4', 'LOW');
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:19' HOUR_MINUTE);
CALL sp_log_app_event(4, 'EVIDENCE_DOWNLOAD', 'evidence', @e3, @c1, 'Downloaded hr_approval_memo.pdf', '185.220.101.4', 'LOW');
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:24' HOUR_MINUTE);
CALL sp_log_app_event(4, 'EVIDENCE_DOWNLOAD', 'evidence', @e4, @c2, 'Downloaded customer_table_backup_diff.csv', '185.220.101.4', 'LOW');
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:30' HOUR_MINUTE);
CALL sp_log_app_event(4, 'EVIDENCE_DOWNLOAD', 'evidence', @e7, @c3, 'Downloaded exported_records_sample.csv', '185.220.101.4', 'LOW');

-- ---------------------------------------------------------------------
-- YESTERDAY 02:40-02:55  DIRECT DATABASE ACCESS (bypasses the application).
-- @app_investigator_id is NULL, exactly as it would be for someone typing
-- SQL into a MySQL client. The triggers still record every change.
-- ---------------------------------------------------------------------
SET @app_investigator_id = NULL, @app_client_ip = NULL;

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:40' HOUR_MINUTE);
UPDATE cases SET case_description =
  'Salary values of employee 1093 updated during scheduled payroll correction.'
 WHERE case_id = @c1;
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:43' HOUR_MINUTE);
UPDATE cases SET priority = 'LOW' WHERE case_id = @c1;
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:46' HOUR_MINUTE);
UPDATE cases SET case_status = 'ON_HOLD' WHERE case_id = @c1;

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:48' HOUR_MINUTE);
UPDATE evidence SET description = 'Routine payroll log - no anomalies' WHERE evidence_id = @e2;

SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:51' HOUR_MINUTE);
DELETE FROM case_assignments WHERE case_id = @c1 AND investigator_id = 3;
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:53' HOUR_MINUTE);
DELETE FROM case_assignments WHERE case_id = @c2 AND investigator_id = 3;
SET timestamp = UNIX_TIMESTAMP(@today - INTERVAL 1 DAY + INTERVAL '02:55' HOUR_MINUTE);
DELETE FROM case_assignments WHERE case_id = @c3 AND investigator_id = 3;

-- (Separately, outside the database, row 9003 was removed from the stored
--  file evidence/ev07_exported_records_sample.csv. A database cannot see
--  file-system edits - only SHA-256 verification can reveal them.)

-- ---------------------------------------------------------------------
-- TODAY  Benign typo logins, discovery and response
-- ---------------------------------------------------------------------
INSERT INTO login_attempts (email, investigator_id, ip_address, attempted_at, success, failure_reason) VALUES
 ('meera.iyer@ghosthunter.local', 5, '10.10.1.55', @now0 - INTERVAL 245 MINUTE, 0, 'BAD_PASSWORD'),
 ('meera.iyer@ghosthunter.local', 5, '10.10.1.55', @now0 - INTERVAL 244 MINUTE, 1, NULL),
 ('vikram.mehta@ghosthunter.local', 2, '10.10.1.22', @now0 - INTERVAL 135 MINUTE, 1, NULL);

SET timestamp = UNIX_TIMESTAMP(@now0 - INTERVAL 244 MINUTE);
SET @app_investigator_id = 5, @app_client_ip = '10.10.1.55';
CALL sp_log_app_event(5, 'LOGIN', NULL, NULL, NULL, 'Successful login', '10.10.1.55', 'LOW');

-- Auditor Meera verifies evidence 7: the stored file no longer matches
SET timestamp = UNIX_TIMESTAMP(@now0 - INTERVAL 180 MINUTE);
CALL sp_record_integrity_check(@e7, '34ae963524c704e933acb60fd4717d74bc4d2394b0c0084ceadf7baf4d99676d', 5, 'MANUAL', @r);

SET timestamp = UNIX_TIMESTAMP(@now0 - INTERVAL 135 MINUTE);
SET @app_investigator_id = 2, @app_client_ip = '10.10.1.22';
CALL sp_log_app_event(2, 'LOGIN', NULL, NULL, NULL, 'Successful login', '10.10.1.22', 'LOW');

-- Lead Vikram re-verifies: still TAMPERED (a second failure)
SET timestamp = UNIX_TIMESTAMP(@now0 - INTERVAL 120 MINUTE);
CALL sp_record_integrity_check(@e7, '34ae963524c704e933acb60fd4717d74bc4d2394b0c0084ceadf7baf4d99676d', 2, 'MANUAL', @r);

-- Vikram restores Priya on CASE-001 and puts the case back in progress
SET timestamp = UNIX_TIMESTAMP(@now0 - INTERVAL 100 MINUTE);
CALL sp_assign_investigator(@c1, 3, 'MEMBER', 2);
CALL sp_update_case_status(@c1, 'IN_PROGRESS', 2);

-- restore the real clock and clear the session identity
SET timestamp = DEFAULT;
SET @app_investigator_id = NULL, @app_client_ip = NULL;

-- Quick verification of what was generated
SELECT 'investigators' AS table_name, COUNT(*) AS row_count FROM investigators
UNION ALL SELECT 'cases', COUNT(*) FROM cases
UNION ALL SELECT 'evidence', COUNT(*) FROM evidence
UNION ALL SELECT 'case_assignments', COUNT(*) FROM case_assignments
UNION ALL SELECT 'custody_transfers', COUNT(*) FROM custody_transfers
UNION ALL SELECT 'integrity_checks', COUNT(*) FROM integrity_checks
UNION ALL SELECT 'audit_logs (written by triggers/procedures)', COUNT(*) FROM audit_logs
UNION ALL SELECT 'login_attempts', COUNT(*) FROM login_attempts;
