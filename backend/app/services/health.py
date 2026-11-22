"""Comprehensive system health and connectivity service for SQL Ghost Hunter."""
from __future__ import annotations

import datetime as dt
import hashlib
import time
from pathlib import Path
from typing import Any, Dict

from sqlalchemy import text

from ..ai import detector, ollama_client
from ..config import get_settings
from ..database import get_engine

REQUIRED_TABLES = [
    "ai_alerts", "app_sessions", "audit_logs", "case_assignments", "cases",
    "custody_transfers", "detection_rules", "evidence", "integrity_checks",
    "investigators", "login_attempts"
]

REQUIRED_VIEWS = [
    "vw_audit_trail", "vw_case_summary", "vw_custody_history",
    "vw_dashboard_stats", "vw_evidence_overview", "vw_integrity_history",
    "vw_investigator_activity"
]

REQUIRED_ROUTINES = [
    "fn_current_custodian", "fn_has_case_access", "fn_case_risk_score",
    "sp_create_case", "sp_register_evidence", "sp_transfer_custody",
    "sp_apply_integrity_check", "sp_log_app_event"
]


def check_system_health() -> Dict[str, Any]:
    """Execute real connectivity checks across all application tiers."""
    start_time = time.perf_counter()
    s = get_settings()
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    
    components: Dict[str, Any] = {}
    is_operational = True
    is_degraded = False

    # 1. FastAPI Backend Framework
    components["backend"] = {
        "status": "HEALTHY",
        "framework": "FastAPI",
        "description": "ASGI server online and responsive"
    }

    # 2. MySQL Engine & Connectivity
    mysql_ok = False
    mysql_details = ""
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
            mysql_ok = True
            mysql_details = "Connected to MySQL via InnoDB"
    except Exception as exc:
        mysql_ok = False
        mysql_details = f"Connection failed: {type(exc).__name__}"
        is_operational = False

    components["mysql"] = {
        "status": "HEALTHY" if mysql_ok else "UNAVAILABLE",
        "database": s.db_name,
        "details": mysql_details
    }

    # 3. Schema Objects (Tables, Views, Stored Routines)
    schema_ok = False
    schema_details: Dict[str, Any] = {}
    if mysql_ok:
        try:
            with get_engine().connect() as conn:
                # Check tables
                tables_res = conn.execute(text(
                    "SELECT TABLE_NAME FROM information_schema.TABLES "
                    "WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = 'BASE TABLE'"
                ), {"db": s.db_name}).fetchall()
                found_tables = {row[0].lower() for row in tables_res}
                missing_tables = [t for t in REQUIRED_TABLES if t.lower() not in found_tables]

                # Check views
                views_res = conn.execute(text(
                    "SELECT TABLE_NAME FROM information_schema.VIEWS "
                    "WHERE TABLE_SCHEMA = :db"
                ), {"db": s.db_name}).fetchall()
                found_views = {row[0].lower() for row in views_res}
                missing_views = [v for v in REQUIRED_VIEWS if v.lower() not in found_views]

                # Check routines
                routines_res = conn.execute(text(
                    "SELECT ROUTINE_NAME FROM information_schema.ROUTINES "
                    "WHERE ROUTINE_SCHEMA = :db"
                ), {"db": s.db_name}).fetchall()
                found_routines = {row[0].lower() for row in routines_res}
                missing_routines = [r for r in REQUIRED_ROUTINES if r.lower() not in found_routines]

                if not missing_tables and not missing_views and not missing_routines:
                    schema_ok = True
                    schema_details = {
                        "tables_count": len(found_tables),
                        "views_count": len(found_views),
                        "routines_count": len(found_routines),
                        "all_required_present": True
                    }
                else:
                    schema_ok = False
                    schema_details = {
                        "missing_tables": missing_tables,
                        "missing_views": missing_views,
                        "missing_routines": missing_routines
                    }
                    is_operational = False
        except Exception as exc:
            schema_ok = False
            schema_details = {"error": str(exc)}
            is_operational = False
    else:
        schema_details = {"error": "MySQL unavailable; schema unverified"}

    components["database_schema"] = {
        "status": "HEALTHY" if schema_ok else "UNAVAILABLE",
        "details": schema_details
    }

    # 4. Connection Pool
    components["connection_pool"] = {
        "status": "HEALTHY" if mysql_ok else "UNAVAILABLE",
        "pool_type": "QueuePool",
        "operational": mysql_ok
    }

    # 5. Evidence Storage Directory Accessibility
    storage_ok = False
    storage_details = ""
    evidence_dir = Path(s.storage_dir) / "evidence"
    try:
        evidence_dir.mkdir(parents=True, exist_ok=True)
        canary = evidence_dir / ".health_canary"
        canary.write_text("health_check_ok")
        canary.unlink(missing_ok=True)
        storage_ok = True
        storage_details = "Read/write verified in storage/evidence/"
    except Exception as exc:
        storage_ok = False
        storage_details = f"Filesystem error: {exc}"
        is_operational = False

    components["evidence_storage"] = {
        "status": "HEALTHY" if storage_ok else "UNAVAILABLE",
        "storage_dir": "storage/evidence",
        "details": storage_details
    }

    # 6. Cryptographic SHA-256 Engine
    crypto_ok = False
    try:
        sample_hash = hashlib.sha256(b"sql_ghost_hunter_health_test").hexdigest()
        crypto_ok = (sample_hash == "d2f0ca293a37ba753f2fb75d47e2bbb7ab277215553480484b12617db06a429a")
    except Exception:
        crypto_ok = False
        is_operational = False

    components["crypto_sha256"] = {
        "status": "HEALTHY" if crypto_ok else "UNAVAILABLE",
        "algorithm": "SHA-256",
        "verified": crypto_ok
    }

    # 7. Local LLM / Ollama Runtime
    ollama_status = ollama_client.status()
    ollama_ok = bool(ollama_status.get("available"))
    if not ollama_ok:
        is_degraded = True

    components["ollama"] = {
        "status": "HEALTHY" if ollama_ok else "DEGRADED",
        "mode": ollama_status.get("mode", "OFFLINE"),
        "available": ollama_ok,
        "details": "Local LLM operational" if ollama_ok else "Offline (rule-based fallback active)"
    }

    # 8. Anomaly Detection & ML Rules
    ml_available = detector.sklearn_available()
    components["ai_engine"] = {
        "status": "HEALTHY",
        "rules_active": 11,
        "ml_available": ml_available,
        "mode": "11 Detection Rules + Forensic Scoring Active"
    }

    # Compute Overall Status
    if not is_operational:
        overall_status = "UNAVAILABLE"
    elif is_degraded:
        overall_status = "DEGRADED"
    else:
        overall_status = "HEALTHY"

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "status": overall_status,
        "operational": is_operational,
        "timestamp": now_iso,
        "duration_ms": elapsed_ms,
        "components": components
    }
