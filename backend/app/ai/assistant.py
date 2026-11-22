"""AI Forensic Assistant.

Pipeline for every question
  1. ROUTE    - map the question to ONE allowlisted intent (regex rules;
                if nothing matches and the LLM is online, the LLM may pick an
                intent from the allowlist - its JSON answer is validated).
  2. RETRIEVE - run that intent's fixed, parameterized, read-only queries
                (respecting the user's case access). The LLM never writes SQL.
  3. ANSWER   - "Verified facts" come straight from MySQL rows. An optional
                LLM narrative rewrites ONLY those facts; without the LLM a
                deterministic summary is produced. Both are labelled.
  4. GUARD    - case/evidence codes in the narrative that are not in the
                facts are flagged as possible hallucinations.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass, field
from typing import Callable

from fastapi import HTTPException

from ..database import fetch_all, fetch_one
from ..security.auth import RequestContext
from ..services.audit import changed_fields, log_app_event
from . import ollama_client

# ---------------------------------------------------------------------------
@dataclass
class ToolResult:
    title: str
    facts: list[str]
    summary: str
    tables: list[dict] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)


def _table(title: str, rows: list[dict], cols: list[str]) -> dict:
    return {"title": title, "columns": cols, "rows": [[r.get(c) for c in cols] for r in rows]}


def _t(v) -> str:
    return str(v)[:16] if v else "?"


# ---------------------------------------------------------------------------
# reference parsing
# ---------------------------------------------------------------------------
RANGES = {
    "today": ("today", lambda now: (now.replace(hour=0, minute=0, second=0, microsecond=0), now)),
    "yesterday": ("yesterday", lambda now: (now.replace(hour=0, minute=0, second=0, microsecond=0) - dt.timedelta(days=1),
                                            now.replace(hour=0, minute=0, second=0, microsecond=0))),
    "24h": ("in the last 24 hours", lambda now: (now - dt.timedelta(hours=24), now)),
    "7d": ("in the last 7 days", lambda now: (now - dt.timedelta(days=7), now)),
    "30d": ("in the last 30 days", lambda now: (now - dt.timedelta(days=30), now)),
}


def parse_range(q: str) -> str:
    if "yesterday" in q:
        return "yesterday"
    if "today" in q:
        return "today"
    if re.search(r"24\s*h|last day|past day", q):
        return "24h"
    if re.search(r"week|7 days|seven days", q):
        return "7d"
    if re.search(r"month|30 days", q):
        return "30d"
    return "7d"


def find_case(ctx: RequestContext, q: str, context: dict) -> int | None:
    m = re.search(r"case[\s#:_-]*0*(\d{1,6})\b", q)
    if m:
        n = int(m.group(1))
        row = fetch_one(ctx.conn, "SELECT case_id FROM cases WHERE case_code = :c", {"c": f"CASE-{n:03d}"})
        if row:
            return row["case_id"]
        row = fetch_one(ctx.conn, "SELECT case_id FROM cases WHERE case_id = :c", {"c": n})
        return row["case_id"] if row else -1
    return context.get("case_id")


def find_evidence(q: str, context: dict) -> int | None:
    m = re.search(r"\b(?:ev|evidence)(?:\s*(?:item|file|record|id))?[\s#:_-]*0*(\d{1,6})\b", q)
    if m:
        return int(m.group(1))
    return context.get("evidence_id")


def find_alert(q: str) -> int | None:
    m = re.search(r"alert[\s#:_-]*(\d{1,7})\b", q) or re.search(r"#(\d{1,7})\b", q)
    return int(m.group(1)) if m else None


RECORD_WORDS = {"evidence": "evidence", "ev": "evidence", "case": "cases", "assignment": "case_assignments",
                "investigator": "investigators", "transfer": "custody_transfers", "check": "integrity_checks"}


def find_record(ctx: RequestContext, q: str, context: dict) -> tuple[str, int] | None:
    m = re.search(r"\b(evidence|ev|case|assignment|investigator|transfer|check)[\s#:_-]*0*(\d{1,7})\b", q)
    if m:
        table = RECORD_WORDS[m.group(1)]
        if table == "cases":
            cid = find_case(ctx, q, {})
            return ("cases", cid) if cid and cid > 0 else None
        return table, int(m.group(2))
    if context.get("table_name") and context.get("record_id"):
        return context["table_name"], context["record_id"]
    if context.get("evidence_id"):
        return "evidence", context["evidence_id"]
    if context.get("case_id"):
        return "cases", context["case_id"]
    return None


def find_investigator(ctx: RequestContext, q: str) -> dict | None:
    for r in fetch_all(ctx.conn, "SELECT investigator_id, investigator_name FROM investigators"):
        parts = [p.lower() for p in r["investigator_name"].split()]
        if any(re.search(rf"\b{re.escape(p)}\b", q) for p in parts if len(p) > 2):
            return r
    return None


def _check_case(ctx: RequestContext, case_id: int) -> None:
    ok = fetch_one(ctx.conn, "SELECT fn_has_case_access(:u, :c) AS ok", {"u": ctx.user.investigator_id, "c": case_id})
    if not ok or not ok["ok"]:
        raise HTTPException(403, "You are not assigned to that case")


def _scope_sql(ctx: RequestContext, col: str) -> str:
    """Extra WHERE condition limiting INVESTIGATOR users to their cases.
    ``col`` is a constant from this module; the user id is bound as :scope_uid."""
    return "" if ctx.user.sees_all_cases else f" AND ({col} IS NOT NULL AND fn_has_case_access(:scope_uid, {col}) = 1)"


def _p(ctx: RequestContext, **kw) -> dict:
    kw["scope_uid"] = ctx.user.investigator_id
    return kw


# ---------------------------------------------------------------------------
# TOOLS (allowlisted, read-only, parameterized)
# ---------------------------------------------------------------------------
def tool_suspicious(ctx: RequestContext, rng: str = "7d") -> ToolResult:
    label, fn = RANGES.get(rng, RANGES["7d"])
    start, end = fn(dt.datetime.now())
    p = _p(ctx, s=start, e=end)
    alerts = fetch_all(ctx.conn, f"""
        SELECT a.alert_id, a.severity, a.risk_score, a.rule_code, a.detection_method, a.title, a.status,
               a.first_event_at, a.last_event_at, c.case_code
          FROM ai_alerts a LEFT JOIN cases c ON c.case_id = a.related_case_id
         WHERE a.status <> 'DISMISSED'
           AND (a.last_event_at BETWEEN :s AND :e OR a.first_event_at BETWEEN :s AND :e)
           {_scope_sql(ctx, 'a.related_case_id')}
         ORDER BY a.risk_score DESC, a.alert_id LIMIT 15""", p)
    events = fetch_all(ctx.conn, f"""
        SELECT log_id, `timestamp`, action_type, table_name, record_id, case_code, investigator_name, risk_level
          FROM vw_audit_trail
         WHERE risk_level IN ('HIGH','CRITICAL') AND `timestamp` BETWEEN :s AND :e
           {_scope_sql(ctx, 'related_case_id')}
         ORDER BY `timestamp` LIMIT 20""", p)
    fails = fetch_all(ctx.conn, """
        SELECT email, COUNT(*) AS failures, MIN(attempted_at) AS first_at, MAX(attempted_at) AS last_at,
               GROUP_CONCAT(DISTINCT ip_address) AS ips
          FROM login_attempts WHERE success = 0 AND attempted_at BETWEEN :s AND :e
         GROUP BY email ORDER BY failures DESC""", p) if ctx.user.sees_all_cases else []
    facts = [f"Time window: {label} ({_t(start)} to {_t(end)})."]
    if not alerts and not events and not fails:
        facts.append("No alerts, high-risk audit events or failed logins were recorded in this window.")
    for a in alerts:
        facts.append(f"Alert #{a['alert_id']} [{a['severity']} {a['risk_score']}/100, {a['detection_method']}] "
                     f"{a['title']} ({a['case_code'] or 'no case'}), events {_t(a['first_event_at'])} - "
                     f"{_t(a['last_event_at'])}, status {a['status']}.")
    for e in events:
        facts.append(f"Audit #{e['log_id']} at {_t(e['timestamp'])}: {e['action_type']} on {e['table_name'] or '-'} "
                     f"#{e['record_id'] or '-'} by {e['investigator_name']} [{e['risk_level']}] ({e['case_code'] or 'no case'}).")
    for f in fails:
        facts.append(f"{f['failures']} failed login(s) for {f['email']} between {_t(f['first_at'])} and "
                     f"{_t(f['last_at'])} from {f['ips']}.")
    top = alerts[0] if alerts else None
    summary = (f"{len(alerts)} open alert(s), {len(events)} high/critical audit event(s) and "
               f"{sum(f['failures'] for f in fails)} failed login(s) {label}."
               + (f" The most serious is alert #{top['alert_id']}: {top['title']} ({top['severity']}, "
                  f"{top['risk_score']}/100)." if top else ""))
    return ToolResult(f"Suspicious activity {label}", facts, summary,
                      [_table("Alerts", alerts, ["alert_id", "severity", "risk_score", "title", "case_code", "last_event_at"]),
                       _table("High-risk audit events", events, ["log_id", "timestamp", "action_type", "table_name",
                                                                  "record_id", "investigator_name", "risk_level"])],
                      ["ai_alerts", "audit_logs", "login_attempts"])


def tool_failed_verification(ctx: RequestContext) -> ToolResult:
    ev = fetch_all(ctx.conn, f"""
        SELECT evidence_id, evidence_code, evidence_name, case_code, integrity_status, original_hash,
               current_hash, last_verified_at, failed_checks, custodian_name
          FROM vw_evidence_overview
         WHERE failed_checks > 0 {_scope_sql(ctx, 'case_id')}
         ORDER BY integrity_status = 'VERIFIED', evidence_id""", _p(ctx))
    facts = []
    if not ev:
        facts.append("No evidence item has ever failed SHA-256 verification.")
    for e in ev:
        facts.append(f"{e['evidence_code']} '{e['evidence_name']}' ({e['case_code']}): current status "
                     f"{e['integrity_status']}, {e['failed_checks']} failed check(s), last verified "
                     f"{_t(e['last_verified_at'])}; original hash {e['original_hash'][:16]}…, latest computed "
                     f"{(e['current_hash'] or 'file missing')[:16]}…; custodian {e['custodian_name']}.")
    bad = [e for e in ev if e["integrity_status"] != "VERIFIED"]
    summary = (f"{len(bad)} evidence item(s) are currently compromised: "
               + ", ".join(f"{e['evidence_code']} ({e['integrity_status']})" for e in bad) + "."
               if bad else "All evidence currently matches its original SHA-256 hash.")
    return ToolResult("Evidence that failed verification", facts, summary,
                      [_table("Evidence with failed checks", ev, ["evidence_code", "evidence_name", "case_code",
                                                                  "integrity_status", "failed_checks", "last_verified_at"])],
                      ["vw_evidence_overview", "integrity_checks"])


def tool_record_history(ctx: RequestContext, table: str, record_id: int) -> ToolResult:
    if table in ("investigators",) and not ctx.user.sees_all_cases:
        raise HTTPException(403, "Only leads, admins and auditors can view investigator history")
    rows = fetch_all(ctx.conn, f"""
        SELECT log_id, `timestamp`, action_type, investigator_name, db_user, ip_address, risk_level,
               old_values, new_values, related_case_id
          FROM vw_audit_trail
         WHERE table_name = :t AND record_id = :r AND action_type IN ('INSERT','UPDATE','DELETE')
           {_scope_sql(ctx, 'related_case_id')}
         ORDER BY `timestamp`, log_id""", _p(ctx, t=table, r=record_id))
    facts = []
    if not rows:
        facts.append(f"No recorded changes for {table} #{record_id} (or you do not have access to it).")
    for r in rows:
        diffs = changed_fields(r["old_values"], r["new_values"])
        if r["action_type"] == "UPDATE":
            diffs = [d for d in diffs if d["field"] not in ("last_verified_at",)]
            detail = "; ".join(f"{d['field']}: {json.dumps(d['old'])} -> {json.dumps(d['new'])}" for d in diffs[:6])
        elif r["action_type"] == "DELETE":
            detail = "deleted row preserved: " + json.dumps(r["old_values"])[:220]
        else:
            detail = "created"
        facts.append(f"Audit #{r['log_id']} at {_t(r['timestamp'])}: {r['action_type']} by {r['investigator_name']} "
                     f"(MySQL account {r['db_user']}, IP {r['ip_address'] or 'n/a'}) [{r['risk_level']}] - {detail}.")
    actors = sorted({r["investigator_name"] for r in rows if r["action_type"] != "INSERT"})
    summary = (f"{table} #{record_id} has {len(rows)} recorded change(s). Modified by: "
               f"{', '.join(actors) or 'nobody since creation'}." if rows else facts[0])
    return ToolResult(f"Change history of {table} #{record_id}", facts, summary,
                      [_table("Changes", rows, ["log_id", "timestamp", "action_type", "investigator_name",
                                                "db_user", "risk_level"])], ["audit_logs"])


def tool_recent_changes(ctx: RequestContext) -> ToolResult:
    rows = fetch_all(ctx.conn, f"""
        SELECT log_id, `timestamp`, action_type, table_name, record_id, investigator_name, risk_level,
               old_values, new_values
          FROM vw_audit_trail
         WHERE action_type IN ('UPDATE','DELETE') AND NOT (table_name = 'evidence' AND risk_level = 'LOW')
           {_scope_sql(ctx, 'related_case_id')}
         ORDER BY `timestamp` DESC, log_id DESC LIMIT 10""", _p(ctx))
    facts = []
    for r in rows:
        diffs = changed_fields(r["old_values"], r["new_values"])[:3]
        facts.append(f"Audit #{r['log_id']} at {_t(r['timestamp'])}: {r['action_type']} {r['table_name']} "
                     f"#{r['record_id']} by {r['investigator_name']} [{r['risk_level']}]"
                     + (": " + "; ".join(f"{d['field']} {json.dumps(d['old'])} -> {json.dumps(d['new'])}"
                                         for d in diffs) if r["action_type"] == "UPDATE" else "") + ".")
    return ToolResult("Most recent modifications", facts or ["No modifications recorded."],
                      "These are the 10 most recent UPDATE/DELETE operations. Name a record "
                      "(for example 'evidence 2' or 'case 1') to see its full history.",
                      [_table("Recent modifications", rows, ["log_id", "timestamp", "action_type", "table_name",
                                                             "record_id", "investigator_name", "risk_level"])],
                      ["audit_logs"])


def tool_why_flagged(ctx: RequestContext, alert_id: int | None) -> ToolResult:
    if alert_id is None:
        row = fetch_one(ctx.conn, f"""SELECT alert_id FROM ai_alerts WHERE status IN ('OPEN','ESCALATED')
                                      {_scope_sql(ctx, 'related_case_id')}
                                      ORDER BY risk_score DESC, alert_id LIMIT 1""", _p(ctx))
        if not row:
            return ToolResult("Why was it flagged?", ["There are no open alerts."], "There are no open alerts.")
        alert_id = row["alert_id"]
    a = fetch_one(ctx.conn, """SELECT a.*, r.rule_name, r.description AS rule_description, r.threshold,
                                      r.window_minutes, c.case_code
                                 FROM ai_alerts a JOIN detection_rules r ON r.rule_code = a.rule_code
                                 LEFT JOIN cases c ON c.case_id = a.related_case_id
                                WHERE a.alert_id = :a""", {"a": alert_id})
    if not a:
        raise HTTPException(404, f"Alert #{alert_id} not found")
    if a["related_case_id"] and not ctx.user.sees_all_cases:
        _check_case(ctx, a["related_case_id"])
    facts_json = a.get("supporting_facts") or {}
    facts = [f"Alert #{a['alert_id']}: {a['title']} - {a['severity']} ({a['risk_score']}/100), status {a['status']}.",
             f"Detection method: {a['detection_method']} - rule {a['rule_code']} '{a['rule_name']}': {a['rule_description']} "
             f"(threshold {float(a['threshold']):g}, window {a['window_minutes']} min).",
             f"Explanation: {a['explanation']}"]
    for b in facts_json.get("score_breakdown", []):
        facts.append(f"Score factor: {b['factor']} = {b['points']:+d} points.")
    ids = facts_json.get("log_ids") or []
    rows = []
    if ids:
        ids = [int(i) for i in ids][:30]
        ph = ", ".join(f":i{k}" for k in range(len(ids)))
        rows = fetch_all(ctx.conn, f"""SELECT log_id, `timestamp`, action_type, table_name, record_id,
                                              investigator_name, risk_level, details
                                         FROM vw_audit_trail WHERE log_id IN ({ph}) ORDER BY `timestamp`""",
                         {f"i{k}": v for k, v in enumerate(ids)})
        for r in rows:
            facts.append(f"Supporting audit #{r['log_id']} at {_t(r['timestamp'])}: {r['action_type']} "
                         f"{r['table_name'] or ''} #{r['record_id'] or '-'} by {r['investigator_name']} [{r['risk_level']}].")
    return ToolResult(f"Why alert #{alert_id} was flagged", facts, a["explanation"],
                      [_table("Supporting audit events", rows, ["log_id", "timestamp", "action_type", "table_name",
                                                                "record_id", "investigator_name", "risk_level"])],
                      ["ai_alerts", "detection_rules", "audit_logs"])


def tool_custody(ctx: RequestContext, evidence_id: int | None) -> ToolResult:
    if not evidence_id:
        raise HTTPException(400, "Which evidence? For example: 'custody history of EV-0001' or 'evidence 1'.")
    ev = fetch_one(ctx.conn, "SELECT * FROM vw_evidence_overview WHERE evidence_id = :e", {"e": evidence_id})
    if not ev:
        raise HTTPException(404, f"Evidence {evidence_id} not found")
    _check_case(ctx, ev["case_id"])
    rows = fetch_all(ctx.conn, """SELECT transfer_id, transfer_timestamp, from_name, to_name, performed_by_name,
                                         transfer_reason, verification_status
                                    FROM vw_custody_history WHERE evidence_id = :e
                                   ORDER BY transfer_timestamp, transfer_id""", {"e": evidence_id})
    facts = [f"{ev['evidence_code']} '{ev['evidence_name']}' belongs to {ev['case_code']}; current custodian: "
             f"{ev['custodian_name']}; integrity status {ev['integrity_status']}."]
    for i, r in enumerate(rows, 1):
        facts.append(f"Step {i} at {_t(r['transfer_timestamp'])}: {r['from_name']} -> {r['to_name']} "
                     f"(recorded by {r['performed_by_name']}), reason '{r['transfer_reason']}', hash at hand-over "
                     f"{r['verification_status']}.")
    breaks = [r for r in rows if r["verification_status"] != "VERIFIED"]
    summary = (f"{ev['evidence_code']} passed through {len(rows)} custody step(s) and is now held by "
               f"{ev['custodian_name']}. "
               + (f"{len(breaks)} hand-over(s) had a hash problem." if breaks else
                  "Every hand-over verified the original SHA-256 hash."))
    return ToolResult(f"Chain of custody of {ev['evidence_code']}", facts, summary,
                      [_table("Custody history", rows, ["transfer_timestamp", "from_name", "to_name",
                                                        "verification_status", "transfer_reason"])],
                      ["custody_transfers", "vw_custody_history"])


def tool_case_summary(ctx: RequestContext, case_id: int | None) -> ToolResult:
    if not case_id or case_id < 0:
        raise HTTPException(404, "Case not found. Use a code such as 'Case 001' or 'CASE-001'.")
    _check_case(ctx, case_id)
    c = fetch_one(ctx.conn, "SELECT * FROM vw_case_summary WHERE case_id = :c", {"c": case_id})
    alerts = fetch_all(ctx.conn, """SELECT alert_id, severity, risk_score, title, detection_method, status,
                                          first_event_at, last_event_at, explanation
                                     FROM ai_alerts WHERE related_case_id = :c AND status <> 'DISMISSED'
                                    ORDER BY risk_score DESC, alert_id""", {"c": case_id})
    events = fetch_all(ctx.conn, """SELECT log_id, `timestamp`, action_type, table_name, record_id,
                                          investigator_name, risk_level
                                     FROM vw_audit_trail WHERE related_case_id = :c AND risk_level IN ('HIGH','CRITICAL')
                                    ORDER BY `timestamp`""", {"c": case_id})
    ev = fetch_all(ctx.conn, """SELECT evidence_code, evidence_name, integrity_status, custodian_name, failed_checks
                                  FROM vw_evidence_overview WHERE case_id = :c ORDER BY evidence_id""", {"c": case_id})
    facts = [f"{c['case_code']} '{c['case_title']}': status {c['case_status']}, priority {c['priority']}, "
             f"created by {c['created_by_name']} on {_t(c['created_at'])}.",
             f"Evidence: {c['evidence_count']} item(s), {c['verified_count']} verified, {c['compromised_count']} "
             f"compromised; {c['active_members']} active team member(s).",
             f"Case risk score {c['risk_score']}/100 ({c['risk_level']}) from {c['open_alerts']} open alert(s)."]
    for a in alerts:
        facts.append(f"Alert #{a['alert_id']} [{a['severity']} {a['risk_score']}/100, {a['detection_method']}]: "
                     f"{a['title']} ({_t(a['first_event_at'])} - {_t(a['last_event_at'])}).")
    for e in events:
        facts.append(f"High-risk audit #{e['log_id']} at {_t(e['timestamp'])}: {e['action_type']} "
                     f"{e['table_name']} #{e['record_id']} by {e['investigator_name']} [{e['risk_level']}].")
    for e in ev:
        if e["integrity_status"] != "VERIFIED":
            facts.append(f"{e['evidence_code']} '{e['evidence_name']}' is {e['integrity_status']} "
                         f"({e['failed_checks']} failed checks), held by {e['custodian_name']}.")
    top = alerts[:3]
    summary = (f"{c['case_code']} ({c['case_title']}) has risk {c['risk_level']} ({c['risk_score']}/100). "
               + (f"Main concerns: " + "; ".join(f"{a['title']} ({a['severity']})" for a in top) + ". "
                  if top else "No open alerts. ")
               + f"{len(events)} high/critical audit event(s) are linked to the case"
               + (f", the first at {_t(events[0]['timestamp'])} and the last at {_t(events[-1]['timestamp'])}."
                  if events else "."))
    return ToolResult(f"Investigation summary: {c['case_code']}", facts, summary,
                      [_table("Alerts", alerts, ["alert_id", "severity", "risk_score", "title", "last_event_at"]),
                       _table("High-risk audit events", events, ["log_id", "timestamp", "action_type", "table_name",
                                                                  "record_id", "investigator_name", "risk_level"]),
                       _table("Evidence", ev, ["evidence_code", "evidence_name", "integrity_status", "custodian_name"])],
                      ["vw_case_summary", "ai_alerts", "audit_logs", "vw_evidence_overview"])


def tool_highest_risk(ctx: RequestContext) -> ToolResult:
    rows = fetch_all(ctx.conn, f"""SELECT case_id, case_code, case_title, case_status, risk_score, risk_level,
                                         open_alerts, compromised_count
                                    FROM vw_case_summary WHERE 1=1 {_scope_sql(ctx, 'case_id')}
                                   ORDER BY risk_score DESC, open_alerts DESC, case_id""", _p(ctx))
    facts = [f"{r['case_code']} '{r['case_title']}' ({r['case_status']}): risk {r['risk_score']}/100 "
             f"({r['risk_level']}), {r['open_alerts']} open alert(s), {r['compromised_count']} compromised evidence."
             for r in rows]
    top = rows[0] if rows else None
    summary = (f"{top['case_code']} ({top['case_title']}) currently has the highest risk: {top['risk_score']}/100 "
               f"({top['risk_level']}) with {top['open_alerts']} open alert(s). Case risk = highest open alert "
               f"score + 5 per additional open alert (fn_case_risk_score)." if top else "No cases found.")
    return ToolResult("Investigations ranked by risk", facts, summary,
                      [_table("Cases by risk", rows, ["case_code", "case_title", "risk_score", "risk_level", "open_alerts"])],
                      ["vw_case_summary", "fn_case_risk_score"])


def tool_failed_logins(ctx: RequestContext, rng: str) -> ToolResult:
    if not ctx.user.sees_all_cases:
        raise HTTPException(403, "Only leads, admins and auditors can review login history")
    label, fn = RANGES.get(rng, RANGES["7d"])
    start, end = fn(dt.datetime.now())
    rows = fetch_all(ctx.conn, """SELECT email, SUM(success = 0) AS failures, SUM(success = 1) AS successes,
                                         MIN(attempted_at) AS first_at, MAX(attempted_at) AS last_at,
                                         GROUP_CONCAT(DISTINCT ip_address) AS ips
                                    FROM login_attempts WHERE attempted_at BETWEEN :s AND :e
                                   GROUP BY email HAVING failures > 0 ORDER BY failures DESC""", {"s": start, "e": end})
    facts = [f"{r['email']}: {int(r['failures'])} failure(s), {int(r['successes'])} success(es) between "
             f"{_t(r['first_at'])} and {_t(r['last_at'])} from {r['ips']}." for r in rows]
    return ToolResult(f"Failed logins {label}", facts or [f"No failed logins {label}."],
                      f"{sum(int(r['failures']) for r in rows)} failed login(s) across {len(rows)} account(s) {label}.",
                      [_table("Failed logins", rows, ["email", "failures", "successes", "first_at", "last_at", "ips"])],
                      ["login_attempts"])


def tool_investigator_activity(ctx: RequestContext, inv: dict, rng: str) -> ToolResult:
    if not ctx.user.sees_all_cases and inv["investigator_id"] != ctx.user.investigator_id:
        raise HTTPException(403, "You can only review your own activity")
    label, fn = RANGES.get(rng, RANGES["7d"])
    start, end = fn(dt.datetime.now())
    rows = fetch_all(ctx.conn, """SELECT log_id, `timestamp`, action_type, table_name, record_id, case_code, risk_level
                                    FROM vw_audit_trail WHERE investigator_id = :i AND `timestamp` BETWEEN :s AND :e
                                   ORDER BY `timestamp`""", {"i": inv["investigator_id"], "s": start, "e": end})
    facts = [f"Audit #{r['log_id']} at {_t(r['timestamp'])}: {r['action_type']} {r['table_name'] or ''} "
             f"#{r['record_id'] or '-'} ({r['case_code'] or 'no case'}) [{r['risk_level']}]." for r in rows[:40]]
    high = sum(r["risk_level"] in ("HIGH", "CRITICAL") for r in rows)
    return ToolResult(f"Activity of {inv['investigator_name']} {label}", facts or [f"No recorded activity {label}."],
                      f"{inv['investigator_name']} has {len(rows)} audit event(s) {label}, {high} of them HIGH/CRITICAL.",
                      [_table("Activity", rows, ["timestamp", "action_type", "table_name", "record_id",
                                                 "case_code", "risk_level"])], ["audit_logs"])


HELP = ToolResult(
    "What I can answer",
    ["What suspicious activities happened today?  (or yesterday / this week)",
     "Which evidence files failed verification?",
     "Who modified evidence 2?  /  What was changed in case 1?",
     "Why was alert 3 flagged?",
     "Summarize the suspicious activities in Case 001.",
     "Show the custody history of EV-0001.",
     "Which investigation currently has the highest risk?",
     "Show failed logins this week.  /  What did Rahul do yesterday?"],
    "I answer only from the SQL Ghost Hunter database using fixed, read-only queries. "
    "Try one of the example questions.")


# ---------------------------------------------------------------------------
# routing
# ---------------------------------------------------------------------------
INTENTS = ["suspicious_activity", "failed_verification", "record_history", "why_flagged", "case_summary",
           "custody_history", "highest_risk_case", "failed_logins", "investigator_activity", "help"]


def route(ctx: RequestContext, question: str, context: dict) -> tuple[str, dict]:
    q = question.lower()
    rng = parse_range(q)
    if re.search(r"\bwhy\b.*\b(flag|alert|suspicious|risk|score)|explain (the )?alert|alert\s*#?\d+", q):
        return "why_flagged", {"alert_id": find_alert(q)}
    if re.search(r"custod|chain of|who (has|holds)|handed|hand-?over", q):
        return "custody_history", {"evidence_id": find_evidence(q, context)}
    case_id = find_case(ctx, q, context)
    if case_id and re.search(r"summar|overview|brief|investigation|report|what happened|suspicious", q) \
            and (re.search(r"case", q) or context.get("case_id")):
        return "case_summary", {"case_id": case_id}
    if re.search(r"\b(who|what|which)\b.*\b(modif|chang|edit|updat|delet|alter)", q):
        rec = find_record(ctx, q, context)
        return ("record_history", {"table": rec[0], "record_id": rec[1]}) if rec else ("recent_changes", {})
    if re.search(r"fail(ed)?\b.*verif|tamper|compromis|integrity|hash (mis)?match|verification fail", q):
        return "failed_verification", {}
    if re.search(r"(highest|most|top|greatest|riskiest).*(risk|danger|critical|serious)|riskiest", q):
        return "highest_risk_case", {}
    if re.search(r"log ?in|password|brute|sign.?in", q):
        return "failed_logins", {"rng": rng}
    inv = find_investigator(ctx, q)
    if inv and re.search(r"activ|did|do\b|doing|action|history|event", q):
        return "investigator_activity", {"inv": inv, "rng": rng}
    if re.search(r"suspicious|anomal|alert|unusual|incident|happen|risk|threat|attack", q):
        return "suspicious_activity", {"rng": rng}
    if case_id and case_id > 0:
        return "case_summary", {"case_id": case_id}
    return "", {}


def llm_route(ctx: RequestContext, question: str, context: dict) -> tuple[str, dict]:
    """Ask the LLM to pick ONE allowlisted intent. The output is validated."""
    system = ("Classify a digital-forensics question into exactly one intent. Reply with JSON only: "
              '{"intent": one of ' + json.dumps(INTENTS) + ', "case_number": int|null, '
              '"evidence_id": int|null, "alert_id": int|null, "range": "today"|"yesterday"|"7d"|"30d"|null}')
    try:
        raw = ollama_client.chat(system, question, temperature=0.0, json_mode=True)
        data = json.loads(raw)
    except (ollama_client.LLMUnavailable, ValueError):
        return "", {}
    intent = data.get("intent")
    if intent not in INTENTS:
        return "", {}
    rng = data.get("range") if data.get("range") in RANGES else "7d"
    if intent == "suspicious_activity":
        return intent, {"rng": rng}
    if intent == "failed_logins":
        return intent, {"rng": rng}
    if intent == "case_summary" and isinstance(data.get("case_number"), int):
        return intent, {"case_id": find_case(ctx, f"case {data['case_number']}", {})}
    if intent == "custody_history" and isinstance(data.get("evidence_id"), int):
        return intent, {"evidence_id": data["evidence_id"]}
    if intent == "why_flagged":
        return intent, {"alert_id": data.get("alert_id") if isinstance(data.get("alert_id"), int) else None}
    if intent in ("failed_verification", "highest_risk_case", "help"):
        return intent, {}
    return "", {}


def run_tool(ctx: RequestContext, intent: str, params: dict) -> ToolResult:
    tools: dict[str, Callable[..., ToolResult]] = {
        "suspicious_activity": lambda: tool_suspicious(ctx, params.get("rng", "7d")),
        "failed_verification": lambda: tool_failed_verification(ctx),
        "record_history": lambda: tool_record_history(ctx, params["table"], params["record_id"]),
        "recent_changes": lambda: tool_recent_changes(ctx),
        "why_flagged": lambda: tool_why_flagged(ctx, params.get("alert_id")),
        "case_summary": lambda: tool_case_summary(ctx, params.get("case_id")),
        "custody_history": lambda: tool_custody(ctx, params.get("evidence_id")),
        "highest_risk_case": lambda: tool_highest_risk(ctx),
        "failed_logins": lambda: tool_failed_logins(ctx, params.get("rng", "7d")),
        "investigator_activity": lambda: tool_investigator_activity(ctx, params["inv"], params.get("rng", "7d")),
        "help": lambda: HELP,
    }
    return tools[intent]()


NARRATIVE_SYSTEM = (
    "You are the forensic assistant of SQL Ghost Hunter. Answer the investigator's question using ONLY the "
    "FACTS provided (they were retrieved from the MySQL database). Rules: never invent records, names, times, "
    "hashes or numbers; if the facts do not answer the question, say so; describe activity as 'suspicious' or "
    "'indicates', never as proven guilt; mention relevant timestamps; maximum 170 words; plain text.")


def _guard(narrative: str, facts_text: str) -> list[str]:
    warnings = []
    for token in set(re.findall(r"\b(?:CASE-\d{3,}|EV-\d{4,}|#\d+)\b", narrative)):
        if token not in facts_text:
            warnings.append(f"The AI narrative mentions '{token}', which is not in the verified facts.")
    return warnings


def answer(ctx: RequestContext, question: str, context: dict | None = None, use_llm: bool = True) -> dict:
    context = context or {}
    intent, params = route(ctx, question, context)
    routed_by = "rules"
    if not intent and use_llm:
        intent, params = llm_route(ctx, question, context)
        routed_by = "llm" if intent else routed_by
    if not intent:
        intent, params = "help", {}
    result = run_tool(ctx, intent, params)
    facts_text = "\n".join(result.facts)

    llm = ollama_client.status()
    narrative, narrative_source, warnings = result.summary, "deterministic (rule-based template)", []
    if use_llm and llm["available"] and intent != "help":
        try:
            narrative = ollama_client.chat(NARRATIVE_SYSTEM,
                                           f"QUESTION: {question}\n\nFACTS:\n{facts_text[:7000]}")
            narrative_source = f"AI-generated by local model {llm['model']} from the facts below"
            warnings = _guard(narrative, facts_text)
        except ollama_client.LLMUnavailable as exc:
            narrative_source = f"deterministic (LLM unavailable: {exc})"
    log_app_event(ctx, "AI_QUERY", f"Assistant question ({intent}): {question}"[:500],
                  case_id=params.get("case_id") if isinstance(params.get("case_id"), int) and params.get("case_id", 0) > 0 else None)
    return {"question": question, "intent": intent, "routed_by": routed_by, "title": result.title,
            "narrative": narrative, "narrative_source": narrative_source, "warnings": warnings,
            "facts": result.facts, "tables": [t for t in result.tables if t["rows"]], "sources": result.sources,
            "ai_mode": llm["mode"]}
