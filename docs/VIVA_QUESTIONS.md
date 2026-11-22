# Viva Preparation - 50 Questions and Answers

Answers are kept short so they can be spoken in 20-40 seconds. Project examples are in *italics*.

## A. DBMS fundamentals

**1. What is a DBMS and why use one instead of files?**
Software that stores data in an organised way and provides querying, integrity rules, concurrency control, security and recovery. Files cannot enforce rules like "evidence must belong to an existing case"; *MySQL enforces that with a foreign key*.

**2. What is a relational database?**
Data stored in tables (relations) of rows and columns, linked through keys. *investigators, cases, evidence and audit_logs are related tables.*

**3. Difference between DDL, DML, DCL and TCL?**
DDL defines structure (CREATE, ALTER, DROP). DML changes data (INSERT, UPDATE, DELETE, SELECT). DCL controls access (GRANT, REVOKE - *13_security_privileges.sql*). TCL controls transactions (COMMIT, ROLLBACK, SAVEPOINT - *11_transactions.sql*).

**4. What is a schema?**
The logical structure of a database: tables, columns, types, constraints, views, routines. *Our schema is `ghost_hunter`, created by 01_schema.sql.*

**5. Why MySQL 8 specifically?**
It enforces CHECK constraints (8.0.16+), supports JSON columns, window functions, CTEs, REGEXP_LIKE and `INSERT ... AS new ON DUPLICATE KEY UPDATE`, which the project uses.

## B. Keys

**6. What is a primary key?**
A column (or columns) that uniquely identifies each row; it cannot be NULL. *`evidence_id` in evidence.*

**7. What is a foreign key?**
A column that must match a primary key in another table, enforcing referential integrity. *`evidence.case_id` references `cases.case_id`, so evidence cannot point to a non-existent case.*

**8. Candidate key vs primary key vs surrogate key?**
Candidate keys are all minimal unique identifiers; one is chosen as primary. A surrogate key is an artificial number (AUTO_INCREMENT). *`case_id` is a surrogate key; `case_code` (CASE-001) is another candidate key, protected with UNIQUE.*

**9. What is a composite key?**
A key made of several columns. *`UNIQUE(case_id, investigator_id)` in case_assignments prevents assigning the same person twice.*

**10. Why ON DELETE RESTRICT instead of CASCADE?**
Forensic history must never disappear because a parent row is deleted. Also, MySQL does not fire triggers for cascaded deletes, so CASCADE would escape auditing.

## C. Constraints

**11. Name the constraints used.**
PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, CHECK, DEFAULT. *11 PKs, 20 FKs, 6 UNIQUE, 35 CHECKs.*

**12. Give an interesting CHECK constraint from the project.**
*`CHECK (REGEXP_LIKE(original_hash, '^[0-9a-f]{64}$'))` - only a valid SHA-256 can be stored;* and a multi-column check: a VERIFIED integrity check must have `actual_hash = expected_hash`.

**13. What does DEFAULT do?**
Supplies a value when none is given. *`case_status DEFAULT 'OPEN'`, `created_at DEFAULT CURRENT_TIMESTAMP`.*

**14. Can every rule be a constraint?**
No. "The original hash can never change" compares OLD and NEW values, so it is a BEFORE UPDATE trigger (*trg_evidence_protect_original_hash*).

## D. Normalisation

**15. What is normalisation?**
Organising tables to remove redundancy and update anomalies, by splitting data so each fact is stored once.

**16. Explain 1NF, 2NF, 3NF.**
1NF: atomic values, no repeating groups. 2NF: 1NF + no partial dependency on part of a composite key. 3NF: 2NF + no transitive dependency (non-key depending on non-key).

**17. Show 3NF in your project.**
*Investigator names are stored only in investigators; other tables keep investigator_id. The current custodian is not stored at all - it is derived from the latest custody transfer by fn_current_custodian().*

**18. Did you denormalise anywhere? Why?**
*`evidence.current_hash/integrity_status` cache the latest check for fast filtering (written in the same transaction as the history), and audit JSON stores historical snapshots, which must not change when the source row changes.*

## E. Queries, joins, subqueries, aggregates

**19. INNER vs LEFT JOIN?**
INNER returns only matching rows; LEFT returns all rows of the left table, with NULLs where there is no match. *LEFT JOIN keeps audit rows with no investigator - an INNER JOIN would hide direct-database tampering.*

**20. Where did you use RIGHT and CROSS JOIN?**
*RIGHT JOIN lists every investigator with their assignments (the auditor appears with NULLs). CROSS JOIN builds an investigator x risk-level matrix so zero counts appear.*

**21. What is a self join?**
Joining a table to itself. *Each custody transfer joined to the previous transfer of the same evidence to compute hours held.*

**22. Correlated vs non-correlated subquery?**
A non-correlated subquery runs once (e.g. `SELECT AVG(file_size_bytes)`). A correlated subquery references the outer row and runs per row (*latest integrity check per evidence*).

**23. EXISTS vs IN?**
IN compares with a list of values; EXISTS checks whether at least one row exists and stops early. *EXISTS finds cases changed without application identity.*

**24. Why can NOT IN be dangerous?**
If the subquery returns a NULL, `x NOT IN (...)` becomes unknown and returns no rows. *We use it on a NOT NULL column.*

**25. WHERE vs HAVING?**
WHERE filters rows before grouping; HAVING filters groups after aggregation. *`HAVING COUNT(*) >= 3` finds actors with 3+ deletes.*

**26. Name the aggregate functions used.**
COUNT, SUM, AVG, MIN, MAX (*evidence storage summary*), plus COUNT(DISTINCT) and WITH ROLLUP.

## F. Views, indexes, procedures, functions, triggers

**27. What is a view and why use one?**
A stored SELECT that behaves like a virtual table. It hides joins and gives one consistent definition. *The dashboard reads `vw_dashboard_stats`; the audit page reads `vw_audit_trail`.*

**28. What is an index? Downside?**
A data structure (B-tree) that speeds up searches. Downside: slower writes and extra storage. *`idx_audit_table_record (table_name, record_id)` makes "who modified this record" use an index - shown with EXPLAIN.*

**29. Stored procedure vs stored function?**
A function returns one value and can be used inside SELECT. A procedure is called with CALL, can have IN/OUT parameters, return result sets and manage transactions. *fn_current_custodian() vs sp_transfer_custody().*

**30. Why put business logic in procedures?**
The rules are enforced by the database for every client, and the app account can change history tables only through them (it has no direct INSERT/UPDATE/DELETE grant).

**31. What does SIGNAL do?**
Raises a custom error and aborts the statement. *`SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Receiver is not assigned to this case'`.*

**32. What is a trigger? BEFORE vs AFTER?**
Code that runs automatically on INSERT/UPDATE/DELETE. BEFORE can validate or block the change; AFTER reacts after it succeeded. *AFTER triggers write audit_logs; BEFORE triggers block edits of audit history and the original hash.*

**33. What are OLD and NEW?**
Row images inside a trigger: OLD = before the change (UPDATE/DELETE), NEW = after (INSERT/UPDATE). *They become old_values and new_values JSON.*

**34. How did you avoid recursive triggers?**
Audit triggers insert only into audit_logs, and audit_logs has no trigger that inserts anywhere - its triggers only block changes.

**35. How does a trigger know which investigator made the change?**
The backend authenticates the user, then runs `SET @app_investigator_id = <id>` on the same connection; triggers read that session variable. If it is NULL, the change came from outside the application. `USER()` also records the MySQL account.

## G. Transactions and ACID

**36. What is a transaction?**
A group of statements treated as one unit: all succeed (COMMIT) or none (ROLLBACK). *sp_register_evidence inserts evidence, custody and integrity rows in one transaction.*

**37. Explain ACID.**
Atomicity - all or nothing. Consistency - constraints always hold. Isolation - concurrent transactions do not interfere. Durability - committed data survives crashes.

**38. What is a SAVEPOINT?**
A marker inside a transaction to roll back part of it. *11_transactions.sql T4 keeps a note but undoes a status change.*

**39. What happens to audit rows if a transaction is rolled back?**
They are rolled back too, because the trigger ran inside the same transaction - nothing was committed, so nothing happened (*T3 shows 4 audit rows inside, 0 after ROLLBACK*).

**40. What isolation level does InnoDB use and where did you lock rows?**
REPEATABLE READ by default. *`SELECT ... FOR UPDATE` in sp_create_case prevents two cases getting the same CASE number; sp_apply_integrity_check locks the evidence row.*

## H. Digital forensics, SHA-256, chain of custody

**41. What is SHA-256?**
A cryptographic hash function producing a 256-bit (64 hex characters) fingerprint. Any change to the file, even one byte, gives a completely different hash, and it is infeasible to create a different file with the same hash.

**42. How does the system detect tampering?**
The SHA-256 is computed during upload and stored as the immutable `original_hash`. Verification recomputes the hash of the stored file; different = TAMPERED, file gone = MISSING. A new integrity_checks row is appended and an alert raised.

**43. Why is SHA-256 not encryption?**
Encryption is reversible with a key and hides content; hashing is one-way and proves integrity. The file stays readable.

**44. What is chain of custody and how is it enforced?**
The documented history of who held evidence, when and why, so it is admissible. *sp_transfer_custody allows only the current custodian or a lead/admin, checks the receiver is on the case, re-verifies the hash at hand-over, and triggers make the history append-only.*

**45. Why store passwords with bcrypt and not SHA-256?**
bcrypt is deliberately slow and salted, which makes brute-forcing stolen hashes expensive. SHA-256 is fast - good for file integrity, bad for passwords.

## I. AI and architecture

**46. How does anomaly detection work?**
It reads audit_logs, login_attempts and integrity_checks and applies 11 detectors: rules with configurable thresholds (e.g. 3 deletes in 60 min), a statistical z-score of hourly activity, and an optional IsolationForest. Each finding gets a score with a breakdown of factors.

**47. Rule-based vs statistical vs machine learning here?**
Rules are fixed conditions written by us. Statistics compare a value with a computed baseline (z-score). ML (IsolationForest) learns what "normal" looks like from the data itself, unsupervised; we label it clearly and treat it as a hint.

**48. How do you stop the AI assistant from inventing data or running dangerous SQL?**
The LLM never writes SQL. Questions are mapped to allowlisted intents; each intent runs fixed, parameterised, read-only queries; facts are shown separately; the LLM may only rephrase them; a guard flags codes not present in the facts.

**49. What if Ollama/the model is offline?**
Everything keeps working: SQL features, detection and risk scoring need no LLM; the assistant and reports use deterministic summaries; the UI shows "LLM offline".

**50. Explain the overall architecture in one minute.**
Browser UI (HTML/CSS/JS) calls a FastAPI backend. The backend authenticates via server-side sessions, sets the investigator identity on the MySQL connection and calls views and stored procedures using a least-privilege account. MySQL triggers write the audit trail; evidence files live on disk with SHA-256 in the database. An AI layer analyses the audit data and answers questions from verified facts, optionally phrased by a local LLM.

---

### Likely follow-ups
- *Can root still erase the logs?* Yes, a full administrator can drop triggers - documented in SECURITY.md; production needs external write-once log storage.
- *Why JSON for old/new values?* Different tables have different columns; JSON stores any row snapshot in one audit table and MySQL can query it (JSON_EXTRACT, JSON_TABLE).
- *Why not an ORM?* To keep SQL visible and explainable for a DBMS course; SQLAlchemy Core is used only for connections and bound parameters.
