-- =====================================================================
-- SQL GHOST HUNTER  |  07_aggregate_queries.sql
-- PURPOSE : Statistics used by the dashboard, reports and anomaly rules.
-- CONCEPTS: COUNT(), SUM(), AVG(), MIN(), MAX(), COUNT(DISTINCT),
--           GROUP BY, HAVING, ORDER BY on aggregates, WITH ROLLUP.
-- =====================================================================
USE ghost_hunter;

-- ---------------------------------------------------------------------
-- A1. COUNT / SUM / AVG / MIN / MAX in one query - evidence storage summary
-- ---------------------------------------------------------------------
SELECT COUNT(*)                         AS evidence_items,
       SUM(file_size_bytes)             AS total_bytes,
       ROUND(AVG(file_size_bytes), 1)   AS avg_bytes,
       MIN(file_size_bytes)             AS smallest,
       MAX(file_size_bytes)             AS largest,
       MIN(uploaded_at)                 AS first_registered,
       MAX(uploaded_at)                 AS last_registered
  FROM evidence;
-- [[OUTPUT]]
--   +----------------+-------------+-----------+----------+---------+---------------------+---------------------+
--   | evidence_items | total_bytes | avg_bytes | smallest | largest | first_registered    | last_registered     |
--   +----------------+-------------+-----------+----------+---------+---------------------+---------------------+
--   | 10             | 28204       | 2820.4    | 159      | 12836   | 2026-10-29 10:30:00 | 2026-11-09 15:30:00 |
--   +----------------+-------------+-----------+----------+---------+---------------------+---------------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A2. COUNT with GROUP BY - audit events per operation type
-- ---------------------------------------------------------------------
SELECT action_type, COUNT(*) AS events
  FROM audit_logs
 GROUP BY action_type
 ORDER BY events DESC;
-- [[OUTPUT]]
--   +-------------------+--------+
--   | action_type       | events |
--   +-------------------+--------+
--   | INSERT            | 68     |
--   | UPDATE            | 19     |
--   | EVIDENCE_DOWNLOAD | 5      |
--   | DELETE            | 4      |
--   | LOGIN             | 4      |
--   +-------------------+--------+
--   5 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A3. GROUP BY two columns - risk distribution per table
-- ---------------------------------------------------------------------
SELECT table_name, risk_level, COUNT(*) AS events
  FROM audit_logs
 WHERE table_name IS NOT NULL
 GROUP BY table_name, risk_level
 ORDER BY table_name, FIELD(risk_level, 'CRITICAL','HIGH','MEDIUM','LOW');
-- [[OUTPUT]]
--   +-------------------+------------+--------+
--   | table_name        | risk_level | events |
--   +-------------------+------------+--------+
--   | case_assignments  | HIGH       | 3      |
--   | case_assignments  | LOW        | 14     |
--   | cases             | MEDIUM     | 4      |
--   | cases             | LOW        | 12     |
--   | custody_transfers | LOW        | 14     |
--   | evidence          | CRITICAL   | 2      |
--   | evidence          | LOW        | 23     |
--   | integrity_checks  | CRITICAL   | 2      |
--   | integrity_checks  | LOW        | 17     |
--   | investigators     | MEDIUM     | 5      |
--   +-------------------+------------+--------+
--   10 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A4. HAVING - actors with 3 or more DELETE operations
--     (WHERE filters rows BEFORE grouping, HAVING filters GROUPS after)
-- ---------------------------------------------------------------------
SELECT COALESCE(investigator_id, 0) AS actor_id, db_user, COUNT(*) AS deletes,
       MIN(`timestamp`) AS first_delete, MAX(`timestamp`) AS last_delete
  FROM audit_logs
 WHERE action_type = 'DELETE'
 GROUP BY COALESCE(investigator_id, 0), db_user
HAVING COUNT(*) >= 3;
-- [[OUTPUT]]
--   +----------+----------------+---------+---------------------+---------------------+
--   | actor_id | db_user        | deletes | first_delete        | last_delete         |
--   +----------+----------------+---------+---------------------+---------------------+
--   | 0        | root@localhost | 3       | 2026-11-18 02:51:00 | 2026-11-18 02:55:00 |
--   +----------+----------------+---------+---------------------+---------------------+
--   1 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A5. COUNT + SUM(condition) - failed vs successful logins per account,
--     only accounts with at least one failure.
-- ---------------------------------------------------------------------
SELECT email,
       COUNT(*)              AS attempts,
       SUM(success = 0)      AS failures,
       SUM(success = 1)      AS successes,
       COUNT(DISTINCT ip_address) AS distinct_ips
  FROM login_attempts
 GROUP BY email
HAVING SUM(success = 0) > 0
 ORDER BY failures DESC;
-- [[OUTPUT]]
--   +-------------------------------+----------+----------+-----------+--------------+
--   | email                         | attempts | failures | successes | distinct_ips |
--   +-------------------------------+----------+----------+-----------+--------------+
--   | rahul.verma@ghosthunter.local | 7        | 6        | 1         | 1            |
--   | meera.iyer@ghosthunter.local  | 2        | 1        | 1         | 1            |
--   +-------------------------------+----------+----------+-----------+--------------+
--   2 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A6. AVG of a calculated value - average hours between registration and
--     the latest verification, per case.
-- ---------------------------------------------------------------------
SELECT c.case_code,
       COUNT(e.evidence_id)                                                   AS items,
       ROUND(AVG(TIMESTAMPDIFF(HOUR, e.uploaded_at, e.last_verified_at)), 1)  AS avg_hours_to_last_check
  FROM cases c
  JOIN evidence e ON e.case_id = c.case_id
 GROUP BY c.case_code
 ORDER BY c.case_code;
-- [[OUTPUT]]
--   +-----------+-------+-------------------------+
--   | case_code | items | avg_hours_to_last_check |
--   +-----------+-------+-------------------------+
--   | CASE-001  | 3     | 346.0                   |
--   | CASE-002  | 2     | 107.0                   |
--   | CASE-003  | 2     | 272.5                   |
--   | CASE-004  | 2     | 0.0                     |
--   | CASE-005  | 1     | 0.0                     |
--   +-----------+-------+-------------------------+
--   5 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A7. GROUP BY ... WITH ROLLUP - evidence count per case and type, with
--     sub-totals per case and a grand total (NULL rows are totals).
-- ---------------------------------------------------------------------
SELECT c.case_code, e.evidence_type, COUNT(*) AS items
  FROM evidence e
  JOIN cases c ON c.case_id = e.case_id
 GROUP BY c.case_code, e.evidence_type WITH ROLLUP;
-- [[OUTPUT]]
--   +-----------+---------------+-------+
--   | case_code | evidence_type | items |
--   +-----------+---------------+-------+
--   | CASE-001  | CSV           | 1     |
--   | CASE-001  | PDF           | 1     |
--   | CASE-001  | TXT           | 1     |
--   | CASE-001  | NULL          | 3     |
--   | CASE-002  | CSV           | 1     |
--   | CASE-002  | PNG           | 1     |
--   | CASE-002  | NULL          | 2     |
--   | CASE-003  | CSV           | 1     |
--   | CASE-003  | TXT           | 1     |
--   | CASE-003  | NULL          | 2     |
--   | CASE-004  | JPEG          | 1     |
--   | CASE-004  | TXT           | 1     |
--   | CASE-004  | NULL          | 2     |
--   | CASE-005  | PDF           | 1     |
--   | CASE-005  | NULL          | 1     |
--   +-----------+---------------+-------+
--   16 row(s) (showing first 15)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A8. MAX per group + HAVING on MAX - investigators whose most severe
--     event is HIGH or CRITICAL (uses the stored function fn_risk_rank).
-- ---------------------------------------------------------------------
SELECT i.investigator_name,
       COUNT(a.log_id)                    AS events,
       MAX(fn_risk_rank(a.risk_level))    AS worst_rank,
       SUM(a.risk_level IN ('HIGH','CRITICAL')) AS high_or_critical
  FROM investigators i
  JOIN audit_logs a ON a.investigator_id = i.investigator_id
 GROUP BY i.investigator_name
HAVING MAX(fn_risk_rank(a.risk_level)) >= 3
 ORDER BY high_or_critical DESC;
-- [[OUTPUT]]
--   +-------------------+--------+------------+------------------+
--   | investigator_name | events | worst_rank | high_or_critical |
--   +-------------------+--------+------------+------------------+
--   | Meera Iyer        | 3      | 4          | 2                |
--   | Vikram Mehta      | 32     | 4          | 1                |
--   +-------------------+--------+------------+------------------+
--   2 row(s)
-- [[/OUTPUT]]

-- ---------------------------------------------------------------------
-- A9. Daily activity for the last 7 days (dashboard trend chart)
-- ---------------------------------------------------------------------
SELECT DATE(`timestamp`) AS day,
       COUNT(*) AS events,
       SUM(risk_level IN ('HIGH','CRITICAL')) AS high_risk
  FROM audit_logs
 WHERE `timestamp` >= CURDATE() - INTERVAL 6 DAY
 GROUP BY DATE(`timestamp`)
 ORDER BY day;
-- [[OUTPUT]]
--   +------------+--------+-----------+
--   | day        | events | high_risk |
--   +------------+--------+-----------+
--   | 2026-11-13 | 1      | 0         |
--   | 2026-11-14 | 4      | 0         |
--   | 2026-11-16 | 1      | 0         |
--   | 2026-11-18 | 13     | 4         |
--   | 2026-11-19 | 11     | 3         |
--   +------------+--------+-----------+
--   5 row(s)
-- [[/OUTPUT]]
