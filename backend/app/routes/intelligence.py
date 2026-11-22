"""AI analysis, alerts, assistant, reports, SQL demonstration and documentation."""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, PlainTextResponse

from ..ai import assistant, detector, ollama_client
from ..config import PROJECT_ROOT
from ..database import execute, fetch_all, fetch_one
from ..schemas import AlertStatusUpdate, AssistantQuery, RuleUpdate
from ..security.auth import RequestContext, get_context, require
from ..services import audit, reports, sql_demo

router = APIRouter(prefix="/api", tags=["intelligence"])


# ---------------------------------------------------------------- AI status / analysis
@router.get("/ai/status")
def ai_status(refresh: bool = False, ctx: RequestContext = Depends(get_context)):
    st = ollama_client.status(force=refresh)
    return {"llm": st, "anomaly_detection": "ONLINE (rule-based + statistical)",
            "ml_available": detector.sklearn_available(),
            "assistant_mode": "LLM narrative + verified facts" if st["available"]
            else "Deterministic summaries + verified facts (LLM offline)"}


@router.post("/ai/analyze")
def analyze(ctx: RequestContext = Depends(require("ai.analyze"))):
    result = detector.run_analysis(ctx.conn)
    audit.log_app_event(ctx, "ANALYSIS_RUN", f"Anomaly analysis: {result['findings']} findings, "
                                             f"{result['new_alerts']} new alerts")
    return result


@router.get("/ai/alerts")
def list_alerts(status: Optional[str] = None, severity: Optional[str] = None, case_id: Optional[int] = None,
                ctx: RequestContext = Depends(get_context)):
    where, p = ["1=1"], {"uid": ctx.user.investigator_id}
    if status:
        where.append("a.status = :st"); p["st"] = status
    if severity:
        where.append("a.severity = :sv"); p["sv"] = severity
    if case_id:
        where.append("a.related_case_id = :c"); p["c"] = case_id
    if not ctx.user.sees_all_cases:
        where.append("a.related_case_id IS NOT NULL AND fn_has_case_access(:uid, a.related_case_id) = 1")
    return fetch_all(ctx.conn, f"""
        SELECT a.*, c.case_code, i.investigator_name AS related_investigator, r.rule_name,
               rv.investigator_name AS reviewed_by_name
          FROM ai_alerts a
          JOIN detection_rules r ON r.rule_code = a.rule_code
          LEFT JOIN cases c ON c.case_id = a.related_case_id
          LEFT JOIN investigators i ON i.investigator_id = a.related_investigator_id
          LEFT JOIN investigators rv ON rv.investigator_id = a.reviewed_by
         WHERE {' AND '.join(where)}
         ORDER BY FIELD(a.status,'ESCALATED','OPEN','ACKNOWLEDGED','DISMISSED'), a.risk_score DESC, a.alert_id""", p)


@router.patch("/ai/alerts/{alert_id}")
def review_alert(alert_id: int, body: AlertStatusUpdate, ctx: RequestContext = Depends(require("ai.alert_review"))):
    n = execute(ctx.conn, """UPDATE ai_alerts SET status = :s, reviewed_by = :u, reviewed_at = NOW()
                              WHERE alert_id = :a""", {"s": body.status, "u": ctx.user.investigator_id, "a": alert_id})
    if not n:
        raise HTTPException(404, "Alert not found")
    return fetch_one(ctx.conn, "SELECT alert_id, status, reviewed_at FROM ai_alerts WHERE alert_id = :a", {"a": alert_id})


@router.get("/ai/rules")
def list_rules(ctx: RequestContext = Depends(get_context)):
    return fetch_all(ctx.conn, "SELECT * FROM detection_rules ORDER BY detection_method, rule_code")


@router.patch("/ai/rules/{rule_code}")
def update_rule(rule_code: str, body: RuleUpdate, ctx: RequestContext = Depends(require("ai.rules_edit"))):
    rule = fetch_one(ctx.conn, "SELECT rule_code, params FROM detection_rules WHERE rule_code = :r", {"r": rule_code})
    if not rule:
        raise HTTPException(404, "Rule not found")
    fields: dict = {}
    for k in ("threshold", "window_minutes", "base_score"):
        if getattr(body, k) is not None:
            fields[k] = getattr(body, k)
    if body.is_enabled is not None:
        fields["is_enabled"] = 1 if body.is_enabled else 0
    if body.start_hour is not None or body.end_hour is not None:
        if rule_code != "OFF_HOURS_ACTIVITY":
            raise HTTPException(400, "Working hours apply only to OFF_HOURS_ACTIVITY")
        params = rule["params"] or {}
        params.update({k: v for k, v in (("start_hour", body.start_hour), ("end_hour", body.end_hour)) if v is not None})
        if params.get("start_hour", 8) >= params.get("end_hour", 20):
            raise HTTPException(400, "start_hour must be before end_hour")
        fields["params"] = json.dumps(params)
    if fields:
        sets = ", ".join(f"{k} = :{k}" for k in fields)     # keys from the fixed list above
        execute(ctx.conn, f"UPDATE detection_rules SET {sets} WHERE rule_code = :r", {**fields, "r": rule_code})
    return fetch_one(ctx.conn, "SELECT * FROM detection_rules WHERE rule_code = :r", {"r": rule_code})


@router.get("/ai/case-risk")
def case_risk(ctx: RequestContext = Depends(get_context)):
    return fetch_all(ctx.conn, """SELECT case_id, case_code, case_title, case_status, risk_score, risk_level, open_alerts,
                                         compromised_count FROM vw_case_summary
                                   WHERE fn_has_case_access(:u, case_id) = 1
                                   ORDER BY risk_score DESC, case_id""", {"u": ctx.user.investigator_id})


@router.post("/ai/assistant")
def ask(body: AssistantQuery, ctx: RequestContext = Depends(get_context)):
    context = body.context.model_dump(exclude_none=True) if body.context else {}
    return assistant.answer(ctx, body.question, context, body.use_llm)


# ---------------------------------------------------------------- reports
@router.get("/reports/case/{case_id}")
def case_report(case_id: int, format: str = Query("json", pattern="^(json|md|html)$"), ai: bool = True,
                ctx: RequestContext = Depends(require("reports.generate"))):
    r = reports.build(ctx, case_id, use_ai=ai)
    code = r["case"]["case_code"]
    if format == "md":
        return PlainTextResponse(reports.to_markdown(r), media_type="text/markdown",
                                 headers={"Content-Disposition": f'attachment; filename="{code}_report.md"'})
    if format == "html":
        return HTMLResponse(reports.to_html(r))
    return r


# ---------------------------------------------------------------- SQL demonstration
@router.get("/sql/catalog")
def sql_catalog(ctx: RequestContext = Depends(get_context)):
    return sql_demo.catalog()


@router.post("/sql/run/{query_id}")
def sql_run(query_id: str, ctx: RequestContext = Depends(get_context)):
    return sql_demo.run(ctx, query_id)


@router.get("/sql/tables")
def sql_tables(ctx: RequestContext = Depends(get_context)):
    return sql_demo.tables(ctx)


@router.get("/sql/scripts/{name}", response_class=PlainTextResponse)
def sql_script(name: str, ctx: RequestContext = Depends(get_context)):
    return sql_demo.script(name)


# ---------------------------------------------------------------- documentation
DOCS = {
    "README": PROJECT_ROOT / "README.md",
    "DOCKER": PROJECT_ROOT / "docs" / "DOCKER.md",
    "API_REFERENCE": PROJECT_ROOT / "docs" / "API_REFERENCE.md",
    "CONTRIBUTING": PROJECT_ROOT / "docs" / "CONTRIBUTING.md",
    "ARCHITECTURE": PROJECT_ROOT / "docs" / "ARCHITECTURE.md",
    "ER_DIAGRAM": PROJECT_ROOT / "docs" / "ER_DIAGRAM.md",
    "SQL_EXPLANATION": PROJECT_ROOT / "docs" / "SQL_EXPLANATION.md",
    "AI_EXPLANATION": PROJECT_ROOT / "docs" / "AI_EXPLANATION.md",
    "SECURITY": PROJECT_ROOT / "docs" / "SECURITY.md",
    "DEMONSTRATION": PROJECT_ROOT / "docs" / "DEMONSTRATION.md",
    "VIVA_QUESTIONS": PROJECT_ROOT / "docs" / "VIVA_QUESTIONS.md",
    "TEST_RESULTS": PROJECT_ROOT / "docs" / "TEST_RESULTS.md",
    "TRACEABILITY": PROJECT_ROOT / "docs" / "TRACEABILITY.md",
}


@router.get("/docs")
def docs_list(ctx: RequestContext = Depends(get_context)):
    return [{"name": k, "available": v.exists()} for k, v in DOCS.items()]


@router.get("/docs/{name}", response_class=PlainTextResponse)
def docs_get(name: str, ctx: RequestContext = Depends(get_context)):
    path = DOCS.get(name)
    if not path or not path.exists():
        raise HTTPException(404, "Document not found")
    return path.read_text(encoding="utf-8")
