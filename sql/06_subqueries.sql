-- =====================================================================
-- SQL GHOST HUNTER  |  06_subqueries.sql
-- PURPOSE : Nested queries used during investigations.
-- CONCEPTS: single-row subquery, multiple-row subquery (IN / NOT IN),
--           correlated subquery, EXISTS / NOT EXISTS, scalar subquery in
--           SELECT, derived table (subquery in FROM), ANY / ALL.
-- =====================================================================
USE ghost_hunter;

-- ---------------------------------------------------------------------
-- S1. SINGLE-ROW subquery - evidence files larger than the average size.
--     The inner query returns exactly one value (the average).
-- ---------------------------------------------------------------------
SELECT evidence_id, evidence_name, file_size_bytes
  FROM evidence
 WHERE file_size_bytes > (SELECT AVG(file_size_bytes) FROM evidence)
 ORDER BY file_size_bytes DESC;
-- [[OUTPUT]]
--   +-------------+--------------------------------+-----------------+
--   | evidence_id | evidence_name                  | file_size_bytes |
--   +-------------+--------------------------------+-----------------+
--   | 9           | suspicious_link_screenshot.jpg | 12836           |
--   | 5           | dba_console_screenshot.png     | 12157           |
--   +-------------+--------------------------------+-----------------+
--   2 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S2. SINGLE-ROW subquery - the most recent audit event and who did it.
-- ---------------------------------------------------------------------
SELECT log_id, `timestamp`, action_type, table_name, investigator_id
  FROM audit_logs
 WHERE log_id = (SELECT MAX(log_id) FROM audit_logs);
-- [[OUTPUT]]
--   +--------+---------------------+-------------+------------+-----------------+
--   | log_id | timestamp           | action_type | table_name | investigator_id |
--   +--------+---------------------+-------------+------------+-----------------+
--   | 100    | 2026-11-19 13:00:02 | DELETE      | cases      | 2               |
--   +--------+---------------------+-------------+------------+-----------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S3. MULTIPLE-ROW subquery with IN - cases that contain at least one
--     piece of evidence that failed verification.
-- ---------------------------------------------------------------------
SELECT case_code, case_title, case_status
  FROM cases
 WHERE case_id IN (SELECT case_id FROM evidence WHERE integrity_status <> 'VERIFIED');
-- [[OUTPUT]]
--   +-----------+-------------------------------------------+-------------+
--   | case_code | case_title                                | case_status |
--   +-----------+-------------------------------------------+-------------+
--   | CASE-003  | Insider Data Exfiltration via CSV Exports | OPEN        |
--   +-----------+-------------------------------------------+-------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S4. MULTIPLE-ROW subquery with NOT IN - active investigators who are not
--     assigned to any open case. (assignment.investigator_id is NOT NULL,
--     so NOT IN is safe here - NOT IN with NULLs would return nothing.)
-- ---------------------------------------------------------------------
SELECT investigator_id, investigator_name, role
  FROM investigators
 WHERE is_active = 1
   AND investigator_id NOT IN (SELECT ca.investigator_id
                                 FROM case_assignments ca
                                 JOIN cases c ON c.case_id = ca.case_id
                                WHERE ca.assignment_status = 'ACTIVE' AND c.case_status <> 'CLOSED');
-- [[OUTPUT]]
--   +-----------------+-------------------+---------+
--   | investigator_id | investigator_name | role    |
--   +-----------------+-------------------+---------+
--   | 1               | Ananya Rao        | ADMIN   |
--   | 5               | Meera Iyer        | AUDITOR |
--   +-----------------+-------------------+---------+
--   2 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S5. CORRELATED subquery - the LATEST integrity check of every evidence.
--     The inner query is re-evaluated for each outer row (uses ic.evidence_id).
-- ---------------------------------------------------------------------
SELECT ic.evidence_id, ic.check_id, ic.verification_result, ic.check_context, ic.checked_at
  FROM integrity_checks ic
 WHERE ic.check_id = (SELECT MAX(ic2.check_id)
                        FROM integrity_checks ic2
                       WHERE ic2.evidence_id = ic.evidence_id)
 ORDER BY ic.evidence_id;
-- [[OUTPUT]]
--   +-------------+----------+---------------------+------------------+---------------------+
--   | evidence_id | check_id | verification_result | check_context    | checked_at          |
--   +-------------+----------+---------------------+------------------+---------------------+
--   | 1           | 13       | VERIFIED            | CUSTODY_TRANSFER | 2026-11-11 16:45:00 |
--   | 2           | 16       | VERIFIED            | MANUAL           | 2026-11-14 09:40:00 |
--   | 3           | 15       | VERIFIED            | MANUAL           | 2026-11-12 12:00:00 |
--   | 4           | 4        | VERIFIED            | REGISTRATION     | 2026-11-01 11:40:00 |
--   | 5           | 12       | VERIFIED            | CUSTODY_TRANSFER | 2026-11-10 10:10:00 |
--   | 6           | 14       | VERIFIED            | CUSTODY_TRANSFER | 2026-11-12 11:30:00 |
--   | 7           | 19       | TAMPERED            | MANUAL           | 2026-11-19 11:00:01 |
--   | 8           | 8        | VERIFIED            | REGISTRATION     | 2026-11-07 11:05:00 |
--   | 9           | 9        | VERIFIED            | REGISTRATION     | 2026-11-07 11:05:00 |
--   | 10          | 10       | VERIFIED            | REGISTRATION     | 2026-11-09 15:30:00 |
--   +-------------+----------+---------------------+------------------+---------------------+
--   10 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S6. CORRELATED subquery - investigators whose number of audit events is
--     above the average number of events per identified investigator.
-- ---------------------------------------------------------------------
SELECT i.investigator_name,
       (SELECT COUNT(*) FROM audit_logs a WHERE a.investigator_id = i.investigator_id) AS events
  FROM investigators i
 WHERE (SELECT COUNT(*) FROM audit_logs a WHERE a.investigator_id = i.investigator_id)
       > (SELECT COUNT(*) / COUNT(DISTINCT investigator_id) FROM audit_logs WHERE investigator_id IS NOT NULL);
-- [[OUTPUT]]
--   +-------------------+--------+
--   | investigator_name | events |
--   +-------------------+--------+
--   | Vikram Mehta      | 32     |
--   | Priya Sharma      | 28     |
--   | Rahul Verma       | 21     |
--   +-------------------+--------+
--   3 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S7. EXISTS - cases where something was changed WITHOUT an application
--     identity (direct database access).
-- ---------------------------------------------------------------------
SELECT c.case_code, c.case_title
  FROM cases c
 WHERE EXISTS (SELECT 1 FROM audit_logs a
                WHERE a.related_case_id = c.case_id
                  AND a.investigator_id IS NULL
                  AND a.event_source = 'TRIGGER');
-- [[OUTPUT]]
--   +-----------+-------------------------------------------+
--   | case_code | case_title                                |
--   +-----------+-------------------------------------------+
--   | CASE-001  | Payroll Database Tampering                |
--   | CASE-002  | Unauthorized Customer Record Deletion     |
--   | CASE-003  | Insider Data Exfiltration via CSV Exports |
--   +-----------+-------------------------------------------+
--   3 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S8. NOT EXISTS - evidence that has never been verified after
--     registration (only the baseline REGISTRATION check exists).
-- ---------------------------------------------------------------------
SELECT e.evidence_id, e.evidence_name, e.uploaded_at
  FROM evidence e
 WHERE NOT EXISTS (SELECT 1 FROM integrity_checks ic
                    WHERE ic.evidence_id = e.evidence_id AND ic.check_context <> 'REGISTRATION');
-- [[OUTPUT]]
--   +-------------+--------------------------------+---------------------+
--   | evidence_id | evidence_name                  | uploaded_at         |
--   +-------------+--------------------------------+---------------------+
--   | 4           | customer_table_backup_diff.csv | 2026-11-01 11:40:00 |
--   | 8           | phishing_email_headers.txt     | 2026-11-07 11:05:00 |
--   | 9           | suspicious_link_screenshot.jpg | 2026-11-07 11:05:00 |
--   | 10          | vendor_invoice_INV-2291.pdf    | 2026-11-09 15:30:00 |
--   +-------------+--------------------------------+---------------------+
--   4 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S9. SCALAR subqueries in SELECT - one summary line per case.
-- ---------------------------------------------------------------------
SELECT c.case_code,
       (SELECT COUNT(*) FROM evidence e WHERE e.case_id = c.case_id)                 AS evidence_items,
       (SELECT COUNT(*) FROM audit_logs a WHERE a.related_case_id = c.case_id)       AS audit_events,
       (SELECT MAX(a.`timestamp`) FROM audit_logs a WHERE a.related_case_id = c.case_id) AS last_activity
  FROM cases c
 ORDER BY c.case_code;
-- [[OUTPUT]]
--   +-----------+----------------+--------------+---------------------+
--   | case_code | evidence_items | audit_events | last_activity       |
--   +-----------+----------------+--------------+---------------------+
--   | CASE-001  | 3              | 34           | 2026-11-19 11:20:01 |
--   | CASE-002  | 2              | 16           | 2026-11-18 02:53:00 |
--   | CASE-003  | 2              | 21           | 2026-11-19 11:00:01 |
--   | CASE-004  | 2              | 10           | 2026-11-16 10:00:00 |
--   | CASE-005  | 1              | 7            | 2026-11-13 17:10:00 |
--   +-----------+----------------+--------------+---------------------+
--   5 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S10. DERIVED TABLE (subquery in FROM) - busiest hour of the day for
--      data changes, computed from an inner aggregation.
-- ---------------------------------------------------------------------
SELECT hour_of_day, changes
  FROM (SELECT HOUR(`timestamp`) AS hour_of_day, COUNT(*) AS changes
          FROM audit_logs
         WHERE action_type IN ('INSERT','UPDATE','DELETE')
         GROUP BY HOUR(`timestamp`)) AS per_hour
 ORDER BY changes DESC
 LIMIT 5;
-- [[OUTPUT]]
--   +-------------+---------+
--   | hour_of_day | changes |
--   +-------------+---------+
--   | 10          | 25      |
--   | 11          | 23      |
--   | 14          | 12      |
--   | 9           | 9       |
--   | 2           | 7       |
--   +-------------+---------+
--   5 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- S11. ALL - evidence larger than EVERY text (TXT) file.
-- ---------------------------------------------------------------------
SELECT evidence_id, evidence_name, evidence_type, file_size_bytes
  FROM evidence
 WHERE file_size_bytes > ALL (SELECT file_size_bytes FROM evidence WHERE evidence_type = 'TXT');
-- [[OUTPUT]]
--   +-------------+--------------------------------+---------------+-----------------+
--   | evidence_id | evidence_name                  | evidence_type | file_size_bytes |
--   +-------------+--------------------------------+---------------+-----------------+
--   | 3           | hr_approval_memo.pdf           | PDF           | 816             |
--   | 5           | dba_console_screenshot.png     | PNG           | 12157           |
--   | 9           | suspicious_link_screenshot.jpg | JPEG          | 12836           |
--   | 10          | vendor_invoice_INV-2291.pdf    | PDF           | 792             |
--   +-------------+--------------------------------+---------------+-----------------+
--   4 row(s)
-- [[/OUTPUT]]
