"""Dashboard - every number comes from a live MySQL query."""
from __future__ import annotations

from ..ai import detector, ollama_client
from ..database import fetch_all, fetch_one
from ..security.auth import RequestContext


def dashboard(ctx: RequestContext) -> dict:
    stats = fetch_one(ctx.conn, "SELECT * FROM vw_dashboard_stats")
    scope = "" if ctx.user.sees_all_cases else \
        " AND related_case_id IS NOT NULL AND fn_has_case_access(:uid, related_case_id) = 1"
    p = {"uid": ctx.user.investigator_id}
    recent = fetch_all(ctx.conn, f"""
        SELECT log_id, `timestamp`, action_type, table_name, record_id, case_code, investigator_name, risk_level
          FROM vw_audit_trail
         WHERE action_type IN ('INSERT','UPDATE','DELETE')
           AND NOT (table_name = 'evidence' AND action_type = 'UPDATE' AND risk_level = 'LOW') {scope}
         ORDER BY `timestamp` DESC, log_id DESC LIMIT 10""", p)
    daily = fetch_all(ctx.conn, """
        WITH RECURSIVE days AS (SELECT CURDATE() - INTERVAL 13 DAY AS d
                                UNION ALL SELECT d + INTERVAL 1 DAY FROM days WHERE d < CURDATE())
        SELECT days.d AS day,
               (SELECT COUNT(*) FROM audit_logs a WHERE a.`timestamp` >= days.d
                  AND a.`timestamp` < days.d + INTERVAL 1 DAY) AS events,
               (SELECT COUNT(*) FROM audit_logs a WHERE a.`timestamp` >= days.d
                  AND a.`timestamp` < days.d + INTERVAL 1 DAY AND a.risk_level IN ('HIGH','CRITICAL')) AS high_risk
          FROM days ORDER BY days.d""")
    risk = fetch_all(ctx.conn, """SELECT risk_level, COUNT(*) AS events FROM audit_logs
                                   GROUP BY risk_level ORDER BY FIELD(risk_level,'LOW','MEDIUM','HIGH','CRITICAL')""")
    alerts = fetch_all(ctx.conn, f"""
        SELECT a.alert_id, a.severity, a.risk_score, a.title, a.detection_method, a.last_event_at, c.case_code
          FROM ai_alerts a LEFT JOIN cases c ON c.case_id = a.related_case_id
         WHERE a.status IN ('OPEN','ESCALATED')
           {"" if ctx.user.sees_all_cases else "AND a.related_case_id IS NOT NULL AND fn_has_case_access(:uid, a.related_case_id) = 1"}
         ORDER BY a.risk_score DESC, a.alert_id LIMIT 6""", p)
    cases = fetch_all(ctx.conn, """SELECT case_code, case_title, risk_score, risk_level, case_status
                                     FROM vw_case_summary WHERE fn_has_case_access(:uid, case_id) = 1
                                    ORDER BY risk_score DESC, case_id LIMIT 5""", p)
    ai = ollama_client.status()
    return {"stats": stats, "recent_modifications": recent, "daily_activity": daily, "risk_distribution": risk,
            "top_alerts": alerts, "cases_by_risk": cases,
            "ai_status": {"llm": ai, "anomaly_detection": "ONLINE (rule-based + statistical)",
                          "ml_available": detector.sklearn_available()}}
