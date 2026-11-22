# SQL Concepts - Explained with SQL Ghost Hunter Examples

All examples are taken from the scripts in `sql/`. The demonstration scripts contain **83 numbered queries** (Q1-Q22, C1-C16, J1-J8, S1-S11, A1-A9, T1-T6, X1-X11), each with a comment explaining the concept and the **real output captured from MySQL 8.4** in a `-- [[OUTPUT]]` block.

| Script | Concepts | Run when |
|---|---|---|
| 01_schema.sql | CREATE DATABASE, CREATE TABLE, all constraints, JSON columns, reference data | install |
| 02_sample_data.sql | INSERT, CALL, user variables, `SET timestamp` | install |
| 03_basic_queries.sql | DDL/DML, ALTER, DROP (isolated table), operators, WHERE/ORDER BY/DISTINCT/LIMIT | demo |
| 04_constraints.sql | proves PK/FK/UNIQUE/NOT NULL/CHECK/DEFAULT are enforced | demo |
| 05_joins.sql | INNER, LEFT, RIGHT, CROSS, SELF joins | demo |
| 06_subqueries.sql | single-row, multiple-row, correlated, EXISTS/NOT EXISTS, IN/NOT IN, ALL, derived table | demo |
| 07_aggregate_queries.sql | COUNT/SUM/AVG/MIN/MAX, GROUP BY, HAVING, WITH ROLLUP | demo |
| 08_views_indexes.sql | 7 views, indexes, EXPLAIN | install (re-runnable) |
| 09_procedures_functions.sql | 10 functions, 11 procedures, SIGNAL, handlers, transactions | install |
| 10_triggers.sql | 23 triggers (auditing + protection) | install |
| 11_transactions.sql | COMMIT, ROLLBACK, SAVEPOINT, atomic procedures | demo |
| 12_advanced_queries.sql | CTE, recursive CTE, window functions, JSON_TABLE, UNION | demo |
| 13_security_privileges.sql | CREATE USER, GRANT, least privilege | install |

---

## 1. DDL - Data Definition Language
Defines structure. `CREATE DATABASE ghost_hunter CHARACTER SET utf8mb4` (01), `CREATE TABLE evidence (...)` (01), `ALTER TABLE demo_field_notes ADD COLUMN reviewed ...` and `MODIFY` (03 Q7), `DROP TABLE demo_field_notes` (03 Q8 - only on an isolated scratch table, never on real data), `CREATE VIEW`, `CREATE INDEX` (08).

## 2. DML - Data Manipulation Language
Changes data. `INSERT INTO cases ...` (03 Q9), `UPDATE cases SET case_status='IN_PROGRESS' ...` (Q10), `DELETE FROM cases WHERE case_id = @test_case` (Q11). Q12 then shows the three audit rows the triggers created - proof that every DML statement leaves a trace. `SELECT` is used everywhere.

## 3. Constraints (01, proven in 04)
| Constraint | Example | 04 test result |
|---|---|---|
| PRIMARY KEY | `CONSTRAINT pk_evidence PRIMARY KEY (evidence_id)` | duplicate id -> error 1062 |
| FOREIGN KEY | `FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE RESTRICT` | evidence for case 999 -> 1452; deleting CASE-001 -> 1451 |
| UNIQUE | `uq_investigators_email UNIQUE (email)` | duplicate e-mail -> 1062 |
| NOT NULL | `case_title VARCHAR(200) NOT NULL` | NULL title -> 1048 |
| CHECK | `CHECK (role IN ('ADMIN','LEAD_INVESTIGATOR','INVESTIGATOR','AUDITOR'))`, `CHECK (REGEXP_LIKE(original_hash,'^[0-9a-f]{64}$','c'))` | invalid role / malformed hash -> 3819 |
| DEFAULT | `case_status ... DEFAULT 'OPEN'`, `created_at ... DEFAULT CURRENT_TIMESTAMP` | minimal insert gets OPEN/MEDIUM/now |

A multi-column CHECK enforces forensic logic: a `VERIFIED` integrity check must have `actual_hash = expected_hash` (C9).

## 4. Operators (03)
- Arithmetic `/ * + -`: `ROUND(file_size_bytes / 1024, 2) AS size_kb`, `DATEDIFF(NOW(), uploaded_at)` (Q13).
- Comparison `> < = <> >= <=`: `file_size_bytes > 10000 OR integrity_status <> 'VERIFIED'` (Q14).
- Logical `AND OR NOT`: high-risk events that are direct-DB or deletes and NOT application events (Q15).
- `BETWEEN` (Q16), `IN` (Q17), `LIKE 'r%'` / `'%ra%'` (Q18), `IS NULL` - changes with no application identity (Q19), `IS NOT NULL` (Q20).
- NULL-safe equality `<=>` is used in triggers: `NOT (OLD.original_hash <=> NEW.original_hash)`.

## 5. Clauses
`WHERE` (everywhere), `ORDER BY` with several keys (Q22), `DISTINCT` (Q21), `LIMIT` (Q16, Q22), `GROUP BY` (07 A2-A9), `HAVING` - actors with >= 3 deletes (A4), failed-login accounts (A5).
**WHERE vs HAVING:** WHERE filters rows before grouping; HAVING filters the groups after aggregation.

## 6. Aggregate functions (07)
A1 computes `COUNT(*)`, `SUM(file_size_bytes)`, `AVG`, `MIN`, `MAX` of evidence in one row. A5 uses `SUM(success = 0)` (a condition is 1/0 in MySQL) and `COUNT(DISTINCT ip_address)`. A7 uses `WITH ROLLUP` for subtotals. The dashboard view `vw_dashboard_stats` is a set of `COUNT(*)` subqueries.

## 7. Joins (05)
| Join | Project use |
|---|---|
| INNER JOIN | evidence + case + uploader (J1) |
| same table joined 3 times | custody history with from / to / performed-by names (J2) |
| LEFT JOIN | keep audit rows whose `investigator_id` is NULL - an INNER JOIN would hide direct-DB tampering (J3); anti-join "investigators who never uploaded evidence" (J4) |
| RIGHT JOIN | all investigators with their active assignments, auditor shown with NULLs (J5) |
| CROSS JOIN | investigator x risk-level matrix so zero counts appear (J6) |
| SELF JOIN | each custody transfer with the previous one -> hours held (J7) |

## 8. Subqueries (06)
- **Single-row:** `WHERE file_size_bytes > (SELECT AVG(file_size_bytes) FROM evidence)` (S1), latest event (S2).
- **Multiple-row with IN / NOT IN:** cases containing compromised evidence (S3); active investigators not on any open case (S4). NOT IN is safe there because the subquery column is NOT NULL.
- **Correlated:** latest integrity check per evidence - the inner query references the outer `ic.evidence_id` (S5); investigators above average activity (S6).
- **EXISTS / NOT EXISTS:** cases changed without application identity (S7); evidence never re-verified (S8).
- **Scalar subquery in SELECT** (S9), **derived table** in FROM (S10), **ALL** (S11).

## 9. Views (08)
`vw_evidence_overview`, `vw_audit_trail`, `vw_case_summary`, `vw_custody_history`, `vw_integrity_history`, `vw_dashboard_stats`, `vw_investigator_activity`. Views hide joins, give one consistent definition of "current custodian" or "case risk", and are what the API reads (e.g. the dashboard is `SELECT * FROM vw_dashboard_stats`).

## 10. Indexes (01, 08)
InnoDB creates the PRIMARY KEY (clustered) index and an index for every FK. Additional indexes match the most frequent forensic filters: `idx_audit_timestamp`, `idx_audit_actor_time (investigator_id, timestamp)`, `idx_audit_table_record (table_name, record_id)`, `idx_audit_case_time`, `idx_audit_action_risk`, `idx_evidence_status`, `idx_custody_evidence_time`, `idx_integrity_evidence_time`, `idx_login_email_time`, `idx_alerts_status_severity`, `idx_cases_status`. `EXPLAIN` in 08 shows the "who modified this record" query uses `idx_audit_table_record` with `type = ref` instead of a full scan. Trade-off: indexes speed up reads but slow down writes slightly and use space.

## 11. Stored functions (09)
Return one value and can be used inside SQL:
`fn_risk_level(score)`, `fn_risk_rank(level)`, `fn_max_risk(a,b)`, `fn_escalate_risk(level)`, `fn_audit_risk(action, table, actor)` (used by triggers), `fn_is_off_hours(time)` (reads working hours from `detection_rules`), `fn_current_custodian(evidence_id)`, `fn_case_evidence_count(case_id)`, `fn_case_risk_score(case_id)`, `fn_has_case_access(investigator, case)` (row-level access used by the API).
They are declared `DETERMINISTIC NO SQL` or `READS SQL DATA`, which MySQL requires when binary logging is on.

## 12. Stored procedures (09)
Multi-step operations with IN/OUT parameters, validation with `SIGNAL SQLSTATE '45000'`, and an `EXIT HANDLER FOR SQLEXCEPTION` that does `ROLLBACK; RESIGNAL;`:
`sp_create_case`, `sp_update_case_status`, `sp_assign_investigator`, `sp_remove_assignment`, `sp_register_evidence`, `sp_apply_integrity_check` (internal), `sp_record_integrity_check`, `sp_transfer_custody`, `sp_delete_empty_case`, `sp_log_app_event`, `sp_case_risk_summary` (returns a result set).
Example: `CALL sp_transfer_custody(1, 4, 'Hand-over for analysis', '<sha256>', 3, @tid); SELECT @tid;`

## 13. Triggers (10)
**23 triggers.** Auditing (`AFTER INSERT/UPDATE/DELETE` on investigators, cases, evidence, case_assignments; `AFTER INSERT` on custody_transfers and integrity_checks; `AFTER UPDATE` on detection_rules and ai_alerts) write `OLD`/`NEW` values as `JSON_OBJECT(...)`, the application identity `@app_investigator_id`, the MySQL account `USER()`, IP and a risk level.
Protection (`BEFORE UPDATE/DELETE`): `trg_evidence_protect_original_hash`, `trg_audit_block_update/delete`, `trg_custody_block_*`, `trg_integrity_block_*` raise `SIGNAL` errors.
**No recursion:** audit triggers insert only into `audit_logs`, whose own triggers only block changes.
**Password hashes are never copied** into audit JSON (only a `password_changed` flag).

## 14. Transactions (09, 11)
`START TRANSACTION` ... `COMMIT` makes changes permanent; `ROLLBACK` undoes them; `SAVEPOINT` + `ROLLBACK TO SAVEPOINT` undo part of a transaction (11 T2-T4). T3 shows the audit rows written by triggers are rolled back together with the change (nothing was committed, so nothing happened). T5 shows atomicity of `sp_transfer_custody`: the integrity check is inserted first, the custody insert then violates a CHECK, the handler rolls back -> 0 rows remain.

**ACID in this project:** *Atomicity* - evidence + custody + baseline check registered together or not at all. *Consistency* - constraints and triggers keep rules true after every transaction. *Isolation* - InnoDB REPEATABLE READ; `SELECT ... FOR UPDATE` in `sp_create_case` serialises case-number generation. *Durability* - committed rows survive crashes (InnoDB redo log).

## 15. Advanced SQL (12)
CTE `WITH case_integrity AS (...)` (X8), recursive CTE generating 24 hours (X9), window functions `ROW_NUMBER() OVER (PARTITION BY evidence_id ...)` (X5), `LAG()` (X6), `RANK()` and `SUM() OVER ()` (X7), `JSON_TABLE(JSON_KEYS(new_values), ...)` to list exactly which fields changed (X4), `UNION ALL` timeline (X10), `GROUP_CONCAT` (X11).

## 16. Security in SQL (13)
`CREATE USER 'ghost_app'@'localhost'` and narrow `GRANT`s: SELECT + EXECUTE on the database, a few INSERT/UPDATE grants, and **no** INSERT/UPDATE/DELETE on `audit_logs`, `integrity_checks`, `custody_transfers` or `evidence`. Procedures and triggers run with their DEFINER's rights, so the app can still record history - but only through the rules coded in them.
