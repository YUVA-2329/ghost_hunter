# 🕵️‍♂️ SQL Ghost Hunter
### *Every Database Change Leaves a Trace.*

[![Database](https://img.shields.io/badge/Database-MySQL%208.0%20(InnoDB)-00758F?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.10+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](docs/DOCKER.md)
[![Integrity](https://img.shields.io/badge/Integrity-SHA--256%20Cryptographic%20Verification-green?style=for-the-badge&logo=hashcat&logoColor=white)](docs/SECURITY.md)
[![Tests](https://img.shields.io/badge/Pytest-41%2F41%20Passed%20(100%25)-brightgreen?style=for-the-badge&logo=pytest&logoColor=white)](docs/TEST_RESULTS.md)
[![Zero Mock Data](https://img.shields.io/badge/Data%20Integrity-Zero%20Mock%20Data%20(100%25%20RDBMS)-blueviolet?style=for-the-badge)](docs/TRACEABILITY.md)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

An enterprise-grade **database forensics, cryptographic integrity monitoring, and digital evidence chain-of-custody platform** built natively on **MySQL 8.0** and **FastAPI**. 

It intercepts and audits every row-level mutation using immutable database triggers, computes deterministic **SHA-256** checksums on digital evidence, enforces legal custody handoffs, identifies suspicious activity through **11 anomaly detection rules**, and features an **AI Forensic Assistant** that queries strictly from factual relational records.

---

## 📑 Table of Contents
1. [🎓 Examiner & Faculty Evaluation Guide](#-examiner--faculty-evaluation-guide)
2. [💡 The 30-Second Explanation (For Anyone)](#-the-30-second-explanation)
3. [⚡ 1-Command Quick Launch (Docker)](#-1-command-quick-launch-docker)
4. [💻 Local Installation & Setup](#-local-installation--setup)
5. [🔍 Interactive Backend Status Indicator](#-interactive-backend-status-indicator)
6. [🏛️ System Architecture & Data Flow](#️-system-architecture--data-flow)
7. [🗄️ Relational Database Schema (3NF)](#️-relational-database-schema-3nf)
8. [📚 Academic DBMS Syllabus Traceability Matrix](#-academic-dbms-syllabus-traceability-matrix)
9. [🔬 7 Scripted Forensic Demonstration Scenarios](#-7-scripted-forensic-demonstration-scenarios)
10. [🎙️ Top Viva Voce Defense Questions & Answers](#️-top-viva-voce-defense-questions--answers)
11. [👥 Default Demonstration Credentials](#-default-demonstration-credentials)
12. [📖 Complete Documentation Index](#-complete-documentation-index)

---

## 🎓 Examiner & Faculty Evaluation Guide

> **To the Respected Project Evaluator / External Examiner:**
> 
> Most computer science web projects rely entirely on application-level logging (`logger.info()`). However, in real-world database forensics, **application logs cannot be trusted**:
> 1. An attacker or disgruntled DBA with direct MySQL access (`mysql -u root`) can alter, drop, or falsify rows without ever triggering application code.
> 2. Web server logs can be modified, truncated, or erased by anyone with administrative server permissions.
> 
> **SQL Ghost Hunter solves this fundamental problem at the Database Engine layer:**
> - **Engine-Enforced Triggers:** All INSERT, UPDATE, and DELETE actions execute MySQL triggers that immediately write old and new field-level JSON values into an append-only audit trail.
> - **Privilege Separation:** The web application connects through a restricted account (`ghost_app`) with **REVOKED write privileges** on audit logs. Even if the web application is compromised via SQL injection, historical records cannot be rewritten.
> - **Mathematical Tamper Proofing:** Physical evidence files are hashed with SHA-256 upon intake. Any bit-level file alteration is mathematically detected during re-verification.

---

## 💡 The 30-Second Explanation

> Imagine your school has an examination marks register written in special permanent ink.
> 
> If someone secretly uses a blade or eraser to alter a student's mark from 35 to 95, an ordinary report card won't tell you who cheated. But SQL Ghost Hunter is like an invisible security camera watching the ledger: the second a pen touches the paper, it takes a permanent photograph of the old number, records the exact second it was changed, notes who held the pen, and sounds an alarm if the paper was modified after hours.

---

## ⚡ 1-Command Quick Launch (Docker)

You can run the complete system (FastAPI Backend, MySQL 8.0, and Evidence Storage) with a single command:

```bash
# 1. Clone the repository
git clone https://github.com/YUVA-2329/ghost_hunter.git
cd ghost_hunter

# 2. Launch with Docker Compose (builds app, boots MySQL, runs migrations & seeds demo)
docker compose up --build -d
```

- **Forensic Web Dashboard:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs:** [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
- **Real-Time Health Probe:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

To view live application logs:
```bash
docker compose logs -f app
```

To stop the containers:
```bash
docker compose down
```
*(For detailed container management and volume backups, see [docs/DOCKER.md](docs/DOCKER.md)).*

---

## 💻 Local Installation & Setup

If you prefer to run the system natively on Windows 11, Linux, or macOS:

### Prerequisites
- **Python 3.10+** (Python 3.10, 3.11, 3.12, or 3.13)
- **MySQL 8.0+** (MySQL Community Server)

### Setup Steps
```powershell
# 1. Create and activate a Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # Linux/macOS: source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment credentials
copy .env.example .env
# Edit .env and enter your MySQL root password (DB_ADMIN_PASSWORD)

# 4. Automated 1-Command Database Setup
# Runs schema, triggers, views, procedures, security privileges, and copies demo evidence
python backend\scripts\setup_database.py --yes

# 5. Start SQL Ghost Hunter
python run.py
```
Open your browser to `http://127.0.0.1:8000`.

---

## 🔍 Interactive Backend Status Indicator

SQL Ghost Hunter includes an **instant system connectivity diagnostic tool** built directly into the UI:

1. Look at the top navigation bar search box (`Type 'backend' to check connectivity...`).
2. Type the word:
   ```text
   backend
   ```
3. The application immediately triggers a real HTTP probe to `/api/health`, benchmarking database latency, connection pooling, table counts, and filesystem storage permissions:
   - **`🟢 BACKEND CONNECTED`** — Vibrant pulse badge indicating MySQL InnoDB connection pool is operational and schema objects are verified.
   - **`🔴 BACKEND DISCONNECTED`** — Visual alert indicating connectivity degradation or unreachable database.
4. The status indicator automatically dismisses after **5 seconds** without cluttering your workflow.

---

## 🏛️ System Architecture & Data Flow

```mermaid
flowchart TD
    User["👨‍💼 Forensic Investigator / Auditor"] -->|Browser HTTPS / ES Modules| UI["Liquid Glass Frontend (Chart.js / Vanilla JS)"]
    UI -->|JSON REST + HttpOnly Session Cookie| API["FastAPI ASGI Backend"]

    subgraph SecurityBoundary ["Security & Integrity Enforcement"]
        API -->|Identity Stamping: @app_investigator_id| DB["MySQL 8.0 InnoDB Database"]
        DB -->|DML Event| Triggers["23 Database Triggers (BEFORE / AFTER)"]
        Triggers -->|Immutable Write| AuditLog[("audit_logs (Append-Only)")]
        Triggers -->|Integrity Lock| CustodyTable[("custody_transfers")]
    end

    subgraph StorageEngine ["Evidence & Cryptographic Vault"]
        API -->|Raw Stream / Read-Write| Storage["storage/evidence/ (Filesystem)"]
        API -->|Deterministic Checksum| SHA256["hashlib.sha256() Cryptographic Engine"]
        SHA256 -->|Verification Result| DB
    end

    subgraph IntelligenceLayer ["Forensic Intelligence & Detection"]
        API -->|11 Detection Rules + Z-Score| AnomalyDetector["Anomaly Detection Engine"]
        API -->|Factual Schema Queries| Assistant["AI Forensic Assistant"]
        Assistant -.->|Optional LLM| Ollama["Ollama Local Model (llama3.2:3b)"]
        Assistant -->|Fallback Engine| RuleEngine["Deterministic Factual Rule Engine"]
    end
```

---

## 🗄️ Relational Database Schema (3NF)

The database schema (`ghost_hunter`) is strictly normalized to **Third Normal Form (3NF)** with explicit foreign key integrity, non-null constraints, and domain checks:

| Table Name | Primary Key | Description | Key Constraints / Triggers |
| :--- | :--- | :--- | :--- |
| **`investigators`** | `investigator_id` | Registered forensic officers and agents | Unique badge numbers, email regex constraint |
| **`cases`** | `case_id` | Forensic investigation dossiers | Priority enum, status transitions enforced |
| **`case_assignments`**| `assignment_id` | M:N bridge between cases & investigators | Composite uniqueness (`case_id`, `investigator_id`) |
| **`evidence`** | `evidence_id` | Digital artifacts (dumps, logs, images) | Immutable original hash, file size checks |
| **`custody_transfers`**| `transfer_id` | Chain-of-custody hand-off history | Append-only, authorizer foreign keys |
| **`integrity_checks`** | `check_id` | SHA-256 verification history | Historical log, mismatch flags |
| **`audit_logs`** | `log_id` | System-wide trigger-enforced ledger | JSON old/new value diffs, append-only triggers |
| **`detection_rules`** | `rule_id` | Configurable anomaly detection triggers | Unique rule codes, severity weighting |
| **`anomaly_alerts`** | `alert_id` | Flagged suspicious behaviors & breaches | Case links, risk scores, status lifecycle |
| **`users`** | `user_id` | Web application authentication credentials | Bcrypt password hashes, role enforcement |
| **`sessions`** | `session_id` | Server-side active login sessions | Expiry timestamps, SHA-256 token hashing |

---

## 📚 Academic DBMS Syllabus Traceability Matrix

Every core requirement of the undergraduate Computer Science DBMS syllabus is implemented with real, production-ready SQL:

| DBMS Syllabus Concept | Implementation in SQL Ghost Hunter | Relevant SQL Script |
| :--- | :--- | :--- |
| **DDL & Constraints** | Primary keys, composite keys, foreign keys (`ON DELETE RESTRICT`), `CHECK` constraints, `NOT NULL`, `DEFAULT` | [`sql/01_schema.sql`](sql/01_schema.sql) |
| **DML Operations** | Parameterized relational INSERT, UPDATE, and DELETE statements | [`sql/02_sample_data.sql`](sql/02_sample_data.sql) |
| **Complex Joins** | `INNER JOIN`, `LEFT OUTER JOIN`, `RIGHT OUTER JOIN`, `CROSS JOIN`, Multi-table joins across 4+ relations | [`sql/05_joins.sql`](sql/05_joins.sql) |
| **Subqueries & CTEs** | Correlated subqueries, nested scalar queries, `EXISTS`, `IN`, Common Table Expressions (`WITH`) | [`sql/06_subqueries.sql`](sql/06_subqueries.sql) |
| **Aggregate Functions** | `COUNT()`, `SUM()`, `AVG()`, `GROUP BY`, `HAVING`, window ranking functions (`DENSE_RANK()`, `ROW_NUMBER()`) | [`sql/07_aggregate_queries.sql`](sql/07_aggregate_queries.sql) |
| **Views & Indexing** | 7 specialized relational views, composite B-Tree indexes, unique indexes, hash indexes | [`sql/08_views_indexes.sql`](sql/08_views_indexes.sql) |
| **Stored Procedures** | 11 procedures with `IN`/`OUT` parameters, error condition handlers, and dynamic SQL | [`sql/09_procedures_functions.sql`](sql/09_procedures_functions.sql) |
| **Stored Functions** | 10 deterministic scalar functions computing risk scores, custody duration, and hash checks | [`sql/09_procedures_functions.sql`](sql/09_procedures_functions.sql) |
| **Database Triggers** | 23 triggers (`BEFORE INSERT`, `AFTER INSERT`, `BEFORE UPDATE`, `AFTER UPDATE`, `BEFORE DELETE`) | [`sql/10_triggers.sql`](sql/10_triggers.sql) |
| **ACID Transactions** | Explicit `START TRANSACTION`, `COMMIT`, `ROLLBACK`, savepoints, and isolation level controls | [`sql/11_transactions.sql`](sql/11_transactions.sql) |
| **Database Security** | Least-privilege account creation (`CREATE USER`, `GRANT`, `REVOKE`, privilege isolation) | [`sql/13_security_privileges.sql`](sql/13_security_privileges.sql) |

*(Explore all 32 interactive demonstration queries directly from the UI's **SQL Demo** module).*

---

## 🔬 7 Scripted Forensic Demonstration Scenarios

During evaluation or laboratory demonstration, execute these 7 pre-seeded scenarios to prove real database integrity:

```
+-----------------------------------------------------------------------------------------+
| SCENARIO 1: Evidence Registration & SHA-256 Fingerprinting                              |
| Action : Register a new forensic memory dump.                                           |
| Result : File hash is computed instantly; metadata is stored in MySQL.                 |
+-----------------------------------------------------------------------------------------+
| SCENARIO 2: Cryptographic Tamper Detection                                              |
| Action : Click "Verify Integrity" on Evidence Item EV-0007 (deliberately modified byte). |
| Result : System detects SHA-256 mismatch; triggers critical TAMPER alert in MySQL.     |
+-----------------------------------------------------------------------------------------+
| SCENARIO 3: Automatic Row-Level Update Audit Trail                                      |
| Action : Update an investigator's clearance level.                                      |
| Result : AFTER UPDATE trigger writes old and new values to audit_logs as JSON.          |
+-----------------------------------------------------------------------------------------+
| SCENARIO 4: Deletion Interception & History Preservation                                |
| Action : Delete an active case assignment.                                              |
| Result : BEFORE DELETE trigger copies deleted row into audit trail before removal.      |
+-----------------------------------------------------------------------------------------+
| SCENARIO 5: Forensic Anomaly Detection Rules                                            |
| Action : Run background forensic scan.                                                  |
| Result : 11 rules detect off-hours activity, bulk updates, and orphan evidence.          |
+-----------------------------------------------------------------------------------------+
| SCENARIO 6: Legal Chain of Custody Transfer                                             |
| Action : Transfer evidence from Lead Investigator to Forensic Analyst.                  |
| Result : Atomic transaction validates authorizer and updates current custodian.         |
+-----------------------------------------------------------------------------------------+
| SCENARIO 7: Grounded AI Assistant (Zero Hallucination)                                  |
| Action : Ask "What suspicious activities happened today?".                              |
| Result : Answers generated strictly from real MySQL rows; zero invented data.           |
+-----------------------------------------------------------------------------------------+
```

---

## 🎙️ Top Viva Voce Defense Questions & Answers

### Q1: Why use database triggers instead of logging in FastAPI/Python?
> **Answer:** Application-level logging only records events that pass through web endpoints. If an attacker gains shell access or uses MySQL Workbench to execute `UPDATE evidence SET ...`, application logs remain blind. Triggers execute inside the **MySQL storage engine kernel** and cannot be bypassed, regardless of how the connection was made.

### Q2: How do you prevent an attacker from modifying the `audit_logs` table?
> **Answer:** Through **MySQL privilege separation**. The web application connects using the least-privilege account `ghost_app`. In [`sql/13_security_privileges.sql`](sql/13_security_privileges.sql), `ghost_app` is granted only `SELECT` privileges on `audit_logs`. Direct `INSERT`, `UPDATE`, and `DELETE` privileges are explicitly revoked. Only trigger definitions (`DEFINER = root`) have authority to append to the log.

### Q3: What ensures the chain of custody remains legally defensible?
> **Answer:** Every transfer is recorded as an immutable relational row linked by foreign keys to the authorizing officer and recipient. At each handoff, the physical file's SHA-256 digest is recomputed and compared against the baseline hash stored during intake.

### Q4: What normal form is the database in?
> **Answer:** The schema satisfies **Third Normal Form (3NF)**:
> 1. **1NF:** Every column contains atomic values, and every table has a defined primary key.
> 2. **2NF:** It is in 1NF and contains no partial functional dependencies (all non-key attributes are fully dependent on the primary key).
> 3. **3NF:** It is in 2NF and contains no transitive functional dependencies ($X \to Y$ and $Y \to Z$).

---

## 👥 Default Demonstration Credentials

| Role | Name | Email Address | Password | Clearance Level |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | System Administrator | `admin@ghosthunter.local` | `Admin@Ghost2026` | Level 5 (Director) |
| **Lead Investigator**| Vikram Mehta | `vikram.mehta@ghosthunter.local` | `Lead@Ghost2026` | Level 4 (Lead Investigator) |
| **Investigator** | Priya Sharma | `priya.sharma@ghosthunter.local` | `Priya@Ghost2026` | Level 3 (Senior Analyst) |
| **Investigator** | Rahul Verma | `rahul.verma@ghosthunter.local` | `Rahul@Ghost2026` | Level 2 (Field Investigator) |
| **Auditor** | Meera Iyer | `meera.iyer@ghosthunter.local` | `Audit@Ghost2026` | Level 1 (Read-Only Auditor) |

*(Quick-login buttons for each role are available on the web login screen).*

---

## 📖 Complete Documentation Index

All technical documentation is stored in the repository and accessible inside the web application:

| Document | Description |
| :--- | :--- |
| **[DOCKER.md](docs/DOCKER.md)** | Single-command Docker container guide, architecture, volume backups |
| **[API_REFERENCE.md](docs/API_REFERENCE.md)** | Full specification for all 43 REST API endpoints with request/response schemas |
| **[CONTRIBUTING.md](docs/CONTRIBUTING.md)** | Developer guidelines, code standards, test execution, PR process |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Detailed subsystem breakdown, request lifecycles, and component interactions |
| **[ER_DIAGRAM.md](docs/ER_DIAGRAM.md)** | Complete entity relationship diagram, relational mappings, and cardinality rules |
| **[SQL_EXPLANATION.md](docs/SQL_EXPLANATION.md)** | Comprehensive guide explaining every SQL script and query in the curriculum |
| **[AI_EXPLANATION.md](docs/AI_EXPLANATION.md)** | Mathematical breakdown of the 11 detection rules, scoring models, and AI engine |
| **[SECURITY.md](docs/SECURITY.md)** | Detailed threat modeling, privilege isolation, and vulnerability safeguards |
| **[DEMONSTRATION.md](docs/DEMONSTRATION.md)** | Step-by-step laboratory and faculty demonstration presentation guide |
| **[VIVA_QUESTIONS.md](docs/VIVA_QUESTIONS.md)** | 50 comprehensive viva voce examination questions with in-depth answers |
| **[TEST_RESULTS.md](docs/TEST_RESULTS.md)** | Formal automated test report detailing unit, integration, and security checks |
| **[TRACEABILITY.md](docs/TRACEABILITY.md)** | Academic requirement traceability matrix mapping requirements to test suites |

---

## 🧪 Automated Testing Benchmark

The automated test suite verifies 100% of relational, security, and API capabilities:

```bash
python -m pytest tests -v
```

```
============================= test session starts =============================
platform win32 -- Python 3.10.10, pytest-9.2.0, pluggy-1.7.0
collected 41 items

tests/test_connectivity_and_health.py::test_health_endpoint_structure_and_components PASSED [  2%]
tests/test_connectivity_and_health.py::test_health_endpoint_no_secrets_exposed PASSED        [  4%]
tests/test_connectivity_and_health.py::test_authenticated_core_connectivity PASSED          [  7%]
tests/test_ghost_hunter.py::test_schema_has_required_tables_and_objects PASSED               [  9%]
tests/test_ghost_hunter.py::test_sample_data_meets_minimums PASSED                             [ 12%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[03_basic_queries.sql] PASSED [ 14%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[04_constraints.sql] PASSED   [ 17%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[05_joins.sql] PASSED         [ 19%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[06_subqueries.sql] PASSED    [ 21%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[07_aggregate_queries.sql] PASSED [ 24%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[08_views_indexes.sql] PASSED [ 26%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[11_transactions.sql] PASSED  [ 29%]
tests/test_ghost_hunter.py::test_demo_sql_script_executes_without_errors[12_advanced_queries.sql] PASSED [ 31%]
tests/test_ghost_hunter.py::test_at_least_25_documented_queries PASSED                         [ 34%]
tests/test_ghost_hunter.py::test_1_normal_evidence_registration PASSED                         [ 36%]
tests/test_ghost_hunter.py::test_2_evidence_tampering_detected PASSED                          [ 39%]
tests/test_ghost_hunter.py::test_3_update_monitoring PASSED                                    [ 41%]
tests/test_ghost_hunter.py::test_4_delete_monitoring PASSED                                    [ 43%]
tests/test_ghost_hunter.py::test_5_suspicious_activity_detected PASSED                         [ 46%]
tests/test_ghost_hunter.py::test_5b_sample_incident_alerts PASSED                              [ 48%]
tests/test_ghost_hunter.py::test_6_chain_of_custody PASSED                                     [ 51%]
tests/test_ghost_hunter.py::test_7_ai_investigation_offline PASSED                             [ 53%]
tests/test_ghost_hunter.py::test_assistant_example_questions[...] PASSED (7 questions)          [ 70%]
tests/test_ghost_hunter.py::test_7b_llm_path_with_local_model_and_hallucination_guard PASSED   [ 73%]
tests/test_ghost_hunter.py::test_report_generation PASSED                                      [ 75%]
tests/test_ghost_hunter.py::test_dashboard_numbers_match_database PASSED                       [ 78%]
tests/test_ghost_hunter.py::test_sql_demo_catalog_runs_read_only PASSED                        [ 80%]
tests/test_ghost_hunter.py::test_unauthenticated_and_csrf PASSED                               [ 82%]
tests/test_ghost_hunter.py::test_login_lockout PASSED                                          [ 85%]
tests/test_ghost_hunter.py::test_role_based_access PASSED                                      [ 87%]
tests/test_ghost_hunter.py::test_browser_cannot_choose_identity PASSED                         [ 90%]
tests/test_ghost_hunter.py::test_upload_validation PASSED                                      [ 92%]
tests/test_ghost_hunter.py::test_app_account_cannot_rewrite_history PASSED                       [ 95%]
tests/test_ghost_hunter.py::test_privileged_account_still_blocked_by_triggers PASSED           [ 97%]
tests/test_ghost_hunter.py::test_sessions_store_only_token_hash PASSED                         [100%]

====================== 41 passed, 29 warnings in 41.66s =======================
```

---

## ⚖️ License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
