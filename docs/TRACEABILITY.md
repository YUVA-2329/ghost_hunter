# Requirement Traceability Matrix

Status: **IT** = implemented and tested (automated test or recorded manual check) · **I** = implemented, not tested here · **NI** = not implemented.

## Database

| Requirement | Implementation | Evidence of testing | Status |
|---|---|---|---|
| MySQL database created | `sql/01_schema.sql` | setup script, test 1 | IT |
| Seven or more related tables | 11 tables (7 required + login_attempts, app_sessions, detection_rules, ai_alerts) | test_schema_has_required_tables_and_objects | IT |
| All required columns per table | 01_schema.sql (plus justified extras e.g. `case_code`, `performed_by`, `hash_at_transfer`) | schema test, API tests | IT |
| PK / FK / UNIQUE / NOT NULL / CHECK / DEFAULT | 11 PK, 20 FK, 6 UNIQUE, 35 CHECK, defaults | 04_constraints.sql (each rejected), schema test | IT |
| Referential integrity | FKs `ON DELETE RESTRICT` | C10, C11 in 04 | IT |
| Indexes | 11 extra indexes, EXPLAIN | 08 run, EXPLAIN output | IT |
| Normalisation to 3NF | ER_DIAGRAM.md section 5; derived custodian | design review | I (documented) |
| JSON old/new audit values | `old_values`/`new_values JSON` + `JSON_OBJECT` in triggers | tests 3, 4; X4 JSON_TABLE | IT |
| Sample data minimums | 5 investigators, 5 cases, 10 evidence, 14 transfers, 19 checks, 97 audit rows, normal + suspicious | test_sample_data_meets_minimums | IT |
| ER diagram (Mermaid) | docs/ER_DIAGRAM.md (rendered on Documentation page) | rendered in browser | IT |

## SQL academic requirements

| Requirement | Location | Status |
|---|---|---|
| CREATE DATABASE / CREATE TABLE | 01, 03 Q1-Q2 | IT |
| INSERT / SELECT / UPDATE / DELETE | 02, 03 Q3-Q6, Q9-Q12 | IT |
| ALTER TABLE / DROP TABLE (isolated) | 03 Q7-Q8 (`demo_field_notes` only) | IT |
| Arithmetic, comparison, logical, BETWEEN, IN, LIKE, IS NULL, AND, OR, NOT | 03 Q13-Q20 | IT |
| COUNT, SUM, AVG, MIN, MAX | 07 A1-A9 | IT |
| WHERE, ORDER BY, GROUP BY, HAVING, DISTINCT, LIMIT | 03 Q21-Q22, 07 | IT |
| INNER, LEFT, RIGHT, CROSS JOIN (+ SELF) | 05 J1-J8 | IT |
| Single-row, multiple-row, correlated subqueries, EXISTS, IN, NOT IN | 06 S1-S11 | IT |
| Views | 08 (7 views) | IT |
| Stored procedures / functions | 09 (11 / 10) | IT |
| Triggers | 10 (23) | IT |
| Transactions, COMMIT, ROLLBACK (+ SAVEPOINT) | 11 T1-T6, procedures | IT |
| >= 25 executable, commented queries with output | 83 numbered queries, real output blocks | test_at_least_25_documented_queries + script tests | IT |
| Dedicated SQL folder, scripts 01-12 | `sql/01`-`12` (+ `13_security_privileges.sql`) | script tests | IT |

## Auditing (section 5)

| Requirement | Implementation | Status |
|---|---|---|
| Triggers for INSERT/UPDATE/DELETE on business tables | investigators, cases, evidence, case_assignments (+ custody, integrity, rules, alerts) | IT |
| Operation, table, record, previous/new values, timestamp, investigator | audit_logs columns | IT |
| No recursive triggers | design (SQL_EXPLANATION §13) | IT (scripts run) |
| Normal users cannot modify/delete audit history | no grants for ghost_app + blocking triggers | IT (tests 36, 37) |
| Session-based identity, never trust browser ID | `@app_investigator_id` from server session; extra fields rejected | IT (tests 3, 34) |
| Document admin-bypass limitation | SECURITY.md §3 | I (documented) |
| Genuine DB events in UI | Audit page reads `vw_audit_trail` | IT |

## Evidence, integrity, custody (sections 6-7)

| Requirement | Implementation | Status |
|---|---|---|
| PDF/PNG/JPG/TXT/CSV (+JSON/LOG) upload | `utils/files.py` | IT |
| Validate, store securely, SHA-256, store hash, link case, record uploader, audit | `store_upload` + `sp_register_evidence` | IT (test 1) |
| Verify: recompute, compare, VERIFIED/TAMPERED, record attempt, alert | `sp_record_integrity_check` + detector | IT (test 2) |
| Never overwrite original hash / never delete checks | trigger + append-only triggers | IT (tests 2, 37) |
| Genuinely detect file modification | SHA-256 of stored file | IT (test 2, UI flow) |
| Transfer with from/to/reason/timestamp/responsible/verification | `sp_transfer_custody` | IT (test 6) |
| Chronological history, current custodian | `vw_custody_history`, `fn_current_custodian` | IT |
| Prevent unauthorised transfers | procedure checks | IT (test 6) |
| History not editable | append-only triggers, no grants | IT (test 6) |

## AI (section 8)

| Requirement | Implementation | Status |
|---|---|---|
| Anomaly detection on real audit logs (9 patterns) | 11 detectors in `ai/detector.py` | IT (tests 5, 5b) |
| Rule-based + statistical + optional ML, clearly distinguished | RULE / STATISTICAL / ML labels | IT |
| LOW/MEDIUM/HIGH/CRITICAL, score, explanation | score breakdown per alert | IT |
| Configurable risk | `detection_rules` + admin UI | IT (RBAC test; UI) |
| Forensic assistant, 8 example questions | `ai/assistant.py` | IT (tests 7, 20-26) |
| No arbitrary SQL by LLM; allowlisted, parameterised, access-controlled | intent router + fixed tools | IT |
| No invented records | facts from DB + hallucination guard | IT (test 27) |
| Report generator (facts vs AI recommendations separated) | `services/reports.py` | IT (test 28) |
| Offline fallback, status shown | deterministic summaries, status pill | IT (test 7) |
| Real local LLM via Ollama | `ai/ollama_client.py` | I (tested with API stand-in only) |

## Frontend (section 9)

| Page | Status |
|---|---|
| 1 Dashboard (live stats, AI status) | IT |
| 2 Investigations (create, view, status, assign, details) | IT |
| 3 Evidence (upload, SHA-256, list, verify, history) | IT |
| 4 Chain of custody (transfer, current, previous, history) | IT |
| 5 Audit logs (all columns, filters date/investigator/operation/risk) | IT |
| 6 AI security analysis (anomalies, scores, explanations, summaries, status) | IT |
| 7 SQL demonstration (tables, concepts, queries, explanations, results; no free SQL) | IT |
| 8 Documentation | IT |
| Light premium theme, responsive | IT (desktop + 390 px) |

## Security (section 10)

| Requirement | Status |
|---|---|
| bcrypt hashing, secure sessions, RBAC | IT |
| Input validation, parameterised queries, no arbitrary SQL | IT |
| Upload validation, size limits, safe storage | IT |
| .env configuration, .env.example, .gitignore | I |
| Appropriate DB privileges | IT |
| CSRF, CSP, security headers, login lockout | IT |

## Deliverables

| Deliverable | Location | Status |
|---|---|---|
| Source code | backend/, frontend/ | IT |
| SQL scripts | sql/ | IT |
| README | README.md | done |
| ER diagram, architecture, SQL, AI, security docs | docs/ | done |
| Test results | docs/TEST_RESULTS.md | done |
| Demonstration guide | docs/DEMONSTRATION.md | done |
| 40+ viva Q&A | docs/VIVA_QUESTIONS.md (50) | done |
| Traceability matrix | this file | done |

**Not implemented:** nothing from the brief is omitted. Items marked **I** are implemented but could not be verified in this build environment (real Ollama model, a run on Windows 11).
