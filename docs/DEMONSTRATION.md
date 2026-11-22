# Demonstration Guide (University Presentation)

Total time: about 20-25 minutes. Prepare beforehand:

```powershell
cd sql-ghost-hunter
.\.venv\Scripts\Activate.ps1
python backend\scripts\setup_database.py --yes     # fresh database + sample data (re-run before every demo)
python run.py                                      # keep this window open
```

Open http://127.0.0.1:8000 in the browser and MySQL Workbench (or a `mysql` prompt) connected as root to `ghost_hunter`. Keep a second PowerShell window open in the project folder.

---

## 1. Project introduction (1 min)
"SQL Ghost Hunter is a database forensics system. Its motto is *Every Database Change Leaves a Trace*. MySQL itself records every change with triggers, evidence files are protected by SHA-256 hashes, and an AI layer helps investigators understand suspicious behaviour."

## 2. Problem statement (1 min)
An insider changes a payroll record at 2 a.m., deletes colleagues from a case and edits an evidence file. Normally you notice only that "something changed". We want to answer: **who, what, when, old value, new value, was it suspicious, is the evidence still intact, and what happened to it over time?** (README table in section 1.)

## 3. Database architecture (2 min)
- Show `sql/01_schema.sql`: 7 required tables + 4 supporting tables (login_attempts, app_sessions, detection_rules, ai_alerts) - each provides a real feature.
- In the app: **SQL Demonstration -> Database tables**: 11 tables, 7 views, live row counts, columns.
- Point out: `original_hash CHAR(64)` with a REGEXP CHECK, JSON columns `old_values` / `new_values`, `ON DELETE RESTRICT`.

## 4. ER diagram (2 min)
**Documentation -> ER diagram & normalisation.** Explain 1:N (case -> evidence), M:N (cases <-> investigators via case_assignments), the three investigator roles in custody_transfers, why the current custodian is *derived* (3NF) and why `audit_logs.related_case_id` has no FK (history must survive deletion).

## 5. SQL concepts (3 min)
**SQL Demonstration -> Example queries**: run live
1. *INNER JOIN* - evidence with case and uploader.
2. *LEFT JOIN* - unidentified actors stay visible.
3. *Correlated subquery* - latest integrity check per evidence.
4. *HAVING* - actors with >= 3 deletes (shows the direct-DB attacker).
5. *JSON_TABLE* - exactly which fields of evidence 2 changed.

Then the **SQL concepts implemented** tab (checklist) and the **SQL scripts** tab (e.g. `04_constraints.sql`: each constraint REJECTED with its MySQL error number).
Optional in Workbench: run `sql/11_transactions.sql` and show T3 (rollback also removes the trigger's audit rows) and T5 (atomic procedure).

## 6. Trigger demonstration - TEST 3 & TEST 4 (3 min)
In Workbench (this is a *direct* database change, no application login):
```sql
USE ghost_hunter;
UPDATE cases SET priority = 'CRITICAL' WHERE case_id = 4;      -- TEST 3
INSERT INTO cases (case_code, case_title, created_by) VALUES ('CASE-900', 'Trigger demo case', 1);
DELETE FROM cases WHERE case_code = 'CASE-900';               -- TEST 4
SELECT log_id, action_type, table_name, record_id, investigator_id, db_user,
       old_values, new_values, risk_level
  FROM audit_logs ORDER BY log_id DESC LIMIT 3;
```
In the app: **Database Audit Logs**, Investigator = *UNIDENTIFIED (outside app)*, click the rows: old vs new values, MySQL account `root@localhost`, risk escalated. Then show it cannot be erased:
```sql
DELETE FROM audit_logs WHERE log_id = 1;   -- Error 1644: Audit history is append-only
```
Now repeat an update **through the app** (Investigations -> CASE-004 -> Edit -> change priority) and show that this audit row names the investigator and `ghost_app@localhost`.

## 7. Evidence registration - TEST 1 (2 min)
Log in as **Investigator (Priya)**. Evidence Management -> case CASE-001 -> choose any PDF -> *Register & hash*. Point out: SHA-256 shown, status VERIFIED, file stored under a random name, and three audit rows (evidence, custody, integrity) created by one stored procedure transaction. Try uploading a `.exe` or a text file renamed to `.pdf` -> rejected.

## 8. SHA-256 verification (1 min)
Open the new evidence -> *Verify integrity now* -> both hashes identical, VERIFIED, a new row in the verification history (append-only).

## 9. Tampering demonstration - TEST 2 (2 min)
In the second PowerShell window (use the evidence number of your upload, e.g. 11):
```powershell
python backend\scripts\simulate_tampering.py 11
```
(or open `storage\evidence\<file>` in an editor and change one character). Click *Verify integrity now* again: **TAMPERED**, red computed hash, original hash unchanged, history keeps the earlier VERIFIED check, and a **CRITICAL** alert is created. The pre-loaded item **EV-0007** already shows two failed checks (a row was removed from that CSV).
Optional: `python backend\scripts\simulate_tampering.py 11 --restore` and verify again -> VERIFIED, history shows the incident.

## 10. Chain of custody - TEST 6 (1 min)
Chain of Custody -> your evidence -> transfer to Rahul with a reason. The timeline shows previous and new custodian and the hash status at hand-over. Transfer again as Priya -> refused ("Only the current custodian..."), enforced inside `sp_transfer_custody`. In Workbench `UPDATE custody_transfers SET transfer_reason='x';` -> blocked by trigger.

## 11. AI anomaly detection - TEST 5 (3 min)
Log in as **Lead (Vikram)** -> **AI Security Analysis** -> *Run anomaly analysis*.
Walk through the pre-loaded incident of last night:
- `FAILED_LOGINS` - 6 failures on Rahul's account from 185.220.101.4, then a successful login (+20 possible takeover).
- `EVIDENCE_ACCESS_BURST` - 5 downloads across 3 cases in 18 minutes.
- `DIRECT_DB_CHANGE`, `REPEATED_DELETE`, `REPEATED_RECORD_CHANGE`, `SENSITIVE_MODIFICATION` - edits made directly in MySQL at 02:40-02:55.
- `HIGH_ACTIVITY_ZSCORE` (statistical) and `ISOLATION_FOREST` (ML) - labelled differently from rules.
For one alert, read the **score breakdown** (each factor and its points). Mention: explanations say *indicator for review, not proof*. Show the **Detection rules** tab (log in as admin to edit a threshold; the change itself is audited).
To create a fresh pattern live (TEST 5), in Workbench run the UPDATE of section 6 three more times on the same case, then *Run anomaly analysis* again -> new REPEATED_RECORD_CHANGE / DIRECT_DB_CHANGE alerts.

## 12. AI forensic assistant - TEST 7 (2 min)
**Forensic assistant** tab: ask *"Summarize the suspicious activities in Case 001."* Show: intent detected, summary/narrative (labelled AI or deterministic), **Verified facts retrieved from MySQL** with timestamps, and the source tables. Ask *"Who modified evidence 2?"* (old -> new description, UNIDENTIFIED, root@localhost) and *"Which investigation currently has the highest risk?"*.
If Ollama is not running, point out the *LLM offline* status: everything still works with deterministic summaries. Then **Investigation reports** -> CASE-001 -> facts, rule-based recommendations, AI section clearly separated; *Printable version*.

## 13. Final conclusion (1 min)
- Every change is captured **inside MySQL** (triggers), attributed to the authenticated investigator or flagged as outside the application.
- Evidence integrity is proven with SHA-256 against an immutable original hash; history is append-only.
- Chain of custody is enforced by stored procedures and protected by triggers.
- AI adds explainable detection and a fact-grounded assistant, and works offline.
- Limitation to mention honestly: a database administrator with full privileges can drop triggers; production systems add external, write-once log storage.

---

### Quick reset
If anything goes wrong during the demo: stop the server (Ctrl+C), `python backend\scripts\setup_database.py --yes`, `python run.py`.

### Account cheat-sheet
Admin `admin@ghosthunter.local` / `Admin@Ghost2026` · Lead `vikram.mehta@ghosthunter.local` / `Lead@Ghost2026` · Investigator `priya.sharma@ghosthunter.local` / `Priya@Ghost2026` · Investigator `rahul.verma@ghosthunter.local` / `Rahul@Ghost2026` · Auditor `meera.iyer@ghosthunter.local` / `Audit@Ghost2026` (also clickable on the login page).
