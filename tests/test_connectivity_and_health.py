# -*- coding: utf-8 -*-
"""Automated connectivity and system health check tests."""
import pytest
from starlette.testclient import TestClient

from app.main import app

client = TestClient(app)
client.headers.update({"X-Requested-With": "GhostHunter"})


def test_health_endpoint_structure_and_components():
    """Verify GET /api/health executes real component checks and returns structured JSON."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()

    # Top-level contract
    assert "status" in data
    assert data["status"] in ("HEALTHY", "DEGRADED", "UNAVAILABLE")
    assert "operational" in data
    assert isinstance(data["operational"], bool)
    assert "timestamp" in data
    assert "duration_ms" in data
    assert isinstance(data["duration_ms"], (int, float))
    assert data["duration_ms"] > 0

    # Components inventory
    components = data.get("components", {})
    required_components = [
        "backend", "mysql", "database_schema", "connection_pool",
        "evidence_storage", "crypto_sha256", "ollama", "ai_engine"
    ]
    for comp in required_components:
        assert comp in components, f"Missing required component: {comp}"
        assert "status" in components[comp]
        assert components[comp]["status"] in ("HEALTHY", "DEGRADED", "UNAVAILABLE")

    # Tier-specific assertions
    assert components["backend"]["framework"] == "FastAPI"
    assert components["mysql"]["database"] in ("ghost_hunter", "ghost_hunter_test")
    assert components["database_schema"]["details"]["all_required_present"] is True
    assert components["database_schema"]["details"]["tables_count"] == 11
    assert components["database_schema"]["details"]["views_count"] == 7
    assert components["crypto_sha256"]["status"] == "HEALTHY"
    assert components["crypto_sha256"]["verified"] is True
    assert components["evidence_storage"]["status"] == "HEALTHY"
    assert components["ai_engine"]["rules_active"] == 11


def test_health_endpoint_no_secrets_exposed():
    """Verify /api/health never leaks passwords, credentials or session tokens."""
    res = client.get("/api/health")
    text = res.text.lower()
    assert "password" not in text
    assert "yuva" not in text
    assert "secret" not in text
    assert "token" not in text


def test_authenticated_core_connectivity():
    """Verify authenticated connectivity across core endpoints."""
    # 1. Login
    login_res = client.post("/api/auth/login", json={
        "email": "admin@ghosthunter.local",
        "password": "Admin@Ghost2026"
    })
    assert login_res.status_code == 200

    # 2. Dashboard
    dash_res = client.get("/api/dashboard")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "stats" in dash_data
    assert dash_data["stats"]["total_cases"] >= 5

    # 3. Cases
    cases_res = client.get("/api/cases")
    assert cases_res.status_code == 200
    assert len(cases_res.json()) >= 5

    # 4. Evidence
    evidence_res = client.get("/api/evidence")
    assert evidence_res.status_code == 200
    assert len(evidence_res.json()) >= 10

    # 5. Custody
    custody_res = client.get("/api/custody")
    assert custody_res.status_code == 200
    assert len(custody_res.json()) >= 2

    # 6. Audit Logs
    audit_res = client.get("/api/audit")
    assert audit_res.status_code == 200
    assert audit_res.json()["total"] >= 20

    # 7. AI Rules
    rules_res = client.get("/api/ai/rules")
    assert rules_res.status_code == 200
    assert len(rules_res.json()) == 11

    # 8. SQL Catalog
    sql_res = client.get("/api/sql/catalog")
    assert sql_res.status_code == 200
    assert len(sql_res.json()["queries"]) >= 25

    # 9. SQL Tables View
    tables_res = client.get("/api/sql/tables")
    assert tables_res.status_code == 200
    assert len(tables_res.json()) >= 18

    # 10. Documentation
    docs_res = client.get("/api/docs")
    assert docs_res.status_code == 200
    assert len(docs_res.json()) >= 10
