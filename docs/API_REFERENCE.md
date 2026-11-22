# SQL Ghost Hunter — API Reference

This document provides a comprehensive reference for all **43 REST API endpoints** exposed by the **SQL Ghost Hunter** FastAPI backend.

- **Base URL:** `http://localhost:8000/api`
- **Interactive Swagger UI:** `http://localhost:8000/api-docs`
- **OpenAPI Schema:** `http://localhost:8000/api/openapi.json`

---

## 1. Authentication & Security Headers

### Session Management
Authentication uses server-side sessions backed by MySQL (`sessions` table). Upon successful login, the server issues an `HttpOnly`, `SameSite=Lax` cookie named `session_id`.

### CSRF Protection
All state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) require the custom header:
```http
X-Requested-With: GhostHunter
```
Requests lacking this header are rejected with `403 Forbidden`.

---

## 2. Endpoint Catalog by Module

### A. System Health & Diagnostics

#### `GET /api/health`
Performs live health checks across FastAPI, MySQL InnoDB connection pool, database schema (11 tables, 7 views, 21 routines), filesystem storage read/write, SHA-256 computation, and AI runtime.
- **Access:** Public (No authentication required)
- **Response `200 OK`:**
```json
{
  "status": "HEALTHY",
  "operational": true,
  "timestamp": "2026-11-22T18:00:00Z",
  "duration_ms": 14.8,
  "components": {
    "backend": { "status": "HEALTHY", "framework": "FastAPI" },
    "mysql": { "status": "HEALTHY", "database": "ghost_hunter" },
    "database_schema": { "status": "HEALTHY", "details": { "tables_count": 11, "views_count": 7, "routines_count": 21 } },
    "connection_pool": { "status": "HEALTHY", "pool_type": "QueuePool" },
    "evidence_storage": { "status": "HEALTHY", "storage_dir": "storage/evidence" },
    "crypto_sha256": { "status": "HEALTHY", "verified": true },
    "ollama": { "status": "DEGRADED", "mode": "OFFLINE (rule-based fallback)" },
    "ai_engine": { "status": "HEALTHY", "rules_active": 11 }
  }
}
```

---

### B. Authentication

#### `POST /api/auth/login`
Authenticates an investigator or administrator via email and bcrypt password hash.
- **Headers:** `X-Requested-With: GhostHunter`
- **Request Body:**
```json
{
  "email": "admin@ghosthunter.local",
  "password": "Admin@Ghost2026"
}
```
- **Response `200 OK`:** Sets `session_id` cookie and returns user profile.

#### `GET /api/auth/me`
Retrieves identity and permissions for the currently authenticated investigator.
- **Response `200 OK`:**
```json
{
  "investigator_id": 1,
  "badge_number": "GH-ADMIN-01",
  "full_name": "System Administrator",
  "email": "admin@ghosthunter.local",
  "role": "admin",
  "clearance_level": "LEVEL_5_DIRECTOR"
}
```

#### `POST /api/auth/logout`
Destroys the current session in the MySQL `sessions` table and clears the cookie.
- **Headers:** `X-Requested-With: GhostHunter`
- **Response `200 OK`:** `{"status": "logged_out"}`

---

### C. Dashboard & Telemetry

#### `GET /api/dashboard`
Aggregates forensic statistics, recent audit activity, active cases, and alert summaries.
- **Response `200 OK`:**
```json
{
  "stats": {
    "total_cases": 6,
    "open_cases": 4,
    "total_evidence": 11,
    "failed_verifications": 1,
    "pending_alerts": 3,
    "audit_events_24h": 142
  },
  "recent_activity": [...],
  "top_alerts": [...]
}
```

---

### D. Investigation Cases

#### `GET /api/cases`
Lists all forensic investigations with optional status and priority filtering.
- **Query Params:** `status` (OPEN, CLOSED, UNDER_REVIEW), `priority` (LOW, MEDIUM, HIGH, CRITICAL)
- **Response `200 OK`:** Array of Case objects.

#### `POST /api/cases`
Opens a new forensic investigation case.
- **Headers:** `X-Requested-With: GhostHunter`
- **Request Body:**
```json
{
  "case_number": "CASE-2026-0099",
  "title": "Unauthorized Payroll Table Modifications",
  "description": "Suspected after-hours rate adjustments",
  "priority": "HIGH",
  "lead_investigator_id": 1
}
```
- **Response `201 Created`**

#### `GET /api/cases/{case_id}`
Retrieves complete details for a case, including assigned investigators and registered evidence.

#### `PATCH /api/cases/{case_id}`
Updates case status, severity, or notes.
- **Headers:** `X-Requested-With: GhostHunter`
- **Request Body:** `{"status": "UNDER_REVIEW", "notes": "Initial analysis complete."}`

#### `POST /api/cases/{case_id}/assignments`
Assigns an investigator to a case.
- **Request Body:** `{"investigator_id": 2, "assignment_role": "FORENSIC_ANALYST"}`

#### `GET /api/cases/{case_id}/timeline`
Retrieves chronological forensic events related to this specific case.

---

### E. Digital Evidence & Integrity

#### `GET /api/evidence`
Lists all digital evidence items registered in the system.
- **Query Params:** `case_id`, `custody_status`, `search`

#### `POST /api/evidence`
Registers a new piece of digital evidence.
- **Request Body:**
```json
{
  "case_id": 1,
  "evidence_number": "EV-0012",
  "item_type": "DATABASE_DUMP",
  "description": "Raw binlog export covering incident timeframe"
}
```
- **Response `201 Created`**

#### `GET /api/evidence/{evidence_id}`
Retrieves evidence metadata, current custodian, original SHA-256, and verification status.

#### `PATCH /api/evidence/{evidence_id}`
Updates evidence metadata (cannot alter immutable hashes or history).

#### `POST /api/evidence/{evidence_id}/upload`
Uploads raw forensic file payload. Computes SHA-256 hash immediately upon receipt and stores file in `storage/evidence/`.
- **Form Data:** `file: <binary>`

#### `POST /api/evidence/{evidence_id}/verify`
Re-hashes the physical file on disk and verifies against the immutable original hash in MySQL.
- **Response `200 OK`:**
```json
{
  "evidence_id": 7,
  "status": "TAMPERED",
  "original_hash": "a1b2c3...",
  "computed_hash": "f9e8d7...",
  "verified_at": "2026-11-22T18:30:00Z",
  "match": false
}
```

#### `GET /api/evidence/{evidence_id}/download`
Securely downloads evidence file with automatic audit logging of the download action.

#### `GET /api/integrity`
Returns history of all integrity checks executed across all evidence records.

---

### F. Chain of Custody

#### `GET /api/custody`
Lists chain of custody transfer history.
- **Query Params:** `evidence_id`, `investigator_id`

#### `POST /api/custody`
Transfers legal custody of evidence between authorized investigators.
- **Request Body:**
```json
{
  "evidence_id": 1,
  "to_investigator_id": 3,
  "transfer_reason": "Transferred for cryptographic deep inspection"
}
```
- **Response `201 Created`**

---

### G. Audit Logs

#### `GET /api/audit`
Queries the immutable trigger-generated audit trail with multi-column filtering.
- **Query Params:** `table_name`, `action`, `investigator_id`, `start_date`, `end_date`, `page`, `page_size`
- **Response `200 OK`:** Paged audit records containing JSON `old_values` and `new_values`.

#### `GET /api/audit/timeline`
Retrieves aggregated histogram of audit operations over time.

#### `GET /api/audit/{log_id}`
Retrieves detailed breakdown of a single audit event, including field diffs.

---

### H. AI Forensics & Anomaly Alerts

#### `POST /api/ai/query`
Natural language query interface for the forensic AI assistant. Answers exclusively from factual MySQL records.
- **Request Body:** `{"question": "What suspicious activity was logged today?"}`
- **Response `200 OK`:**
```json
{
  "query": "What suspicious activity was logged today?",
  "intent": "suspicious_activity",
  "findings_count": 3,
  "response": "Found 3 suspicious events detected in the audit log...",
  "engine": "rule-based-fallback"
}
```

#### `GET /api/ai/rules`
Lists the 11 active anomaly detection rules.

#### `POST /api/ai/rules/{rule_code}/toggle`
Enables or disables a specific detection rule.
- **Request Body:** `{"enabled": true}`

#### `GET /api/ai/alerts`
Lists forensic anomaly alerts generated by the detection engine.

#### `PATCH /api/ai/alerts/{alert_id}`
Updates alert review status (`DISMISSED`, `CONFIRMED`, `UNDER_INVESTIGATION`).
- **Request Body:** `{"status": "CONFIRMED"}`

---

### I. Analytics & Risk Matrix

#### `GET /api/analytics/kpis`
High-level forensic metrics and trend indicators.

#### `GET /api/analytics/risk-matrix`
Risk quadrant scores categorized by case severity and evidence vulnerability.

#### `GET /api/analytics/timeline`
Activity distributions by day, hour, and operation type.

#### `GET /api/analytics/custody-flow`
Directed graph nodes and links representing custody handoffs between investigators.

---

### J. SQL Demonstration Catalog

#### `GET /api/sql/catalog`
Returns educational SQL queries grouped by syllabus topics (Joins, Triggers, Views, Procedures, Subqueries).

#### `GET /api/sql/tables`
Returns table schemas, foreign key definitions, and column metadata.

#### `POST /api/sql/run`
Executes a read-only query in a sandboxed, parameter-checked transaction.
- **Request Body:** `{"query_id": "05_01"}`

---

### K. Forensic Reports & Documentation

#### `GET /api/reports`
Lists generated forensic dossiers.

#### `POST /api/reports/generate`
Compiles an official forensic investigation report (PDF or HTML).
- **Request Body:** `{"case_id": 1, "format": "html", "include_audit_trail": true}`

#### `GET /api/reports/{report_id}/download`
Streams generated report artifact to the client.

#### `GET /api/docs`
Lists available documentation topics.

#### `GET /api/docs/{doc_id}`
Renders Markdown documentation content (e.g., `README`, `ARCHITECTURE`, `ER_DIAGRAM`).

---

### L. User & Investigator Management

#### `GET /api/users`
Lists system users (Admin role required).

#### `POST /api/users`
Provisions a new investigator account with clearance level and role.
- **Request Body:**
```json
{
  "full_name": "Ananya Roy",
  "email": "ananya.roy@ghosthunter.local",
  "password": "TemporaryPassword123!",
  "role": "investigator",
  "clearance_level": "LEVEL_3_ANALYST",
  "badge_number": "GH-INV-05"
}
```
