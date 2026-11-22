"""SQL Demonstration page - a FIXED catalogue of read-only queries.

Users can only choose a query id; the SQL text is defined here on the server.
Each query runs inside START TRANSACTION READ ONLY ... ROLLBACK, so even a
mistake in this catalogue could not modify data. There is no endpoint that
accepts SQL text from the browser.
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import text

from ..config import PROJECT_ROOT
from ..database import fetch_all, row_to_dict, translate_db_error
from ..security.auth import RequestContext

Q = dict  # readability

CATALOG: list[dict] = [
    # --- basic / operators / clauses (03) ---
    Q(id="basic-select", concept="SELECT, WHERE, ORDER BY", file="03_basic_queries.sql",
      title="List evidence with its integrity status",
      explanation="The simplest query: choose columns, filter nothing, sort by id.",
      sql="SELECT evidence_id, evidence_name, evidence_type, integrity_status, uploaded_at\n  FROM evidence\n ORDER BY evidence_id;"),
    Q(id="arithmetic", concept="Arithmetic operators", file="03_basic_queries.sql",
      title="File size in KB and age in days",
      explanation="/ and * operate on numbers; DATEDIFF subtracts dates; ROUND formats the result.",
      sql="SELECT evidence_id, evidence_name, file_size_bytes,\n       ROUND(file_size_bytes / 1024, 2) AS size_kb,\n       DATEDIFF(NOW(), uploaded_at)     AS age_days\n  FROM evidence\n ORDER BY file_size_bytes DESC;"),
    Q(id="logical", concept="AND, OR, NOT, IN, comparison", file="03_basic_queries.sql",
      title="High-risk changes made outside the application or deletions",
      explanation="Combines conditions: risk must be HIGH/CRITICAL AND (no investigator OR a DELETE) AND NOT an application event.",
      sql="SELECT log_id, `timestamp`, action_type, table_name, record_id, risk_level\n  FROM audit_logs\n WHERE risk_level IN ('HIGH','CRITICAL')\n   AND (investigator_id IS NULL OR action_type = 'DELETE')\n   AND NOT event_source = 'APPLICATION'\n ORDER BY log_id;"),
    Q(id="between", concept="BETWEEN", file="03_basic_queries.sql",
      title="Audit events in the last 2 days",
      explanation="BETWEEN a AND b is inclusive on both ends - a compact date-range filter.",
      sql="SELECT log_id, `timestamp`, action_type, table_name, risk_level\n  FROM audit_logs\n WHERE `timestamp` BETWEEN NOW() - INTERVAL 2 DAY AND NOW()\n ORDER BY `timestamp`;"),
    Q(id="like", concept="LIKE pattern matching", file="03_basic_queries.sql",
      title="Investigators matching a name pattern",
      explanation="% matches any number of characters, _ exactly one.",
      sql="SELECT investigator_id, investigator_name, email\n  FROM investigators\n WHERE email LIKE 'r%' OR investigator_name LIKE '%ra%';"),
    Q(id="is-null", concept="IS NULL", file="03_basic_queries.sql",
      title="Changes with no application identity (direct DB access)",
      explanation="NULL means 'unknown'; it must be tested with IS NULL, never with = NULL.",
      sql="SELECT log_id, `timestamp`, action_type, table_name, record_id, db_user\n  FROM audit_logs\n WHERE investigator_id IS NULL AND event_source = 'TRIGGER'\n ORDER BY log_id;"),
    Q(id="distinct-limit", concept="DISTINCT, LIMIT", file="03_basic_queries.sql",
      title="Tables that have been modified (distinct) and the 5 latest high-risk events",
      explanation="DISTINCT removes duplicate rows; LIMIT keeps the first N rows after ORDER BY.",
      sql="SELECT DISTINCT table_name\n  FROM audit_logs\n WHERE action_type IN ('INSERT','UPDATE','DELETE')\n ORDER BY table_name\n LIMIT 5;"),
    # --- constraints (04) ---
    Q(id="constraints", concept="Constraints (catalogue)", file="04_constraints.sql",
      title="Constraints declared on the evidence table",
      explanation="information_schema lists PRIMARY KEY, FOREIGN KEY, UNIQUE and CHECK constraints. 04_constraints.sql also proves each one rejects bad data.",
      sql="SELECT constraint_name, constraint_type\n  FROM information_schema.table_constraints\n WHERE table_schema = DATABASE() AND table_name = 'evidence'\n ORDER BY constraint_type, constraint_name;"),
    Q(id="check-clauses", concept="CHECK constraints", file="04_constraints.sql",
      title="CHECK constraint expressions",
      explanation="Each CHECK clause is evaluated on every INSERT/UPDATE; MySQL 8.0.16+ enforces them.",
      sql="SELECT cc.constraint_name, cc.check_clause\n  FROM information_schema.check_constraints cc\n  JOIN information_schema.table_constraints tc\n    ON tc.constraint_schema = cc.constraint_schema AND tc.constraint_name = cc.constraint_name\n WHERE tc.table_schema = DATABASE() AND tc.table_name IN ('evidence','integrity_checks')\n ORDER BY cc.constraint_name;"),
    Q(id="foreign-keys", concept="FOREIGN KEY", file="04_constraints.sql",
      title="Foreign keys and referenced tables",
      explanation="Every child column must reference an existing parent row (referential integrity).",
      sql="SELECT table_name, column_name, referenced_table_name, referenced_column_name\n  FROM information_schema.key_column_usage\n WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL\n ORDER BY table_name, column_name;"),
    # --- joins (05) ---
    Q(id="inner-join", concept="INNER JOIN", file="05_joins.sql",
      title="Evidence with case and uploader",
      explanation="INNER JOIN returns only rows that have a match in every joined table.",
      sql="SELECT e.evidence_id, c.case_code, e.evidence_name, e.integrity_status,\n       i.investigator_name AS uploaded_by\n  FROM evidence e\n  INNER JOIN cases c         ON c.case_id = e.case_id\n  INNER JOIN investigators i ON i.investigator_id = e.uploaded_by\n ORDER BY e.evidence_id;"),
    Q(id="multi-join", concept="Multi-table JOIN (same table, 3 aliases)", file="05_joins.sql",
      title="Chain of custody of evidence 1 with names",
      explanation="investigators is joined three times (from / to / performed by). LEFT JOIN keeps the initial acquisition where 'from' is NULL.",
      sql="SELECT t.transfer_timestamp,\n       COALESCE(f.investigator_name, '(acquired)') AS from_custodian,\n       r.investigator_name AS to_custodian,\n       p.investigator_name AS performed_by,\n       t.verification_status\n  FROM custody_transfers t\n  LEFT JOIN  investigators f ON f.investigator_id = t.transferred_from\n  INNER JOIN investigators r ON r.investigator_id = t.transferred_to\n  INNER JOIN investigators p ON p.investigator_id = t.performed_by\n WHERE t.evidence_id = 1\n ORDER BY t.transfer_timestamp, t.transfer_id;"),
    Q(id="left-join", concept="LEFT JOIN", file="05_joins.sql",
      title="High-risk events with actor names (unidentified kept)",
      explanation="LEFT JOIN keeps every audit row even when investigator_id is NULL; an INNER JOIN would hide direct-DB changes.",
      sql="SELECT a.log_id, a.`timestamp`, a.action_type, a.table_name,\n       COALESCE(i.investigator_name, 'UNIDENTIFIED') AS actor, a.risk_level\n  FROM audit_logs a\n  LEFT JOIN investigators i ON i.investigator_id = a.investigator_id\n WHERE a.risk_level IN ('HIGH','CRITICAL')\n ORDER BY a.log_id;"),
    Q(id="right-join", concept="RIGHT JOIN", file="05_joins.sql",
      title="All investigators with their active assignments",
      explanation="RIGHT JOIN keeps every row of the RIGHT table (investigators); people without assignments show NULL.",
      sql="SELECT i.investigator_name, i.role, c.case_code, ca.assignment_role\n  FROM case_assignments ca\n  INNER JOIN cases c ON c.case_id = ca.case_id AND ca.assignment_status = 'ACTIVE'\n  RIGHT JOIN investigators i ON i.investigator_id = ca.investigator_id\n ORDER BY i.investigator_id, c.case_code;"),
    Q(id="cross-join", concept="CROSS JOIN", file="05_joins.sql",
      title="Investigator x risk level heat-map",
      explanation="CROSS JOIN builds every combination, so levels with zero events still appear.",
      sql="SELECT i.investigator_name, r.risk_level,\n       (SELECT COUNT(*) FROM audit_logs a\n         WHERE a.investigator_id = i.investigator_id AND a.risk_level = r.risk_level) AS events\n  FROM investigators i\n  CROSS JOIN (SELECT 'LOW' AS risk_level UNION ALL SELECT 'MEDIUM'\n              UNION ALL SELECT 'HIGH' UNION ALL SELECT 'CRITICAL') r\n ORDER BY i.investigator_id, FIELD(r.risk_level,'LOW','MEDIUM','HIGH','CRITICAL');"),
    # --- subqueries (06) ---
    Q(id="single-row-subquery", concept="Single-row subquery", file="06_subqueries.sql",
      title="Evidence larger than the average file",
      explanation="The inner query returns exactly one value (AVG) used in the outer WHERE.",
      sql="SELECT evidence_id, evidence_name, file_size_bytes\n  FROM evidence\n WHERE file_size_bytes > (SELECT AVG(file_size_bytes) FROM evidence)\n ORDER BY file_size_bytes DESC;"),
    Q(id="in-subquery", concept="Multiple-row subquery (IN)", file="06_subqueries.sql",
      title="Cases containing compromised evidence",
      explanation="IN compares with a LIST of values produced by the subquery.",
      sql="SELECT case_code, case_title, case_status\n  FROM cases\n WHERE case_id IN (SELECT case_id FROM evidence WHERE integrity_status <> 'VERIFIED');"),
    Q(id="not-in-subquery", concept="NOT IN", file="06_subqueries.sql",
      title="Active investigators with no open-case assignment",
      explanation="NOT IN excludes values returned by the subquery (safe because the column is NOT NULL).",
      sql="SELECT investigator_id, investigator_name, role\n  FROM investigators\n WHERE is_active = 1\n   AND investigator_id NOT IN (SELECT ca.investigator_id FROM case_assignments ca\n                                 JOIN cases c ON c.case_id = ca.case_id\n                                WHERE ca.assignment_status = 'ACTIVE' AND c.case_status <> 'CLOSED');"),
    Q(id="correlated-subquery", concept="Correlated subquery", file="06_subqueries.sql",
      title="Latest integrity check of each evidence item",
      explanation="The inner query refers to the outer row (ic.evidence_id) and runs once per outer row.",
      sql="SELECT ic.evidence_id, ic.check_id, ic.verification_result, ic.check_context, ic.checked_at\n  FROM integrity_checks ic\n WHERE ic.check_id = (SELECT MAX(ic2.check_id) FROM integrity_checks ic2\n                       WHERE ic2.evidence_id = ic.evidence_id)\n ORDER BY ic.evidence_id;"),
    Q(id="exists", concept="EXISTS / NOT EXISTS", file="06_subqueries.sql",
      title="Cases changed without an application identity",
      explanation="EXISTS is true as soon as the subquery finds one matching row.",
      sql="SELECT c.case_code, c.case_title\n  FROM cases c\n WHERE EXISTS (SELECT 1 FROM audit_logs a\n                WHERE a.related_case_id = c.case_id\n                  AND a.investigator_id IS NULL AND a.event_source = 'TRIGGER');"),
    # --- aggregates (07) ---
    Q(id="aggregates", concept="COUNT, SUM, AVG, MIN, MAX", file="07_aggregate_queries.sql",
      title="Evidence storage summary",
      explanation="Aggregate functions collapse many rows into one summary row.",
      sql="SELECT COUNT(*) AS items, SUM(file_size_bytes) AS total_bytes,\n       ROUND(AVG(file_size_bytes), 1) AS avg_bytes,\n       MIN(file_size_bytes) AS smallest, MAX(file_size_bytes) AS largest\n  FROM evidence;"),
    Q(id="group-by", concept="GROUP BY", file="07_aggregate_queries.sql",
      title="Audit events per operation type",
      explanation="GROUP BY creates one group per action_type; COUNT(*) counts rows in each group.",
      sql="SELECT action_type, COUNT(*) AS events\n  FROM audit_logs\n GROUP BY action_type\n ORDER BY events DESC;"),
    Q(id="having", concept="HAVING", file="07_aggregate_queries.sql",
      title="Actors with 3 or more DELETE operations",
      explanation="WHERE filters rows before grouping; HAVING filters the groups afterwards.",
      sql="SELECT COALESCE(investigator_id, 0) AS actor_id, db_user, COUNT(*) AS deletes\n  FROM audit_logs\n WHERE action_type = 'DELETE'\n GROUP BY COALESCE(investigator_id, 0), db_user\nHAVING COUNT(*) >= 3;"),
    Q(id="login-stats", concept="SUM(condition), COUNT(DISTINCT)", file="07_aggregate_queries.sql",
      title="Failed vs successful logins per account",
      explanation="In MySQL a condition evaluates to 1/0, so SUM(condition) counts matching rows.",
      sql="SELECT email, COUNT(*) AS attempts, SUM(success = 0) AS failures,\n       SUM(success = 1) AS successes, COUNT(DISTINCT ip_address) AS distinct_ips\n  FROM login_attempts\n GROUP BY email\nHAVING SUM(success = 0) > 0\n ORDER BY failures DESC;"),
    # --- views / functions / advanced (08, 09, 12) ---
    Q(id="view-dashboard", concept="VIEW", file="08_views_indexes.sql",
      title="Dashboard statistics view",
      explanation="vw_dashboard_stats is a stored SELECT; the Dashboard page reads it directly.",
      sql="SELECT * FROM vw_dashboard_stats;"),
    Q(id="view-case-summary", concept="VIEW + stored functions", file="08_views_indexes.sql",
      title="Case summary view (uses fn_case_risk_score / fn_risk_level)",
      explanation="Views can call stored functions; the risk score is computed in the database.",
      sql="SELECT case_code, case_title, case_status, evidence_count, compromised_count,\n       open_alerts, risk_score, risk_level\n  FROM vw_case_summary\n ORDER BY risk_score DESC;"),
    Q(id="functions", concept="Stored FUNCTIONS", file="09_procedures_functions.sql",
      title="Current custodian and risk helpers",
      explanation="fn_current_custodian derives the holder from custody history; fn_risk_level maps a score to a level.",
      sql="SELECT e.evidence_id, e.evidence_name,\n       fn_current_custodian(e.evidence_id) AS custodian_id,\n       fn_case_evidence_count(e.case_id)  AS items_in_case,\n       fn_risk_level(72)                  AS level_of_72\n  FROM evidence e\n WHERE e.case_id = 1;"),
    Q(id="json-diff", concept="JSON_TABLE / JSON_EXTRACT", file="12_advanced_queries.sql",
      title="Who changed evidence 2 and what changed?",
      explanation="Audit triggers store old/new rows as JSON; JSON_TABLE turns the keys into rows so differing fields can be listed.",
      sql="SELECT a.log_id, a.`timestamp`, COALESCE(i.investigator_name, 'UNIDENTIFIED') AS actor,\n       a.db_user, k.field,\n       JSON_UNQUOTE(JSON_EXTRACT(a.old_values, CONCAT('$.', k.field))) AS old_value,\n       JSON_UNQUOTE(JSON_EXTRACT(a.new_values, CONCAT('$.', k.field))) AS new_value\n  FROM audit_logs a\n  LEFT JOIN investigators i ON i.investigator_id = a.investigator_id\n  JOIN JSON_TABLE(JSON_KEYS(a.new_values), '$[*]' COLUMNS (field VARCHAR(64) PATH '$')) k\n WHERE a.table_name = 'evidence' AND a.record_id = 2 AND a.action_type = 'UPDATE'\n   AND NOT (JSON_EXTRACT(a.old_values, CONCAT('$.', k.field)) <=> JSON_EXTRACT(a.new_values, CONCAT('$.', k.field)))\n   AND k.field <> 'last_verified_at';"),
    Q(id="window", concept="Window functions (ROW_NUMBER, LAG)", file="12_advanced_queries.sql",
      title="Minutes between consecutive direct-DB actions",
      explanation="LAG() reads the previous row in the window without a self join; short gaps suggest a rushed or scripted session.",
      sql="SELECT log_id, `timestamp`, action_type, table_name, record_id,\n       TIMESTAMPDIFF(MINUTE, LAG(`timestamp`) OVER (ORDER BY `timestamp`, log_id), `timestamp`) AS minutes_since_previous\n  FROM audit_logs\n WHERE investigator_id IS NULL AND event_source = 'TRIGGER'\n   AND `timestamp` > NOW() - INTERVAL 7 DAY;"),
    Q(id="cte", concept="CTE (WITH) + CASE", file="12_advanced_queries.sql",
      title="Integrity verdict per case",
      explanation="A Common Table Expression names an intermediate result; CASE turns numbers into a verdict.",
      sql="WITH case_integrity AS (\n  SELECT c.case_code, COUNT(e.evidence_id) AS items,\n         SUM(e.integrity_status = 'TAMPERED') AS tampered,\n         SUM(e.integrity_status = 'MISSING')  AS missing\n    FROM cases c LEFT JOIN evidence e ON e.case_id = c.case_id\n   GROUP BY c.case_code)\nSELECT case_code, items, tampered, missing,\n       CASE WHEN tampered > 0 THEN 'EVIDENCE COMPROMISED'\n            WHEN missing  > 0 THEN 'EVIDENCE MISSING'\n            WHEN items    = 0 THEN 'NO EVIDENCE YET'\n            ELSE 'INTACT' END AS integrity_verdict\n  FROM case_integrity\n ORDER BY tampered DESC, case_code;"),
    Q(id="recursive-cte", concept="Recursive CTE", file="12_advanced_queries.sql",
      title="Yesterday's activity per hour (0-23)",
      explanation="The recursive CTE generates the 24 hours so hours without activity still show 0.",
      sql="WITH RECURSIVE hours AS (SELECT 0 AS h UNION ALL SELECT h + 1 FROM hours WHERE h < 23)\nSELECT LPAD(h, 2, '0') AS hour_of_day,\n       (SELECT COUNT(*) FROM audit_logs a\n         WHERE DATE(a.`timestamp`) = CURDATE() - INTERVAL 1 DAY AND HOUR(a.`timestamp`) = hours.h) AS events,\n       IF(fn_is_off_hours(CURDATE() + INTERVAL h HOUR), 'off-hours', 'working hours') AS period\n  FROM hours;"),
]
_BY_ID = {q["id"]: q for q in CATALOG}

SQL_FILES = ["01_schema.sql", "02_sample_data.sql", "03_basic_queries.sql", "04_constraints.sql", "05_joins.sql",
             "06_subqueries.sql", "07_aggregate_queries.sql", "08_views_indexes.sql",
             "09_procedures_functions.sql", "10_triggers.sql", "11_transactions.sql", "12_advanced_queries.sql",
             "13_security_privileges.sql"]

CONCEPTS = [
    ("DDL", "CREATE DATABASE, CREATE TABLE, ALTER TABLE, DROP TABLE", "01, 03"),
    ("DML", "INSERT, SELECT, UPDATE, DELETE", "02, 03"),
    ("Constraints", "PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, CHECK, DEFAULT", "01, 04"),
    ("Operators", "arithmetic, comparison, AND/OR/NOT, BETWEEN, IN, LIKE, IS NULL", "03"),
    ("Clauses", "WHERE, ORDER BY, GROUP BY, HAVING, DISTINCT, LIMIT", "03, 07"),
    ("Aggregates", "COUNT, SUM, AVG, MIN, MAX, WITH ROLLUP", "07"),
    ("Joins", "INNER, LEFT, RIGHT, CROSS, SELF", "05"),
    ("Subqueries", "single-row, multiple-row, correlated, EXISTS, IN, NOT IN, ALL, derived tables", "06"),
    ("Views", "7 views incl. vw_dashboard_stats, vw_audit_trail", "08"),
    ("Indexes", "composite indexes + EXPLAIN", "01, 08"),
    ("Stored functions", "fn_risk_level, fn_current_custodian, fn_has_case_access ...", "09"),
    ("Stored procedures", "sp_register_evidence, sp_transfer_custody ... (IN/OUT, SIGNAL, handlers)", "09"),
    ("Triggers", "23 triggers: auditing (AFTER) + protection (BEFORE)", "10"),
    ("Transactions", "START TRANSACTION, COMMIT, ROLLBACK, SAVEPOINT", "09, 11"),
    ("Advanced", "CTE, recursive CTE, window functions, JSON_TABLE", "12"),
    ("Security", "CREATE USER, GRANT, least privilege", "13"),
]


def catalog() -> dict:
    return {"queries": [{k: v for k, v in q.items()} for q in CATALOG],
            "concepts": [{"concept": c, "items": i, "files": f} for c, i, f in CONCEPTS],
            "files": SQL_FILES}


def run(ctx: RequestContext, query_id: str) -> dict:
    q = _BY_ID.get(query_id)
    if not q:
        raise HTTPException(404, "Unknown demonstration query")
    conn = ctx.conn
    conn.execute(text("START TRANSACTION READ ONLY"))
    try:
        res = conn.execute(text(q["sql"].rstrip().rstrip(";")))
        cols = list(res.keys())
        rows = [list(row_to_dict(r, json_cols=()).values()) for r in res.fetchmany(200)]
    except Exception as exc:  # pragma: no cover - catalogue is tested
        raise translate_db_error(exc) if hasattr(exc, "orig") else exc
    finally:
        conn.execute(text("ROLLBACK"))
    return {"id": q["id"], "columns": cols, "rows": rows, "row_count": len(rows)}


def tables(ctx: RequestContext) -> list[dict]:
    rows = fetch_all(ctx.conn, """
        SELECT t.table_name, t.table_type, t.table_comment
          FROM information_schema.tables t
         WHERE t.table_schema = DATABASE()
         ORDER BY t.table_type, t.table_name""")
    cols = fetch_all(ctx.conn, """
        SELECT table_name, column_name, column_type, is_nullable, column_key, column_default, extra
          FROM information_schema.columns
         WHERE table_schema = DATABASE()
         ORDER BY table_name, ordinal_position""")
    by_table: dict[str, list] = {}
    for c in cols:
        by_table.setdefault(c["TABLE_NAME"] if "TABLE_NAME" in c else c["table_name"], []).append(c)
    out = []
    for t in rows:
        name = t.get("TABLE_NAME") or t.get("table_name")
        ttype = t.get("TABLE_TYPE") or t.get("table_type")
        count = None
        if ttype == "BASE TABLE":
            # identifier comes from information_schema of our own database, quoted
            count = ctx.conn.execute(text(f"SELECT COUNT(*) FROM `{name.replace('`', '')}`")).scalar()
        out.append({"table_name": name, "type": "VIEW" if ttype == "VIEW" else "TABLE", "rows": count,
                    "columns": [{k.lower(): v for k, v in c.items() if k.lower() != "table_name"}
                                for c in by_table.get(name, [])]})
    return out


def script(name: str) -> str:
    if name not in SQL_FILES:
        raise HTTPException(404, "Unknown script")
    return (PROJECT_ROOT / "sql" / name).read_text(encoding="utf-8")
