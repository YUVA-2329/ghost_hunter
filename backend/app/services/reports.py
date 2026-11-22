"""Investigation report generator.

A report has three clearly separated parts:
  1. VERIFIED FACTS        - copied from MySQL (case, evidence, hashes,
                             custody, alerts, audit timeline).
  2. RECOMMENDED STEPS     - deterministic rules applied to those facts.
  3. AI NARRATIVE (opt.)   - written by the local LLM from the facts only,
                             labelled as AI-generated, omitted when offline.
"""
from __future__ import annotations

import datetime as dt
import html
import json

from ..ai import ollama_client
from ..database import fetch_all, fetch_one
from ..security.auth import RequestContext, ensure_case_access
from .audit import log_app_event


def build(ctx: RequestContext, case_id: int, use_ai: bool = True) -> dict:
    ensure_case_access(ctx, case_id)
    c = fetch_one(ctx.conn, "SELECT * FROM vw_case_summary WHERE case_id = :c", {"c": case_id})
    team = fetch_all(ctx.conn, """SELECT i.investigator_name, i.role, ca.assignment_role, ca.assignment_status, ca.assigned_at
                                    FROM case_assignments ca JOIN investigators i ON i.investigator_id = ca.investigator_id
                                   WHERE ca.case_id = :c ORDER BY ca.assignment_status, ca.assignment_role""", {"c": case_id})
    evidence = fetch_all(ctx.conn, """SELECT evidence_id, evidence_code, evidence_name, evidence_type, file_size_bytes,
                                             original_hash, current_hash, integrity_status, last_verified_at,
                                             uploaded_by_name, uploaded_at, custodian_name, check_count, failed_checks
                                        FROM vw_evidence_overview WHERE case_id = :c ORDER BY evidence_id""", {"c": case_id})
    checks = fetch_all(ctx.conn, """SELECT check_id, evidence_code, verification_result, check_context, checked_at,
                                           checked_by_name, expected_hash, actual_hash
                                      FROM vw_integrity_history WHERE case_id = :c ORDER BY checked_at, check_id""", {"c": case_id})
    custody = fetch_all(ctx.conn, """SELECT transfer_id, evidence_code, transfer_timestamp, from_name, to_name,
                                            performed_by_name, transfer_reason, verification_status
                                       FROM vw_custody_history WHERE case_id = :c ORDER BY transfer_timestamp, transfer_id""",
                        {"c": case_id})
    alerts = fetch_all(ctx.conn, """SELECT alert_id, rule_code, detection_method, severity, risk_score, title, explanation,
                                           status, first_event_at, last_event_at, supporting_facts
                                      FROM ai_alerts WHERE related_case_id = :c
                                     ORDER BY risk_score DESC, alert_id""", {"c": case_id})
    timeline = fetch_all(ctx.conn, """SELECT log_id, `timestamp`, action_type, event_source, table_name, record_id,
                                             investigator_name, db_user, ip_address, risk_level, details
                                        FROM vw_audit_trail WHERE related_case_id = :c AND risk_level <> 'LOW'
                                       ORDER BY `timestamp`, log_id""", {"c": case_id})
    counts = fetch_one(ctx.conn, """SELECT COUNT(*) AS total, SUM(risk_level IN ('HIGH','CRITICAL')) AS high,
                                           SUM(investigator_id IS NULL AND event_source = 'TRIGGER') AS unidentified,
                                           MIN(`timestamp`) AS first_at, MAX(`timestamp`) AS last_at
                                      FROM audit_logs WHERE related_case_id = :c""", {"c": case_id})

    report = {
        "generated_at": dt.datetime.now().isoformat(sep=" ", timespec="seconds"),
        "generated_by": ctx.user.name,
        "case": c, "team": team, "evidence": evidence, "integrity_checks": checks, "custody": custody,
        "alerts": alerts, "timeline": timeline, "audit_counts": counts,
        "recommendations": recommendations(c, evidence, alerts, custody, counts),
        "ai_narrative": None, "ai_status": ollama_client.status()["mode"],
    }
    if use_ai:
        report["ai_narrative"] = _narrative(report)
    log_app_event(ctx, "REPORT_GENERATED", f"Investigation report generated for {c['case_code']}",
                  table="cases", record_id=case_id, case_id=case_id)
    return report


def recommendations(c: dict, evidence: list, alerts: list, custody: list, counts: dict) -> list[str]:
    """Deterministic, rule-based next steps derived from the facts."""
    steps: list[str] = []
    open_alerts = [a for a in alerts if a["status"] in ("OPEN", "ESCALATED")]
    rules = {a["rule_code"] for a in open_alerts}
    for e in evidence:
        if e["integrity_status"] == "TAMPERED":
            steps.append(f"{e['evidence_code']} is TAMPERED: keep the altered file as-is (it is itself evidence), "
                         f"obtain a fresh copy from the original source, and review file-system access to the evidence "
                         f"store between the last VERIFIED check and the first failed check.")
        elif e["integrity_status"] == "MISSING":
            steps.append(f"{e['evidence_code']} is MISSING from storage: check backups and the storage server's "
                         f"deletion logs; record the loss in the chain of custody.")
    if "DIRECT_DB_CHANGE" in rules or (counts and counts.get("unidentified")):
        steps.append("Changes were made directly in MySQL without an application login: review the MySQL general/"
                     "binary logs for the reported db_user and times, identify who holds that account, and rotate "
                     "its password. Compare old_values in the audit log to restore altered data.")
    if "REPEATED_DELETE" in rules:
        steps.append("Restore deleted rows from the preserved old_values JSON in audit_logs (or a backup) and confirm "
                     "with the case lead which deletions were legitimate.")
    if "FAILED_LOGINS" in rules:
        steps.append("Reset the password of the targeted account, confirm with the account owner whether the "
                     "successful login was theirs, and block the source IP address if it is unknown.")
    if "EVIDENCE_ACCESS_BURST" in rules:
        steps.append("Interview the investigator about the burst of evidence downloads and check where the "
                     "downloaded files were sent (endpoint/DLP logs).")
    if "OFF_HOURS_ACTIVITY" in rules:
        steps.append("Confirm whether the off-hours activity was authorised (on-call rota, change tickets).")
    if "REPEATED_RECORD_CHANGE" in rules or "SENSITIVE_MODIFICATION" in rules:
        steps.append("Compare successive old/new values of the repeatedly changed records and revert unauthorised "
                     "edits through the application so the correction is itself audited.")
    if any(t["verification_status"] != "VERIFIED" for t in custody):
        steps.append("At least one custody hand-over did not verify the hash: document who held the item at "
                     "that moment and re-verify before the next transfer.")
    if not steps:
        steps.append("No open risk indicators: continue routine integrity verification and keep the chain of "
                     "custody up to date.")
    steps.append("Re-run integrity verification on all case evidence and the anomaly analysis after remediation, "
                 "and attach this report to the case file.")
    return steps


def _narrative(report: dict) -> dict:
    c = report["case"]
    compact = {
        "case": {k: c[k] for k in ("case_code", "case_title", "case_status", "priority", "risk_score", "risk_level")},
        "evidence": [{k: e[k] for k in ("evidence_code", "evidence_name", "integrity_status", "failed_checks",
                                        "custodian_name")} for e in report["evidence"]],
        "alerts": [{k: a[k] for k in ("alert_id", "severity", "risk_score", "title", "first_event_at", "last_event_at")}
                   for a in report["alerts"] if a["status"] != "DISMISSED"][:10],
        "high_risk_events": [{k: t[k] for k in ("timestamp", "action_type", "table_name", "investigator_name",
                                                "risk_level")} for t in report["timeline"]
                             if t["risk_level"] in ("HIGH", "CRITICAL")][:20],
    }
    system = ("You write the executive summary of a digital forensic investigation report. Use ONLY the JSON facts. "
              "Do not invent people, times, numbers or conclusions. Say 'indicates' or 'suggests', never 'proves'. "
              "120-180 words, plain text, no headings.")
    try:
        text_ = ollama_client.chat(system, json.dumps(compact, default=str)[:7000])
        return {"text": text_, "source": f"AI-generated by local model {ollama_client.status()['model']}",
                "disclaimer": "AI-generated summary of the verified facts. Verify every statement against the "
                              "facts section before relying on it."}
    except ollama_client.LLMUnavailable as exc:
        return {"text": None, "source": f"not generated - {exc}",
                "disclaimer": "The AI model is offline; the report contains verified facts and rule-based "
                              "recommendations only."}


# ---------------------------------------------------------------------------
# rendering
# ---------------------------------------------------------------------------
def _md_table(rows: list[dict], cols: list[tuple[str, str]]) -> str:
    if not rows:
        return "_None recorded._\n"
    head = "| " + " | ".join(h for _, h in cols) + " |\n|" + "---|" * len(cols) + "\n"
    body = "".join("| " + " | ".join(str(r.get(k) if r.get(k) is not None else "").replace("|", "/")
                                     for k, _ in cols) + " |\n" for r in rows)
    return head + body


def to_markdown(r: dict) -> str:
    c = r["case"]
    out = [f"# Investigation Report - {c['case_code']}: {c['case_title']}",
           f"Generated {r['generated_at']} by {r['generated_by']} with SQL Ghost Hunter.", "",
           "## 1. Verified facts (retrieved from MySQL)", "",
           f"- **Status:** {c['case_status']}  **Priority:** {c['priority']}  "
           f"**Risk:** {c['risk_level']} ({c['risk_score']}/100)",
           f"- **Created by:** {c['created_by_name']} on {c['created_at']}",
           f"- **Description:** {c['case_description'] or '-'}",
           f"- **Audit events:** {r['audit_counts']['total']} total, {r['audit_counts']['high'] or 0} HIGH/CRITICAL, "
           f"{r['audit_counts']['unidentified'] or 0} without application identity", "",
           "### Team", _md_table(r["team"], [("investigator_name", "Investigator"), ("role", "Role"),
                                             ("assignment_role", "Case role"), ("assignment_status", "Status")]),
           "### Evidence and integrity", _md_table(r["evidence"], [
               ("evidence_code", "Code"), ("evidence_name", "Name"), ("integrity_status", "Integrity"),
               ("original_hash", "Original SHA-256"), ("current_hash", "Latest SHA-256"),
               ("custodian_name", "Custodian")]),
           "### Integrity verification history", _md_table(r["integrity_checks"], [
               ("checked_at", "Time"), ("evidence_code", "Evidence"), ("verification_result", "Result"),
               ("check_context", "Context"), ("checked_by_name", "Checked by")]),
           "### Chain of custody", _md_table(r["custody"], [
               ("transfer_timestamp", "Time"), ("evidence_code", "Evidence"), ("from_name", "From"),
               ("to_name", "To"), ("verification_status", "Hash"), ("transfer_reason", "Reason")]),
           "### Risk assessments (anomaly detection)", _md_table(r["alerts"], [
               ("alert_id", "#"), ("severity", "Severity"), ("risk_score", "Score"),
               ("detection_method", "Method"), ("title", "Finding"), ("status", "Status")]),
           ]
    for a in r["alerts"]:
        out.append(f"- **Alert #{a['alert_id']}** - {a['explanation']}")
    out += ["", "### Audit timeline (MEDIUM and above)", _md_table(r["timeline"], [
                ("timestamp", "Time"), ("action_type", "Action"), ("table_name", "Table"), ("record_id", "Record"),
                ("investigator_name", "Actor"), ("db_user", "MySQL account"), ("risk_level", "Risk")]),
            "## 2. Suggested investigation steps (rule-based)", ""]
    out += [f"{i}. {s}" for i, s in enumerate(r["recommendations"], 1)]
    out += ["", "## 3. AI-generated narrative", ""]
    n = r.get("ai_narrative")
    if n and n.get("text"):
        out += [f"> {line}" for line in n["text"].splitlines()] + ["", f"_{n['source']}. {n['disclaimer']}_"]
    else:
        out.append(f"_Not included: {(n or {}).get('source', 'not requested')}._")
    return "\n".join(out) + "\n"


def to_html(r: dict) -> str:
    """Self-contained printable HTML (no scripts)."""
    md = to_markdown(r)
    body, in_table, in_list = [], False, False
    for line in md.splitlines():
        esc = html.escape(line)
        if line.startswith("|"):
            cells = [html.escape(x.strip()) for x in line.strip("|").split("|")]
            if set(line.replace("|", "").strip()) <= {"-"}:
                continue
            if not in_table:
                body.append("<table><tr>" + "".join(f"<th>{x}</th>" for x in cells) + "</tr>")
                in_table = True
            else:
                body.append("<tr>" + "".join(f"<td>{x}</td>" for x in cells) + "</tr>")
            continue
        if in_table:
            body.append("</table>"); in_table = False
        if line.startswith("- ") or (line[:3].rstrip(".").isdigit() and ". " in line[:4]):
            if not in_list:
                body.append("<ul>"); in_list = True
            body.append("<li>" + _inline(esc.split(" ", 1)[1]) + "</li>")
            continue
        if in_list:
            body.append("</ul>"); in_list = False
        if line.startswith("### "):
            body.append(f"<h3>{esc[4:]}</h3>")
        elif line.startswith("## "):
            body.append(f"<h2>{esc[3:]}</h2>")
        elif line.startswith("# "):
            body.append(f"<h1>{esc[2:]}</h1>")
        elif line.startswith("&gt; "):
            body.append(f"<blockquote>{esc[5:]}</blockquote>")
        elif line.strip():
            body.append(f"<p>{_inline(esc)}</p>")
    if in_table:
        body.append("</table>")
    if in_list:
        body.append("</ul>")
    style = ("body{font:13px/1.5 'Segoe UI',Arial,sans-serif;color:#0f172a;max-width:1100px;margin:24px auto;padding:0 24px}"
             "h1{font-size:22px;border-bottom:2px solid #2563eb;padding-bottom:6px}h2{font-size:17px;margin-top:28px;color:#1e3a8a}"
             "h3{font-size:14px;margin-top:20px}table{border-collapse:collapse;width:100%;margin:6px 0 14px;font-size:12px}"
             "th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top;word-break:break-all}"
             "th{background:#f1f5f9}blockquote{border-left:3px solid #2563eb;margin:8px 0;padding:6px 12px;background:#eff6ff}"
             "@media print{body{margin:0}}")
    return (f"<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>Report {html.escape(r['case']['case_code'])}"
            f"</title><style>{style}</style></head><body>{''.join(body)}</body></html>")


def _inline(s: str) -> str:
    import re
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    return re.sub(r"(?<![\w*])_(.+?)_(?![\w*])", r"<em>\1</em>", s)
