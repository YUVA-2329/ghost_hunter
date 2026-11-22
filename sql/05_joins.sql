-- =====================================================================
-- SQL GHOST HUNTER  |  05_joins.sql
-- PURPOSE : Combine related tables to answer forensic questions.
-- CONCEPTS: INNER JOIN, LEFT JOIN, RIGHT JOIN, CROSS JOIN, SELF JOIN,
--           multi-table joins, table aliases.
-- =====================================================================
USE ghost_hunter;

-- ---------------------------------------------------------------------
-- J1. INNER JOIN - evidence with its case and the investigator who
--     registered it. Only rows with a match in all tables are returned.
-- ---------------------------------------------------------------------
SELECT e.evidence_id, c.case_code, e.evidence_name, e.integrity_status,
       i.investigator_name AS uploaded_by
  FROM evidence e
  INNER JOIN cases c         ON c.case_id = e.case_id
  INNER JOIN investigators i ON i.investigator_id = e.uploaded_by
 ORDER BY e.evidence_id;
-- [[OUTPUT]]
--   +-------------+-----------+--------------------------------+------------------+--------------+
--   | evidence_id | case_code | evidence_name                  | integrity_status | uploaded_by  |
--   +-------------+-----------+--------------------------------+------------------+--------------+
--   | 1           | CASE-001  | payroll_export_march.csv       | VERIFIED         | Priya Sharma |
--   | 2           | CASE-001  | db_server_audit_extract.txt    | VERIFIED         | Priya Sharma |
--   | 3           | CASE-001  | hr_approval_memo.pdf           | VERIFIED         | Priya Sharma |
--   | 4           | CASE-002  | customer_table_backup_diff.csv | VERIFIED         | Priya Sharma |
--   | 5           | CASE-002  | dba_console_screenshot.png     | VERIFIED         | Priya Sharma |
--   | 6           | CASE-003  | vpn_access_log.txt             | VERIFIED         | Rahul Verma  |
--   | 7           | CASE-003  | exported_records_sample.csv    | TAMPERED         | Priya Sharma |
--   | 8           | CASE-004  | phishing_email_headers.txt     | VERIFIED         | Rahul Verma  |
--   | 9           | CASE-004  | suspicious_link_screenshot.jpg | VERIFIED         | Rahul Verma  |
--   | 10          | CASE-005  | vendor_invoice_INV-2291.pdf    | VERIFIED         | Vikram Mehta |
--   +-------------+-----------+--------------------------------+------------------+--------------+
--   10 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- J2. Multi-table INNER JOIN using the SAME table three times (with
--     different aliases) - full chain of custody of evidence 1 with names.
--     LEFT JOIN on "from" keeps the initial acquisition (from = NULL).
-- ---------------------------------------------------------------------
SELECT t.transfer_id, t.transfer_timestamp,
       COALESCE(f.investigator_name, '(acquired)') AS from_custodian,
       r.investigator_name                           AS to_custodian,
       p.investigator_name                           AS performed_by,
       t.verification_status
  FROM custody_transfers t
  LEFT JOIN  investigators f ON f.investigator_id = t.transferred_from
  INNER JOIN investigators r ON r.investigator_id = t.transferred_to
  INNER JOIN investigators p ON p.investigator_id = t.performed_by
 WHERE t.evidence_id = 1
 ORDER BY t.transfer_timestamp, t.transfer_id;
-- [[OUTPUT]]
--   +-------------+---------------------+----------------+--------------+--------------+---------------------+
--   | transfer_id | transfer_timestamp  | from_custodian | to_custodian | performed_by | verification_status |
--   +-------------+---------------------+----------------+--------------+--------------+---------------------+
--   | 1           | 2026-10-29 10:30:00 | (acquired)     | Priya Sharma | Priya Sharma | VERIFIED            |
--   | 11          | 2026-11-10 10:10:00 | Priya Sharma   | Rahul Verma  | Priya Sharma | VERIFIED            |
--   | 13          | 2026-11-11 16:45:00 | Rahul Verma    | Vikram Mehta | Rahul Verma  | VERIFIED            |
--   +-------------+---------------------+----------------+--------------+--------------+---------------------+
--   3 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- J3. LEFT JOIN - every audit event with the investigator's name.
--     Events with investigator_id = NULL (direct DB access) are kept
--     and shown as UNIDENTIFIED; an INNER JOIN would silently hide them.
-- ---------------------------------------------------------------------
SELECT a.log_id, a.`timestamp`, a.action_type, a.table_name,
       COALESCE(i.investigator_name, 'UNIDENTIFIED') AS actor, a.risk_level
  FROM audit_logs a
  LEFT JOIN investigators i ON i.investigator_id = a.investigator_id
 WHERE a.risk_level IN ('HIGH','CRITICAL')
 ORDER BY a.log_id;
-- [[OUTPUT]]
--   +--------+---------------------+-------------+------------------+--------------+------------+
--   | log_id | timestamp           | action_type | table_name       | actor        | risk_level |
--   +--------+---------------------+-------------+------------------+--------------+------------+
--   | 86     | 2026-11-18 02:48:00 | UPDATE      | evidence         | UNIDENTIFIED | CRITICAL   |
--   | 87     | 2026-11-18 02:51:00 | DELETE      | case_assignments | UNIDENTIFIED | HIGH       |
--   | 88     | 2026-11-18 02:53:00 | DELETE      | case_assignments | UNIDENTIFIED | HIGH       |
--   | 89     | 2026-11-18 02:55:00 | DELETE      | case_assignments | UNIDENTIFIED | HIGH       |
--   | 91     | 2026-11-19 10:00:01 | INSERT      | integrity_checks | Meera Iyer   | CRITICAL   |
--   | 92     | 2026-11-19 10:00:01 | UPDATE      | evidence         | Meera Iyer   | CRITICAL   |
--   | 94     | 2026-11-19 11:00:01 | INSERT      | integrity_checks | Vikram Mehta | CRITICAL   |
--   +--------+---------------------+-------------+------------------+--------------+------------+
--   7 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- J4. LEFT JOIN + IS NULL ("anti-join") - investigators who have never
--     registered any evidence.
-- ---------------------------------------------------------------------
SELECT i.investigator_id, i.investigator_name, i.role
  FROM investigators i
  LEFT JOIN evidence e ON e.uploaded_by = i.investigator_id
 WHERE e.evidence_id IS NULL;
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
-- J5. RIGHT JOIN - all investigators (right table) with their ACTIVE
--     case assignments; investigators with no assignment show NULLs
--     (e.g. the auditor, who is read-only).
-- ---------------------------------------------------------------------
SELECT i.investigator_name, i.role, c.case_code, ca.assignment_role
  FROM case_assignments ca
  INNER JOIN cases c ON c.case_id = ca.case_id AND ca.assignment_status = 'ACTIVE'
  RIGHT JOIN investigators i ON i.investigator_id = ca.investigator_id
 ORDER BY i.investigator_id, c.case_code;
-- [[OUTPUT]]
--   +-------------------+-------------------+-----------+-----------------+
--   | investigator_name | role              | case_code | assignment_role |
--   +-------------------+-------------------+-----------+-----------------+
--   | Ananya Rao        | ADMIN             | CASE-005  | LEAD            |
--   | Vikram Mehta      | LEAD_INVESTIGATOR | CASE-001  | LEAD            |
--   | Vikram Mehta      | LEAD_INVESTIGATOR | CASE-002  | LEAD            |
--   | Vikram Mehta      | LEAD_INVESTIGATOR | CASE-003  | LEAD            |
--   | Vikram Mehta      | LEAD_INVESTIGATOR | CASE-004  | LEAD            |
--   | Vikram Mehta      | LEAD_INVESTIGATOR | CASE-005  | MEMBER          |
--   | Priya Sharma      | INVESTIGATOR      | CASE-001  | MEMBER          |
--   | Rahul Verma       | INVESTIGATOR      | CASE-001  | MEMBER          |
--   | Rahul Verma       | INVESTIGATOR      | CASE-002  | REVIEWER        |
--   | Rahul Verma       | INVESTIGATOR      | CASE-003  | MEMBER          |
--   | Rahul Verma       | INVESTIGATOR      | CASE-004  | MEMBER          |
--   | Meera Iyer        | AUDITOR           | NULL      | NULL            |
--   +-------------------+-------------------+-----------+-----------------+
--   12 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- J6. CROSS JOIN - every investigator x every risk level, then count
--     their events per level. The cartesian product guarantees a row
--     (with 0) even when an investigator has no events at that level -
--     the basis of the risk heat-map.
-- ---------------------------------------------------------------------
SELECT i.investigator_name, r.risk_level,
       (SELECT COUNT(*) FROM audit_logs a
         WHERE a.investigator_id = i.investigator_id AND a.risk_level = r.risk_level) AS events
  FROM investigators i
  CROSS JOIN (SELECT 'LOW' AS risk_level UNION ALL SELECT 'MEDIUM'
              UNION ALL SELECT 'HIGH' UNION ALL SELECT 'CRITICAL') r
 ORDER BY i.investigator_id, FIELD(r.risk_level, 'LOW','MEDIUM','HIGH','CRITICAL');
-- [[OUTPUT]]
--   +-------------------+------------+--------+
--   | investigator_name | risk_level | events |
--   +-------------------+------------+--------+
--   | Ananya Rao        | LOW        | 4      |
--   | Ananya Rao        | MEDIUM     | 4      |
--   | Ananya Rao        | HIGH       | 0      |
--   | Ananya Rao        | CRITICAL   | 0      |
--   | Vikram Mehta      | LOW        | 30     |
--   | Vikram Mehta      | MEDIUM     | 1      |
--   | Vikram Mehta      | HIGH       | 0      |
--   | Vikram Mehta      | CRITICAL   | 1      |
--   | Priya Sharma      | LOW        | 28     |
--   | Priya Sharma      | MEDIUM     | 0      |
--   | Priya Sharma      | HIGH       | 0      |
--   | Priya Sharma      | CRITICAL   | 0      |
--   | Rahul Verma       | LOW        | 20     |
--   | Rahul Verma       | MEDIUM     | 1      |
--   | Rahul Verma       | HIGH       | 0      |
--   +-------------------+------------+--------+
--   20 row(s) (showing first 15)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- J7. SELF JOIN - pair each custody transfer with the PREVIOUS transfer
--     of the same evidence to measure how long each custodian held it.
-- ---------------------------------------------------------------------
SELECT cur.evidence_id,
       prev.transfer_id AS previous_transfer,
       cur.transfer_id  AS next_transfer,
       TIMESTAMPDIFF(HOUR, prev.transfer_timestamp, cur.transfer_timestamp) AS hours_held
  FROM custody_transfers cur
  JOIN custody_transfers prev
    ON prev.evidence_id = cur.evidence_id
   AND prev.transfer_id = (SELECT MAX(p2.transfer_id) FROM custody_transfers p2
                            WHERE p2.evidence_id = cur.evidence_id AND p2.transfer_id < cur.transfer_id)
 ORDER BY cur.evidence_id, cur.transfer_id;
-- [[OUTPUT]]
--   +-------------+-------------------+---------------+------------+
--   | evidence_id | previous_transfer | next_transfer | hours_held |
--   +-------------+-------------------+---------------+------------+
--   | 1           | 1                 | 11            | 287        |
--   | 1           | 11                | 13            | 30         |
--   | 5           | 5                 | 12            | 214        |
--   | 6           | 6                 | 14            | 189        |
--   +-------------+-------------------+---------------+------------+
--   4 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- J8. JOIN on a VIEW - integrity verification history with names, only
--     the failed checks.
-- ---------------------------------------------------------------------
SELECT h.check_id, h.evidence_code, h.evidence_name, h.verification_result,
       h.checked_by_name, h.checked_at
  FROM vw_integrity_history h
  JOIN cases c ON c.case_id = h.case_id
 WHERE h.verification_result <> 'VERIFIED'
 ORDER BY h.checked_at;
-- [[OUTPUT]]
--   +----------+---------------+-----------------------------+---------------------+-----------------+---------------------+
--   | check_id | evidence_code | evidence_name               | verification_result | checked_by_name | checked_at          |
--   +----------+---------------+-----------------------------+---------------------+-----------------+---------------------+
--   | 18       | EV-0007       | exported_records_sample.csv | TAMPERED            | Meera Iyer      | 2026-11-19 10:00:01 |
--   | 19       | EV-0007       | exported_records_sample.csv | TAMPERED            | Vikram Mehta    | 2026-11-19 11:00:01 |
--   +----------+---------------+-----------------------------+---------------------+-----------------+---------------------+
--   2 row(s)
-- [[/OUTPUT]]
