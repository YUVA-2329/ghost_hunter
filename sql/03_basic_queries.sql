-- =====================================================================
-- SQL GHOST HUNTER  |  03_basic_queries.sql
-- PURPOSE : Basic SQL - DDL & DML commands, SQL operators and clauses.
-- CONCEPTS: CREATE DATABASE, CREATE TABLE, INSERT, SELECT, UPDATE, DELETE,
--           ALTER TABLE, DROP TABLE, arithmetic / comparison / logical
--           operators, BETWEEN, IN, LIKE, IS NULL, AND, OR, NOT,
--           WHERE, ORDER BY, DISTINCT, LIMIT.
-- Requires the installed database (01, 09, 10, 08, 02). Safe to re-run.
-- The "-- [[OUTPUT]]" blocks hold the REAL output captured from MySQL by
-- backend/scripts/capture_sql_outputs.py (timestamps depend on install time).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Q1. CREATE DATABASE  (IF NOT EXISTS makes it harmless when it exists)
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS ghost_hunter CHARACTER SET utf8mb4;
USE ghost_hunter;

-- =====================================================================
-- PART A - DDL/DML on an ISOLATED scratch table.
-- DROP TABLE is only ever demonstrated here, never on real data.
-- =====================================================================

-- Q2. CREATE TABLE - a scratch table for investigator field notes
DROP TABLE IF EXISTS demo_field_notes;
CREATE TABLE demo_field_notes (
  note_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_code   VARCHAR(20)  NOT NULL,
  note_text   VARCHAR(300) NOT NULL,
  minutes     INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Q3. INSERT - add several rows in one statement
INSERT INTO demo_field_notes (case_code, note_text, minutes) VALUES
  ('CASE-001', 'Interviewed HR approver HR-07', 45),
  ('CASE-001', 'Collected payroll export from HR system', 20),
  ('CASE-003', 'Reviewed VPN logs for 10 May', 60),
  ('CASE-004', 'Checked SPF/DMARC results of phishing mail', 15);
-- [[OUTPUT]]
--   Query OK, 4 row(s) affected
-- [[/OUTPUT]]

-- Q4. SELECT - read the rows back
SELECT note_id, case_code, note_text, minutes FROM demo_field_notes;
-- [[OUTPUT]]
--   +---------+-----------+--------------------------------------------+---------+
--   | note_id | case_code | note_text                                  | minutes |
--   +---------+-----------+--------------------------------------------+---------+
--   | 1       | CASE-001  | Interviewed HR approver HR-07              | 45      |
--   | 2       | CASE-001  | Collected payroll export from HR system    | 20      |
--   | 3       | CASE-003  | Reviewed VPN logs for 10 May               | 60      |
--   | 4       | CASE-004  | Checked SPF/DMARC results of phishing mail | 15      |
--   +---------+-----------+--------------------------------------------+---------+
--   4 row(s)
-- [[/OUTPUT]]

-- Q5. UPDATE - correct the minutes of one note
UPDATE demo_field_notes SET minutes = minutes + 15 WHERE note_id = 3;
-- [[OUTPUT]]
--   Query OK, 1 row(s) affected
-- [[/OUTPUT]]

-- Q6. DELETE - remove a note
DELETE FROM demo_field_notes WHERE case_code = 'CASE-004';
-- [[OUTPUT]]
--   Query OK, 1 row(s) affected
-- [[/OUTPUT]]

-- Q7. ALTER TABLE - add a column, then change its definition
ALTER TABLE demo_field_notes ADD COLUMN reviewed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE demo_field_notes MODIFY note_text VARCHAR(500) NOT NULL;
DESCRIBE demo_field_notes;
-- [[OUTPUT]]
--   +------------+--------------+------+-----+-------------------+-------------------+
--   | Field      | Type         | Null | Key | Default           | Extra             |
--   +------------+--------------+------+-----+-------------------+-------------------+
--   | note_id    | int unsigned | NO   | PRI | NULL              | auto_increment    |
--   | case_code  | varchar(20)  | NO   |     | NULL              |                   |
--   | note_text  | varchar(500) | NO   |     | NULL              |                   |
--   | minutes    | int          | NO   |     | 0                 |                   |
--   | created_at | datetime     | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
--   | reviewed   | tinyint(1)   | NO   |     | 0                 |                   |
--   +------------+--------------+------+-----+-------------------+-------------------+
--   6 row(s)
-- [[/OUTPUT]]

-- Q8. DROP TABLE - remove the isolated scratch table
DROP TABLE demo_field_notes;
SHOW TABLES LIKE 'demo_%';
-- [[OUTPUT]]
--   +---------------------------------+
--   | Tables_in_ghost_hunter (demo_%) |
--   +---------------------------------+
--   +---------------------------------+
--   0 row(s)
-- [[/OUTPUT]]

-- =====================================================================
-- PART B - DML on a REAL business table. Every change below is caught
-- by the audit triggers (this is demonstration TEST 3 and TEST 4 in SQL).
-- We identify ourselves as investigator 2 (Vikram, lead) the same way the
-- backend does on every request.
-- =====================================================================
SET @app_investigator_id = 2, @app_client_ip = '127.0.0.1';

-- Q9. INSERT into cases (a throw-away test case)
INSERT INTO cases (case_code, case_title, case_description, priority, created_by)
VALUES ('CASE-901', 'SQL demonstration test case', 'Created by 03_basic_queries.sql', 'LOW', 2);
SET @test_case = LAST_INSERT_ID();

-- Q10. UPDATE the test case (trigger stores OLD and NEW values as JSON)
UPDATE cases SET case_status = 'IN_PROGRESS', priority = 'MEDIUM' WHERE case_id = @test_case;
-- [[OUTPUT]]
--   Query OK, 1 row(s) affected
-- [[/OUTPUT]]

-- Q11. DELETE the test case (trigger preserves the deleted row)
DELETE FROM cases WHERE case_id = @test_case;
-- [[OUTPUT]]
--   Query OK, 1 row(s) affected
-- [[/OUTPUT]]

-- Q12. SELECT the audit trail produced by Q9-Q11 (proof the triggers ran)
SELECT log_id, action_type, table_name, record_id, investigator_id,
       JSON_UNQUOTE(JSON_EXTRACT(old_values, '$.case_status')) AS old_status,
       JSON_UNQUOTE(JSON_EXTRACT(new_values, '$.case_status')) AS new_status,
       risk_level
  FROM audit_logs
 WHERE table_name = 'cases' AND record_id = @test_case
 ORDER BY log_id;
-- [[OUTPUT]]
--   +--------+-------------+------------+-----------+-----------------+-------------+-------------+------------+
--   | log_id | action_type | table_name | record_id | investigator_id | old_status  | new_status  | risk_level |
--   +--------+-------------+------------+-----------+-----------------+-------------+-------------+------------+
--   | 98     | INSERT      | cases      | 6         | 2               | NULL        | OPEN        | LOW        |
--   | 99     | UPDATE      | cases      | 6         | 2               | OPEN        | IN_PROGRESS | LOW        |
--   | 100    | DELETE      | cases      | 6         | 2               | IN_PROGRESS | NULL        | MEDIUM     |
--   +--------+-------------+------------+-----------+-----------------+-------------+-------------+------------+
--   3 row(s)
-- [[/OUTPUT]]
SET @app_investigator_id = NULL, @app_client_ip = NULL;

-- =====================================================================
-- PART C - OPERATORS
-- =====================================================================

-- Q13. ARITHMETIC operators (/, *, -, ROUND) - evidence size in KB and
--      age in days since registration.
SELECT evidence_id, evidence_name,
       file_size_bytes,
       ROUND(file_size_bytes / 1024, 2)          AS size_kb,
       file_size_bytes * 8                       AS size_bits,
       DATEDIFF(NOW(), uploaded_at)              AS age_days
  FROM evidence
 ORDER BY file_size_bytes DESC;
-- [[OUTPUT]]
--   +-------------+--------------------------------+-----------------+---------+-----------+----------+
--   | evidence_id | evidence_name                  | file_size_bytes | size_kb | size_bits | age_days |
--   +-------------+--------------------------------+-----------------+---------+-----------+----------+
--   | 9           | suspicious_link_screenshot.jpg | 12836           | 12.54   | 102688    | 12       |
--   | 5           | dba_console_screenshot.png     | 12157           | 11.87   | 97256     | 18       |
--   | 3           | hr_approval_memo.pdf           | 816             | 0.80    | 6528      | 21       |
--   | 10          | vendor_invoice_INV-2291.pdf    | 792             | 0.77    | 6336      | 10       |
--   | 2           | db_server_audit_extract.txt    | 383             | 0.37    | 3064      | 21       |
--   | 6           | vpn_access_log.txt             | 303             | 0.30    | 2424      | 15       |
--   | 8           | phishing_email_headers.txt     | 299             | 0.29    | 2392      | 12       |
--   | 4           | customer_table_backup_diff.csv | 245             | 0.24    | 1960      | 18       |
--   | 1           | payroll_export_march.csv       | 214             | 0.21    | 1712      | 21       |
--   | 7           | exported_records_sample.csv    | 159             | 0.16    | 1272      | 15       |
--   +-------------+--------------------------------+-----------------+---------+-----------+----------+
--   10 row(s)
-- [[/OUTPUT]]

-- Q14. COMPARISON operators (>, <>) - large files whose status is not VERIFIED
--      or files larger than 10 KB.
SELECT evidence_id, evidence_name, file_size_bytes, integrity_status
  FROM evidence
 WHERE file_size_bytes > 10000 OR integrity_status <> 'VERIFIED';
-- [[OUTPUT]]
--   +-------------+--------------------------------+-----------------+------------------+
--   | evidence_id | evidence_name                  | file_size_bytes | integrity_status |
--   +-------------+--------------------------------+-----------------+------------------+
--   | 5           | dba_console_screenshot.png     | 12157           | VERIFIED         |
--   | 7           | exported_records_sample.csv    | 159             | TAMPERED         |
--   | 9           | suspicious_link_screenshot.jpg | 12836           | VERIFIED         |
--   +-------------+--------------------------------+-----------------+------------------+
--   3 row(s)
-- [[/OUTPUT]]

-- Q15. LOGICAL operators AND / OR / NOT - high-risk data changes that were
--      NOT made through the application OR are DELETEs.
SELECT log_id, `timestamp`, action_type, table_name, record_id, risk_level
  FROM audit_logs
 WHERE risk_level IN ('HIGH','CRITICAL')
   AND (investigator_id IS NULL OR action_type = 'DELETE')
   AND NOT event_source = 'APPLICATION'
 ORDER BY log_id;
-- [[OUTPUT]]
--   +--------+---------------------+-------------+------------------+-----------+------------+
--   | log_id | timestamp           | action_type | table_name       | record_id | risk_level |
--   +--------+---------------------+-------------+------------------+-----------+------------+
--   | 86     | 2026-11-18 02:48:00 | UPDATE      | evidence         | 2         | CRITICAL   |
--   | 87     | 2026-11-18 02:51:00 | DELETE      | case_assignments | 2         | HIGH       |
--   | 88     | 2026-11-18 02:53:00 | DELETE      | case_assignments | 5         | HIGH       |
--   | 89     | 2026-11-18 02:55:00 | DELETE      | case_assignments | 9         | HIGH       |
--   +--------+---------------------+-------------+------------------+-----------+------------+
--   4 row(s)
-- [[/OUTPUT]]

-- Q16. BETWEEN - audit events recorded in the last 2 days
SELECT log_id, `timestamp`, action_type, table_name, risk_level
  FROM audit_logs
 WHERE `timestamp` BETWEEN NOW() - INTERVAL 2 DAY AND NOW()
 ORDER BY `timestamp`
 LIMIT 10;
-- [[OUTPUT]]
--   +--------+---------------------+-------------------+------------+------------+
--   | log_id | timestamp           | action_type       | table_name | risk_level |
--   +--------+---------------------+-------------------+------------+------------+
--   | 77     | 2026-11-18 02:08:00 | LOGIN             | NULL       | MEDIUM     |
--   | 78     | 2026-11-18 02:12:00 | EVIDENCE_DOWNLOAD | evidence   | LOW        |
--   | 79     | 2026-11-18 02:16:00 | EVIDENCE_DOWNLOAD | evidence   | LOW        |
--   | 80     | 2026-11-18 02:19:00 | EVIDENCE_DOWNLOAD | evidence   | LOW        |
--   | 81     | 2026-11-18 02:24:00 | EVIDENCE_DOWNLOAD | evidence   | LOW        |
--   | 82     | 2026-11-18 02:30:00 | EVIDENCE_DOWNLOAD | evidence   | LOW        |
--   | 83     | 2026-11-18 02:40:00 | UPDATE            | cases      | MEDIUM     |
--   | 84     | 2026-11-18 02:43:00 | UPDATE            | cases      | MEDIUM     |
--   | 85     | 2026-11-18 02:46:00 | UPDATE            | cases      | MEDIUM     |
--   | 86     | 2026-11-18 02:48:00 | UPDATE            | evidence   | CRITICAL   |
--   +--------+---------------------+-------------------+------------+------------+
--   10 row(s)
-- [[/OUTPUT]]

-- Q17. IN - evidence of the given types
SELECT evidence_id, evidence_name, evidence_type
  FROM evidence
 WHERE evidence_type IN ('PDF', 'PNG', 'JPEG');
-- [[OUTPUT]]
--   +-------------+--------------------------------+---------------+
--   | evidence_id | evidence_name                  | evidence_type |
--   +-------------+--------------------------------+---------------+
--   | 3           | hr_approval_memo.pdf           | PDF           |
--   | 5           | dba_console_screenshot.png     | PNG           |
--   | 9           | suspicious_link_screenshot.jpg | JPEG          |
--   | 10          | vendor_invoice_INV-2291.pdf    | PDF           |
--   +-------------+--------------------------------+---------------+
--   4 row(s)
-- [[/OUTPUT]]

-- Q18. LIKE - investigators whose e-mail starts with 'r' or names containing 'ra'
SELECT investigator_id, investigator_name, email
  FROM investigators
 WHERE email LIKE 'r%' OR investigator_name LIKE '%ra%';
-- [[OUTPUT]]
--   +-----------------+-------------------+--------------------------------+
--   | investigator_id | investigator_name | email                          |
--   +-----------------+-------------------+--------------------------------+
--   | 1               | Ananya Rao        | admin@ghosthunter.local        |
--   | 2               | Vikram Mehta      | vikram.mehta@ghosthunter.local |
--   | 4               | Rahul Verma       | rahul.verma@ghosthunter.local  |
--   | 5               | Meera Iyer        | meera.iyer@ghosthunter.local   |
--   +-----------------+-------------------+--------------------------------+
--   4 row(s)
-- [[/OUTPUT]]

-- Q19. IS NULL - changes made with NO application identity (direct DB access)
SELECT log_id, `timestamp`, action_type, table_name, record_id, db_user
  FROM audit_logs
 WHERE investigator_id IS NULL AND event_source = 'TRIGGER'
 ORDER BY log_id;
-- [[OUTPUT]]
--   +--------+---------------------+-------------+------------------+-----------+----------------+
--   | log_id | timestamp           | action_type | table_name       | record_id | db_user        |
--   +--------+---------------------+-------------+------------------+-----------+----------------+
--   | 1      | 2026-10-10 09:05:00 | INSERT      | investigators    | 1         | root@localhost |
--   | 83     | 2026-11-18 02:40:00 | UPDATE      | cases            | 1         | root@localhost |
--   | 84     | 2026-11-18 02:43:00 | UPDATE      | cases            | 1         | root@localhost |
--   | 85     | 2026-11-18 02:46:00 | UPDATE      | cases            | 1         | root@localhost |
--   | 86     | 2026-11-18 02:48:00 | UPDATE      | evidence         | 2         | root@localhost |
--   | 87     | 2026-11-18 02:51:00 | DELETE      | case_assignments | 2         | root@localhost |
--   | 88     | 2026-11-18 02:53:00 | DELETE      | case_assignments | 5         | root@localhost |
--   | 89     | 2026-11-18 02:55:00 | DELETE      | case_assignments | 9         | root@localhost |
--   +--------+---------------------+-------------+------------------+-----------+----------------+
--   8 row(s)
-- [[/OUTPUT]]

-- Q20. IS NOT NULL - custody transfers that have a previous custodian
--      (i.e. real hand-overs, not the initial acquisition)
SELECT transfer_id, evidence_id, transferred_from, transferred_to, verification_status
  FROM custody_transfers
 WHERE transferred_from IS NOT NULL
 ORDER BY transfer_timestamp;
-- [[OUTPUT]]
--   +-------------+-------------+------------------+----------------+---------------------+
--   | transfer_id | evidence_id | transferred_from | transferred_to | verification_status |
--   +-------------+-------------+------------------+----------------+---------------------+
--   | 11          | 1           | 3                | 4              | VERIFIED            |
--   | 12          | 5           | 3                | 2              | VERIFIED            |
--   | 13          | 1           | 4                | 2              | VERIFIED            |
--   | 14          | 6           | 4                | 3              | VERIFIED            |
--   +-------------+-------------+------------------+----------------+---------------------+
--   4 row(s)
-- [[/OUTPUT]]

-- =====================================================================
-- PART D - CLAUSES
-- =====================================================================

-- Q21. DISTINCT - which tables have ever been modified
SELECT DISTINCT table_name
  FROM audit_logs
 WHERE action_type IN ('INSERT','UPDATE','DELETE')
 ORDER BY table_name;
-- [[OUTPUT]]
--   +-------------------+
--   | table_name        |
--   +-------------------+
--   | case_assignments  |
--   | cases             |
--   | custody_transfers |
--   | evidence          |
--   | integrity_checks  |
--   | investigators     |
--   +-------------------+
--   6 row(s)
-- [[/OUTPUT]]

-- Q22. ORDER BY (multiple keys) + LIMIT - the 5 most recent high-risk events
SELECT log_id, `timestamp`, action_type, table_name, risk_level
  FROM audit_logs
 WHERE risk_level IN ('HIGH','CRITICAL')
 ORDER BY `timestamp` DESC, log_id DESC
 LIMIT 5;
-- [[OUTPUT]]
--   +--------+---------------------+-------------+------------------+------------+
--   | log_id | timestamp           | action_type | table_name       | risk_level |
--   +--------+---------------------+-------------+------------------+------------+
--   | 94     | 2026-11-19 11:00:01 | INSERT      | integrity_checks | CRITICAL   |
--   | 92     | 2026-11-19 10:00:01 | UPDATE      | evidence         | CRITICAL   |
--   | 91     | 2026-11-19 10:00:01 | INSERT      | integrity_checks | CRITICAL   |
--   | 89     | 2026-11-18 02:55:00 | DELETE      | case_assignments | HIGH       |
--   | 88     | 2026-11-18 02:53:00 | DELETE      | case_assignments | HIGH       |
--   +--------+---------------------+-------------+------------------+------------+
--   5 row(s)
-- [[/OUTPUT]]
