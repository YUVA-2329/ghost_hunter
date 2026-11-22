"""Read-only access to the audit trail (written exclusively by MySQL)."""
from __future__ import annotations

import datetime as dt

from fastapi import HTTPException

from ..database import call_procedure, fetch_all, fetch_one, fetch_value
from ..security.auth import RequestContext

ACTIONS = ("INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EVIDENCE_DOWNLOAD", "INTEGRITY_CHECK",
           "REPORT_GENERATED", "AI_QUERY", "ANALYSIS_RUN")
RISKS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
TABLES = ("investigators", "cases", "evidence", "case_assignments", "custody_transfers",
          "integrity_checks", "detection_rules", "ai_alerts")
IGNORED_DIFF_KEYS = set()


def changed_fields(old: dict | None, new: dict | None) -> list[dict]:
    """Field-level difference between old_values and new_values JSON."""
    old, new = old or {}, new or {}
    keys = list(dict.fromkeys(list(old.keys()) + list(new.keys())))
    out = []
    for k in keys:
        if k in IGNORED_DIFF_KEYS:
            continue
        if old.get(k) != new.get(k) or not old or not new:
            out.append({"field": k, "old": old.get(k), "new": new.get(k)})
    return out


def _scope(ctx: RequestContext, where: list[str], params: dict) -> None:
    if not ctx.user.can("audit.view_all"):
        # investigators: their own events + events of cases they can access
        where.append("(investigator_id = :me OR (related_case_id IS NOT NULL "
                     "AND fn_has_case_access(:me, related_case_id) = 1))")
        params["me"] = ctx.user.investigator_id


def search(ctx: RequestContext, *, date_from: dt.date | None = None, date_to: dt.date | None = None,
           investigator: str | None = None, action: str | None = None, risk: str | None = None,
           table: str | None = None, case_id: int | None = None, record_id: int | None = None,
           source: str | None = None, page: int = 1, page_size: int = 50) -> dict:
    where, params = ["1=1"], {}
    if date_from:
        where.append("`timestamp` >= :df"); params["df"] = dt.datetime.combine(date_from, dt.time.min)
    if date_to:
        where.append("`timestamp` < :dt"); params["dt"] = dt.datetime.combine(date_to, dt.time.min) + dt.timedelta(days=1)
    if investigator == "none":
        where.append("investigator_id IS NULL")
    elif investigator:
        where.append("investigator_id = :inv"); params["inv"] = int(investigator)
    if action:
        if action not in ACTIONS:
            raise HTTPException(400, "Unknown action type")
        where.append("action_type = :act"); params["act"] = action
    if risk:
        levels = [r for r in risk.split(",") if r in RISKS]
        if not levels:
            raise HTTPException(400, "Unknown risk level")
        names = [f":rk{i}" for i in range(len(levels))]
        where.append(f"risk_level IN ({', '.join(names)})")
        params.update({f"rk{i}": lv for i, lv in enumerate(levels)})
    if table:
        if table not in TABLES:
            raise HTTPException(400, "Unknown table")
        where.append("table_name = :tbl"); params["tbl"] = table
    if case_id:
        where.append("related_case_id = :case"); params["case"] = case_id
    if record_id:
        where.append("record_id = :rid"); params["rid"] = record_id
    if source in ("TRIGGER", "APPLICATION"):
        where.append("event_source = :src"); params["src"] = source
    _scope(ctx, where, params)
    clause = " AND ".join(where)
    total = fetch_value(ctx.conn, f"SELECT COUNT(*) FROM vw_audit_trail WHERE {clause}", params)
    page_size = max(1, min(page_size, 200))
    params.update({"lim": page_size, "off": (max(page, 1) - 1) * page_size})
    rows = fetch_all(ctx.conn, f"""SELECT * FROM vw_audit_trail WHERE {clause}
                                   ORDER BY `timestamp` DESC, log_id DESC LIMIT :lim OFFSET :off""", params)
    for r in rows:
        r["changes"] = changed_fields(r.get("old_values"), r.get("new_values")) \
            if r["action_type"] in ("INSERT", "UPDATE", "DELETE") else []
    return {"total": total, "page": page, "page_size": page_size, "rows": rows}


def get_event(ctx: RequestContext, log_id: int) -> dict:
    where, params = ["log_id = :id"], {"id": log_id}
    _scope(ctx, where, params)
    row = fetch_one(ctx.conn, f"SELECT * FROM vw_audit_trail WHERE {' AND '.join(where)}", params)
    if not row:
        raise HTTPException(404, "Audit event not found")
    row["changes"] = changed_fields(row.get("old_values"), row.get("new_values"))
    return row


def record_history(ctx: RequestContext, table: str, record_id: int) -> list[dict]:
    return search(ctx, table=table, record_id=record_id, page_size=200)["rows"]


def filter_options(ctx: RequestContext) -> dict:
    return {
        "investigators": fetch_all(ctx.conn, "SELECT investigator_id, investigator_name FROM investigators "
                                             "ORDER BY investigator_name"),
        "actions": list(ACTIONS), "risks": list(RISKS), "tables": list(TABLES),
    }


def log_app_event(ctx: RequestContext, action: str, details: str, *, table: str | None = None,
                  record_id: int | None = None, case_id: int | None = None, risk: str = "LOW") -> None:
    call_procedure(ctx.conn, "sp_log_app_event", {
        "i": ctx.user.investigator_id, "a": action, "t": table, "r": record_id, "c": case_id,
        "d": details[:500], "ip": ctx.ip, "risk": risk})
