"""Investigation (case) management - thin layer over views and procedures."""
from __future__ import annotations

from ..database import call_procedure, execute, fetch_all, fetch_one
from ..security.auth import RequestContext

ACCESS_FILTER = "fn_has_case_access(:uid, {col}) = 1"


def list_cases(ctx: RequestContext, status: str | None = None) -> list[dict]:
    sql = f"SELECT * FROM vw_case_summary WHERE {ACCESS_FILTER.format(col='case_id')}"
    params = {"uid": ctx.user.investigator_id}
    if status:
        sql += " AND case_status = :st"
        params["st"] = status
    sql += " ORDER BY FIELD(case_status,'OPEN','IN_PROGRESS','ON_HOLD','CLOSED'), risk_score DESC, case_id"
    return fetch_all(ctx.conn, sql, params)


def get_case(ctx: RequestContext, case_id: int) -> dict:
    case = fetch_one(ctx.conn, "SELECT * FROM vw_case_summary WHERE case_id = :c", {"c": case_id})
    case["team"] = fetch_all(ctx.conn, """
        SELECT ca.assignment_id, ca.investigator_id, i.investigator_name, i.role,
               ca.assignment_role, ca.assignment_status, ca.assigned_at,
               ab.investigator_name AS assigned_by_name
          FROM case_assignments ca
          JOIN investigators i       ON i.investigator_id = ca.investigator_id
          LEFT JOIN investigators ab ON ab.investigator_id = ca.assigned_by
         WHERE ca.case_id = :c
         ORDER BY ca.assignment_status, FIELD(ca.assignment_role,'LEAD','MEMBER','REVIEWER'), i.investigator_name""",
        {"c": case_id})
    case["evidence"] = fetch_all(ctx.conn, """
        SELECT evidence_id, evidence_code, evidence_name, evidence_type, integrity_status,
               custodian_name, last_verified_at, uploaded_at, failed_checks
          FROM vw_evidence_overview WHERE case_id = :c ORDER BY evidence_id""", {"c": case_id})
    case["alerts"] = fetch_all(ctx.conn, """
        SELECT alert_id, rule_code, detection_method, severity, risk_score, title, status, last_event_at
          FROM ai_alerts WHERE related_case_id = :c
         ORDER BY FIELD(status,'ESCALATED','OPEN','ACKNOWLEDGED','DISMISSED'), risk_score DESC LIMIT 20""",
        {"c": case_id})
    case["recent_activity"] = fetch_all(ctx.conn, """
        SELECT log_id, `timestamp`, action_type, table_name, record_id, investigator_name, risk_level, details
          FROM vw_audit_trail WHERE related_case_id = :c
         ORDER BY `timestamp` DESC, log_id DESC LIMIT 25""", {"c": case_id})
    return case


def create_case(ctx: RequestContext, title: str, description: str | None, priority: str) -> int:
    out = call_procedure(ctx.conn, "sp_create_case",
                         {"t": title, "d": description, "p": priority, "by": ctx.user.investigator_id},
                         out=["case_id"])
    return int(out["case_id"])


def update_case(ctx: RequestContext, case_id: int, fields: dict) -> None:
    allowed = {"case_title", "case_description", "priority"}   # column names come from this allowlist
    sets = [f"{k} = :{k}" for k in fields if k in allowed]
    if not sets:
        return
    params = {k: v for k, v in fields.items() if k in allowed}
    params["c"] = case_id
    execute(ctx.conn, f"UPDATE cases SET {', '.join(sets)} WHERE case_id = :c", params)


def set_status(ctx: RequestContext, case_id: int, status: str) -> None:
    call_procedure(ctx.conn, "sp_update_case_status",
                   {"c": case_id, "s": status, "by": ctx.user.investigator_id})


def assign(ctx: RequestContext, case_id: int, investigator_id: int, role: str) -> None:
    call_procedure(ctx.conn, "sp_assign_investigator",
                   {"c": case_id, "i": investigator_id, "r": role, "by": ctx.user.investigator_id})


def unassign(ctx: RequestContext, case_id: int, investigator_id: int) -> None:
    call_procedure(ctx.conn, "sp_remove_assignment",
                   {"c": case_id, "i": investigator_id, "by": ctx.user.investigator_id})


def delete_case(ctx: RequestContext, case_id: int) -> None:
    call_procedure(ctx.conn, "sp_delete_empty_case", {"c": case_id, "by": ctx.user.investigator_id})
