# Security Features

## 1. Controls implemented

| Area | Control | Where |
|---|---|---|
| Passwords | bcrypt, cost 12, per-password salt; long passwords pre-hashed; password policy for new accounts | `security/passwords.py` |
| Authentication | server-side sessions: random 256-bit token in an **HttpOnly, SameSite=Strict** cookie; only SHA-256(token) stored in `app_sessions`; expiry; logout and deactivation revoke immediately | `security/auth.py`, `routes/auth.py` |
| Brute force | 5 failures in 15 min -> HTTP 429 lockout (also for unknown e-mails, so it does not reveal which accounts exist); dummy bcrypt check for unknown users (timing) | `routes/auth.py` |
| Identity for auditing | investigator resolved from the session in MySQL, then `SET @app_investigator_id` on the same connection; browser-supplied IDs never used; extra JSON fields rejected (`extra="forbid"`) | `database.identity()`, `schemas` |
| Authorisation (RBAC) | ADMIN, LEAD_INVESTIGATOR, INVESTIGATOR, AUDITOR permission map; row-level case access with `fn_has_case_access`; repeated inside procedures (defence in depth) | `security/auth.py`, `09_procedures_functions.sql` |
| SQL injection | every value is a bound parameter (`:name`); dynamic column names only from server-side allowlists; no endpoint accepts SQL text; SQL demo runs fixed catalogue queries in `START TRANSACTION READ ONLY` | all services |
| Least privilege in MySQL | app connects as `ghost_app`: SELECT + EXECUTE, a few INSERT/UPDATE grants, **no** write access to audit/custody/integrity/evidence tables, no DDL | `13_security_privileges.sql` |
| Tamper resistance | triggers block UPDATE/DELETE on `audit_logs`, `integrity_checks`, `custody_transfers`; `original_hash` immutable; FKs `ON DELETE RESTRICT` | `10_triggers.sql`, `01_schema.sql` |
| File uploads | extension allowlist, **magic-byte content check**, UTF-8/NUL check for text, JSON parse check, size limit (`MAX_UPLOAD_MB`), streamed hashing, random UUID file names, path-containment check, files set read-only, rejected uploads deleted | `utils/files.py` |
| Downloads | access-checked, `Content-Disposition: attachment`, `nosniff`, audited as `EVIDENCE_DOWNLOAD` | `services/evidence.py` |
| CSRF | state-changing `/api/*` requests must send `X-Requested-With: GhostHunter` (cross-site forms cannot) + SameSite=Strict cookie | `main.py` |
| XSS | all dynamic text escaped in the UI; Markdown sanitised with DOMPurify; strict CSP `script-src 'self'` (no inline scripts); reports contain no scripts | `frontend/js/ui.js`, `main.py` |
| Headers | CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer, `Cache-Control: no-store` on API | `main.py` |
| Errors | database rule errors returned as short messages; other errors logged server-side, generic message to the client | `main.py` |
| Secrets | `.env` (git-ignored), `.env.example` without secrets; DB password passed via `connect_args`, never in a logged URL; no secrets in frontend | `config.py`, `.gitignore` |
| AI | LLM gets facts only, no credentials, cannot run SQL; intents allowlisted; hallucination guard | `ai/assistant.py` |

## 2. Application identity vs database identity

An investigator logging into the web app and a MySQL account are **different identities**. All application users share the MySQL account `ghost_app`. The investigator is therefore recorded through `@app_investigator_id`, set by the backend from the authenticated session. The trigger also stores `USER()` (the real MySQL account) and the client IP:

| Situation | investigator_id | db_user | Risk |
|---|---|---|---|
| change through the app | the investigator | ghost_app@localhost | normal |
| change in MySQL Workbench as root | NULL ("UNIDENTIFIED") | root@localhost | escalated + DIRECT_DB_CHANGE alert |

## 3. Known limitations (privileged administrators)

Auditing inside a database cannot fully protect against someone who controls the database server:
- A user with `SUPER`/`TRIGGER`/`DROP` privileges (e.g. root) can `DROP TRIGGER`, disable binary logs or edit the data files. The trigger-based audit trail detects *ordinary* direct changes (they are logged as UNIDENTIFIED) but not an administrator who first removes the triggers.
- Session variables can be set by any client: a privileged user connecting directly could `SET @app_investigator_id = 3` to impersonate an investigator. The `db_user` column still shows the real MySQL account, which is why it is displayed next to the investigator.
- Files on disk can be changed by anyone with OS access; this is **detected** (SHA-256) but not **prevented**.

Mitigations for production (beyond this project): separate DBA accounts with MFA, MySQL Enterprise Audit or the binary log shipped to a write-once (WORM) store, periodic export of audit hashes, OS-level permissions on the storage folder, HTTPS with `COOKIE_SECURE=true`, a reverse proxy with rate limiting.

## 4. Demo-only items
The sample accounts and their passwords are public in the README for the local demonstration. Delete or change them before any other use. The sample data uses `SET timestamp` to create a believable timeline; this is documented in `02_sample_data.sql`.
