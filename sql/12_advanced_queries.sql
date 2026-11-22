-- =====================================================================
-- SQL GHOST HUNTER  |  12_advanced_queries.sql
-- PURPOSE : Forensic investigation queries that combine several features.
-- CONCEPTS: views, stored functions & procedures in queries, CTEs (WITH),
--           recursive CTE, window functions (ROW_NUMBER, LAG, RANK,
--           COUNT() OVER), JSON_EXTRACT / JSON_TABLE / JSON_KEYS,
--           CASE expressions, GROUP_CONCAT, UNION ALL.
-- =====================================================================
USE ghost_hunter;

-- ---------------------------------------------------------------------
-- X1. VIEW - live dashboard figures (exactly what the Dashboard page uses)
-- ---------------------------------------------------------------------
SELECT * FROM vw_dashboard_stats;
-- [[OUTPUT]]
--   +-------------+------------+----------------+-------------------+----------------------+--------------------+------------------+-------------+------------------+-------------------+------------------+
--   | total_cases | open_cases | total_evidence | verified_evidence | compromised_evidence | total_audit_events | high_risk_events | open_alerts | high_risk_alerts | custody_transfers | integrity_checks |
--   +-------------+------------+----------------+-------------------+----------------------+--------------------+------------------+-------------+------------------+-------------------+------------------+
--   | 5           | 4          | 10             | 9                 | 1                    | 104                | 7                | 0           | 0                | 14                | 20               |
--   +-------------+------------+----------------+-------------------+----------------------+--------------------+------------------+-------------+------------------+-------------------+------------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X2. STORED FUNCTIONS in a query - current custodian (derived from the
--     custody history), risk level of a score, off-hours check.
-- ---------------------------------------------------------------------
SELECT e.evidence_id, e.evidence_name,
       fn_current_custodian(e.evidence_id) AS custodian_id,
       fn_risk_level(92)                   AS level_of_92,
       fn_is_off_hours('2026-01-01 02:30:00') AS is_0230_off_hours
  FROM evidence e
 WHERE e.case_id = 1;
-- [[OUTPUT]]
--   +-------------+-----------------------------+--------------+-------------+-------------------+
--   | evidence_id | evidence_name               | custodian_id | level_of_92 | is_0230_off_hours |
--   +-------------+-----------------------------+--------------+-------------+-------------------+
--   | 1           | payroll_export_march.csv    | 2            | CRITICAL    | 1                 |
--   | 2           | db_server_audit_extract.txt | 3            | CRITICAL    | 1                 |
--   | 3           | hr_approval_memo.pdf        | 3            | CRITICAL    | 1                 |
--   +-------------+-----------------------------+--------------+-------------+-------------------+
--   3 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X3. STORED PROCEDURE returning a result set - risk summary of CASE-003
-- ---------------------------------------------------------------------
CALL sp_case_risk_summary(3);
-- [[OUTPUT]]
--   +-----------+-------------------------------------------+-------------+----------------+-------------------+--------------+------------------+------------+------------+
--   | case_code | case_title                                | case_status | evidence_items | compromised_items | audit_events | high_risk_events | risk_score | risk_level |
--   +-----------+-------------------------------------------+-------------+----------------+-------------------+--------------+------------------+------------+------------+
--   | CASE-003  | Insider Data Exfiltration via CSV Exports | OPEN        | 2              | 1                 | 21           | 4                | 0          | LOW        |
--   +-----------+-------------------------------------------+-------------+----------------+-------------------+--------------+------------------+------------+------------+
--   1 row(s)
--   Query OK, 0 row(s) affected
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X4. WHO modified this record and WHAT changed?  (record = evidence 2)
--     JSON_TABLE turns the JSON keys into rows; only keys whose value
--     differs between old_values and new_values are listed.
-- ---------------------------------------------------------------------
SELECT a.log_id, a.`timestamp`,
       COALESCE(i.investigator_name, 'UNIDENTIFIED') AS actor,
       a.db_user, k.field,
       JSON_UNQUOTE(JSON_EXTRACT(a.old_values, CONCAT('$.', k.field))) AS old_value,
       JSON_UNQUOTE(JSON_EXTRACT(a.new_values, CONCAT('$.', k.field))) AS new_value
  FROM audit_logs a
  LEFT JOIN investigators i ON i.investigator_id = a.investigator_id
  JOIN JSON_TABLE(JSON_KEYS(a.new_values), '$[*]' COLUMNS (field VARCHAR(64) PATH '$')) k
 WHERE a.table_name = 'evidence' AND a.record_id = 2 AND a.action_type = 'UPDATE'
   AND NOT (JSON_EXTRACT(a.old_values, CONCAT('$.', k.field)) <=> JSON_EXTRACT(a.new_values, CONCAT('$.', k.field)))
   AND k.field NOT IN ('last_verified_at')
 ORDER BY a.log_id;
-- [[OUTPUT]]
--   +--------+---------------------+--------------+----------------+-------------+------------------------------------------------------------------+------------------------------------+
--   | log_id | timestamp           | actor        | db_user        | field       | old_value                                                        | new_value                          |
--   +--------+---------------------+--------------+----------------+-------------+------------------------------------------------------------------+------------------------------------+
--   | 86     | 2026-11-18 02:48:00 | UNIDENTIFIED | root@localhost | description | MySQL general-log extract showing UPDATE/DELETE statements fr... | Routine payroll log - no anomalies |
--   +--------+---------------------+--------------+----------------+-------------+------------------------------------------------------------------+------------------------------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X5. WINDOW FUNCTION ROW_NUMBER - the latest custody transfer of each
--     evidence item (= the current custodian) without a correlated subquery.
-- ---------------------------------------------------------------------
SELECT evidence_id, to_name AS current_custodian, transfer_timestamp
  FROM (SELECT h.*, ROW_NUMBER() OVER (PARTITION BY evidence_id
                                       ORDER BY transfer_timestamp DESC, transfer_id DESC) AS rn
          FROM vw_custody_history h) ranked
 WHERE rn = 1
 ORDER BY evidence_id;
-- [[OUTPUT]]
--   +-------------+-------------------+---------------------+
--   | evidence_id | current_custodian | transfer_timestamp  |
--   +-------------+-------------------+---------------------+
--   | 1           | Vikram Mehta      | 2026-11-11 16:45:00 |
--   | 2           | Priya Sharma      | 2026-10-29 10:30:00 |
--   | 3           | Priya Sharma      | 2026-10-29 10:30:00 |
--   | 4           | Priya Sharma      | 2026-11-01 11:40:00 |
--   | 5           | Vikram Mehta      | 2026-11-10 10:10:00 |
--   | 6           | Priya Sharma      | 2026-11-12 11:30:00 |
--   | 7           | Priya Sharma      | 2026-11-04 14:30:00 |
--   | 8           | Rahul Verma       | 2026-11-07 11:05:00 |
--   | 9           | Rahul Verma       | 2026-11-07 11:05:00 |
--   | 10          | Vikram Mehta      | 2026-11-09 15:30:00 |
--   +-------------+-------------------+---------------------+
--   10 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X6. WINDOW FUNCTION LAG - minutes between consecutive actions of the
--     unidentified (direct DB) actor: very short gaps suggest a scripted
--     or rushed session.
-- ---------------------------------------------------------------------
SELECT log_id, `timestamp`, action_type, table_name, record_id,
       TIMESTAMPDIFF(MINUTE, LAG(`timestamp`) OVER (ORDER BY `timestamp`, log_id), `timestamp`) AS minutes_since_previous
  FROM audit_logs
 WHERE investigator_id IS NULL AND event_source = 'TRIGGER' AND `timestamp` > NOW() - INTERVAL 7 DAY;
-- [[OUTPUT]]
--   +--------+---------------------+-------------+------------------+-----------+------------------------+
--   | log_id | timestamp           | action_type | table_name       | record_id | minutes_since_previous |
--   +--------+---------------------+-------------+------------------+-----------+------------------------+
--   | 83     | 2026-11-18 02:40:00 | UPDATE      | cases            | 1         | NULL                   |
--   | 84     | 2026-11-18 02:43:00 | UPDATE      | cases            | 1         | 3                      |
--   | 85     | 2026-11-18 02:46:00 | UPDATE      | cases            | 1         | 3                      |
--   | 86     | 2026-11-18 02:48:00 | UPDATE      | evidence         | 2         | 2                      |
--   | 87     | 2026-11-18 02:51:00 | DELETE      | case_assignments | 2         | 3                      |
--   | 88     | 2026-11-18 02:53:00 | DELETE      | case_assignments | 5         | 2                      |
--   | 89     | 2026-11-18 02:55:00 | DELETE      | case_assignments | 9         | 2                      |
--   +--------+---------------------+-------------+------------------+-----------+------------------------+
--   7 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X7. WINDOW FUNCTION RANK + COUNT() OVER - rank actors by number of
--     high/critical events and show their share of all such events.
-- ---------------------------------------------------------------------
SELECT actor, high_risk_events,
       RANK() OVER (ORDER BY high_risk_events DESC) AS risk_rank,
       ROUND(100 * high_risk_events / SUM(high_risk_events) OVER (), 1) AS pct_of_total
  FROM (SELECT COALESCE(i.investigator_name, 'UNIDENTIFIED') AS actor, COUNT(*) AS high_risk_events
          FROM audit_logs a
          LEFT JOIN investigators i ON i.investigator_id = a.investigator_id
         WHERE a.risk_level IN ('HIGH','CRITICAL')
         GROUP BY COALESCE(i.investigator_name, 'UNIDENTIFIED')) t;
-- [[OUTPUT]]
--   +--------------+------------------+-----------+--------------+
--   | actor        | high_risk_events | risk_rank | pct_of_total |
--   +--------------+------------------+-----------+--------------+
--   | UNIDENTIFIED | 4                | 1         | 57.1         |
--   | Meera Iyer   | 2                | 2         | 28.6         |
--   | Vikram Mehta | 1                | 3         | 14.3         |
--   +--------------+------------------+-----------+--------------+
--   3 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X8. CTE (WITH) - per-case integrity picture, then classify each case.
-- ---------------------------------------------------------------------
WITH case_integrity AS (
  SELECT c.case_code,
         COUNT(e.evidence_id)                         AS items,
         SUM(e.integrity_status = 'TAMPERED')         AS tampered,
         SUM(e.integrity_status = 'MISSING')          AS missing
    FROM cases c
    LEFT JOIN evidence e ON e.case_id = c.case_id
   GROUP BY c.case_code
)
SELECT case_code, items, tampered, missing,
       CASE WHEN tampered > 0 THEN 'EVIDENCE COMPROMISED'
            WHEN missing  > 0 THEN 'EVIDENCE MISSING'
            WHEN items    = 0 THEN 'NO EVIDENCE YET'
            ELSE 'INTACT' END AS integrity_verdict
  FROM case_integrity
 ORDER BY tampered DESC, case_code;
-- [[OUTPUT]]
--   +-----------+-------+----------+---------+----------------------+
--   | case_code | items | tampered | missing | integrity_verdict    |
--   +-----------+-------+----------+---------+----------------------+
--   | CASE-003  | 2     | 1        | 0       | EVIDENCE COMPROMISED |
--   | CASE-001  | 3     | 0        | 0       | INTACT               |
--   | CASE-002  | 2     | 0        | 0       | INTACT               |
--   | CASE-004  | 2     | 0        | 0       | INTACT               |
--   | CASE-005  | 1     | 0        | 0       | INTACT               |
--   +-----------+-------+----------+---------+----------------------+
--   5 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X9. RECURSIVE CTE - generate all 24 hours, then count yesterday's data
--     changes per hour (hours with no activity still appear with 0).
--     Shows activity in the middle of the night.
-- ---------------------------------------------------------------------
WITH RECURSIVE hours AS (
  SELECT 0 AS h
  UNION ALL
  SELECT h + 1 FROM hours WHERE h < 23
)
SELECT LPAD(h, 2, '0') AS hour_of_day,
       (SELECT COUNT(*) FROM audit_logs a
         WHERE DATE(a.`timestamp`) = CURDATE() - INTERVAL 1 DAY
           AND HOUR(a.`timestamp`) = hours.h) AS events_yesterday,
       IF(fn_is_off_hours(CURDATE() + INTERVAL h HOUR), 'off-hours', 'working hours') AS note
  FROM hours
 WHERE h BETWEEN 0 AND 5 OR h BETWEEN 9 AND 11;
-- [[OUTPUT]]
--   +-------------+------------------+---------------+
--   | hour_of_day | events_yesterday | note          |
--   +-------------+------------------+---------------+
--   | 00          | 0                | off-hours     |
--   | 01          | 0                | off-hours     |
--   | 02          | 13               | off-hours     |
--   | 03          | 0                | off-hours     |
--   | 04          | 0                | off-hours     |
--   | 05          | 0                | off-hours     |
--   | 09          | 0                | working hours |
--   | 10          | 0                | working hours |
--   | 11          | 0                | working hours |
--   +-------------+------------------+---------------+
--   9 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- X10. GROUP_CONCAT + UNION ALL - a combined forensic timeline of CASE-001
--      (audit events and custody transfers in one chronological list).
-- ---------------------------------------------------------------------
SELECT event_time, source, summary
  FROM (
    SELECT a.`timestamp` AS event_time, 'AUDIT' AS source,
           CONCAT(a.action_type, ' ', COALESCE(a.table_name, ''), ' #', COALESCE(a.record_id, '-'),
                  ' by ', COALESCE(i.investigator_name, 'UNIDENTIFIED'), ' [', a.risk_level, ']') AS summary
      FROM audit_logs a
      LEFT JOIN investigators i ON i.investigator_id = a.investigator_id
     WHERE a.related_case_id = 1 AND a.risk_level <> 'LOW'
    UNION ALL
    SELECT h.transfer_timestamp, 'CUSTODY',
           CONCAT(h.evidence_code, ': ', h.from_name, ' -> ', h.to_name, ' (', h.verification_status, ')')
      FROM vw_custody_history h
     WHERE h.case_id = 1
  ) timeline
 ORDER BY event_time;
-- [[OUTPUT]]
--   +---------------------+---------+-----------------------------------------------------------+
--   | event_time          | source  | summary                                                   |
--   +---------------------+---------+-----------------------------------------------------------+
--   | 2026-10-29 10:30:00 | CUSTODY | EV-0001: (initial acquisition) -> Priya Sharma (VERIFIED) |
--   | 2026-10-29 10:30:00 | CUSTODY | EV-0002: (initial acquisition) -> Priya Sharma (VERIFIED) |
--   | 2026-10-29 10:30:00 | CUSTODY | EV-0003: (initial acquisition) -> Priya Sharma (VERIFIED) |
--   | 2026-11-10 10:10:00 | CUSTODY | EV-0001: Priya Sharma -> Rahul Verma (VERIFIED)           |
--   | 2026-11-11 16:45:00 | CUSTODY | EV-0001: Rahul Verma -> Vikram Mehta (VERIFIED)           |
--   | 2026-11-18 02:40:00 | AUDIT   | UPDATE cases #1 by UNIDENTIFIED [MEDIUM]                  |
--   | 2026-11-18 02:43:00 | AUDIT   | UPDATE cases #1 by UNIDENTIFIED [MEDIUM]                  |
--   | 2026-11-18 02:46:00 | AUDIT   | UPDATE cases #1 by UNIDENTIFIED [MEDIUM]                  |
--   | 2026-11-18 02:48:00 | AUDIT   | UPDATE evidence #2 by UNIDENTIFIED [CRITICAL]             |
--   | 2026-11-18 02:51:00 | AUDIT   | DELETE case_assignments #2 by UNIDENTIFIED [HIGH]         |
--   +---------------------+---------+-----------------------------------------------------------+
--   10 row(s)
-- [[/OUTPUT]]

-- X11. GROUP_CONCAT - team of every case in one line
SELECT c.case_code,
       GROUP_CONCAT(CONCAT(i.investigator_name, ' (', ca.assignment_role, ')')
                    ORDER BY ca.assignment_role, i.investigator_name SEPARATOR ', ') AS active_team
  FROM cases c
  JOIN case_assignments ca ON ca.case_id = c.case_id AND ca.assignment_status = 'ACTIVE'
  JOIN investigators i     ON i.investigator_id = ca.investigator_id
 GROUP BY c.case_code;
-- [[OUTPUT]]
--   +-----------+------------------------------------------------------------------+
--   | case_code | active_team                                                      |
--   +-----------+------------------------------------------------------------------+
--   | CASE-001  | Vikram Mehta (LEAD), Priya Sharma (MEMBER), Rahul Verma (MEMBER) |
--   | CASE-002  | Vikram Mehta (LEAD), Rahul Verma (REVIEWER)                      |
--   | CASE-003  | Vikram Mehta (LEAD), Rahul Verma (MEMBER)                        |
--   | CASE-004  | Vikram Mehta (LEAD), Rahul Verma (MEMBER)                        |
--   | CASE-005  | Ananya Rao (LEAD), Vikram Mehta (MEMBER)                         |
--   +-----------+------------------------------------------------------------------+
--   5 row(s)
-- [[/OUTPUT]]
