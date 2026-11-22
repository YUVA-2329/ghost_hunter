"""End-to-end tests for SQL Ghost Hunter (real MySQL, real files, real API).

TEST 1-7 correspond to the demonstration scenarios of the project brief.
"""
from __future__ import annotations

import hashlib
import http.server
import json
import os
import re
import threading
from pathlib import Path

import pymysql
import pytest

from conftest import ROOT, STORAGE, TEST_DB, make_pdf

H = {"X-Requested-With": "GhostHunter"}


def audit_rows(db, table, record_id):
    with db.cursor() as c:
        c.execute("SELECT * FROM audit_logs WHERE table_name=%s AND record_id=%s ORDER BY log_id", (table, record_id))
        rows = c.fetchall()
    for r in rows:
        for k in ("old_values", "new_values"):
            if isinstance(r[k], str):
                r[k] = json.loads(r[k])
    return rows


# ---------------------------------------------------------------------------- SQL layer
def test_schema_has_required_tables_and_objects(admin_db):
    with admin_db.cursor() as c:
        c.execute("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema=%s", (TEST_DB,))
        objs = {r["TABLE_NAME"]: r["TABLE_TYPE"] for r in c.fetchall()}
        for t in ("investigators", "cases", "evidence", "custody_transfers", "integrity_checks", "audit_logs",
                  "case_assignments"):
            assert objs.get(t) == "BASE TABLE", t
        assert sum(v == "VIEW" for v in objs.values()) >= 5
        c.execute("SELECT COUNT(*) n FROM information_schema.triggers WHERE trigger_schema=%s", (TEST_DB,))
        assert c.fetchone()["n"] >= 20
        c.execute("SELECT routine_type, COUNT(*) n FROM information_schema.routines WHERE routine_schema=%s "
                  "GROUP BY routine_type", (TEST_DB,))
        routines = {r["ROUTINE_TYPE"]: r["n"] for r in c.fetchall()}
        assert routines["FUNCTION"] >= 5 and routines["PROCEDURE"] >= 5
        c.execute("SELECT constraint_type, COUNT(*) n FROM information_schema.table_constraints "
                  "WHERE table_schema=%s GROUP BY constraint_type", (TEST_DB,))
        cons = {r["CONSTRAINT_TYPE"]: r["n"] for r in c.fetchall()}
        assert cons["PRIMARY KEY"] >= 7 and cons["FOREIGN KEY"] >= 10 and cons["UNIQUE"] >= 3 and cons["CHECK"] >= 15


def test_sample_data_meets_minimums(admin_db):
    with admin_db.cursor() as c:
        for table, minimum in [("investigators", 3), ("cases", 5), ("evidence", 10), ("custody_transfers", 2),
                               ("integrity_checks", 2), ("audit_logs", 20)]:
            c.execute(f"SELECT COUNT(*) n FROM {table}")
            assert c.fetchone()["n"] >= minimum, table
        c.execute("SELECT COUNT(*) n FROM audit_logs WHERE risk_level IN ('HIGH','CRITICAL')")
        assert c.fetchone()["n"] > 0       # suspicious activity present
        c.execute("SELECT COUNT(*) n FROM audit_logs WHERE risk_level = 'LOW'")
        assert c.fetchone()["n"] > 0       # normal activity present


DEMO_SCRIPTS = ["03_basic_queries.sql", "04_constraints.sql", "05_joins.sql", "06_subqueries.sql",
                "07_aggregate_queries.sql", "08_views_indexes.sql", "11_transactions.sql", "12_advanced_queries.sql"]


@pytest.mark.parametrize("script", DEMO_SCRIPTS)
def test_demo_sql_script_executes_without_errors(script, admin_db):
    from app.utils.sql_script import split_sql
    text = re.sub(r"\bghost_hunter\b", TEST_DB, (ROOT / "sql" / script).read_text(encoding="utf-8"))
    with admin_db.cursor() as c:
        for st in split_sql(text):
            c.execute(st.sql)
            while True:
                if c.description:
                    c.fetchall()
                if not c.nextset():
                    break


def test_at_least_25_documented_queries():
    labels = 0
    for f in DEMO_SCRIPTS:
        labels += len(re.findall(r"^-- (?:-+\n-- )?[QCJSATX]\d+\.", (ROOT / "sql" / f).read_text(), re.M))
    assert labels >= 25, labels


# ---------------------------------------------------------------------------- TEST 1
def test_1_normal_evidence_registration(client_for, admin_db):
    priya = client_for("priya")
    pdf = make_pdf("Test 1 - normal evidence registration")
    r = priya.post("/api/evidence", data={"case_id": "1", "description": "Test 1 PDF"},
                   files={"file": ("memo test.pdf", pdf, "application/pdf")})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["sha256"] == hashlib.sha256(pdf).hexdigest()
    assert body["integrity_status"] == "VERIFIED" and body["evidence_type"] == "PDF"
    eid = body["evidence_id"]
    with admin_db.cursor() as c:
        c.execute("SELECT * FROM evidence WHERE evidence_id=%s", (eid,))
        ev = c.fetchone()
        assert ev["original_hash"] == body["sha256"] and ev["uploaded_by"] == 3
        assert re.fullmatch(r"evidence/[0-9a-f]{32}\.pdf", ev["file_path"])          # random stored name
        assert (STORAGE / ev["file_path"]).read_bytes() == pdf
        c.execute("SELECT * FROM custody_transfers WHERE evidence_id=%s", (eid,))
        assert c.fetchone()["transferred_to"] == 3
        c.execute("SELECT * FROM integrity_checks WHERE evidence_id=%s", (eid,))
        assert c.fetchone()["check_context"] == "REGISTRATION"
    ins = [a for a in audit_rows(admin_db, "evidence", eid) if a["action_type"] == "INSERT"]
    assert ins and ins[0]["investigator_id"] == 3 and ins[0]["new_values"]["original_hash"] == body["sha256"]


# ---------------------------------------------------------------------------- TEST 2
def test_2_evidence_tampering_detected(client_for, admin_db):
    lead = client_for("lead")
    data = b"id,value\n1,alpha\n2,beta\n"
    eid = lead.post("/api/evidence", data={"case_id": "2"},
                    files={"file": ("ledger.csv", data, "text/csv")}).json()["evidence_id"]
    with admin_db.cursor() as c:
        c.execute("SELECT file_path, original_hash FROM evidence WHERE evidence_id=%s", (eid,))
        ev = c.fetchone()
    path = STORAGE / ev["file_path"]
    os.chmod(path, 0o644)
    path.write_bytes(data.replace(b"beta", b"BETA"))          # modified outside the application

    r = lead.post(f"/api/evidence/{eid}/verify")
    assert r.status_code == 200
    v = r.json()
    assert v["result"] == "TAMPERED" and v["actual_hash"] != v["expected_hash"] and v["alert_id"]
    with admin_db.cursor() as c:
        c.execute("SELECT original_hash, integrity_status FROM evidence WHERE evidence_id=%s", (eid,))
        now = c.fetchone()
        assert now["original_hash"] == ev["original_hash"]          # never overwritten
        assert now["integrity_status"] == "TAMPERED"
        c.execute("SELECT verification_result FROM integrity_checks WHERE evidence_id=%s ORDER BY check_id", (eid,))
        assert [x["verification_result"] for x in c.fetchall()] == ["VERIFIED", "TAMPERED"]   # history kept
        c.execute("SELECT severity, explanation FROM ai_alerts WHERE alert_id=%s", (v["alert_id"],))
        alert = c.fetchone()
        assert alert["severity"] == "CRITICAL" and "changed after registration" in alert["explanation"]
    # a missing file is detected as MISSING
    path.unlink()
    assert lead.post(f"/api/evidence/{eid}/verify").json()["result"] == "MISSING"


# ---------------------------------------------------------------------------- TEST 3
def test_3_update_monitoring(client_for, admin_db):
    lead = client_for("lead")
    r = lead.patch("/api/cases/4", json={"priority": "CRITICAL", "case_title": "Credential Phishing Campaign (wave 2)"})
    assert r.status_code == 200
    upd = [a for a in audit_rows(admin_db, "cases", 4) if a["action_type"] == "UPDATE"][-1]
    assert upd["investigator_id"] == 2 and upd["event_source"] == "TRIGGER"
    assert upd["old_values"]["priority"] != "CRITICAL" and upd["new_values"]["priority"] == "CRITICAL"
    assert upd["new_values"]["case_title"].endswith("(wave 2)")
    assert upd["timestamp"] is not None and upd["ip_address"]


# ---------------------------------------------------------------------------- TEST 4
def test_4_delete_monitoring(client_for, admin_db):
    admin = client_for("admin")
    c = admin.post("/api/cases", json={"case_title": "Temporary test case", "priority": "LOW"}).json()
    r = admin.delete(f"/api/cases/{c['case_id']}")
    assert r.status_code == 200, r.text
    rows = audit_rows(admin_db, "cases", c["case_id"])
    dele = [a for a in rows if a["action_type"] == "DELETE"][0]
    assert dele["old_values"]["case_title"] == "Temporary test case" and dele["new_values"] is None
    assert dele["investigator_id"] == 1
    # the assignment created with the case was deleted explicitly and audited too
    with admin_db.cursor() as cur:
        cur.execute("SELECT COUNT(*) n FROM audit_logs WHERE table_name='case_assignments' AND action_type='DELETE' "
                    "AND related_case_id=%s", (c["case_id"],))
        assert cur.fetchone()["n"] == 1


# ---------------------------------------------------------------------------- TEST 5
def test_5_suspicious_activity_detected(client_for, admin_db):
    # direct database session (no application identity): repeated sensitive changes
    with admin_db.cursor() as c:
        c.execute("SET @app_investigator_id = NULL")
        for i in range(4):
            c.execute("UPDATE cases SET case_description=%s WHERE case_id=2", (f"edited directly {i}",))
        c.execute("UPDATE evidence SET description='nothing to see here' WHERE evidence_id=4")
    lead = client_for("lead")
    r = lead.post("/api/ai/analyze")
    assert r.status_code == 200
    alerts = lead.get("/api/ai/alerts?case_id=2").json()
    rules = {a["rule_code"] for a in alerts}
    assert {"DIRECT_DB_CHANGE", "REPEATED_RECORD_CHANGE", "SENSITIVE_MODIFICATION"} <= rules
    rec = next(a for a in alerts if a["rule_code"] == "REPEATED_RECORD_CHANGE")
    assert rec["severity"] in ("HIGH", "CRITICAL") and "changed 4 times" in rec["explanation"]
    assert rec["supporting_facts"]["score_breakdown"]               # explainable score
    assert sum(b["points"] for b in rec["supporting_facts"]["score_breakdown"]) == rec["risk_score"] or rec["risk_score"] == 100
    # re-running is idempotent
    again = lead.post("/api/ai/analyze").json()
    assert again["new_alerts"] == 0


def test_5b_sample_incident_alerts(client_for):
    lead = client_for("lead")
    lead.post("/api/ai/analyze")
    rules = {a["rule_code"] for a in lead.get("/api/ai/alerts").json()}
    for expected in ("INTEGRITY_FAILURE", "FAILED_LOGINS", "REPEATED_DELETE", "EVIDENCE_ACCESS_BURST",
                     "OFF_HOURS_ACTIVITY", "HIGH_ACTIVITY_ZSCORE"):
        assert expected in rules, expected


# ---------------------------------------------------------------------------- TEST 6
def test_6_chain_of_custody(client_for, admin_db):
    priya, rahul = client_for("priya"), client_for("rahul")
    before = priya.get("/api/custody/3").json()
    assert before["custodian_name"] == "Priya Sharma"
    r = priya.post("/api/custody/transfer", json={"evidence_id": 3, "to_investigator_id": 4,
                                                  "transfer_reason": "Second opinion on the HR memo"})
    assert r.status_code == 201, r.text
    assert r.json()["verification_status"] == "VERIFIED"
    after = rahul.get("/api/custody/3").json()
    assert after["custodian_name"] == "Rahul Verma"
    assert len(after["transfers"]) == len(before["transfers"]) + 1
    assert after["transfers"][-1]["from_name"] == "Priya Sharma"            # previous custodian retained
    assert after["transfers"][0]["transfer_id"] == before["transfers"][0]["transfer_id"]
    # Priya no longer holds it -> unauthorised transfer refused by the procedure
    r = priya.post("/api/custody/transfer", json={"evidence_id": 3, "to_investigator_id": 2, "transfer_reason": "try again"})
    assert r.status_code == 400 and "current custodian" in r.json()["detail"]
    # history cannot be edited, even by a privileged account
    with admin_db.cursor() as c, pytest.raises(pymysql.MySQLError, match="append-only"):
        c.execute("UPDATE custody_transfers SET transfer_reason='rewritten' WHERE evidence_id=3")


# ---------------------------------------------------------------------------- TEST 7
def test_7_ai_investigation_offline(client_for):
    lead = client_for("lead")
    lead.post("/api/ai/analyze")
    r = lead.post("/api/ai/assistant", json={"question": "Summarize the suspicious activities in Case 001."})
    assert r.status_code == 200
    a = r.json()
    assert a["intent"] == "case_summary" and "CASE-001" in a["title"]
    assert a["narrative_source"].startswith("deterministic")              # LLM offline -> fallback
    facts = "\n".join(a["facts"])
    assert "Payroll Database Tampering" in facts and re.search(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}", facts)
    assert "risk" in a["narrative"].lower()


@pytest.mark.parametrize("question,intent", [
    ("What suspicious activities happened today?", "suspicious_activity"),
    ("Which evidence files failed verification?", "failed_verification"),
    ("Who modified evidence 2?", "record_history"),
    ("What was changed?", "recent_changes"),
    ("Why was alert 1 flagged?", "why_flagged"),
    ("Show the custody history of EV-0001", "custody_history"),
    ("Which investigation currently has the highest risk?", "highest_risk_case"),
])
def test_assistant_example_questions(client_for, question, intent):
    r = client_for("lead").post("/api/ai/assistant", json={"question": question})
    assert r.status_code == 200, r.text
    assert r.json()["intent"] == intent and r.json()["facts"]


class _FakeOllama(http.server.BaseHTTPRequestHandler):
    reply = "CASE-001 shows suspicious direct database changes. CASE-999 was also involved."

    def _send(self, obj):
        data = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send({"models": [{"name": "llama3.2:3b"}]})

    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self._send({"message": {"role": "assistant", "content": self.reply}})

    def log_message(self, *a):
        pass


def test_7b_llm_path_with_local_model_and_hallucination_guard(client_for):
    """Uses a stand-in HTTP server that speaks the Ollama API (no real model)."""
    from app.ai import ollama_client
    from app.config import get_settings
    srv = http.server.HTTPServer(("127.0.0.1", 0), _FakeOllama)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    s = get_settings()
    old = s.ollama_url
    s.ollama_url = f"http://127.0.0.1:{srv.server_address[1]}"
    ollama_client.status(force=True)
    try:
        a = client_for("lead").post("/api/ai/assistant",
                                    json={"question": "Summarize the suspicious activities in Case 001."}).json()
        assert a["narrative_source"].startswith("AI-generated")
        assert a["narrative"] == _FakeOllama.reply
        assert any("CASE-999" in w for w in a["warnings"])          # invented code flagged
        assert a["facts"]                                          # facts still shown separately
    finally:
        s.ollama_url = old
        ollama_client.status(force=True)
        srv.shutdown()


def test_report_generation(client_for):
    lead = client_for("lead")
    j = lead.get("/api/reports/case/1?ai=true").json()
    assert j["case"]["case_code"] == "CASE-001" and j["recommendations"] and j["ai_narrative"]["text"] is None
    md = lead.get("/api/reports/case/1?format=md").text
    assert "## 1. Verified facts" in md and "## 2. Suggested investigation steps" in md and "AI-generated narrative" in md
    html = lead.get("/api/reports/case/1?format=html").text
    assert html.startswith("<!DOCTYPE html>") and "<script" not in html


def test_dashboard_numbers_match_database(client_for, admin_db):
    d = client_for("lead").get("/api/dashboard").json()["stats"]
    with admin_db.cursor() as c:
        c.execute("SELECT COUNT(*) n FROM evidence")
        assert d["total_evidence"] == c.fetchone()["n"]
        c.execute("SELECT COUNT(*) n FROM audit_logs")
        assert d["total_audit_events"] <= c.fetchone()["n"]


def test_sql_demo_catalog_runs_read_only(client_for):
    c = client_for("auditor")
    cat = c.get("/api/sql/catalog").json()
    assert len(cat["queries"]) >= 25
    for q in cat["queries"]:
        r = c.post(f"/api/sql/run/{q['id']}")
        assert r.status_code == 200, (q["id"], r.text)
    assert c.post("/api/sql/run/DROP%20TABLE%20cases").status_code == 404


# ---------------------------------------------------------------------------- security
def test_unauthenticated_and_csrf(app):
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        assert c.get("/api/cases").status_code == 401
        assert c.post("/api/auth/login", json={"email": "x@y.zz", "password": "x"}).status_code == 403   # no CSRF header
        assert c.post("/api/auth/login", json={"email": "x@y.zz", "password": "x"}, headers=H).status_code == 401


def test_login_lockout(app):
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        codes = [c.post("/api/auth/login", json={"email": "nobody@ghosthunter.local", "password": "wrong"},
                        headers=H).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429


def test_role_based_access(client_for):
    auditor, rahul = client_for("auditor"), client_for("rahul")
    assert auditor.post("/api/cases", json={"case_title": "Auditor case"}).status_code == 403
    assert auditor.post("/api/evidence", data={"case_id": "1"},
                        files={"file": ("a.txt", b"hello", "text/plain")}).status_code == 403
    assert rahul.get("/api/cases/5").status_code == 403                      # not assigned
    assert all(x["case_code"] != "CASE-005" for x in rahul.get("/api/cases").json())
    assert rahul.patch("/api/ai/rules/REPEATED_DELETE", json={"is_enabled": False}).status_code == 403


def test_browser_cannot_choose_identity(client_for, admin_db):
    priya = client_for("priya")
    # extra fields (e.g. a forged investigator id) are rejected by the schema
    r = priya.post("/api/custody/transfer", json={"evidence_id": 2, "to_investigator_id": 4,
                                                  "transfer_reason": "forged", "performed_by": 1})
    assert r.status_code == 422


def test_upload_validation(client_for):
    p = client_for("priya")
    bad = [("evil.exe", b"MZ\x90\x00", "application/octet-stream"),
           ("fake.pdf", b"this is not a pdf", "application/pdf"),
           ("binary.txt", b"abc\x00def", "text/plain"),
           ("empty.csv", b"", "text/csv"),
           ("broken.json", b"{not json", "application/json")]
    for name, data, mime in bad:
        r = p.post("/api/evidence", data={"case_id": "1"}, files={"file": (name, data, mime)})
        assert r.status_code == 400, (name, r.text)
    # path traversal in the file name cannot escape the storage folder
    r = p.post("/api/evidence", data={"case_id": "1"}, files={"file": ("../../etc/notes.txt", b"ok", "text/plain")})
    assert r.status_code == 201 and r.json()["evidence_name"] == "notes.txt"


def test_app_account_cannot_rewrite_history(app_db):
    with app_db.cursor() as c:
        for sql in ("UPDATE audit_logs SET risk_level='LOW'", "DELETE FROM audit_logs",
                    "DELETE FROM integrity_checks", "INSERT INTO audit_logs (action_type) VALUES ('LOGIN')",
                    "UPDATE evidence SET original_hash=REPEAT('0',64)", "DROP TABLE cases"):
            with pytest.raises(pymysql.MySQLError) as e:
                c.execute(sql)
            assert e.value.args[0] in (1142, 1044, 1143), sql      # privilege denied


def test_privileged_account_still_blocked_by_triggers(admin_db):
    with admin_db.cursor() as c:
        for sql in ("UPDATE audit_logs SET risk_level='LOW' WHERE log_id=1", "DELETE FROM audit_logs WHERE log_id=1",
                    "UPDATE evidence SET original_hash=REPEAT('0',64) WHERE evidence_id=1"):
            with pytest.raises(pymysql.MySQLError) as e:
                c.execute(sql)
            assert e.value.args[0] == 1644


def test_sessions_store_only_token_hash(client_for, admin_db):
    c = client_for("auditor")
    token = c.cookies.get("gh_session")
    with admin_db.cursor() as cur:
        cur.execute("SELECT token_hash FROM app_sessions")
        hashes = {r["token_hash"] for r in cur.fetchall()}
    assert token not in hashes and hashlib.sha256(token.encode()).hexdigest() in hashes
    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/cases").status_code == 401                           # revoked server-side
