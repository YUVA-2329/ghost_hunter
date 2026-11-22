// =====================================================================
// SQL Ghost Hunter - Interactive Help & Academic Explainer Data Store
// Master dataset for DBMS students, viva preparation, and demonstrations
// =====================================================================

export const UNDERSTAND_IN_30_SECONDS = {
  analogy: {
    title: "The School Ledger Analogy (5th-Standard Level)",
    text: `Imagine your school principal has a special golden notebook in which all student exam marks are recorded.

Normally, if someone sneaks into the teacher's room with an eraser, rubs out a mark of '45' and writes '95', the teacher might later suspect something is wrong, but cannot easily prove WHO changed it, WHAT the original mark was, WHEN it happened, or whether the report card file was secretly replaced.

SQL Ghost Hunter is like an invisible, vigilant camera and duplicate ledger built directly into the computer's database. The exact millisecond anyone tries to alter, insert, or delete any record, SQL Ghost Hunter's database triggers automatically write down:
1. Exactly WHO did it (both the logged-in investigator and the MySQL user account).
2. Exactly WHAT changed (saving the old value and the new value side-by-side in JSON).
3. Exactly WHEN it happened (to the second).
4. Whether digital evidence files were tampered with (using cryptographic SHA-256 digital fingerprints).
5. Whether the activity looks suspicious (using intelligent anomaly detection rules).`
  },
  concepts: [
    {
      term: "Database",
      icon: "sql",
      simple: "An organized digital filing cabinet where software safely stores records (like customer accounts, hospital patients, or police cases) in structured tables.",
      technical: "A structured relational storage system (RDBMS) governed by ACID properties (Atomicity, Consistency, Isolation, Durability) that organizes data into normalized tables with strict constraints, indexed keys, and relational integrity."
    },
    {
      term: "Database Security",
      icon: "shield",
      simple: "Locking the digital filing cabinet so only allowed people can open specific drawers, and preventing unauthorized people from reading or breaking the records.",
      technical: "The collective policies and technical controls—including authentication (bcrypt), role-based access control (RBAC), least-privilege user isolation, parameterization against SQL injection, and cryptographic protection—that protect the database against unauthorized access and integrity breaches."
    },
    {
      term: "Database Forensics",
      icon: "fingerprint",
      simple: "Acting like a digital detective to investigate a crime scene inside the computer: figuring out who touched the data, what they changed, and when they did it.",
      technical: "The scientific identification, preservation, reconstruction, and analysis of relational database events, transactions, and storage artifacts to produce an evidentiary trail that answers who, what, when, where, and how a database modification occurred."
    },
    {
      term: "Data Integrity",
      icon: "check",
      simple: "Making sure information stays 100% accurate, complete, and trustworthy, without anyone secretly altering or corrupting it.",
      technical: "The assurance of data accuracy, consistency, and immutability over its lifecycle, enforced at the relational layer via declarative constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, NOT NULL) and cryptographically via collision-resistant SHA-256 checksums."
    },
    {
      term: "Audit Log (Audit Trail)",
      icon: "audit",
      simple: "An un-erasable diary where every single update, delete, or new entry is written down the moment it happens.",
      technical: "An append-only forensic event log (`audit_logs`) populated automatically by MySQL `AFTER INSERT/UPDATE/DELETE` triggers that capture actor identity (`investigator_id`, `db_user`, `ip_address`), timestamps, and JSON-serialized old vs. new values."
    },
    {
      term: "Digital Evidence",
      icon: "evidence",
      simple: "Any computer file (like a spreadsheet, photo, email, or database backup) used as factual proof in an investigation.",
      technical: "Digital artifacts (files, binary objects, transaction logs) registered with a deterministic cryptographic hash (SHA-256), strict ownership metadata, and immutable chain of custody tracking under evidentiary standards (such as ISO/IEC 27037)."
    }
  ]
};

export const WHY_BUILT = {
  problemSummary: "In corporate enterprises, banks, hospitals, and government agencies, insider threats pose the greatest risk to data security. Employees with legitimate database credentials can silently alter payroll numbers, delete compliance records, or manipulate customer balances without leaving a trace in standard application logs.",
  scenarios: [
    {
      title: "Secret Financial Record Modification",
      desc: "An accountant modifies a salary column directly in the database from 50,000 to 95,000. Normal web logs show nothing because the web app was not used.",
      solution: "MySQL `AFTER UPDATE` triggers intercept the modification, capture the old value (50,000) and new value (95,000), log the database user, and flag an off-hours modification alert."
    },
    {
      title: "Silent Deletion of Evidence",
      desc: "A rogue investigator attempts to delete an incriminating digital evidence record before a courtroom trial.",
      solution: "Foreign keys with `ON DELETE RESTRICT` block cascading deletions, and `BEFORE DELETE` triggers reject deletion attempts on the audit log with Error 1644: 'Audit history is append-only'."
    },
    {
      title: "Physical Evidence Tampering on Disk",
      desc: "Someone opens a stored CSV or PDF evidence file on the server hard drive and changes a transaction amount.",
      solution: "The SHA-256 verification engine recalculates the hash. Because even a 1-character modification alters the entire cryptographic digest (Avalanche Effect), the system flags the file as TAMPERED immediately."
    },
    {
      title: "Unaccountable Evidence Handovers",
      desc: "Physical and digital evidence passes through multiple investigators. In court, the defense argues the evidence was tampered with during transfer.",
      solution: "The Chain of Custody module logs every handover with mandatory SHA-256 re-verification, recording sender, receiver, timestamp, and verification status in an immutable relational ledger."
    }
  ],
  comparison: {
    without: [
      "Changes to database records often go completely unnoticed",
      "Investigators cannot easily see what values existed before a change",
      "Direct database modifications (e.g. via MySQL Workbench) bypass web logs",
      "Evidence files can be modified on the file system without detection",
      "No verifiable proof of who held a piece of evidence at a specific time",
      "Detection of insider tampering requires days or weeks of manual log scraping"
    ],
    with: [
      "Every INSERT, UPDATE, and DELETE is captured automatically by MySQL triggers",
      "Old and new values are preserved side-by-side in structured JSON diffs",
      "Direct database bypass attacks are captured and flagged with investigator_id = NULL",
      "SHA-256 cryptographic hashes detect even a single-byte modification on disk",
      "Immutable, append-only Chain of Custody tracks every evidence handover",
      "11 anomaly detection rules immediately highlight suspicious activities and off-hours changes"
    ]
  },
  disclaimer: "Honest Academic Scope: While SQL Ghost Hunter provides defense-in-depth through MySQL triggers, cryptographic SHA-256 hashes, and least-privilege user isolation, no software system is 100% tamper-proof. If an attacker gains operating-system-level root or raw disk block write access, they can theoretically alter underlying disk storage or drop triggers. SQL Ghost Hunter guarantees that all modifications passing through the database engine leave an indelible trace and that evidence modifications on disk are cryptographically detectable."
};

export const MODULES_TOUR = [
  {
    id: "dashboard",
    name: "1. Executive Dashboard",
    route: "#/dashboard",
    icon: "dashboard",
    what: "The central mission control overview displaying high-level forensic metrics, recent activity charts, and system alerts.",
    why: "Investigators need an immediate snapshot of open cases, pending verifications, compromised evidence, and threat levels without writing manual SQL queries.",
    simple: "Like the dashboard of a car, showing you speed, fuel, and engine warning lights all in one clean screen.",
    technical: "Aggregates metrics via MySQL view `vw_dashboard_stats` and executes a recursive Common Table Expression (CTE) to plot a 14-day chronological activity trend on a Chart.js canvas.",
    tables: ["cases", "evidence", "ai_alerts", "audit_logs"],
    sqlConcepts: ["Views (`vw_dashboard_stats`)", "Recursive CTEs for date generation", "COUNT / SUM aggregates", "LEFT JOINs"],
    demoTip: "Point out the 'Compromised Evidence' badge (item EV-0007) and explain that the 14-day timeline is dynamically computed from actual database timestamps.",
    speech: "Here on the Dashboard, we get an instant overview of forensic posture. Notice the 14-day activity chart: this is powered by a recursive SQL CTE that generates date intervals and joins with `audit_logs`."
  },
  {
    id: "cases",
    name: "2. Investigations & Case Management",
    route: "#/cases",
    icon: "briefcase",
    what: "The hub for creating, tracking, and managing forensic investigation dossiers, assignment rosters, and status lifecycles.",
    why: "Evidence and audit logs must be tied to legal case codes (e.g., CASE-001) with defined priorities, statuses, and assigned investigators.",
    simple: "Like a police file folder that holds all documents, witness statements, and evidence for a specific incident.",
    technical: "Manages entities in `cases` table. Controls status transitions ('OPEN', 'IN_PROGRESS', 'CLOSED') and links team members via the many-to-many bridge table `case_assignments`.",
    tables: ["cases", "case_assignments", "investigators"],
    sqlConcepts: ["Primary Keys (`case_id`)", "Candidate Key (`case_code` UNIQUE)", "M:N Bridge (`case_assignments`)", "ENUM constraints"],
    demoTip: "Open 'Payroll Database Tampering' (CASE-001) to show assigned investigators, attached evidence items, and case priority.",
    speech: "In Case Management, we manage investigation dossiers. Each case has a unique surrogate integer primary key `case_id` alongside a business candidate key `case_code`. Team members are linked via an M:N bridge table `case_assignments`."
  },
  {
    id: "evidence",
    name: "3. Digital Evidence Management",
    route: "#/evidence",
    icon: "evidence",
    what: "The digital evidence vault where seized files, documents, and disk dumps are registered, cataloged, and stored.",
    why: "In legal forensics, every file must have a permanent baseline identity, origin source, file size, MIME type, and cryptographic seal.",
    simple: "Like the evidence room in a police station, where guns, bags, and phones are labeled with evidence tags.",
    technical: "Stored procedure `sp_register_evidence` wraps registration in an ACID transaction: inserts into `evidence`, sets baseline hash, logs initial custody, and creates the first verification record.",
    tables: ["evidence", "cases", "investigators"],
    sqlConcepts: ["Foreign Keys (`case_id` -> `cases`)", "Stored Procedure (`sp_register_evidence`)", "Regex CHECK constraints on SHA-256", "ON DELETE RESTRICT"],
    demoTip: "Show the evidence list, highlighting items that are VERIFIED (green) vs TAMPERED (red).",
    speech: "Every piece of digital evidence is registered through an atomic stored procedure `sp_register_evidence`. Notice that the 64-character SHA-256 hash is validated at the database level with a regular expression CHECK constraint."
  },
  {
    id: "integrity",
    name: "4. SHA-256 Integrity Verification",
    route: "#/integrity",
    icon: "fingerprint",
    what: "The cryptographic verification engine that compares a physical file's current hash on disk against its immutable sealed database hash.",
    why: "To mathematically prove whether an evidence file has remained untouched or if even a single byte was altered.",
    simple: "Like checking if the wax seal on a secret letter is broken or still intact.",
    technical: "Reads the file from disk, computes `hashlib.sha256()`, calls `sp_record_integrity_check`, and writes an immutable row to `integrity_checks`. Discrepancies immediately transition cached status to 'TAMPERED'.",
    tables: ["evidence", "integrity_checks"],
    sqlConcepts: ["Append-only triggers (`trg_integrity_bu/bd`)", "Audit triggers", "Before-and-after cryptographic comparison"],
    demoTip: "Click 'Verify Integrity Now' on item EV-0007 (payroll CSV) and show the instant TAMPERED detection with side-by-side hash comparison.",
    speech: "When I click 'Verify Integrity', the system reads the actual physical file, computes its current SHA-256 hash, and compares it with `original_hash`. For EV-0007, a single altered character causes a completely different hash—this is the cryptographic Avalanche Effect."
  },
  {
    id: "custody",
    name: "5. Chain of Custody",
    route: "#/custody",
    icon: "link",
    what: "The chronological, legally binding ledger of every investigator who has taken physical or digital possession of an evidence item.",
    why: "Without a continuous, un-tampered chain of custody, evidence is ruled inadmissible in a court of law.",
    simple: "Like a courier delivery sheet where every person who touches the package signs their name and timestamp.",
    technical: "Table `custody_transfers` records `evidence_id`, `from_investigator_id`, `to_investigator_id`, timestamp, and verification hash. Stored function `fn_current_custodian` queries the most recent transfer to satisfy 3NF.",
    tables: ["custody_transfers", "evidence", "investigators"],
    sqlConcepts: ["Stored Function (`fn_current_custodian`)", "Self-referencing joins on `investigators`", "Third Normal Form (3NF) adherence", "Append-only triggers"],
    demoTip: "Filter by evidence item EV-0001 to show the complete chronological handover history from Detective Sharma to Lead Vikram.",
    speech: "Notice our Chain of Custody. In relational theory, storing the current custodian directly on the evidence table violates Third Normal Form (3NF) because it creates a transitive dependency. Instead, we use stored function `fn_current_custodian` to dynamically query the latest transfer."
  },
  {
    id: "audit",
    name: "6. Database Audit Logs",
    route: "#/audit",
    icon: "audit",
    what: "The append-only forensic event log capturing every single data modification across all monitored tables.",
    why: "To maintain an immutable record of WHO changed WHAT, WHEN it happened, and whether the modification occurred inside the app or through direct database access.",
    simple: "An invisible video recorder that films every pencil mark and eraser touch in the database.",
    technical: "Populated automatically by MySQL `AFTER INSERT`, `AFTER UPDATE`, and `AFTER DELETE` triggers. Stores old and new row states as JSON objects in `old_values` and `new_values`. Enforces immutability via `BEFORE UPDATE/DELETE` triggers that raise SQLSTATE 45000.",
    tables: ["audit_logs", "investigators", "cases"],
    sqlConcepts: ["Row-level Triggers (`AFTER INSERT/UPDATE/DELETE`)", "JSON serialization (`JSON_OBJECT`)", "Immutability Triggers (`SIGNAL SQLSTATE '45000'`)", "LEFT JOIN to reveal bypasses"],
    demoTip: "Filter by action 'UPDATE', click 'View JSON Diff', and show the old vs. new values side by side in formatted JSON.",
    speech: "This is our core forensic feature: Database Audit Logs. Notice the JSON diffs: MySQL triggers automatically serialized the before-and-after row states directly inside the database engine. Even if someone connects via MySQL Workbench, our triggers capture them."
  },
  {
    id: "ai",
    name: "7. AI Security & Anomaly Detection",
    route: "#/ai",
    icon: "shield",
    what: "The threat detection engine that evaluates database audit events against 11 forensic anomaly detection rules.",
    why: "Human investigators cannot manually read tens of thousands of audit rows. An automated engine flags suspicious activity immediately.",
    simple: "A security guard dog that barks whenever someone sneaks around the office at midnight or tries to erase records.",
    technical: "Engine in `detector.py` evaluates 11 detectors: off-hours operations, high-frequency modifications (z-score), direct database bypasses (`investigator_id=NULL`), multi-evidence deletions, and rapid privilege escalations. Persists idempotent alerts to `ai_alerts`.",
    tables: ["ai_alerts", "detection_rules", "audit_logs"],
    sqlConcepts: ["Rule-based filtering", "Statistical Z-Score calculations", "UNIQUE constraints for deduplication (`fingerprint`)", "Risk score aggregation"],
    demoTip: "Click 'Run Anomaly Analysis' and review an alert to show the transparent, explainable point breakdown (Base Score + Off-Hours Penalty).",
    speech: "Our Anomaly Detection engine avoids opaque black-box AI. It provides fully explainable risk scores with mathematical point breakdowns so that every alert is transparent and defensible in court."
  },
  {
    id: "chat",
    name: "8. AI Forensic Assistant",
    route: "#/chat",
    icon: "sparkles",
    what: "An interactive conversational assistant that helps investigators query cases, understand SQL concepts, and summarize forensic findings.",
    why: "Enables investigators to ask natural language questions like 'Which evidence files are compromised?' and receive instant, grounded answers.",
    simple: "Like having a smart professor or detective partner sitting next to you answering your questions.",
    technical: "Queries the local Ollama LLM runtime (`llama3.2:3b` or fallback heuristic engine). Grounded strictly in factual relational data queried from MySQL views, eliminating hallucinations.",
    tables: ["cases", "evidence", "ai_alerts", "audit_logs"],
    sqlConcepts: ["Data grounding", "Schema introspection", "Zero-write read-only sandboxing"],
    demoTip: "Type: 'What evidence items are currently tampered?' and show how the assistant responds with EV-0007 details verified from MySQL.",
    speech: "Our AI Assistant is strictly grounded in database facts. It runs against local Ollama models with zero cloud dependencies and zero write access to the database."
  },
  {
    id: "sqldemo",
    name: "9. SQL Demonstration Lab",
    route: "#/sqldemo",
    icon: "sql",
    what: "An interactive, pedagogical SQL query laboratory with 31 pre-cataloged queries demonstrating the complete DBMS curriculum.",
    why: "Specifically designed for college demonstrations to prove that every major syllabus concept (joins, subqueries, CTEs, window functions, JSON) is actively used.",
    simple: "A live chemistry lab where you can run SQL experiments and see the results instantly on screen.",
    technical: "Executes cataloged, read-only SELECT queries through SQLAlchemy Core, providing query execution plans (`EXPLAIN`), timing metrics, and concept annotations.",
    tables: ["All 12 tables"],
    sqlConcepts: ["31 queries: Joins, Correlated Subqueries, Recursive CTEs, Window Functions (`ROW_NUMBER`), JSON_TABLE"],
    demoTip: "Select Query 81 ('Rank Evidence by Size per Case') to show an advanced window function executing live on MySQL 8.",
    speech: "This SQL Demonstration Lab contains 31 cataloged queries. For our DBMS faculty, we can run any query live—from simple INNER JOINs to recursive CTEs and window functions—and view the output and execution plan."
  },
  {
    id: "users",
    name: "10. User & Investigator Management",
    route: "#/users",
    icon: "users",
    what: "Administrative panel for managing investigator credentials, roles, badge numbers, and account lockouts.",
    why: "Forensic software requires strict user accountability, role assignments, and brute-force lockout safeguards.",
    simple: "The office directory where employee badges, keys, and job positions are managed.",
    technical: "Manages `investigators` table. Passwords hashed using bcrypt (12 rounds). Monitors `login_attempts` to automatically lock accounts after 5 consecutive failures in 15 minutes.",
    tables: ["investigators", "login_attempts", "app_sessions"],
    sqlConcepts: ["Bcrypt password hashing", "UNIQUE constraints on email and badge", "Brute-force lockout logic", "Session token expiration"],
    demoTip: "Show the four built-in demonstration users representing each of the four roles.",
    speech: "In User Management, we implement secure credentials using bcrypt with 12 salt rounds. We also track failed login attempts to lock out brute-force attacks automatically."
  },
  {
    id: "rbac",
    name: "11. Role-Based Access Control (RBAC)",
    route: "#/rbac",
    icon: "shield",
    what: "The permissions engine enforcing who can create cases, register evidence, transfer custody, or run anomaly scans.",
    why: "Different personnel have different authority levels: an Auditor should only read data, while an Admin can manage users.",
    simple: "Different keys for different doors: the guard has a master key, but the visitor only gets into the lobby.",
    technical: "Enforces 4 distinct roles: `ADMIN`, `LEAD_INVESTIGATOR`, `INVESTIGATOR`, and `AUDITOR`. Permissions checked on both backend API routes and frontend UI rendering.",
    tables: ["investigators", "case_assignments"],
    sqlConcepts: ["Authorization matrix", "Case-level row security (`fn_has_case_access`)", "Principle of Least Privilege"],
    demoTip: "Log out and sign in as Auditor (Meera Iyer) to demonstrate that 'Register Evidence' and 'New Case' buttons disappear.",
    speech: "Our RBAC system enforces the Principle of Least Privilege across four roles. Notice that Auditors have strictly read-only access, preventing any state modification."
  },
  {
    id: "reports",
    name: "12. Forensic Reports & Documentation",
    route: "#/reports",
    icon: "report",
    what: "Official investigation report generation module for summarizing findings, case timelines, and evidence status for legal review.",
    why: "Investigators must produce standardized, timestamped forensic reports that can be submitted to management or courts.",
    simple: "Printing the final case report card with all findings and the investigator's signature.",
    technical: "Generates structured JSON and printable reports. Computes composite risk scores from associated alerts and stores immutable report snapshots in `investigation_reports`.",
    tables: ["investigation_reports", "cases", "evidence", "ai_alerts"],
    sqlConcepts: ["Aggregations", "JSON document storage", "Non-repudiation audit triggers"],
    demoTip: "Open an existing report for CASE-001 to show the executive summary, evidence integrity roster, and risk assessment.",
    speech: "Finally, the Reports module generates court-admissible forensic dossiers combining case summaries, evidence hash verification logs, and detected anomaly breakdowns."
  }
];

export const WORKFLOW_STEPS = [
  { step: 1, title: "1. Investigator Authentication", role: "Investigator / Admin", tech: "FastAPI + Bcrypt + app_sessions", whatUserSees: "A modern login screen with user selection chips. User enters email and password.", behindScenes: "Password verified with `bcrypt.checkpw()`. A secure cryptographic session token is generated, stored in `app_sessions`, and returned as an HTTP-only SameSite cookie." },
  { step: 2, title: "2. Connection Context & Identity Injection", role: "Database Engine", tech: "SQLAlchemy + MySQL User Variables", whatUserSees: "The application transitions seamlessly to the Dashboard.", behindScenes: "On connection checkout, the backend executes `SET @app_investigator_id = :uid, @app_client_ip = :ip`. This allows downstream MySQL triggers to attribute modifications directly to the logged-in investigator." },
  { step: 3, title: "3. Case Creation & Dossier Initialization", role: "Lead Investigator", tech: "sp_create_case + cases table", whatUserSees: "User fills out case title, description, and priority ('CRITICAL', 'HIGH', etc.).", behindScenes: "Stored procedure `sp_create_case` generates a new row in `cases`, auto-assigns the creator as lead in `case_assignments`, and writes an initial audit record." },
  { step: 4, title: "4. Digital Evidence Registration & Hashing", role: "Investigator", tech: "sp_register_evidence + hashlib.sha256", whatUserSees: "Investigator uploads or registers a file with filename, source device, and seizure location.", behindScenes: "Backend computes the 64-character SHA-256 hash. `sp_register_evidence` runs an atomic 3-step transaction: inserts into `evidence`, sets baseline `integrity_checks`, and creates initial `custody_transfers`." },
  { step: 5, title: "5. Database Trigger Monitoring (Active Defense)", role: "MySQL Engine", tech: "AFTER INSERT/UPDATE/DELETE Triggers", whatUserSees: "Any subsequent edit to case details, evidence metadata, or custody records.", behindScenes: "Triggers automatically capture old and new row states using `OLD.*` and `NEW.*`, convert them into JSON via `JSON_OBJECT()`, and insert an immutable record into `audit_logs`." },
  { step: 6, title: "6. Append-Only Immutability Enforcement", role: "Database Triggers", tech: "SIGNAL SQLSTATE '45000'", whatUserSees: "If an attacker or rogue user executes `DELETE FROM audit_logs` or `UPDATE audit_logs`.", behindScenes: "Triggers `trg_audit_bu` and `trg_audit_bd` abort the query with MySQL Error 1644: 'Audit history is append-only'. The data cannot be erased or modified." },
  { step: 7, title: "7. Periodic / On-Demand Integrity Verification", role: "Investigator / Cron", tech: "hashlib.sha256 + integrity_checks", whatUserSees: "Investigator clicks 'Verify Integrity Now' on an evidence card.", behindScenes: "The server reads the physical file, calculates its current SHA-256 hash, and compares it with `original_hash`. If hashes match: status is VERIFIED. If hashes differ: status is updated to TAMPERED and an alert is flagged." },
  { step: 8, title: "8. Chain of Custody Transfer", role: "Current Custodian -> Receiver", tech: "sp_transfer_custody + fn_current_custodian", whatUserSees: "Current custodian selects a recipient investigator and transfer reason, then confirms.", behindScenes: "Stored procedure validates caller authorization using `fn_current_custodian(eid)`, re-verifies file hash, and appends a new record to `custody_transfers`." },
  { step: 9, title: "9. Anomaly Detection & Threat Scoring", role: "AI Security Engine", tech: "detector.py + ai_alerts table", whatUserSees: "Investigator clicks 'Run Anomaly Analysis' or automated cron fires.", behindScenes: "Engine scans recent `audit_logs` against 11 detection rules. Computes risk scores (0-100), hashes alert fingerprints to prevent duplicates, and upserts alerts into `ai_alerts`." },
  { step: 10, title: "10. Forensic Dossier Synthesis & Reporting", role: "Investigator / Lead", tech: "investigation_reports + LLM Assistant", whatUserSees: "Investigator views the complete case timeline, alert breakdown, and generates a final report.", behindScenes: "System compiles all evidence statuses, custody transfers, and anomaly scores into `investigation_reports`, creating a permanent snapshot for court submission." },
  { step: 11, title: "11. Academic Syllabus & SQL Concept Verification", role: "Student / Faculty", tech: "SQL Demonstration Lab", whatUserSees: "Student runs live queries, execution plans, and concept checklists during viva.", behindScenes: "Queries execute parameterized SQL demonstrating 3NF normalization, CTEs, joins, window functions, and views directly on live MySQL data." }
];

export const DATABASE_EXPLAINER = {
  dbName: "ghost_hunter",
  storageEngine: "InnoDB",
  charset: "utf8mb4",
  collation: "utf8mb4_unicode_ci",
  tables: [
    {
      name: "investigators",
      purpose: "Stores user accounts, credentials, badge numbers, roles, and account lockout status.",
      pk: "investigator_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "None (Parent table)",
      relationships: "1:N with `cases` (as creator), 1:N with `case_assignments`, 1:N with `audit_logs` (actor), 1:N with `custody_transfers`",
      constraints: "UNIQUE(email), UNIQUE(badge_number), CHECK(role IN ('ADMIN','LEAD_INVESTIGATOR','INVESTIGATOR','AUDITOR'))",
      sample: { investigator_id: 1, full_name: "Dr. Ananya Rao", email: "admin@ghosthunter.local", role: "ADMIN", badge_number: "GH-001" }
    },
    {
      name: "cases",
      purpose: "Stores forensic investigation dossiers, operational status, priority, and lead ownership.",
      pk: "case_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "created_by -> investigators(investigator_id) ON DELETE RESTRICT",
      relationships: "1:N with `evidence`, 1:N with `case_assignments`, 1:N with `investigation_reports`",
      constraints: "UNIQUE(case_code), CHECK(status IN ('OPEN','IN_PROGRESS','CLOSED','ARCHIVED')), CHECK(priority IN ('CRITICAL','HIGH','MEDIUM','LOW'))",
      sample: { case_id: 1, case_code: "CASE-001", title: "Payroll Database Tampering", priority: "CRITICAL", status: "OPEN" }
    },
    {
      name: "case_assignments",
      purpose: "M:N junction bridge table linking investigators to the cases they are authorized to work on.",
      pk: "assignment_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "case_id -> cases(case_id), investigator_id -> investigators(investigator_id)",
      relationships: "Bridge table resolving many-to-many relationship between `cases` and `investigators`",
      constraints: "UNIQUE(case_id, investigator_id), CHECK(assignment_status IN ('ACTIVE','REMOVED'))",
      sample: { assignment_id: 1, case_id: 1, investigator_id: 2, case_role: "LEAD", assignment_status: "ACTIVE" }
    },
    {
      name: "evidence",
      purpose: "Core digital evidence catalog storing file metadata, seizure details, and cryptographic hashes.",
      pk: "evidence_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "case_id -> cases(case_id) ON DELETE RESTRICT, submitted_by -> investigators(investigator_id)",
      relationships: "1:N with `custody_transfers`, 1:N with `integrity_checks`",
      constraints: "UNIQUE(evidence_code), CHECK(REGEXP_LIKE(original_hash, '^[0-9a-f]{64}$')), CHECK(integrity_status IN ('VERIFIED','COMPROMISED','UNCHECKED'))",
      sample: { evidence_id: 1, evidence_code: "EV-0001", filename: "payroll_dump_tampered.csv", original_hash: "a1b2c3d4...", integrity_status: "VERIFIED" }
    },
    {
      name: "custody_transfers",
      purpose: "Append-only chronological chain of custody logging every transfer of evidence possession.",
      pk: "transfer_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "evidence_id -> evidence(evidence_id), from_investigator_id -> investigators, to_investigator_id -> investigators",
      relationships: "Belongs to `evidence`, joins two `investigators` (sender and receiver)",
      constraints: "Append-only triggers reject UPDATE and DELETE; CHECK(to_investigator_id != from_investigator_id)",
      sample: { transfer_id: 1, evidence_id: 1, from_investigator_id: 1, to_investigator_id: 2, reason: "Initial seizure intake" }
    },
    {
      name: "integrity_checks",
      purpose: "Append-only log of every SHA-256 verification execution for evidence files.",
      pk: "check_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "evidence_id -> evidence(evidence_id), performed_by -> investigators",
      relationships: "Belongs to `evidence`, captures point-in-time cryptographic check result",
      constraints: "Append-only triggers reject UPDATE and DELETE; CHECK(check_result IN ('MATCH','MISMATCH','ERROR'))",
      sample: { check_id: 1, evidence_id: 1, computed_hash: "a1b2c3d4...", check_result: "MATCH" }
    },
    {
      name: "audit_logs",
      purpose: "Master forensic audit trail capturing every INSERT, UPDATE, DELETE in the database.",
      pk: "log_id (BIGINT UNSIGNED AUTO_INCREMENT)",
      fks: "investigator_id -> investigators (nullable to capture direct DB bypasses)",
      relationships: "Central security event repository linked to investigators and cases",
      constraints: "Append-only triggers reject UPDATE and DELETE; JSON columns for old_values and new_values",
      sample: { log_id: 1, table_name: "cases", action: "UPDATE", db_user: "ghost_app@localhost", old_values: '{"status":"OPEN"}', new_values: '{"status":"IN_PROGRESS"}' }
    },
    {
      name: "login_attempts",
      purpose: "Security table recording successful and failed authentication attempts for brute-force defense.",
      pk: "attempt_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "investigator_id -> investigators (nullable for unknown email attempts)",
      relationships: "Tracks authentication telemetry for rate-limiting and alerting",
      constraints: "CHECK(is_successful IN (0, 1)), indexed on (email, attempted_at) for fast lockout checks",
      sample: { attempt_id: 1, email: "admin@ghosthunter.local", ip_address: "127.0.0.1", is_successful: 1 }
    },
    {
      name: "app_sessions",
      purpose: "Stores active cryptographic user session tokens and expiration timestamps.",
      pk: "session_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "investigator_id -> investigators(investigator_id) ON DELETE CASCADE",
      relationships: "Tracks logged-in state across HTTP requests",
      constraints: "UNIQUE(session_token), indexed on (session_token, expires_at)",
      sample: { session_id: 1, investigator_id: 1, session_token: "d4e5f6...", is_active: 1 }
    },
    {
      name: "detection_rules",
      purpose: "Catalog of 11 anomaly detection rules, severities, base scores, and threshold parameters.",
      pk: "rule_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "None (Configuration catalog)",
      relationships: "1:N with `ai_alerts` (identifies which rule triggered the alert)",
      constraints: "UNIQUE(rule_code), CHECK(severity IN ('CRITICAL','HIGH','MEDIUM','LOW'))",
      sample: { rule_id: 1, rule_code: "OFF_HOURS_MODIFICATION", name: "Off-Hours Activity", base_score: 30 }
    },
    {
      name: "ai_alerts",
      purpose: "Stores detected security anomalies, explainable score breakdowns, and investigation triage status.",
      pk: "alert_id (INT UNSIGNED AUTO_INCREMENT)",
      fks: "rule_id -> detection_rules(rule_id), case_id -> cases(case_id)",
      relationships: "Ties suspicious audit events to specific rules and cases",
      constraints: "UNIQUE(fingerprint) for duplicate suppression, CHECK(status IN ('NEW','ACKNOWLEDGED','INVESTIGATING','RESOLVED','DISMISSED'))",
      sample: { alert_id: 1, rule_id: 1, risk_score: 85, fingerprint: "f1a2b3...", status: "NEW" }
    }
  ],
  views: [
    { name: "vw_dashboard_stats", purpose: "Computes global forensic statistics (total cases, open cases, compromised evidence, high risk alerts) in one fast query." },
    { name: "vw_case_summary", purpose: "Calculates aggregated case risk scores, open alert counts, and compromised file totals using correlated subqueries." },
    { name: "vw_audit_trail", purpose: "Flattens audit records, joining investigator names and case codes while cleanly preserving unidentified direct-DB modifications via LEFT JOIN." },
    { name: "vw_evidence_overview", purpose: "Presents comprehensive evidence metadata combined with derived evidence_code, current custodian name, and latest integrity check timestamps." },
    { name: "vw_custody_history", purpose: "Chronological chain of custody view joining sender, receiver, and handover verification results." },
    { name: "vw_integrity_history", purpose: "Chronological cryptographic verification log detailing computed SHA-256 vs baseline hashes and MATCH/MISMATCH statuses." },
    { name: "vw_investigator_activity", purpose: "Aggregates investigator activity metrics, login histories, and assigned caseloads for administration." }
  ],
  storedProcedures: [
    { name: "sp_create_case", purpose: "Atomically creates a new investigation case, sets initial status, assigns the creator as lead investigator, and writes the audit trail." },
    { name: "sp_update_case_status", purpose: "Updates a case's lifecycle status with validation, ensuring closed cases cannot have new evidence added." },
    { name: "sp_register_evidence", purpose: "Runs an atomic 3-step transaction: registers the file in `evidence`, creates initial custody record, and logs baseline SHA-256 verification." },
    { name: "sp_transfer_custody", purpose: "Validates that the current caller is authorized to transfer the item, re-hashes the file, and logs the append-only transfer record." },
    { name: "sp_record_integrity_check", purpose: "Records a new verification check in `integrity_checks`, updates cached status in `evidence`, and flags alerts if tampering is detected." },
    { name: "sp_log_app_event", purpose: "Helper procedure for application-level events (logins, evidence downloads, report exports, AI queries)." }
  ],
  storedFunctions: [
    { name: "fn_current_custodian(eid)", returns: "INT UNSIGNED", purpose: "Queries `custody_transfers` for evidence `eid`, ordering by `transfer_timestamp DESC, transfer_id DESC LIMIT 1` to return the investigator_id who currently holds the item (satisfies 3NF)." },
    { name: "fn_has_case_access(uid, cid)", returns: "TINYINT(1)", purpose: "Evaluates whether user `uid` has access to case `cid` (Admin/Leads have global access; Investigators must be assigned in `case_assignments`)." },
    { name: "fn_calculate_risk_score(eid)", returns: "INT", purpose: "Calculates a composite forensic risk score for an evidence item based on failed checks and suspicious transfer patterns." }
  ],
  triggers: [
    { name: "trg_cases_ai / au / ad", timing: "AFTER INSERT / UPDATE / DELETE", table: "cases", purpose: "Logs case creation, status/priority changes, and deletion to `audit_logs` with old/new JSON diffs." },
    { name: "trg_evidence_protect_original_hash", timing: "BEFORE UPDATE", table: "evidence", purpose: "Enforces that `NEW.original_hash = OLD.original_hash`. If anyone attempts to alter it, throws MySQL Error 1644." },
    { name: "trg_evidence_ai / au / ad", timing: "AFTER INSERT / UPDATE / DELETE", table: "evidence", purpose: "Audits evidence metadata modifications." },
    { name: "trg_custody_bu / bd", timing: "BEFORE UPDATE / DELETE", table: "custody_transfers", purpose: "Enforces append-only immutability. Any UPDATE or DELETE raises SQLSTATE 45000: 'Custody history is append-only'." },
    { name: "trg_integrity_bu / bd", timing: "BEFORE UPDATE / DELETE", table: "integrity_checks", purpose: "Enforces that verification history cannot be altered or purged." },
    { name: "trg_audit_bu / bd", timing: "BEFORE UPDATE / DELETE", table: "audit_logs", purpose: "Guarantees the forensic audit trail is immutable, rejecting all UPDATE and DELETE queries." }
  ]
};

export const TECH_STACK = [
  { tech: "MySQL 8.0", simple: "The digital filing cabinet that safely stores all information in organized tables.", technical: "Relational DBMS providing InnoDB ACID transactions, declarative CHECK constraints, JSON diff columns, stored routines, views, and automated audit triggers." },
  { tech: "Python 3.10+", simple: "The programming language that runs the behind-the-scenes logic of the application.", technical: "High-performance backend runtime driving asynchronous API endpoints, hashing pipelines, and threat detection algorithms." },
  { tech: "FastAPI", simple: "The bridge connecting web browser clicks to backend Python code.", technical: "Modern, high-performance ASGI web framework providing Pydantic-based request validation, automated OpenAPI docs, and strict async route execution." },
  { tech: "SQLAlchemy Core", simple: "The translator helping Python talk to MySQL safely.", technical: "Python SQL abstraction layer utilizing parameterized SQL queries (`:param`) to guarantee 100% immunity against SQL injection attacks." },
  { tech: "PyMySQL & Cryptography", simple: "The connection cable linking Python to MySQL Server 8.", technical: "Pure-Python MySQL client supporting MySQL 8 `caching_sha2_password` authentication and binary protocol transactions." },
  { tech: "Vanilla JavaScript (ES Modules)", simple: "Makes the website interactive and responsive without slow page reloads.", technical: "Modern ECMAScript client-side architecture with native module imports, hash-based client routing, and zero third-party framework overhead." },
  { tech: "HTML5 & CSS3", simple: "Builds the layout, buttons, colors, and beautiful glass appearance of the website.", technical: "Semantic markup and modern CSS3 featuring CSS Custom Properties, Flexbox/Grid layouts, and hardware-accelerated `backdrop-filter` glassmorphism." },
  { tech: "Chart.js", simple: "Draws the interactive 14-day activity line graphs and risk pie charts.", technical: "Client-side HTML5 canvas data visualization library bundled locally for offline execution." },
  { tech: "SHA-256", simple: "Creates an un-fakeable mathematical fingerprint of every digital file.", technical: "NIST FIPS 180-4 collision-resistant cryptographic hash function generating deterministic 256-bit (64-character hex) digests." },
  { tech: "Bcrypt", simple: "Scrambles user passwords so even database administrators cannot read them.", technical: "Adaptive, salted cryptographic password hashing algorithm (12 rounds) designed to resist GPU-based brute-force cracking." },
  { tech: "scikit-learn (Optional)", simple: "Math library that looks for odd patterns in investigator behavior.", technical: "Machine learning library providing unsupervised `IsolationForest` anomaly detection over multi-dimensional activity features." },
  { tech: "Ollama (Optional)", simple: "Runs AI language models locally on your computer without sending data to the cloud.", technical: "Local open-weight LLM runtime (`llama3.2:3b`) queried via HTTP for natural language narrative synthesis without API costs." }
];

export const CORE_WEB_CONCEPTS = [
  { concept: "Frontend vs Backend vs Database", explanation: "The **Frontend** (HTML/CSS/JS) is what the user sees in the browser. The **Backend** (Python FastAPI) is the brain that enforces security rules and runs business logic. The **Database** (MySQL 8) is the vault that reliably stores and protects all permanent records." },
  { concept: "API & REST", explanation: "An **API (Application Programming Interface)** is the defined contract for communication. **REST** uses standard HTTP methods: `GET` to read, `POST` to create, `PATCH/PUT` to update, and `DELETE` to remove resources." },
  { concept: "Authentication vs Authorization", explanation: "**Authentication (AuthN)** verifies *WHO you are* (entering correct email and password). **Authorization (AuthZ)** verifies *WHAT you are allowed to do* (e.g. an Investigator cannot delete users; only an Admin can)." },
  { concept: "Hashing vs Encryption", explanation: "**Hashing** is a one-way street: `data -> hash` (cannot be reversed; used for passwords and file integrity). **Encryption** is a two-way street: `plaintext -> ciphertext -> plaintext` using a secret key (can be decrypted)." }
];

export const DICTIONARY_TERMS = [
  {
    "term": "DBMS",
    "cat": "DBMS & SQL",
    "simple": "Software that manages digital data files safely.",
    "tech": "Database Management System: software controlling data storage, retrieval, concurrency, and security.",
    "project": "MySQL 8 acts as our DBMS.",
    "example": "Like a librarian organizing books according to strict catalog rules."
  },
  {
    "term": "RDBMS",
    "cat": "DBMS & SQL",
    "simple": "A database that connects different tables using keys.",
    "tech": "Relational Database Management System based on Edgar Codd's relational model.",
    "project": "MySQL links cases, evidence, and investigators via relational keys.",
    "example": "Linking your student ID to your exam grades table."
  },
  {
    "term": "SQL",
    "cat": "DBMS & SQL",
    "simple": "The standard language used to talk to relational databases.",
    "tech": "Structured Query Language: domain-specific declarative language for managing relational data.",
    "project": "All queries, stored procedures, triggers, and views are written in SQL.",
    "example": "Giving a precise verbal instruction to the librarian to fetch a specific book."
  },
  {
    "term": "Primary Key",
    "cat": "DBMS & SQL",
    "simple": "A unique identifier so no two rows get mixed up.",
    "tech": "A column or set of columns with unique, non-null values that uniquely identifies each entity.",
    "project": "evidence_id uniquely identifies every piece of evidence.",
    "example": "Your unique Aadhaar or Social Security Number."
  },
  {
    "term": "Foreign Key",
    "cat": "DBMS & SQL",
    "simple": "A column pointing to the primary key of another table.",
    "tech": "A referential constraint enforcing that a child value must match an existing primary key in the parent table.",
    "project": "evidence.case_id references cases.case_id.",
    "example": "Enrolling in a course code that must exist in the university course catalog."
  },
  {
    "term": "Candidate Key",
    "cat": "DBMS & SQL",
    "simple": "Any column that could have been chosen as the unique identifier.",
    "tech": "A minimal superkey whose subset is not a superkey; each candidate key can uniquely identify any tuple.",
    "project": "case_code ('CASE-001') is a natural candidate key alongside surrogate case_id.",
    "example": "Both your student ID number and passport number are candidate keys."
  },
  {
    "term": "Composite Key",
    "cat": "DBMS & SQL",
    "simple": "A primary key made of two or more columns combined together.",
    "tech": "A primary key composed of two or more attributes that together provide uniqueness.",
    "project": "UNIQUE(case_id, investigator_id) in case_assignments forms a composite identifier.",
    "example": "Combining Class Room Number + Seat Number to pinpoint one student."
  },
  {
    "term": "Surrogate Key",
    "cat": "DBMS & SQL",
    "simple": "An artificial counter number used as a primary key.",
    "tech": "A unique identifier with no intrinsic business meaning, typically an auto-incrementing integer or UUID.",
    "project": "case_id (INT UNSIGNED AUTO_INCREMENT).",
    "example": "A numbered token given to you at a clinic reception desk."
  },
  {
    "term": "Referential Integrity",
    "cat": "DBMS & SQL",
    "simple": "Ensures relationships between tables never break or leave orphan records.",
    "tech": "Relational rule that foreign key references must match valid parent primary keys or be NULL.",
    "project": "Enforced via FOREIGN KEY ... ON DELETE RESTRICT.",
    "example": "Preventing an order from existing if the customer account was deleted."
  },
  {
    "term": "Normalization",
    "cat": "DBMS & SQL",
    "simple": "Organizing tables to eliminate redundant duplicate data.",
    "tech": "The systematic decomposition of relational tables to reduce data redundancy and eliminate anomalies.",
    "project": "Schema is fully normalized to Third Normal Form (3NF).",
    "example": "Storing an investigator's phone once in investigators instead of repeating it in every case."
  },
  {
    "term": "1NF (First Normal Form)",
    "cat": "DBMS & SQL",
    "simple": "Every cell has only one single value, no lists or multiple values.",
    "tech": "Attributes contain atomic values and each record in the relation is unique.",
    "project": "Zero comma-separated strings; case team members are split into individual assignment rows.",
    "example": "Writing each hobby on a separate line rather than 'football, chess, tennis' in one box."
  },
  {
    "term": "2NF (Second Normal Form)",
    "cat": "DBMS & SQL",
    "simple": "In 1NF, and no partial dependencies on composite keys.",
    "tech": "Must be in 1NF and all non-key attributes must be fully functionally dependent on the entire primary key.",
    "project": "Non-key columns in case_assignments depend on the full composite key (case_id + investigator_id).",
    "example": "Not storing the course title inside the student enrollment table."
  },
  {
    "term": "3NF (Third Normal Form)",
    "cat": "DBMS & SQL",
    "simple": "In 2NF, and no non-key column depends on another non-key column.",
    "tech": "Must be in 2NF and contain no transitive functional dependencies (X -> Y, Y -> Z).",
    "project": "evidence table does not store current_custodian; it is dynamically queried via fn_current_custodian.",
    "example": "Not storing City and State in an Address table if ZIP code already determines them."
  },
  {
    "term": "ACID Properties",
    "cat": "DBMS & SQL",
    "simple": "The 4 golden rules of database reliability: All-or-nothing, Consistency, Isolation, Durability.",
    "tech": "Atomicity, Consistency, Isolation, Durability guarantees provided by RDBMS transaction managers.",
    "project": "Guaranteed by MySQL's InnoDB engine across all transactions.",
    "example": "An ATM transfer: deducting money from account A and adding to B must both succeed or both rollback."
  },
  {
    "term": "Transaction",
    "cat": "DBMS & SQL",
    "simple": "A bundle of steps executed as one single unit of work.",
    "tech": "A logical unit of database processing that includes one or more database access operations.",
    "project": "sp_register_evidence runs an atomic 3-table transaction.",
    "example": "Booking a flight: payment and seat reservation happen together."
  },
  {
    "term": "Commit",
    "cat": "DBMS & SQL",
    "simple": "Permanently saving changes made during a transaction.",
    "tech": "TCL operation that flushes transaction modifications to the write-ahead log and marks them permanent.",
    "project": "Executed at the end of stored procedures upon successful execution.",
    "example": "Clicking 'Save Document' and hearing the file write to disk."
  },
  {
    "term": "Rollback",
    "cat": "DBMS & SQL",
    "simple": "Undoing all changes if something goes wrong during a transaction.",
    "tech": "TCL operation that aborts the current transaction and reverts the database to its pre-transaction state.",
    "project": "Triggered in error handlers if any registration step fails.",
    "example": "Pressing 'Undo' in a text editor to remove mistakes."
  },
  {
    "term": "Database Trigger",
    "cat": "DBMS & SQL",
    "simple": "An automatic reaction that fires inside MySQL when data is changed.",
    "tech": "A stored procedural routine executed automatically in response to DML events (INSERT, UPDATE, DELETE).",
    "project": "AFTER UPDATE triggers automatically serialize row diffs to audit_logs.",
    "example": "A burglar alarm that rings instantly the moment a door is forced open."
  },
  {
    "term": "Stored Procedure",
    "cat": "DBMS & SQL",
    "simple": "A pre-saved program stored directly inside the database.",
    "tech": "A precompiled collection of SQL statements and procedural control logic stored in the database catalog.",
    "project": "sp_create_case, sp_register_evidence, sp_transfer_custody.",
    "example": "A microwave's preset 'Defrost' button running a 3-minute sequence."
  },
  {
    "term": "Stored Function",
    "cat": "DBMS & SQL",
    "simple": "A saved calculation inside MySQL that returns a single answer.",
    "tech": "A deterministic SQL routine that returns a scalar value and can be embedded directly in SELECT statements.",
    "project": "fn_current_custodian(evidence_id) returns the investigator_id.",
    "example": "A math function squareRoot(x) that returns a single number."
  },
  {
    "term": "Database View",
    "cat": "DBMS & SQL",
    "simple": "A saved query that acts and looks like a virtual table.",
    "tech": "A virtual relation defined by an underlying SQL query that is computed dynamically on demand.",
    "project": "vw_dashboard_stats, vw_case_summary, vw_audit_trail.",
    "example": "A customized student view showing only their own semester marks."
  },
  {
    "term": "Database Index",
    "cat": "DBMS & SQL",
    "simple": "A quick-lookup table of contents that makes searching lightning fast.",
    "tech": "A B-Tree data structure providing O(log N) lookup complexity instead of full table scans.",
    "project": "idx_audit_actor_time on audit_logs(investigator_id, timestamp).",
    "example": "The alphabetical index at the back of a 1,000-page encyclopedia."
  },
  {
    "term": "INNER JOIN",
    "cat": "DBMS & SQL",
    "simple": "Combines rows from two tables only when there is a match in both.",
    "tech": "Relational operator returning the Cartesian product restricted to tuples satisfying the join predicate.",
    "project": "Joins evidence with cases to display parent case metadata.",
    "example": "Listing students who have submitted their exam answer sheets."
  },
  {
    "term": "LEFT JOIN",
    "cat": "DBMS & SQL",
    "simple": "Keeps all rows from the left table, even if there is no match on the right.",
    "tech": "Outer join preserving all tuples of the left relation, substituting NULLs for non-matching right attributes.",
    "project": "Used in vw_audit_trail so direct database bypasses (investigator_id = NULL) are not hidden.",
    "example": "Listing all students, including those who have not enrolled in any clubs."
  },
  {
    "term": "Correlated Subquery",
    "cat": "DBMS & SQL",
    "simple": "An inner query that runs repeatedly using values from the outer query.",
    "tech": "A subquery that references attributes from the enclosing query and is evaluated once per candidate tuple.",
    "project": "Finds the latest integrity check timestamp for each evidence row in vw_case_summary.",
    "example": "Finding the highest scoring student in each separate section."
  },
  {
    "term": "CTE (Common Table Expression)",
    "cat": "DBMS & SQL",
    "simple": "A temporary named query used like a scratchpad table.",
    "tech": "A temporary result set defined using the WITH clause for the duration of a single execution.",
    "project": "Recursive CTE generates a 14-day calendar sequence for the dashboard chart.",
    "example": "Doing scratch work in the margin of your exam paper before writing the final answer."
  },
  {
    "term": "Window Function",
    "cat": "DBMS & SQL",
    "simple": "Calculates ranks or running totals without collapsing rows together.",
    "tech": "A function that calculates values over a partition of rows while preserving each row's individual identity.",
    "project": "ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY file_size_bytes DESC) in Query 81.",
    "example": "Printing each marathon runner's rank next to their name without deleting other runners."
  },
  {
    "term": "JSON_TABLE",
    "cat": "DBMS & SQL",
    "simple": "Converts unstructured JSON text into real relational rows and columns.",
    "tech": "MySQL 8 function that projects JSON data into relational tabular format with typed columns.",
    "project": "Unpacks old_values and new_values in audit_logs to inspect individual field diffs.",
    "example": "Converting a receipt JSON text into an Excel spreadsheet table."
  },
  {
    "term": "Audit Trail",
    "cat": "Forensics & Security",
    "simple": "An un-erasable diary of all database activities and changes.",
    "tech": "A chronological, append-only security log providing documentary evidence of data modifications.",
    "project": "audit_logs table with immutable triggers.",
    "example": "A bank statement listing every deposit, withdrawal, and transfer with timestamps."
  },
  {
    "term": "Digital Forensics",
    "cat": "Forensics & Security",
    "simple": "Using scientific detective work to investigate computer crimes.",
    "tech": "The recovery, investigation, and analysis of material found in digital devices related to cybercrime.",
    "project": "SQL Ghost Hunter acts as a digital forensics suite for relational databases.",
    "example": "Detectives examining digital tire tracks and fingerprints left in computer memory."
  },
  {
    "term": "SHA-256",
    "cat": "Forensics & Security",
    "simple": "A 64-character mathematical fingerprint of a digital file.",
    "tech": "NIST FIPS 180-4 cryptographic hash producing a 256-bit collision-resistant digest.",
    "project": "Stored in evidence.original_hash and integrity_checks.computed_hash.",
    "example": "Changing one comma in a 500-page book completely changes its 64-character hash."
  },
  {
    "term": "Avalanche Effect",
    "cat": "Forensics & Security",
    "simple": "Changing one single bit completely scrambles the output hash.",
    "tech": "Property of cryptographic hashes where a minor change in input yields a drastic, unpredictable change in output.",
    "project": "Demonstrated on EV-0007 when modifying one digit in the CSV.",
    "example": "A small pebble causing an entire mountainside snow avalanche."
  },
  {
    "term": "Chain of Custody",
    "cat": "Forensics & Security",
    "simple": "The complete history of who held an evidence item from start to finish.",
    "tech": "Chronological documentation showing custody, control, transfer, and analysis of evidence.",
    "project": "custody_transfers table governed by fn_current_custodian.",
    "example": "A registered courier package signed for at every transit depot."
  },
  {
    "term": "Data Integrity",
    "cat": "Forensics & Security",
    "simple": "Guaranteeing that information has not been modified or corrupted.",
    "tech": "Assurance of accuracy, completeness, and consistency of data over its lifecycle.",
    "project": "Enforced via relational constraints and cryptographic SHA-256 hashing.",
    "example": "A sealed envelope that shows clear tears if someone tampered with it."
  },
  {
    "term": "Non-Repudiation",
    "cat": "Forensics & Security",
    "simple": "Proof so strong that someone cannot deny they performed an action.",
    "tech": "Assurance that a party cannot refute the validity of a transaction or statement.",
    "project": "Triggers capture investigator ID, database user, client IP, and exact timestamp.",
    "example": "A legally notarized signature on a property deed."
  },
  {
    "term": "RBAC",
    "cat": "Forensics & Security",
    "simple": "Giving users access permissions based on their job role.",
    "tech": "Role-Based Access Control restricting system privileges according to assigned roles.",
    "project": "4 roles: ADMIN, LEAD_INVESTIGATOR, INVESTIGATOR, AUDITOR.",
    "example": "Doctors can prescribe medicine; nurses can administer it; patients can view records."
  },
  {
    "term": "Least Privilege",
    "cat": "Forensics & Security",
    "simple": "Giving programs and users only the bare minimum permissions needed.",
    "tech": "Security design principle granting only the minimum privileges essential for a task.",
    "project": "ghost_app application user has zero DELETE privileges on audit logs.",
    "example": "Giving a valet key that starts the car but cannot unlock the trunk."
  },
  {
    "term": "CSRF",
    "cat": "Forensics & Security",
    "simple": "Tricking a user's browser into making an unwanted request.",
    "tech": "Cross-Site Request Forgery: an attack forcing a logged-in user to execute unwanted actions.",
    "project": "Prevented via custom X-Requested-With header and SameSite cookie policies.",
    "example": "A fake lottery website secretly triggering an online banking transfer in a background tab."
  },
  {
    "term": "Brute-Force Attack",
    "cat": "Forensics & Security",
    "simple": "A hacker guessing thousands of passwords in rapid succession.",
    "tech": "An automated trial-and-error method used to guess authentication credentials.",
    "project": "Prevented via login_attempts rate-limiting: 5 failed attempts locks the account for 15 minutes.",
    "example": "Trying every 4-digit combination from 0000 to 9999 on a bike lock."
  },
  {
    "term": "Bcrypt",
    "cat": "Forensics & Security",
    "simple": "A very strong formula for scrambling passwords with salt.",
    "tech": "Adaptive password hashing algorithm based on Blowfish cipher with configurable work factor.",
    "project": "Stores passwords in investigators.password_hash with 12 rounds.",
    "example": "Mashing an avocado into guacamole: easy to prepare, impossible to separate back into an avocado."
  },
  {
    "term": "Anomaly Detection",
    "cat": "Intelligence & AI",
    "simple": "Automatically spotting weird or suspicious behavior in the data.",
    "tech": "Identification of rare observations that deviate significantly from baseline patterns.",
    "project": "11 detectors in detector.py evaluating audit logs.",
    "example": "Your bank texting you because someone used your card in London at 3 AM."
  },
  {
    "term": "Z-Score",
    "cat": "Intelligence & AI",
    "simple": "A statistical number showing how far from normal an action is.",
    "tech": "Standard score measuring standard deviations from the population mean (Z = (X - mu) / sigma).",
    "project": "Used in HIGH_ACTIVITY_ZSCORE rule to detect sudden spikes in database queries.",
    "example": "A student scoring 98 on an exam where the class average was 35."
  },
  {
    "term": "Isolation Forest",
    "cat": "Intelligence & AI",
    "simple": "An AI algorithm that isolates weird outliers using decision trees.",
    "tech": "Unsupervised anomaly detection algorithm that separates anomalies by random axis-aligned splits.",
    "project": "Optional detector in detector.py using scikit-learn.",
    "example": "Spotting one giraffe standing in a flock of sheep\u2014it takes only one fence to isolate it."
  },
  {
    "term": "Local LLM",
    "cat": "Intelligence & AI",
    "simple": "An AI brain that runs directly on your computer without internet.",
    "tech": "Large Language Model executed on local hardware via runtimes like Ollama.",
    "project": "Integrated with Ollama (llama3.2:3b) with zero third-party cloud data transmission.",
    "example": "A dictionary app installed on your phone that works with no Wi-Fi."
  },
  {
    "term": "Grounding (AI)",
    "cat": "Intelligence & AI",
    "simple": "Forcing the AI to only speak real facts from the database.",
    "tech": "Technique restricting LLM output generation strictly to retrieved relational context, preventing hallucinations.",
    "project": "AI Assistant receives verified JSON facts from MySQL views before answering queries.",
    "example": "An open-book exam where the student must quote the exact page and paragraph of the textbook."
  },
  {
    "term": "FastAPI",
    "cat": "Architecture & Web",
    "simple": "A lightning-fast modern Python website and API framework.",
    "tech": "High-performance Python ASGI web framework based on Starlette and Pydantic.",
    "project": "Powers all backend REST API endpoints.",
    "example": "A fast food drive-through taking orders, validating them, and returning food in seconds."
  },
  {
    "term": "SQLAlchemy Core",
    "cat": "Architecture & Web",
    "simple": "Python's tool for talking to MySQL safely using bound parameters.",
    "tech": "Python SQL toolkit providing database abstraction, connection pooling, and parameterized execution.",
    "project": "Executes all database statements safely with named bind parameters (:param).",
    "example": "A skilled interpreter translating spoken English into precise, grammatically perfect French."
  },
  {
    "term": "Liquid Glass UI",
    "cat": "Architecture & Web",
    "simple": "A modern, frosted-glass design inspired by premium operating systems.",
    "tech": "Modern UI design aesthetic utilizing translucent CSS surfaces, backdrop-filter blur, and responsive hierarchies.",
    "project": "Applied across the entire SQL Ghost Hunter interface and Interactive Help System.",
    "example": "The frosted-glass translucency seen on high-end Apple iOS and macOS control centers."
  }
];

export const TEACHER_PRESENTATION = {
  "elevatorPitch": "Respected faculty, SQL Ghost Hunter is an AI-assisted relational database forensics and data integrity monitoring system built on MySQL 8. Its core motto is 'Every Database Change Leaves a Trace'. While conventional systems only tell you that data changed, SQL Ghost Hunter proves WHO made the change, WHAT the values were before and after using JSON diffs, WHEN it happened, whether digital evidence was tampered with using SHA-256 hashes, and whether insider activities are malicious using automated anomaly detection.",
  "problemStatement": "In modern database management, insider tampering is one of the most dangerous and difficult threats to solve. If a privileged employee secretly alters payroll numbers at 2 a.m. or connects directly via MySQL Workbench to bypass the web application, traditional web server logs show nothing. Furthermore, digital evidence files can be modified on disk without detection. Without verifiable cryptographic proofs and immutable audit trails, investigators cannot prove who was responsible in a court of law.",
  "objectives": [
    "1. Design a normalized (3NF) relational MySQL schema with comprehensive constraint coverage.",
    "2. Capture all INSERT, UPDATE, and DELETE operations automatically using database triggers.",
    "3. Enforce append-only immutability on audit logs, custody records, and integrity checks.",
    "4. Register digital evidence with SHA-256 hashes and reliably detect physical file tampering.",
    "5. Implement a strict, relational chain of custody with authorized handover rules.",
    "6. Detect anomalous database activity using rules, statistical z-scores, and optional machine learning.",
    "7. Provide an AI assistant grounded strictly in verified MySQL facts to eliminate hallucinations.",
    "8. Demonstrate all major syllabus DBMS concepts through 31 live, cataloged SQL queries."
  ],
  "architectureSpeech": "Our system architecture follows a clean 3-tier model. At the presentation tier, we have a vanilla JavaScript client using a premium Liquid Glass interface. At the application tier, Python FastAPI handles business logic and parameterizes all database queries. At the data tier, MySQL 8 serves as the true source of truth. Notice that security is pushed down into the database engine: even if an attacker completely bypasses the Python web backend and runs queries directly in MySQL Workbench, our database triggers still fire, record the modification, capture the MySQL user account, and tag the event as an unidentified direct-database bypass.",
  "liveDemoSteps": [
    {
      "step": "1. Login & Dashboard",
      "action": "Sign in as Admin (admin@ghosthunter.local) and view the Dashboard.",
      "speech": "First, I log in as the Administrator. Notice our live Dashboard: all statistics, the 14-day activity chart, and risk distributions are computed on the fly using MySQL views and recursive CTEs."
    },
    {
      "step": "2. Evidence Registration",
      "action": "Navigate to Evidence Management -> register a new document.",
      "speech": "Next, I register a new evidence file. Notice that our stored procedure sp_register_evidence executes an atomic transaction that computes the SHA-256 hash, stores the file, and sets the baseline integrity check."
    },
    {
      "step": "3. Tamper Detection",
      "action": "Open item EV-0007 and click 'Verify Integrity Now'.",
      "speech": "Now, let us test evidence tampering. EV-0007 has been deliberately modified on disk. When I click 'Verify Integrity', the system recalculates the SHA-256 hash. Because the computed hash differs from the sealed original hash, MySQL marks it as TAMPERED and flags a CRITICAL alert."
    },
    {
      "step": "4. Database Audit Logs",
      "action": "Open Database Audit Logs and expand an UPDATE row.",
      "speech": "Here in the Audit Logs, we can see the exact before-and-after JSON diff captured by our MySQL triggers. Even if an attacker tries to run DELETE FROM audit_logs, our BEFORE DELETE trigger prevents it with an append-only error."
    },
    {
      "step": "5. Chain of Custody",
      "action": "Open Chain of Custody and demonstrate a handover.",
      "speech": "In Chain of Custody, every transfer requires an authorized custodian and re-verifies the SHA-256 hash during handover. In our database schema, the current custodian is dynamically derived by stored function fn_current_custodian to satisfy Third Normal Form."
    },
    {
      "step": "6. AI Security Analysis",
      "action": "Open AI Security Analysis and click 'Run Anomaly Analysis'.",
      "speech": "Our anomaly engine evaluates 11 detectors, including off-hours modifications and activity z-scores. Every alert provides an explainable score breakdown so the investigator understands the exact rationale."
    },
    {
      "step": "7. SQL Demonstration Lab",
      "action": "Open SQL Demonstration -> Example Queries -> execute an INNER JOIN query.",
      "speech": "Finally, our SQL Demonstration Lab proves our DBMS syllabus compliance with 31 executable queries, schema browser, and concept verification."
    }
  ],
  "conclusion": "In conclusion, SQL Ghost Hunter demonstrates that the database is not merely a passive storage bucket, but an active, intelligent, and tamper-evident security system. By combining relational triggers, cryptographic hashing, 3NF normalization, and explainable anomaly detection, we have created an academic project that solves genuine real-world digital forensics challenges."
};

export const VIVA_QUESTIONS = [

  {
    "id": 101,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q1. If you close the application, will the database records disappear?",
    "question": "Q1. If you close the application, will the database records disappear?",
    "simple": "No. Committed records are stored in MySQL and remain there after the application closes.",
    "tech": "MySQL provides persistent storage via the InnoDB engine. Committed transactions are written to disk tablespace files (.ibd) and transaction redo logs, remaining preserved independently of the browser window or the FastAPI process lifecycle.",
    "technical": "MySQL provides persistent storage via the InnoDB engine. Committed transactions are written to disk tablespace files (.ibd) and transaction redo logs, remaining preserved independently of the browser window or the FastAPI process lifecycle.",
    "followup": "What specific ACID property guarantees that data survives application closure or crashes?",
    "facultyPrompt": "What specific ACID property guarantees that data survives application closure or crashes?",
    "analogy": "Viva Strategy: Quote Durability: 'Once a transaction has been committed, it will remain committed even in the event of a system crash or power outage.'",
    "proTip": "Quote Durability: 'Once a transaction has been committed, it will remain committed even in the event of a system crash or power outage.'"
  },
  {
    "id": 102,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q2. What is data persistence?",
    "question": "Q2. What is data persistence?",
    "simple": "It means saved information remains available even after restarting the computer or reopening the application.",
    "tech": "Persistence is the characteristic of state that outlives the execution context that created it. In relational systems, it satisfies the Durability property of ACID, where data is committed to non-volatile secondary storage (disk) via write-ahead logging (WAL).",
    "technical": "Persistence is the characteristic of state that outlives the execution context that created it. In relational systems, it satisfies the Durability property of ACID, where data is committed to non-volatile secondary storage (disk) via write-ahead logging (WAL).",
    "followup": "Contrast data persistence with ephemeral in-memory state in web applications.",
    "facultyPrompt": "Contrast data persistence with ephemeral in-memory state in web applications.",
    "analogy": "Viva Strategy: Explain that frontend variables in JavaScript RAM and backend Python dictionaries are volatile, whereas MySQL InnoDB pages on disk are persistent.",
    "proTip": "Explain that frontend variables in JavaScript RAM and backend Python dictionaries are volatile, whereas MySQL InnoDB pages on disk are persistent."
  },
  {
    "id": 103,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q3. How does the administrator dashboard get updated?",
    "question": "Q3. How does the administrator dashboard get updated?",
    "simple": "The dashboard asks the backend for the latest numbers, and the backend reads them fresh from MySQL.",
    "tech": "The frontend single-page application initiates asynchronous HTTP GET calls (e.g. /api/dashboard/stats) to FastAPI. FastAPI uses SQLAlchemy/PyMySQL to execute optimized SQL views (vw_dashboard_stats, vw_case_summary) against MySQL, returning JSON payloads that dynamically update DOM metrics without a full page reload.",
    "technical": "The frontend single-page application initiates asynchronous HTTP GET calls (e.g. /api/dashboard/stats) to FastAPI. FastAPI uses SQLAlchemy/PyMySQL to execute optimized SQL views (vw_dashboard_stats, vw_case_summary) against MySQL, returning JSON payloads that dynamically update DOM metrics without a full page reload.",
    "followup": "How do you ensure the dashboard stays synchronized when multiple users are modifying data?",
    "facultyPrompt": "How do you ensure the dashboard stays synchronized when multiple users are modifying data?",
    "analogy": "Viva Strategy: Highlight our live-sync mechanism: periodic polling (8s), tab visibility triggers (document.visibilitychange), and an on-demand manual Refresh button.",
    "proTip": "Highlight our live-sync mechanism: periodic polling (8s), tab visibility triggers (document.visibilitychange), and an on-demand manual Refresh button."
  },
  {
    "id": 104,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q4. Does every button directly communicate with MySQL?",
    "question": "Q4. Does every button directly communicate with MySQL?",
    "simple": "No. Buttons in the browser call backend API endpoints. The backend validates permissions, performs business logic, and communicates with MySQL.",
    "tech": "Browsers cannot and should not maintain direct TCP socket connections to database servers for security reasons. Every UI action emits an HTTP fetch request to a RESTful FastAPI endpoint. The backend handles session authentication, CSRF validation, parameter sanitization, and transaction management before querying MySQL via connection pooling.",
    "technical": "Browsers cannot and should not maintain direct TCP socket connections to database servers for security reasons. Every UI action emits an HTTP fetch request to a RESTful FastAPI endpoint. The backend handles session authentication, CSRF validation, parameter sanitization, and transaction management before querying MySQL via connection pooling.",
    "followup": "Why is it dangerous to let a browser frontend communicate directly with MySQL?",
    "facultyPrompt": "Why is it dangerous to let a browser frontend communicate directly with MySQL?",
    "analogy": "Viva Strategy: Mention credential exposure (putting DB passwords in client JS) and SQL injection vulnerability without backend authorization checks.",
    "proTip": "Mention credential exposure (putting DB passwords in client JS) and SQL injection vulnerability without backend authorization checks."
  },
  {
    "id": 105,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Advanced",
    "diff": "Advanced",
    "q": "Q5. What happens when I update a database record?",
    "question": "Q5. What happens when I update a database record?",
    "simple": "The backend sends an UPDATE command to MySQL. MySQL modifies the row in its storage, and active database triggers instantly write a copy of the old and new values into the audit log diary.",
    "tech": "An atomic transaction begins (START TRANSACTION). FastAPI sets the session variable SET @app_investigator_id = :uid. An UPDATE table SET ... WHERE id = :id query executes. MySQL's AFTER UPDATE trigger fires synchronously within the same transaction, executing JSON_OBJECT() diff comparisons between OLD and NEW row states and inserting a row into audit_logs. Finally, SQLAlchemy executes COMMIT, writing changes to InnoDB redo log buffers and flushing to disk.",
    "technical": "An atomic transaction begins (START TRANSACTION). FastAPI sets the session variable SET @app_investigator_id = :uid. An UPDATE table SET ... WHERE id = :id query executes. MySQL's AFTER UPDATE trigger fires synchronously within the same transaction, executing JSON_OBJECT() diff comparisons between OLD and NEW row states and inserting a row into audit_logs. Finally, SQLAlchemy executes COMMIT, writing changes to InnoDB redo log buffers and flushing to disk.",
    "followup": "Explain the exact lifecycle of an UPDATE statement from Python to disk.",
    "facultyPrompt": "Explain the exact lifecycle of an UPDATE statement from Python to disk.",
    "analogy": "Viva Strategy: Emphasize that the audit trigger and the data update occur within the SAME atomic transaction\u2014if either fails, both are rolled back.",
    "proTip": "Emphasize that the audit trigger and the data update occur within the SAME atomic transaction\u2014if either fails, both are rolled back."
  },
  {
    "id": 106,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q6. What is the difference between frontend state and database storage?",
    "question": "Q6. What is the difference between frontend state and database storage?",
    "simple": "Frontend state is temporary memory inside the browser tab (like RAM). If you refresh the tab, it disappears. Database storage is permanent data saved on the server's hard drive.",
    "tech": "Frontend state lives in volatile browser client memory (JavaScript heap variables, DOM nodes, and session storage) scoped to the active execution window. Database storage resides in persistent, non-volatile server disk structures (InnoDB B+ Tree pages, redo logs, system tablespaces) governed by relational constraints and crash-recovery guarantees.",
    "technical": "Frontend state lives in volatile browser client memory (JavaScript heap variables, DOM nodes, and session storage) scoped to the active execution window. Database storage resides in persistent, non-volatile server disk structures (InnoDB B+ Tree pages, redo logs, system tablespaces) governed by relational constraints and crash-recovery guarantees.",
    "followup": "Can an attacker tamper with client-side frontend state to corrupt the database?",
    "facultyPrompt": "Can an attacker tamper with client-side frontend state to corrupt the database?",
    "analogy": "Viva Strategy: Say 'No, because the backend treats all incoming client payloads as untrusted and validates schema constraints and permissions independently.'",
    "proTip": "Say 'No, because the backend treats all incoming client payloads as untrusted and validates schema constraints and permissions independently.'"
  },
  {
    "id": 107,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q7. What happens if the FastAPI server stops?",
    "question": "Q7. What happens if the FastAPI server stops?",
    "simple": "The website temporarily stops responding to clicks, but none of your saved data is lost because MySQL keeps everything safe. When you turn FastAPI back on, all data is still there.",
    "tech": "The stateless application layer goes offline, rejecting incoming HTTP connections (502 Bad Gateway / Connection Refused). However, because the persistence layer (MySQL) is decoupled from the compute layer, all committed transactions remain completely durable on disk. When the ASGI process restarts, it re-establishes connection pools and resumes serving state seamlessly.",
    "technical": "The stateless application layer goes offline, rejecting incoming HTTP connections (502 Bad Gateway / Connection Refused). However, because the persistence layer (MySQL) is decoupled from the compute layer, all committed transactions remain completely durable on disk. When the ASGI process restarts, it re-establishes connection pools and resumes serving state seamlessly.",
    "followup": "What architecture pattern is this called?",
    "facultyPrompt": "What architecture pattern is this called?",
    "analogy": "Viva Strategy: Mention 3-Tier Decoupled Architecture: Presentation Layer (Browser), Application Layer (FastAPI), and Data Persistence Layer (MySQL).",
    "proTip": "Mention 3-Tier Decoupled Architecture: Presentation Layer (Browser), Application Layer (FastAPI), and Data Persistence Layer (MySQL)."
  },
  {
    "id": 108,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q8. What happens if MySQL stops?",
    "question": "Q8. What happens if MySQL stops?",
    "simple": "The application cannot read or save any records and displays an error message telling the user that the database is offline. Once MySQL is started again, everything recovers.",
    "tech": "The backend connection pool raises database operational errors (OperationalError: 2003 Can't connect to MySQL server). The application responds with 503 Service Unavailable. Upon MySQL service recovery, the InnoDB storage engine performs crash recovery by replaying unwritten transactions from the redo log and rolling back uncommitted ones from the undo log, restoring full relational consistency.",
    "technical": "The backend connection pool raises database operational errors (OperationalError: 2003 Can't connect to MySQL server). The application responds with 503 Service Unavailable. Upon MySQL service recovery, the InnoDB storage engine performs crash recovery by replaying unwritten transactions from the redo log and rolling back uncommitted ones from the undo log, restoring full relational consistency.",
    "followup": "How does InnoDB ensure consistency during sudden power failures or crashes?",
    "facultyPrompt": "How does InnoDB ensure consistency during sudden power failures or crashes?",
    "analogy": "Viva Strategy: Explain Write-Ahead Logging (WAL) and the ARIES recovery algorithm (Analysis, Redo, Undo).",
    "proTip": "Explain Write-Ahead Logging (WAL) and the ARIES recovery algorithm (Analysis, Redo, Undo)."
  },
  {
    "id": 109,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q9. What is the purpose of SQLAlchemy?",
    "question": "Q9. What is the purpose of SQLAlchemy?",
    "simple": "It is a Python translation tool that lets backend code speak to MySQL cleanly, safely, and without writing repetitive raw database connection code.",
    "tech": "SQLAlchemy serves as an Object-Relational Mapper (ORM) and Database Abstraction Layer (DBAPI wrapper). It handles database dialect abstraction, connection pooling (QueuePool), query parameterization against SQL injection, declarative table mapping, and transaction lifecycle management (session.commit() / session.rollback()).",
    "technical": "SQLAlchemy serves as an Object-Relational Mapper (ORM) and Database Abstraction Layer (DBAPI wrapper). It handles database dialect abstraction, connection pooling (QueuePool), query parameterization against SQL injection, declarative table mapping, and transaction lifecycle management (session.commit() / session.rollback()).",
    "followup": "Does SQL Ghost Hunter use raw SQL or ORM queries?",
    "facultyPrompt": "Does SQL Ghost Hunter use raw SQL or ORM queries?",
    "analogy": "Viva Strategy: We use a hybrid approach: SQLAlchemy ORM models for CRUD entities, and raw parameterized SQL queries for complex analytical views, CTEs, and trigger invocations.",
    "proTip": "We use a hybrid approach: SQLAlchemy ORM models for CRUD entities, and raw parameterized SQL queries for complex analytical views, CTEs, and trigger invocations."
  },
  {
    "id": 110,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Advanced",
    "diff": "Advanced",
    "q": "Q10. How do MySQL triggers capture database changes?",
    "question": "Q10. How do MySQL triggers capture database changes?",
    "simple": "Triggers are like automated traps inside MySQL. The instant any row is added, edited, or deleted, the trigger runs immediately and writes who did it and what changed into an audit log.",
    "tech": "MySQL triggers are event-driven procedural routines defined with AFTER INSERT/UPDATE/DELETE ON table FOR EACH ROW. They execute synchronously within the same ACID transaction context as the calling DML statement, possessing read access to pseudo-records NEW and OLD to capture state transformations before the transaction commits.",
    "technical": "MySQL triggers are event-driven procedural routines defined with AFTER INSERT/UPDATE/DELETE ON table FOR EACH ROW. They execute synchronously within the same ACID transaction context as the calling DML statement, possessing read access to pseudo-records NEW and OLD to capture state transformations before the transaction commits.",
    "followup": "Can a user disable triggers during an update without admin privileges?",
    "facultyPrompt": "Can a user disable triggers during an update without admin privileges?",
    "analogy": "Viva Strategy: No. Disabling triggers requires the SUPER or TRIGGER administrative privilege. Regular application users have zero ability to bypass them.",
    "proTip": "No. Disabling triggers requires the SUPER or TRIGGER administrative privilege. Regular application users have zero ability to bypass them."
  },
  {
    "id": 111,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Advanced",
    "diff": "Advanced",
    "q": "Q11. How does the application identify old and new values?",
    "question": "Q11. How does the application identify old and new values?",
    "simple": "The MySQL trigger reads the row before the change (OLD) and the row after the change (NEW), converts both into text format (JSON), and saves both side-by-side in the audit log.",
    "tech": "In AFTER UPDATE triggers, the engine exposes OLD.column_name (pre-state) and NEW.column_name (post-state). SQL Ghost Hunter uses MySQL's native JSON_OBJECT() function to serialize the entire old row and new row into JSON attributes stored in audit_logs.old_values and audit_logs.new_values.",
    "technical": "In AFTER UPDATE triggers, the engine exposes OLD.column_name (pre-state) and NEW.column_name (post-state). SQL Ghost Hunter uses MySQL's native JSON_OBJECT() function to serialize the entire old row and new row into JSON attributes stored in audit_logs.old_values and audit_logs.new_values.",
    "followup": "Why store diffs in JSON rather than separate columns?",
    "facultyPrompt": "Why store diffs in JSON rather than separate columns?",
    "analogy": "Viva Strategy: Explain flexibility: JSON allows storing any column's schema changes generically without altering the audit table definition whenever new fields are added.",
    "proTip": "Explain flexibility: JSON allows storing any column's schema changes generically without altering the audit table definition whenever new fields are added."
  },
  {
    "id": 112,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q12. Is the dashboard showing live data or static data?",
    "question": "Q12. Is the dashboard showing live data or static data?",
    "simple": "It shows 100% live data. When you make a change or click Refresh, it queries MySQL and displays actual current numbers.",
    "tech": "The dashboard renders zero hardcoded mock arrays. Metrics are computed on-demand by MySQL aggregation views (vw_dashboard_stats, vw_case_summary) and delivered via JSON APIs. The frontend features an active live-sync polling interval, a manual Refresh button, and tab visibility triggers to ensure real-time synchronization.",
    "technical": "The dashboard renders zero hardcoded mock arrays. Metrics are computed on-demand by MySQL aggregation views (vw_dashboard_stats, vw_case_summary) and delivered via JSON APIs. The frontend features an active live-sync polling interval, a manual Refresh button, and tab visibility triggers to ensure real-time synchronization.",
    "followup": "How can you prove that to me right now?",
    "facultyPrompt": "How can you prove that to me right now?",
    "analogy": "Viva Strategy: Execute Step 10 & 11 of the Demonstration Script: update a row directly in MySQL Workbench and show the live dashboard and audit log reflect the change immediately!",
    "proTip": "Execute Step 10 & 11 of the Demonstration Script: update a row directly in MySQL Workbench and show the live dashboard and audit log reflect the change immediately!"
  },
  {
    "id": 113,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Advanced",
    "diff": "Advanced",
    "q": "Q13. What happens if two users update the same record?",
    "question": "Q13. What happens if two users update the same record?",
    "simple": "MySQL makes the second person wait for a fraction of a second so they don't overwrite each other's changes by accident.",
    "tech": "MySQL InnoDB uses row-level locking (SELECT ... FOR UPDATE or implicit exclusive write locks). Under REPEATABLE READ or READ COMMITTED isolation levels, concurrent transactions modify rows sequentially. If an unresolvable lock dependency occurs, InnoDB detects the cycle and raises a Deadlock error (Deadlock found when trying to get lock; try restarting transaction), rolling back the victim transaction.",
    "technical": "MySQL InnoDB uses row-level locking (SELECT ... FOR UPDATE or implicit exclusive write locks). Under REPEATABLE READ or READ COMMITTED isolation levels, concurrent transactions modify rows sequentially. If an unresolvable lock dependency occurs, InnoDB detects the cycle and raises a Deadlock error (Deadlock found when trying to get lock; try restarting transaction), rolling back the victim transaction.",
    "followup": "What locking granularity does MySQL InnoDB use compared to MyISAM?",
    "facultyPrompt": "What locking granularity does MySQL InnoDB use compared to MyISAM?",
    "analogy": "Viva Strategy: InnoDB uses fine-grained row-level locking (B+Tree index records), whereas legacy MyISAM uses coarse table-level locking.",
    "proTip": "InnoDB uses fine-grained row-level locking (B+Tree index records), whereas legacy MyISAM uses coarse table-level locking."
  },
  {
    "id": 114,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q14. What is transaction COMMIT?",
    "question": "Q14. What is transaction COMMIT?",
    "simple": "Pressing 'Save Permanently' in a document. Once committed, the changes are written in stone and cannot be cancelled.",
    "tech": "COMMIT terminates an active relational transaction, converting dirty in-memory modifications into durable state. The InnoDB storage engine writes all modified log sequence numbers (LSN) to the doublewrite buffer and WAL redo logs on disk, satisfying the Durability contract of ACID.",
    "technical": "COMMIT terminates an active relational transaction, converting dirty in-memory modifications into durable state. The InnoDB storage engine writes all modified log sequence numbers (LSN) to the doublewrite buffer and WAL redo logs on disk, satisfying the Durability contract of ACID.",
    "followup": "Can you ROLLBACK after a COMMIT has succeeded?",
    "facultyPrompt": "Can you ROLLBACK after a COMMIT has succeeded?",
    "analogy": "Viva Strategy: No. Once COMMIT is executed and written to disk, the transaction is immutable. Reversing it requires executing a new compensating transaction.",
    "proTip": "No. Once COMMIT is executed and written to disk, the transaction is immutable. Reversing it requires executing a new compensating transaction."
  },
  {
    "id": 115,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q15. What is ROLLBACK?",
    "question": "Q15. What is ROLLBACK?",
    "simple": "Pressing 'Undo' or 'Cancel' when an error happens, resetting everything back to how it was before you started.",
    "tech": "ROLLBACK terminates an active transaction by undoing all uncommitted modifications. The database engine traverses the transaction's undo log segments, applying inverse operations to revert affected rows to their pre-transaction snapshot, preserving Atomicity.",
    "technical": "ROLLBACK terminates an active transaction by undoing all uncommitted modifications. The database engine traverses the transaction's undo log segments, applying inverse operations to revert affected rows to their pre-transaction snapshot, preserving Atomicity.",
    "followup": "In what scenario does SQL Ghost Hunter trigger a ROLLBACK?",
    "facultyPrompt": "In what scenario does SQL Ghost Hunter trigger a ROLLBACK?",
    "analogy": "Viva Strategy: When registering evidence, if file hash verification fails or disk storage write errors out, the entire transaction is rolled back so no orphan database rows remain.",
    "proTip": "When registering evidence, if file hash verification fails or disk storage write errors out, the entire transaction is rolled back so no orphan database rows remain."
  },
  {
    "id": 116,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Advanced",
    "diff": "Advanced",
    "q": "Q16. Can a database administrator modify or delete audit records?",
    "question": "Q16. Can a database administrator modify or delete audit records?",
    "simple": "Not through normal SQL queries, because special security triggers immediately block any attempt to edit or erase audit records.",
    "tech": "Tables audit_logs, custody_transfers, and integrity_checks are protected by BEFORE UPDATE and BEFORE DELETE triggers that raise SIGNAL SQLSTATE '45000' with custom error messages (e.g. 'Audit history is append-only'). While a root user with SUPER or SYSTEM_USER privileges could theoretically disable triggers, doing so itself creates detectable forensic footprints in MySQL binary logs and leaves identifiable missing sequence numbers.",
    "technical": "Tables audit_logs, custody_transfers, and integrity_checks are protected by BEFORE UPDATE and BEFORE DELETE triggers that raise SIGNAL SQLSTATE '45000' with custom error messages (e.g. 'Audit history is append-only'). While a root user with SUPER or SYSTEM_USER privileges could theoretically disable triggers, doing so itself creates detectable forensic footprints in MySQL binary logs and leaves identifiable missing sequence numbers.",
    "followup": "Demonstrate the trigger blocking a DELETE query.",
    "facultyPrompt": "Demonstrate the trigger blocking a DELETE query.",
    "analogy": "Viva Strategy: Show `trg_audit_block_delete` on `audit_logs` which raises SQLSTATE 45000 'Audit records are append-only and cannot be deleted'.",
    "proTip": "Show `trg_audit_block_delete` on `audit_logs` which raises SQLSTATE 45000 'Audit records are append-only and cannot be deleted'."
  },
  {
    "id": 117,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Advanced",
    "diff": "Advanced",
    "q": "Q17. Is SQL Ghost Hunter completely tamper-proof?",
    "question": "Q17. Is SQL Ghost Hunter completely tamper-proof?",
    "simple": "No security tool is 100% tamper-proof against physical theft or root access, but SQL Ghost Hunter makes tampering so difficult that an attacker cannot alter records without leaving clear forensic evidence.",
    "tech": "Relational databases run within an OS trust boundary. While SQL Ghost Hunter enforces strict RBAC, least-privilege user isolation (ghost_app), append-only triggers, and cryptographic SHA-256 integrity verification, an attacker with root OS access or raw disk block access could theoretically bypass the database engine. Therefore, true forensic defensibility requires defense-in-depth: active OS-level file monitoring, off-site remote log shipping (SIEM), and write-once-read-many (WORM) storage.",
    "technical": "Relational databases run within an OS trust boundary. While SQL Ghost Hunter enforces strict RBAC, least-privilege user isolation (ghost_app), append-only triggers, and cryptographic SHA-256 integrity verification, an attacker with root OS access or raw disk block access could theoretically bypass the database engine. Therefore, true forensic defensibility requires defense-in-depth: active OS-level file monitoring, off-site remote log shipping (SIEM), and write-once-read-many (WORM) storage.",
    "followup": "What is the security boundary between the DBMS and the Host Operating System?",
    "facultyPrompt": "What is the security boundary between the DBMS and the Host Operating System?",
    "analogy": "Viva Strategy: Admit honestly that root OS access trumps software controls\u2014professors love realistic threat modeling over naive claims of 100% invulnerability.",
    "proTip": "Admit honestly that root OS access trumps software controls\u2014professors love realistic threat modeling over naive claims of 100% invulnerability."
  },
  {
    "id": 118,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q18. What happens if the original evidence file is deleted?",
    "question": "Q18. What happens if the original evidence file is deleted?",
    "simple": "If someone deletes the physical file from the hard drive, the next integrity check flags the file as MISSING/TAMPERED immediately, because the system cannot find the file to verify its hash.",
    "tech": "The evidence catalog maintains immutable metadata in evidence and verification history in integrity_checks. During a verification check, the backend attempts to open storage/evidence/{stored_filename}. If an OS.FileNotFoundError occurs, the system records an integrity result of ERROR / COMPROMISED, flags the file in ai_alerts, and creates an immutable audit trail entry noting physical evidence destruction.",
    "technical": "The evidence catalog maintains immutable metadata in evidence and verification history in integrity_checks. During a verification check, the backend attempts to open storage/evidence/{stored_filename}. If an OS.FileNotFoundError occurs, the system records an integrity result of ERROR / COMPROMISED, flags the file in ai_alerts, and creates an immutable audit trail entry noting physical evidence destruction.",
    "followup": "Does deleting the file erase its record from the database?",
    "facultyPrompt": "Does deleting the file erase its record from the database?",
    "analogy": "Viva Strategy: No! Relational metadata in `evidence` and chain of custody logs remain preserved on disk, documenting that evidence item EV-XXXX existed and was destroyed.",
    "proTip": "No! Relational metadata in `evidence` and chain of custody logs remain preserved on disk, documenting that evidence item EV-XXXX existed and was destroyed."
  },
  {
    "id": 119,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q19. Are the uploaded evidence files stored inside MySQL?",
    "question": "Q19. Are the uploaded evidence files stored inside MySQL?",
    "simple": "No. The actual files are saved in a secure folder on disk, while MySQL only stores the file's information (metadata) and its SHA-256 fingerprint.",
    "tech": "Storing large binary files (BLOBs) inside relational tables degrades B-Tree indexing, bloats database buffer pools, and slows backup/restore operations. Best practice forensic architecture dictates hybrid storage: binary payloads are stored on structured, permission-controlled filesystem directories (storage/evidence/), while MySQL stores relational metadata, filesystem relative paths, and deterministic SHA-256 cryptographic hashes.",
    "technical": "Storing large binary files (BLOBs) inside relational tables degrades B-Tree indexing, bloats database buffer pools, and slows backup/restore operations. Best practice forensic architecture dictates hybrid storage: binary payloads are stored on structured, permission-controlled filesystem directories (storage/evidence/), while MySQL stores relational metadata, filesystem relative paths, and deterministic SHA-256 cryptographic hashes.",
    "followup": "Why not store the binary payload in a LONGBLOB column?",
    "facultyPrompt": "Why not store the binary payload in a LONGBLOB column?",
    "analogy": "Viva Strategy: Cite performance: BLOBs bypass the InnoDB buffer pool, cause severe I/O fragmentation, and make database backup dumps unnecessarily massive.",
    "proTip": "Cite performance: BLOBs bypass the InnoDB buffer pool, cause severe I/O fragmentation, and make database backup dumps unnecessarily massive."
  },
  {
    "id": 120,
    "category": "Data Persistence & System Architecture",
    "cat": "Persistence & Architecture",
    "difficulty": "Core",
    "diff": "Intermediate",
    "q": "Q20. What is the difference between storing a file and storing its hash?",
    "question": "Q20. What is the difference between storing a file and storing its hash?",
    "simple": "Storing a file is keeping the actual heavy document (e.g. 50 MB). Storing its hash is keeping a tiny 64-letter unique digital fingerprint (e.g. a1b2c3...). If even one letter in the 50 MB document changes, its fingerprint completely changes, exposing the modification.",
    "tech": "Storing a file preserves the complete byte payload requiring proportional disk capacity O(N). Storing a cryptographic hash preserves a fixed-length 256-bit collision-resistant digest (O(1)) produced by the deterministic SHA-256 mathematical algorithm. Due to the avalanche effect, any single-bit alteration in the source file changes approximately 50% of the output hash bits, enabling instantaneous, computationally irreversible verification of data integrity without requiring comparison against original binary payloads.",
    "technical": "Storing a file preserves the complete byte payload requiring proportional disk capacity O(N). Storing a cryptographic hash preserves a fixed-length 256-bit collision-resistant digest (O(1)) produced by the deterministic SHA-256 mathematical algorithm. Due to the avalanche effect, any single-bit alteration in the source file changes approximately 50% of the output hash bits, enabling instantaneous, computationally irreversible verification of data integrity without requiring comparison against original binary payloads.",
    "followup": "What is the mathematical property that makes SHA-256 secure for integrity verification?",
    "facultyPrompt": "What is the mathematical property that makes SHA-256 secure for integrity verification?",
    "analogy": "Viva Strategy: Quote Pre-image Resistance (infeasible to find x from h(x)) and Collision Resistance (infeasible to find two inputs x != y such that h(x) == h(y)).",
    "proTip": "Quote Pre-image Resistance (infeasible to find x from h(x)) and Collision Resistance (infeasible to find two inputs x != y such that h(x) == h(y))."
  }
,
  {
    "id": 1,
    "cat": "DBMS Fundamentals",
    "diff": "Beginner",
    "q": "What is a DBMS, and why should we use one instead of plain files?",
    "simple": "A DBMS is specialized software that manages data with safety, speed, and rules. Plain files cannot stop two people from corrupting data at the same time or stop someone from creating evidence without a case.",
    "tech": "A DBMS provides ACID transactional guarantees, concurrent access control, query optimization, crash recovery, and declarative relational integrity (such as Foreign Keys) which plain filesystems cannot enforce.",
    "analogy": "A library database versus a loose box of papers on a desk.",
    "followup": "Faculty: 'Which specific storage engine did you use in MySQL and why?' -> Answer: We used InnoDB because it supports transactions, foreign key constraints, and row-level locking."
  },
  {
    "id": 2,
    "cat": "DBMS Fundamentals",
    "diff": "Beginner",
    "q": "What is the difference between DDL, DML, DCL, and TCL?",
    "simple": "DDL builds the database structure (CREATE, ALTER). DML works with data (INSERT, UPDATE, DELETE). DCL controls access rights (GRANT, REVOKE). TCL handles transactions (COMMIT, ROLLBACK).",
    "tech": "Data Definition Language (DDL) alters metadata/schemas; Data Manipulation Language (DML) manages user data; Data Control Language (DCL) manages privileges; Transaction Control Language (TCL) manages ACID transaction boundaries.",
    "analogy": "DDL builds the house; DML moves furniture inside; DCL gives keys to family members; TCL lets you undo redecorating if you change your mind.",
    "followup": "Faculty: 'Where did you use DCL in your project?' -> Answer: In 13_security_privileges.sql, where we GRANT specific SELECT, INSERT, and UPDATE rights to ghost_app."
  },
  {
    "id": 3,
    "cat": "DBMS Fundamentals",
    "diff": "Intermediate",
    "q": "Explain Normalization and why Third Normal Form (3NF) is important.",
    "simple": "Normalization is organizing tables so every fact is stored exactly once. 3NF removes duplicate columns and stops non-key columns from depending on other non-key columns.",
    "tech": "Normalization minimizes redundancy and eliminates update, insert, and delete anomalies. 3NF requires the relation to be in 2NF and have no transitive functional dependencies (X -> Y where Y is not a candidate key).",
    "analogy": "Storing an author's address once in an Authors table rather than retyping it 500 times for every book they wrote.",
    "followup": "Faculty: 'Show me an example of 3NF compliance in your schema.' -> Answer: In evidence, we do not store current_custodian_id because it transitively depends on custody_transfers. We derive it via function fn_current_custodian."
  },
  {
    "id": 4,
    "cat": "DBMS Fundamentals",
    "diff": "Intermediate",
    "q": "What are ACID properties? How does your project satisfy them?",
    "simple": "ACID stands for Atomicity (all or nothing), Consistency (rules never broken), Isolation (no interference between users), and Durability (saved data survives power cuts).",
    "tech": "Atomicity via COMMIT/ROLLBACK in stored procedures; Consistency via declarative CHECK, FK, and NOT NULL constraints; Isolation via InnoDB's MVCC and default REPEATABLE READ; Durability via redo logs and write-ahead logging (WAL).",
    "analogy": "An ATM withdrawal: money dispensed and balance deducted must happen together or neither happens.",
    "followup": "Faculty: 'What happens if evidence registration fails halfway through?' -> Answer: In sp_register_evidence, the ROLLBACK executes, undoing the evidence record, custody transfer, and integrity check simultaneously."
  },
  {
    "id": 5,
    "cat": "DBMS Fundamentals",
    "diff": "Advanced",
    "q": "What is the difference between Primary Key, Candidate Key, and Surrogate Key?",
    "simple": "Candidate keys are all possible unique identifiers. One is chosen as the Primary Key. A Surrogate Key is a made-up counter number (AUTO_INCREMENT).",
    "tech": "A candidate key is a minimal superkey. The primary key is the candidate key chosen by the DBA. A surrogate key has no intrinsic business meaning and is generated artificially (case_id), whereas case_code ('CASE-001') is a natural candidate key.",
    "analogy": "Your DNA and fingerprint are candidate keys; your student roll number is a surrogate key.",
    "followup": "Faculty: 'Why not use case_code as the primary key?' -> Answer: An integer surrogate key is more compact (4 bytes vs VARCHAR), faster for foreign key index lookups, and immune to business code re-formatting."
  },
  {
    "id": 6,
    "cat": "DBMS Fundamentals",
    "diff": "Beginner",
    "q": "What is Referential Integrity and what happens when it is violated?",
    "simple": "It ensures that if table B points to table A, that record in table A must really exist. Violating it produces an error.",
    "tech": "Referential integrity requires that every foreign key value must correspond to an existing primary key value in the referenced parent relation. A violation throws MySQL Error 1452 or 1451.",
    "analogy": "You cannot mail a letter to a house number that does not exist on that street.",
    "followup": "Faculty: 'Can a foreign key column contain NULL?' -> Answer: Yes, unless specified NOT NULL. For example, audit_logs.investigator_id is NULL for direct database access."
  },
  {
    "id": 7,
    "cat": "DBMS Fundamentals",
    "diff": "Intermediate",
    "q": "What is the difference between physical data independence and logical data independence?",
    "simple": "Physical independence means changing how data is stored on disk does not break your queries. Logical independence means changing tables does not break user views.",
    "tech": "Physical data independence isolates conceptual schemas from internal storage structures (e.g. changing B-Tree to Hash index). Logical data independence isolates external views from conceptual schema modifications (e.g. adding columns without breaking views).",
    "analogy": "Replacing your computer's hard drive with an SSD doesn't change your Word documents (physical); adding a new column to a spreadsheet without breaking the chart (logical).",
    "followup": "Faculty: 'How do database views support logical data independence?' -> Answer: Views abstract underlying table restructuring so applications query stable view definitions."
  },
  {
    "id": 8,
    "cat": "DBMS Fundamentals",
    "diff": "Intermediate",
    "q": "What is Concurrency Control and what anomalies does it prevent?",
    "simple": "It manages multiple people accessing the database at the same time so they don't overwrite each other's work.",
    "tech": "Concurrency control coordinates simultaneous transactions using locking or Multi-Version Concurrency Control (MVCC) to prevent Dirty Reads (G1), Non-Repeatable Reads (G2), and Phantom Reads (A3).",
    "analogy": "Traffic lights at an intersection preventing cars from crashing into each other.",
    "followup": "Faculty: 'What is MySQL InnoDB's default isolation level?' -> Answer: REPEATABLE READ."
  },
  {
    "id": 9,
    "cat": "DBMS Fundamentals",
    "diff": "Advanced",
    "q": "Explain the 4 Database Transaction Isolation Levels.",
    "simple": "From lowest to highest protection: Read Uncommitted (can read unfinished work), Read Committed (reads only saved work), Repeatable Read (same query gives same answer during transaction), Serializable (runs transactions one by one).",
    "tech": "1. READ UNCOMMITTED (allows dirty reads); 2. READ COMMITTED (prevents dirty reads); 3. REPEATABLE READ (prevents dirty and non-repeatable reads using snapshot reads); 4. SERIALIZABLE (strict two-phase locking preventing phantoms).",
    "analogy": "From an open office where anyone can read over your shoulder, to a private locked exam room.",
    "followup": "Faculty: 'Why doesn't every system use SERIALIZABLE?' -> Answer: SERIALIZABLE has significant concurrency performance penalties and high deadlock frequencies."
  },
  {
    "id": 10,
    "cat": "DBMS Fundamentals",
    "diff": "Intermediate",
    "q": "What is Write-Ahead Logging (WAL) and how does InnoDB recover from a sudden crash?",
    "simple": "Before changing data in tables, MySQL writes what it's about to do into a fast journal (redo log). If power cuts, it reads the journal to finish or undo.",
    "tech": "WAL dictates that changes must be recorded in the append-only redo log on disk before dirty buffer pool pages are flushed. Upon restart, InnoDB replays the redo log (roll-forward) and rolls back uncommitted transactions using the undo log.",
    "analogy": "A chef writing an order ticket on the kitchen board before cooking the meal.",
    "followup": "Faculty: 'Which ACID property does WAL guarantee?' -> Answer: Durability and Atomicity."
  },
  {
    "id": 11,
    "cat": "DBMS Fundamentals",
    "diff": "Advanced",
    "q": "What is B-Tree indexing and why is it preferred over Hash indexing in relational databases?",
    "simple": "A B-Tree keeps data sorted like a tree, allowing fast searches for exact values and ranges (e.g. dates between Monday and Friday). Hash indexes cannot do range searches.",
    "tech": "A B+Tree is a self-balancing search tree with logarithmic O(log N) depth and sequential leaf node linking, enabling both point queries and efficient range scans (BETWEEN, >, <). Hash indexes offer O(1) point lookups but cannot support range predicates.",
    "analogy": "A phonebook sorted alphabetically lets you find all names starting with 'M' easily; an unorganized bucket of names requires checking every single one.",
    "followup": "Faculty: 'Where are B-Tree indexes used in your schema?' -> Answer: Primary keys, foreign keys, and idx_audit_actor_time (investigator_id, timestamp)."
  },
  {
    "id": 12,
    "cat": "SQL Queries",
    "diff": "Beginner",
    "q": "What is the difference between WHERE and HAVING clauses?",
    "simple": "WHERE filters individual rows before grouping. HAVING filters groups of rows after GROUP BY.",
    "tech": "WHERE evaluates predicate conditions on individual tuples prior to aggregation; HAVING filters aggregate groupings produced by GROUP BY using aggregate functions like COUNT() or SUM().",
    "analogy": "WHERE filters out sick students before taking a class test; HAVING filters out classes whose average score is below 50.",
    "followup": "Faculty: 'Can you use aggregate functions in a WHERE clause?' -> Answer: No, because WHERE executes before aggregates are calculated."
  },
  {
    "id": 13,
    "cat": "SQL Queries",
    "diff": "Intermediate",
    "q": "Why did you use a LEFT JOIN instead of an INNER JOIN in the audit trail view?",
    "simple": "Because if an attacker connects directly to MySQL Workbench, there is no logged-in website investigator! An INNER JOIN would hide those attacks. A LEFT JOIN keeps them visible with NULL.",
    "tech": "An INNER JOIN discards tuples from the left relation where the join predicate fails. In direct database tampering, audit_logs.investigator_id is NULL. Using LEFT JOIN investigators preserves these rows, exposing unauthorized database bypasses.",
    "analogy": "A guest list that still writes down 'Unknown Visitor' instead of pretending nobody knocked on the door.",
    "followup": "Faculty: 'Which view implements this?' -> Answer: vw_audit_trail."
  },
  {
    "id": 14,
    "cat": "SQL Queries",
    "diff": "Advanced",
    "q": "What is a Common Table Expression (CTE) and how did you use it?",
    "simple": "A CTE is a temporary named query you can use like a scratchpad table. We used a Recursive CTE to generate a calendar of the last 14 days.",
    "tech": "A CTE is a temporary result set defined within the scope of a WITH statement. Recursive CTEs consist of an anchor member and a recursive member joined by UNION ALL, ideal for generating date series or traversing hierarchies.",
    "analogy": "A temporary variable in code used to hold an intermediate calculation.",
    "followup": "Faculty: 'Why not just create a permanent calendar table?' -> Answer: A recursive CTE dynamically adapts to CURDATE() without requiring manual table maintenance."
  },
  {
    "id": 15,
    "cat": "SQL Queries",
    "diff": "Advanced",
    "q": "What is a Window Function? How does it differ from GROUP BY?",
    "simple": "GROUP BY collapses multiple rows into a single summary row. Window functions calculate things like ranks or running totals while keeping every original row visible.",
    "tech": "Window functions (ROW_NUMBER(), RANK(), SUM() OVER ()) calculate values over a partition of rows without collapsing them, retaining individual row identities.",
    "analogy": "Announcing each student's class rank beside their name on the report card versus only announcing the class average.",
    "followup": "Faculty: 'Which query in your SQL demo shows this?' -> Answer: Query 81 in 12_advanced_queries.sql, ranking evidence by size per case."
  },
  {
    "id": 16,
    "cat": "SQL Queries",
    "diff": "Intermediate",
    "q": "What is a Correlated Subquery and where is it used in SQL Ghost Hunter?",
    "simple": "It is an inner query that runs over and over for each row in the outer query, using information from that row.",
    "tech": "A subquery that references attributes from the enclosing outer query, evaluated once for every candidate tuple of the outer query.",
    "analogy": "Looking up each student's height against the average height of their own specific grade level.",
    "followup": "Faculty: 'Where is it in your codebase?' -> Answer: In vw_case_summary to compute each case's open alert count and latest activity timestamp."
  },
  {
    "id": 17,
    "cat": "SQL Queries",
    "diff": "Intermediate",
    "q": "What is JSON_TABLE in MySQL 8 and why is it useful?",
    "simple": "It takes JSON data stored in a cell and turns it into real rows and columns you can run standard SQL queries on.",
    "tech": "A built-in MySQL 8 table function that transforms unstructured or semi-structured JSON documents into a relational tabular format with explicitly typed columns.",
    "analogy": "A scanner that reads a paper receipt image and turns it into an organized Excel table.",
    "followup": "Faculty: 'Why store old and new values as JSON in audit_logs?' -> Answer: JSON provides schema flexibility to store diffs for ANY table without altering the audit table schema."
  },
  {
    "id": 18,
    "cat": "SQL Queries",
    "diff": "Beginner",
    "q": "What is the difference between UNION and UNION ALL?",
    "simple": "UNION combines two query results and removes duplicate rows (slower). UNION ALL combines them and keeps duplicates (faster).",
    "tech": "UNION performs an implicit DISTINCT operation by sorting and de-duplicating the combined result sets; UNION ALL simply concatenates result sets without deduplication.",
    "analogy": "UNION removes double-booked names from a party invite list; UNION ALL writes down every RSVP as received.",
    "followup": "Faculty: 'Why use UNION ALL in your recursive CTE?' -> Answer: Recursive CTE syntax requires UNION ALL to append each generated recursive step."
  },
  {
    "id": 19,
    "cat": "SQL Queries",
    "diff": "Advanced",
    "q": "What is an Execution Plan (EXPLAIN) and how do you interpret it?",
    "simple": "EXPLAIN is MySQL telling you how it plans to execute your query: which indexes it will use and how many rows it needs to examine.",
    "tech": "EXPLAIN returns tabular metadata describing the query optimizer's chosen execution strategy, including access types (const, ref, range, index, ALL), indexes utilized (key), and estimated row scans.",
    "analogy": "Google Maps showing you the planned route and expected toll roads before you start driving.",
    "followup": "Faculty: 'What access type indicates a full table scan?' -> Answer: 'ALL', which indicates missing indexes on filter predicates."
  },
  {
    "id": 20,
    "cat": "SQL Queries",
    "diff": "Intermediate",
    "q": "What is the difference between COUNT(*), COUNT(1), and COUNT(column_name)?",
    "simple": "COUNT(*) and COUNT(1) count all rows including NULLs. COUNT(column_name) counts only rows where that specific column is NOT NULL.",
    "tech": "COUNT(*) counts all tuples in the relation regardless of nullability. COUNT(1) is functionally identical in modern optimizers. COUNT(col) evaluates col IS NOT NULL and omits null values.",
    "analogy": "Counting all chairs in a room versus counting only chairs that have people sitting on them.",
    "followup": "Faculty: 'How does this affect audit_logs counting?' -> Answer: COUNT(*) gives total events; COUNT(investigator_id) gives events with authenticated users."
  },
  {
    "id": 21,
    "cat": "SQL Queries",
    "diff": "Intermediate",
    "q": "What is a Self-Join and where does SQL Ghost Hunter use one?",
    "simple": "A self-join is when a table is joined with itself, usually to compare rows within the same table.",
    "tech": "A relational join where a relation is joined to itself via table aliasing (e.g. t1 JOIN t2 ON t1.parent_id = t2.id).",
    "analogy": "Comparing an employee to their manager when both are listed in the same Staff directory.",
    "followup": "Faculty: 'Where is it used?' -> Answer: In custody_transfers, joining investigators twice (as sender i1 and receiver i2)."
  },
  {
    "id": 22,
    "cat": "SQL Queries",
    "diff": "Advanced",
    "q": "How does MySQL's REGEXP_LIKE function enforce data constraints?",
    "simple": "It tests if a text value matches a specific pattern, like checking that an email has '@' or a hash is exactly 64 hex characters.",
    "tech": "REGEXP_LIKE evaluates a regular expression pattern against a string attribute. In our schema, CHECK(REGEXP_LIKE(original_hash, '^[0-9a-f]{64}$')) rejects any string that is not exactly 64 lowercase hexadecimal digits.",
    "analogy": "A coin slot that only accepts coins of exact diameter and thickness.",
    "followup": "Faculty: 'What happens if a user submits an MD5 hash (32 characters)?' -> Answer: MySQL raises a CHECK constraint violation error immediately."
  },
  {
    "id": 23,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "Why did you use ON DELETE RESTRICT on your foreign keys instead of CASCADE?",
    "simple": "In forensics, you must never allow history to be erased! If someone deletes a case, we cannot let the evidence or audit records vanish automatically.",
    "tech": "CASCADE would delete child evidence when a parent case is removed. Furthermore, MySQL does not fire triggers on cascaded delete events, which would allow deletions to escape forensic auditing.",
    "analogy": "A police station cannot shred a murder weapon just because a court case file is archived.",
    "followup": "Faculty: 'How do you clean up a test case then?' -> Answer: You must explicitly delete child records in the correct dependency order, which fires individual triggers for each deletion."
  },
  {
    "id": 24,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "How do your database triggers capture the user identity if the trigger runs inside MySQL?",
    "simple": "When our Python backend borrows a database connection for a user, it runs SET @app_investigator_id = 5. The trigger reads this session variable.",
    "tech": "FastAPI context management executes SET @app_investigator_id = :uid, @app_client_ip = :ip on the pooled connection before running queries. MySQL triggers access NULLIF(@app_investigator_id, 0) and CURRENT_USER().",
    "analogy": "A detective clipping their visitor badge onto their coat before entering the secure evidence room.",
    "followup": "Faculty: 'What happens when connection pooling reuses the connection?' -> Answer: The Python context manager always executes SET @app_investigator_id = NULL upon connection release to prevent identity leakage."
  },
  {
    "id": 25,
    "cat": "Project Database Architecture",
    "diff": "Advanced",
    "q": "How did you make the audit log append-only in MySQL?",
    "simple": "We put BEFORE UPDATE and BEFORE DELETE triggers on audit_logs that throw an error if anyone tries to change or delete a row.",
    "tech": "Triggers trg_audit_bu and trg_audit_bd execute SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'. Furthermore, the application user ghost_app is only granted SELECT and INSERT on audit_logs.",
    "analogy": "A mailbox with a one-way slot: you can drop letters in, but you cannot reach inside to take them back out.",
    "followup": "Faculty: 'Can the root user still delete audit rows?' -> Answer: Even root is stopped by the triggers! Root would have to explicitly DROP the trigger first, which generates its own administrative event."
  },
  {
    "id": 26,
    "cat": "Project Database Architecture",
    "diff": "Advanced",
    "q": "Why does audit_logs.related_case_id have NO foreign key constraint to cases.case_id?",
    "simple": "Forensic history must survive even if a case is purged or modified in the future.",
    "tech": "In digital forensics, an audit log must never be cascaded or blocked by foreign key constraints from surviving independent of business entity lifecycles.",
    "analogy": "Black box flight recorders must survive even if the airplane itself is decommissioned.",
    "followup": "Faculty: 'How do you look up the case then?' -> Answer: We use a LEFT JOIN on related_case_id in vw_audit_trail."
  },
  {
    "id": 27,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "Why is the current custodian of evidence NOT stored as a column in the evidence table?",
    "simple": "To satisfy Third Normal Form (3NF) and avoid duplicate, conflicting data.",
    "tech": "In 3NF, non-key attributes must not transitively depend on other non-key attributes. Storing current custodian directly in evidence would duplicate data stored in custody_transfers. Stored function fn_current_custodian derives it dynamically.",
    "analogy": "Not writing down who currently holds a borrowed library book on the book's cover, but checking the checkout log instead.",
    "followup": "Faculty: 'Doesn't calling a stored function make SELECT queries slower?' -> Answer: The custody_transfers table has an index on (evidence_id, transfer_timestamp DESC), making lookup instantaneous O(1)."
  },
  {
    "id": 28,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "What does stored function fn_current_custodian do?",
    "simple": "It looks up the custody transfers table and finds who received the item most recently.",
    "tech": "It executes: SELECT to_investigator_id FROM custody_transfers WHERE evidence_id = p_evidence_id ORDER BY transfer_timestamp DESC, transfer_id DESC LIMIT 1. Returns the investigator_id.",
    "analogy": "Asking: 'Who was the last person to sign the sign-out sheet?'",
    "followup": "Faculty: 'What if an evidence item has zero transfers?' -> Answer: sp_register_evidence creates an initial intake transfer record atomically during creation, ensuring at least one transfer always exists."
  },
  {
    "id": 29,
    "cat": "Project Database Architecture",
    "diff": "Advanced",
    "q": "How does sp_register_evidence maintain ACID consistency?",
    "simple": "It runs START TRANSACTION, inserts the evidence, creates the first custody record, and logs the initial hash check. If any step fails, it rolls back everything.",
    "tech": "It uses DECLARE EXIT HANDLER FOR SQLEXCEPTION to execute ROLLBACK. Under normal execution, it performs 3 coordinated inserts and commits atomically.",
    "analogy": "Buying groceries: the cashier rings up all items before taking your money; you don't pay for each apple individually.",
    "followup": "Faculty: 'What happens if a duplicate evidence_code is entered?' -> Answer: The UNIQUE constraint triggers SQLEXCEPTION, initiating a full rollback with zero partial state."
  },
  {
    "id": 30,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "What does trigger trg_evidence_protect_original_hash do?",
    "simple": "It prevents anyone from updating the original hash recorded when the evidence was first created.",
    "tech": "It is a BEFORE UPDATE trigger on evidence. If NEW.original_hash <> OLD.original_hash, it executes SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'original_hash cannot be modified'.",
    "analogy": "A tamper-evident wax seal that cannot be replaced once stamped.",
    "followup": "Faculty: 'How can the current hash change then?' -> Answer: current_hash and integrity_status can update, but original_hash remains permanently locked."
  },
  {
    "id": 31,
    "cat": "Project Database Architecture",
    "diff": "Beginner",
    "q": "What is the difference between a Stored Procedure and a Stored Function?",
    "simple": "A function returns one single answer and can be used directly in SELECT queries. A procedure is called with CALL and can perform transactions.",
    "tech": "Functions return a deterministic scalar value, cannot manage transaction boundaries (START/COMMIT), and can be embedded in SQL expressions. Procedures are invoked via CALL, return zero or more result sets, and can execute transaction commands.",
    "analogy": "A function is a calculator button; a procedure is a multi-step recipe.",
    "followup": "Faculty: 'Name one procedure and one function from your project.' -> Answer: Procedure: sp_create_case; Function: fn_current_custodian."
  },
  {
    "id": 32,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "What database views did you create, and why use views instead of direct queries?",
    "simple": "We created 7 views (like vw_dashboard_stats and vw_audit_trail) so complex joins don't need to be rewritten in Python and to give secure, clean access.",
    "tech": "Views provide encapsulation, logical data independence, query reusability, and column-level security. We created vw_dashboard_stats, vw_case_summary, vw_audit_trail, vw_evidence_detail, vw_custody_history, vw_recent_tampering, and vw_investigator_workload.",
    "analogy": "A customized report template that automatically pulls numbers from multiple sheets.",
    "followup": "Faculty: 'Are these views updatable?' -> Answer: No, they contain aggregates, joins, and derived columns, making them read-only by relational definition."
  },
  {
    "id": 33,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "How is the Many-to-Many relationship between cases and investigators modeled?",
    "simple": "Using a junction bridge table called case_assignments with foreign keys to both tables.",
    "tech": "Modeled via table case_assignments featuring foreign keys case_id -> cases and investigator_id -> investigators, with a composite UNIQUE(case_id, investigator_id) constraint.",
    "analogy": "A student enrollment table linking students to courses.",
    "followup": "Faculty: 'What happens when an investigator is removed from a case?' -> Answer: We set assignment_status = 'REMOVED' rather than physically deleting the row to preserve forensic history."
  },
  {
    "id": 34,
    "cat": "Project Database Architecture",
    "diff": "Advanced",
    "q": "What database indexes did you create and what was the rationale?",
    "simple": "We created indexes on search columns like (investigator_id, timestamp) in audit logs and (session_token, expires_at) in sessions.",
    "tech": "1. Composite index idx_audit_actor_time on audit_logs(investigator_id, timestamp) for user activity timelines; 2. idx_custody_evidence_time on custody_transfers(evidence_id, transfer_timestamp DESC) for fn_current_custodian; 3. idx_sessions_lookup on app_sessions(session_token, expires_at).",
    "analogy": "Tabs in a filing cabinet organizing files by date and detective name.",
    "followup": "Faculty: 'Why not put an index on every single column?' -> Answer: Indexes consume disk space and slow down INSERT and UPDATE operations because every index tree must be updated."
  },
  {
    "id": 35,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "How does login_attempts defend against brute-force attacks?",
    "simple": "Every login attempt is logged. If 5 failed attempts happen within 15 minutes for the same email, the account is temporarily locked.",
    "tech": "Before authenticating, the API queries login_attempts for COUNT(*) WHERE email = :email AND is_successful = 0 AND attempted_at > NOW() - INTERVAL 15 MINUTE. If count >= 5, it raises HTTP 429 Too Many Requests.",
    "analogy": "An iPhone disabling itself for 15 minutes after entering the wrong passcode 5 times.",
    "followup": "Faculty: 'Why store this in MySQL instead of in-memory Redis?' -> Answer: Storing it in MySQL provides persistence across backend server restarts and complete forensic auditability."
  },
  {
    "id": 36,
    "cat": "Project Database Architecture",
    "diff": "Intermediate",
    "q": "What is the relationship between detection_rules and ai_alerts?",
    "simple": "detection_rules is the rulebook; ai_alerts is the list of specific times someone broke a rule.",
    "tech": "A 1:N relationship. detection_rules stores rule definitions, descriptions, severities, and base risk scores. ai_alerts references rule_id as a foreign key and records specific incident occurrences.",
    "analogy": "The traffic laws handbook (rules) versus actual speeding tickets issued to drivers (alerts).",
    "followup": "Faculty: 'Can new detection rules be added without changing the database schema?' -> Answer: Yes, by simply inserting a new row into detection_rules."
  },
  {
    "id": 37,
    "cat": "Project Database Architecture",
    "diff": "Advanced",
    "q": "How is the case risk score calculated in investigation_reports?",
    "simple": "It sums up the scores of all active alerts on the case and adds extra penalty points if any evidence is tampered with, capped at 100.",
    "tech": "Calculated dynamically: Sum of associated alert scores (weighted by severity) + 30 points per COMPROMISED evidence file, normalized to a maximum score of 100.",
    "analogy": "Credit score calculation taking into account late payments and default penalties.",
    "followup": "Faculty: 'Where can we see this in the SQL demo?' -> Answer: In Query 28 of 12_advanced_queries.sql."
  },
  {
    "id": 38,
    "cat": "Project Database Architecture",
    "diff": "Advanced",
    "q": "Why is MySQL 8 required rather than older MySQL 5.7?",
    "simple": "Because MySQL 8 adds JSON_TABLE, Common Table Expressions (WITH), Window Functions (ROW_NUMBER), and regex CHECK constraints.",
    "tech": "MySQL 8 introduced recursive CTEs, analytic window functions, JSON functions (JSON_TABLE, JSON_OBJECT), declarative CHECK constraints, and default caching_sha2_password authentication\u2014all essential components of this project.",
    "analogy": "Upgrading from a flip phone to a modern smartphone with GPS and cameras.",
    "followup": "Faculty: 'What happens if we run this schema on MySQL 5.7?' -> Answer: The DDL script fails because MySQL 5.7 parses CHECK constraints as no-op comments and rejects CTE/window function syntax."
  },
  {
    "id": 39,
    "cat": "Forensics & Cybersecurity",
    "diff": "Beginner",
    "q": "Why did you use SHA-256 instead of MD5 or SHA-1 for evidence hashing?",
    "simple": "MD5 and SHA-1 are broken: researchers can create two different files with the exact same hash (collision). SHA-256 is collision-resistant and legally accepted.",
    "tech": "MD5 and SHA-1 suffer from demonstrated practical collision attacks (e.g. Google's SHAttered attack on SHA-1). SHA-256 has a 256-bit keyspace with zero known practical collisions, meeting NIST and ISO forensic evidentiary standards.",
    "analogy": "Using a modern biometric retina scanner instead of an easily forged paper signature.",
    "followup": "Faculty: 'What is the length of a SHA-256 digest in hex characters?' -> Answer: 64 hexadecimal characters (256 bits divided by 4 bits per hex character)."
  },
  {
    "id": 40,
    "cat": "Forensics & Cybersecurity",
    "diff": "Intermediate",
    "q": "What is the Cryptographic Avalanche Effect and how did you demonstrate it?",
    "simple": "It means changing even one tiny letter in a file completely scrambles its entire 64-character hash code.",
    "tech": "A property of cryptographic hash functions where flipping a single input bit results in an unpredictable, statistically uncorrelated change in approximately 50% of the output digest bits.",
    "analogy": "A tiny rock tumble triggering an entire mountainside avalanche.",
    "followup": "Faculty: 'Which evidence item demonstrates this?' -> Answer: Item EV-0007, where a single altered payroll value changed the entire hash, instantly triggering a TAMPERED state."
  },
  {
    "id": 41,
    "cat": "Forensics & Cybersecurity",
    "diff": "Beginner",
    "q": "What is Chain of Custody and why is it legally critical?",
    "simple": "It is proof of who had the evidence every minute. Without it, the defense lawyer will say someone tampered with the evidence, and the judge will throw it out.",
    "tech": "A legal process tracking chronological custody, transfer, analysis, and disposition of physical and electronic evidence to prove evidence integrity under Federal Rule of Evidence 901.",
    "analogy": "A baton in a relay race: if dropped without being handed off, the team is disqualified.",
    "followup": "Faculty: 'What table tracks this?' -> Answer: custody_transfers."
  },
  {
    "id": 42,
    "cat": "Forensics & Cybersecurity",
    "diff": "Intermediate",
    "q": "What is the difference between Hashing and Encryption?",
    "simple": "Hashing is one-way: you cannot get the original file back from the hash. Encryption is two-way: you can decrypt the text back with a key.",
    "tech": "Hashing is a deterministic one-way mathematical function mapping variable-length data to fixed-length digests. Encryption is a reversible transformation requiring symmetric or asymmetric keys for decryption.",
    "analogy": "Hashing is grinding coffee beans (cannot reassemble the bean); encryption is locking money in a safe (can unlock with key).",
    "followup": "Faculty: 'Why not encrypt the evidence files instead of hashing them?' -> Answer: We hash to prove integrity; files can also be encrypted at rest, but hashing is necessary to verify that decryption produced the unaltered original."
  },
  {
    "id": 43,
    "cat": "Forensics & Cybersecurity",
    "diff": "Intermediate",
    "q": "What is Non-Repudiation and how does SQL Ghost Hunter achieve it?",
    "simple": "Non-repudiation means proof so strong that a person cannot lie and say 'I didn't do it'.",
    "tech": "The assurance that a subject cannot deny having performed an action. Achieved via database triggers recording investigator ID, client IP, MySQL username, and microsecond timestamps in an append-only table.",
    "analogy": "Signing a certified postal delivery slip in front of a postal officer.",
    "followup": "Faculty: 'What if the user claims someone used their computer?' -> Answer: We correlate the database audit log with login_attempts and app_sessions IP addresses."
  },
  {
    "id": 44,
    "cat": "Forensics & Cybersecurity",
    "diff": "Intermediate",
    "q": "How does Role-Based Access Control (RBAC) work in SQL Ghost Hunter?",
    "simple": "We have 4 roles: Admin (can do everything), Lead Investigator (manages cases), Investigator (uploads evidence), and Auditor (can only look, cannot change).",
    "tech": "Enforces 4 hierarchical roles (ADMIN, LEAD_INVESTIGATOR, INVESTIGATOR, AUDITOR). Permissions are validated on API endpoints via dependencies and reflected in UI button visibility.",
    "analogy": "Hospital staff: Chief Doctor, Surgeon, Nurse, and Medical Inspector.",
    "followup": "Faculty: 'Can an Auditor register evidence?' -> Answer: No, the backend raises HTTP 403 Forbidden and the UI hides the registration button."
  },
  {
    "id": 45,
    "cat": "Forensics & Cybersecurity",
    "diff": "Advanced",
    "q": "What is the Principle of Least Privilege and how is ghost_app configured?",
    "simple": "Giving software only the bare minimum permissions to do its job, so if it gets hacked, the hacker cannot destroy the database.",
    "tech": "The principle that an account must possess only the minimum privileges necessary to execute authorized functions. ghost_app is granted SELECT, INSERT, UPDATE on core tables, but explicitly DENIED DELETE and DROP on audit_logs and custody_transfers.",
    "analogy": "Giving a valet parking key that only drives the car, but cannot open the glove compartment.",
    "followup": "Faculty: 'Where is this SQL script?' -> Answer: 13_security_privileges.sql."
  },
  {
    "id": 46,
    "cat": "Forensics & Cybersecurity",
    "diff": "Intermediate",
    "q": "What is CSRF and how does the frontend protect against it?",
    "simple": "CSRF is when a malicious website secretly tricks your browser into making requests to our app while you are logged in. We stop it using custom headers and SameSite cookies.",
    "tech": "Cross-Site Request Forgery. Protected by setting session cookies with SameSite=Lax/Strict and requiring a custom header (X-Requested-With: GhostHunter) on state-modifying requests which standard cross-origin forms cannot set.",
    "analogy": "A bank teller refusing a check unless the person is physically standing in the bank with photo ID.",
    "followup": "Faculty: 'Can an evil website set custom headers via fetch?' -> Answer: No, cross-origin fetch requests with custom headers are blocked by browser CORS preflight checks."
  },
  {
    "id": 47,
    "cat": "Forensics & Cybersecurity",
    "diff": "Beginner",
    "q": "How are passwords stored in SQL Ghost Hunter?",
    "simple": "They are scrambled using bcrypt with 12 rounds of salt. Even the database administrator cannot read them.",
    "tech": "Stored in investigators.password_hash using bcrypt. Bcrypt incorporates a per-user random 128-bit salt and an exponential cost factor (12 rounds = 4,096 iterations) to defeat rainbow tables and GPU cracking.",
    "analogy": "Scrambling eggs: once scrambled, you cannot un-scramble them back into an egg.",
    "followup": "Faculty: 'Why not use SHA-256 for passwords?' -> Answer: SHA-256 is designed to be extremely fast; attackers can calculate billions of SHA-256 hashes per second on GPUs. Bcrypt is intentionally slow and memory-intensive."
  },
  {
    "id": 48,
    "cat": "Forensics & Cybersecurity",
    "diff": "Beginner",
    "q": "What evidence integrity statuses exist in your database?",
    "simple": "VERIFIED (hashes match perfectly), COMPROMISED (file was changed on disk), and UNCHECKED (not yet tested).",
    "tech": "Enforced by CHECK(integrity_status IN ('VERIFIED','COMPROMISED','UNCHECKED')). When an integrity check detects a hash mismatch, it updates to 'COMPROMISED' and logs an alert.",
    "analogy": "A traffic signal: Green (Verified), Red (Compromised), Amber (Unchecked).",
    "followup": "Faculty: 'Which table stores the status?' -> Answer: Cached in evidence.integrity_status and permanently logged in integrity_checks."
  },
  {
    "id": 49,
    "cat": "Forensics & Cybersecurity",
    "diff": "Advanced",
    "q": "How does the system distinguish insider tampering from external attacks?",
    "simple": "Insider tampering usually has a logged-in investigator ID and occurs during off-hours. External direct database tampering bypasses the app entirely, leaving investigator_id = NULL.",
    "tech": "The system correlates @app_investigator_id session variables with CURRENT_USER(). If a modification occurs with @app_investigator_id = NULL, it flags DIRECT_DB_BYPASS. If an authenticated user modifies data outside 8 AM - 6 PM, it flags OFF_HOURS_MODIFICATION.",
    "analogy": "An employee using their keycard at 2 AM versus an intruder climbing through the window.",
    "followup": "Faculty: 'Which anomaly rule detects the direct bypass?' -> Answer: Rule DIRECT_DB_MODIFICATION in detector.py."
  },
  {
    "id": 50,
    "cat": "Technology Stack",
    "diff": "Beginner",
    "q": "Why did you choose FastAPI over Flask or Django?",
    "simple": "FastAPI is extremely fast, has automatic input validation using Pydantic, and generates interactive API documentation automatically.",
    "tech": "FastAPI is built on Starlette and asyncio, offering asynchronous I/O performance on par with NodeJS and Go. Its declarative Pydantic schemas enforce type safety and OpenAPI standard documentation out of the box.",
    "analogy": "FastAPI is like an electric high-speed train; Django is like a heavy cargo ship.",
    "followup": "Faculty: 'How do you handle password hashing in your Python backend?' -> Answer: Using bcrypt with automated per-user salt generation and 12 work rounds."
  },
  {
    "id": 51,
    "cat": "Technology Stack",
    "diff": "Intermediate",
    "q": "What is the difference between ASGI and WSGI?",
    "simple": "WSGI handles requests one by one (synchronous). ASGI can handle thousands of requests simultaneously using async/await.",
    "tech": "WSGI (Web Server Gateway Interface) is synchronous and blocks the thread during I/O. ASGI (Asynchronous Server Gateway Interface) supports asynchronous concurrency, background tasks, and WebSockets.",
    "analogy": "A single waiter serving one table from start to finish (WSGI) versus taking orders from multiple tables while meals are cooking (ASGI).",
    "followup": "Faculty: 'Which ASGI web server runs your app?' -> Answer: Uvicorn."
  },
  {
    "id": 52,
    "cat": "Technology Stack",
    "diff": "Intermediate",
    "q": "What is SQLAlchemy Core and why use it instead of SQLAlchemy ORM?",
    "simple": "Core lets us write real SQL queries with parameters, giving full control over MySQL features without the heavy overhead of ORM models.",
    "tech": "SQLAlchemy Core provides schema reflection and expression language centered around SQL constructs. We chose Core over the ORM to explicitly demonstrate raw DBMS concepts, avoid ORM caching opacity, and maintain direct control over SQL execution plans.",
    "analogy": "Driving a manual sports car with full gear control versus an automatic family sedan.",
    "followup": "Faculty: 'Show me where you wrote parameterized queries.' -> Answer: In backend/app/database.py, every helper executes text(query), params."
  },
  {
    "id": 53,
    "cat": "Technology Stack",
    "diff": "Beginner",
    "q": "Why use Vanilla JavaScript instead of React, Vue, or Angular?",
    "simple": "Vanilla JS runs directly in the browser with zero build steps, zero node_modules bloat, fast load times, and works offline.",
    "tech": "Native ES Modules provide standard browser import/export capabilities, predictable DOM manipulation, zero framework abstraction overhead, and complete independence from external npm build pipelines.",
    "analogy": "Walking on your own legs instead of needing crutches or a motorized scooter.",
    "followup": "Faculty: 'How do you navigate between pages without React Router?' -> Answer: Using window.location.hash and hashchange event listeners in frontend/js/router.js."
  },
  {
    "id": 54,
    "cat": "Technology Stack",
    "diff": "Beginner",
    "q": "How does client-side hash routing work in your frontend?",
    "simple": "When you click a link like '#/cases', the browser changes the URL hash. Our JavaScript listens for that change and swaps the content on screen without refreshing.",
    "tech": "The browser fires a hashchange event. router.js extracts window.location.hash, matches it against registered route patterns in PAGES, unmounts the current page, and dynamically mounts the new module.",
    "analogy": "Flipping to a specific tab in a binder without buying a new notebook.",
    "followup": "Faculty: 'What happens if a user enters an unknown hash?' -> Answer: The router redirects to the default '#/dashboard' route."
  },
  {
    "id": 55,
    "cat": "Technology Stack",
    "diff": "Beginner",
    "q": "What is Chart.js and how does it render charts in the browser?",
    "simple": "It is a JavaScript library that draws interactive charts on an HTML5 canvas element.",
    "tech": "Chart.js renders responsive HTML5 <canvas> 2D vector graphics. In SQL Ghost Hunter, it renders the 14-day activity timeline line chart and risk distribution charts locally without internet access.",
    "analogy": "An artist drawing an interactive graph on a whiteboard.",
    "followup": "Faculty: 'Where are the Chart.js files stored?' -> Answer: In frontend/assets/vendor/chart.umd.min.js."
  },
  {
    "id": 56,
    "cat": "Technology Stack",
    "diff": "Intermediate",
    "q": "What is Pydantic and how does FastAPI use it?",
    "simple": "Pydantic validates that the data sent to the server has the right types (like checking that age is an integer and email has an @).",
    "tech": "Pydantic provides data validation and settings management using Python type annotations. FastAPI uses Pydantic models to deserialize HTTP request JSON, validate schemas, and generate OpenAPI documentation.",
    "analogy": "A bouncer checking IDs at the door to ensure only valid people enter.",
    "followup": "Faculty: 'What error code does FastAPI return when Pydantic validation fails?' -> Answer: HTTP 422 Unprocessable Entity."
  },
  {
    "id": 57,
    "cat": "Technology Stack",
    "diff": "Intermediate",
    "q": "What is PyMySQL and why was it chosen?",
    "simple": "It is the pure Python driver that connects our Python code to the MySQL server.",
    "tech": "PyMySQL is a pure-Python MySQL client implementing the Python DB API v2.0. It requires no C compilers to install and seamlessly supports MySQL 8 caching_sha2_password authentication.",
    "analogy": "An HDMI cable connecting your laptop to a monitor.",
    "followup": "Faculty: 'Why not mysqlclient?' -> Answer: PyMySQL is pure Python, eliminating cross-platform C-extension compilation issues on Windows and Linux."
  },
  {
    "id": 58,
    "cat": "Technology Stack",
    "diff": "Intermediate",
    "q": "What is Ollama and how is local AI integration achieved?",
    "simple": "Ollama runs AI language models on your own PC without sending data to OpenAI or Google.",
    "tech": "Ollama is a local LLM runtime that executes open-weight models (like llama3.2:3b) via local HTTP APIs. SQL Ghost Hunter communicates with Ollama locally, ensuring zero sensitive forensic data leaves the machine.",
    "analogy": "A private in-house detective who never talks to outside reporters.",
    "followup": "Faculty: 'What happens if Ollama is not installed?' -> Answer: The AI assistant automatically falls back to an offline heuristic rule-based response engine."
  },
  {
    "id": 59,
    "cat": "Technology Stack",
    "diff": "Advanced",
    "q": "How does the anomaly detector work without relying on cloud AI?",
    "simple": "It uses 11 deterministic rule algorithms and statistical math (z-scores) directly in Python, running 100% locally.",
    "tech": "The engine uses statistical outlier detection (Z-scores for activity spikes), heuristic rules (off-hours windows, privilege escalation patterns), and optional unsupervised Isolation Forests via scikit-learn.",
    "analogy": "A smoke detector that triggers on physical smoke particles without needing internet access.",
    "followup": "Faculty: 'Why is deterministic anomaly detection preferable in digital forensics?' -> Answer: It produces repeatable, explainable evidence that can be presented in court, unlike non-deterministic black-box LLMs."
  },
  {
    "id": 60,
    "cat": "Technology Stack",
    "diff": "Beginner",
    "q": "How is the Apple-inspired Liquid Glass UI implemented in CSS?",
    "simple": "Using CSS backdrop-filter blur, translucent background colors (rgba), soft borders, and rounded corners.",
    "tech": "Utilizes CSS backdrop-filter: blur(20px) saturate(180%), semi-transparent background: rgba(255, 255, 255, 0.72), 1px solid rgba(255, 255, 255, 0.4) borders, and subtle box-shadows.",
    "analogy": "Looking through a pane of frosted glass in an upscale modern office.",
    "followup": "Faculty: 'Does this require external CSS frameworks like Tailwind or Bootstrap?' -> Answer: No, it is 100% custom CSS in help-glass.css."
  },
  {
    "id": 61,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "If the MySQL database server is stopped, and someone alters a file on disk, how does Ghost Hunter know?",
    "simple": "The next time an investigator clicks 'Verify Integrity' or scheduled checks run, the recalculated SHA-256 hash will not match the original hash stored in MySQL.",
    "tech": "The offline modification does not trigger live triggers because MySQL was stopped. However, the system relies on cryptographic non-repudiation: evidence.original_hash is sealed in MySQL. Re-verification hashes the disk file and discovers the discrepancy, updating the status to TAMPERED.",
    "analogy": "If someone swaps a museum painting at night, the security guard doesn't see it happen, but the morning inspection immediately spots that the signature doesn't match.",
    "followup": "Faculty: 'What if they also modify the MySQL data files on disk?' -> Answer: In InnoDB, modifying raw .ibd files directly corrupts pages and checksums, causing MySQL to fail startup or reject corrupted tablespace pages."
  },
  {
    "id": 62,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "What if an attacker with OS root access modifies MySQL tablespace files directly on disk?",
    "simple": "InnoDB will crash or detect checksum corruption because raw database files have internal checksums on every single page.",
    "tech": "InnoDB writes 16KB pages protected by crc32 or innodb checksums in the page header and trailer. Modifying bytes on disk without recalculating page checksums triggers an immediate page corruption assertion during read, forcing a crash or table corruption error.",
    "analogy": "Trying to edit a sealed passport page by hand: the ultraviolet watermark immediately reveals the forgery.",
    "followup": "Faculty: 'Does SQL Ghost Hunter claim to prevent OS root compromises?' -> Answer: No, as stated in our architecture disclaimer, OS root access is outside the database trust boundary."
  },
  {
    "id": 63,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "How does your system prevent duplicate alert spam if an anomaly happens continuously?",
    "simple": "We create a unique cryptographic fingerprint for each alert based on the rule code and record ID. If the alert already exists, we update it instead of creating duplicates.",
    "tech": "Table ai_alerts enforces a UNIQUE(fingerprint) constraint. The fingerprint is computed as SHA2(CONCAT(rule_code, ':', COALESCE(record_id, 0), ':', window), 256). MySQL executes INSERT ... ON DUPLICATE KEY UPDATE to maintain idempotency.",
    "analogy": "A fire alarm ringing once continuously rather than a thousand new fire alarms being installed on the wall.",
    "followup": "Faculty: 'Where is this implemented?' -> Answer: In backend/app/ai/detector.py."
  },
  {
    "id": 64,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "Can an investigator delete themselves from a case to hide their actions?",
    "simple": "No! Case assignments can only be marked as 'REMOVED' to preserve history, and removing someone generates an audit log row.",
    "tech": "case_assignments maintains an assignment_status column with values ('ACTIVE', 'REMOVED'). Trigger trg_assignments_ad logs any deletion, and RBAC requires cases.manage permissions to modify team rosters.",
    "analogy": "You cannot erase your signature from a sign-in sheet; you can only sign out.",
    "followup": "Faculty: 'Which stored procedure handles assignment?' -> Answer: sp_assign_investigator."
  },
  {
    "id": 65,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "What happens if a database trigger encounters an error during an UPDATE?",
    "simple": "The entire UPDATE operation is cancelled and rolled back, exactly as if it was never run.",
    "tech": "Triggers execute within the same transactional context as the triggering DML statement. If a trigger executes SIGNAL SQLSTATE '45000' or fails, MySQL aborts the statement and rolls back any pending changes.",
    "analogy": "A circuit breaker tripping and cutting electricity before a wire catches fire.",
    "followup": "Faculty: 'Does the audit log row get written if the trigger aborts?' -> Answer: If an AFTER trigger aborts, the entire transaction rolls back; if a BEFORE trigger aborts, the row never enters the table."
  },
  {
    "id": 66,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Intermediate",
    "q": "Why does SQL Ghost Hunter explicitly say it is NOT 100% tamper-proof?",
    "simple": "Because being honest is academically and professionally correct: no software can stop someone who has physical ownership of the computer hardware.",
    "tech": "In information security, claims of 100% security violate Kerckhoffs's principle and security fundamentals. Physical hardware access, BIOS manipulation, and OS-level root compromise exist outside the DBMS trust boundary.",
    "analogy": "A bank vault is impenetrable to lock-pickers, but cannot survive a military bunker-buster bomb.",
    "followup": "Faculty: 'What DOES SQL Ghost Hunter guarantee?' -> Answer: It guarantees non-repudiation for all operations inside the database engine and cryptographic detection of file tampering."
  },
  {
    "id": 67,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Intermediate",
    "q": "How does the system detect an off-hours database modification?",
    "simple": "The anomaly engine checks the timestamp of audit logs: if an update happens between 8 PM and 6 AM or on a Sunday, it flags it as off-hours.",
    "tech": "Rule OFF_HOURS_MODIFICATION checks HOUR(timestamp) NOT BETWEEN 8 AND 18 OR DAYOFWEEK(timestamp) IN (1, 7). Off-hours modifications receive a +30 point risk penalty.",
    "analogy": "A bank motion sensor alerting security because an office door opened on Sunday night.",
    "followup": "Faculty: 'Can an investigator legitimately work late?' -> Answer: Yes; the alert is flagged for review, not automatically dismissed or prosecuted."
  },
  {
    "id": 68,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "If root can DROP triggers, how can an organization detect a rogue root user?",
    "simple": "MySQL's General Query Log and binary log record the DDL DROP TRIGGER command, and Ghost Hunter flags sudden missing trigger alerts.",
    "tech": "Dropping a trigger is a DDL command recorded in MySQL's binary logs. Furthermore, external monitoring scripts compare expected trigger catalog counts in information_schema.TRIGGERS and raise an immediate administrative alarm if triggers are absent.",
    "analogy": "Cutting the wires of a security camera is itself captured on film right before the screen goes black.",
    "followup": "Faculty: 'Does ghost_app have DROP TRIGGER privileges?' -> Answer: Absolutely not. ghost_app cannot alter or drop triggers."
  },
  {
    "id": 69,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "What happens if two investigators try to transfer the same evidence item concurrently?",
    "simple": "MySQL uses row-level locking: the first transfer succeeds, and the second transfer fails because the sender is no longer the current custodian.",
    "tech": "sp_transfer_custody executes SELECT fn_current_custodian(p_evidence_id) FOR UPDATE. This row lock serializes execution. The second caller fails the authorization check (from_investigator_id != current_custodian) and rolls back.",
    "analogy": "Two people trying to grab the same physical package at the exact same second.",
    "followup": "Faculty: 'What isolation level prevents this race condition?' -> Answer: REPEATABLE READ with SELECT ... FOR UPDATE."
  },
  {
    "id": 70,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "How does the AI Assistant avoid hallucinations when answering questions?",
    "simple": "It is not allowed to make up facts. We query MySQL first, get the real facts, and feed those exact facts into the AI's prompt.",
    "tech": "Using Retrieval-Augmented Grounding: the backend executes deterministic SQL queries against views (like vw_case_summary) and injects the JSON results into the LLM system prompt with strict instructions: 'Answer ONLY using the provided database facts'.",
    "analogy": "An open-book exam where the student must point to the exact page and paragraph of the textbook.",
    "followup": "Faculty: 'What happens if the question cannot be answered by the database?' -> Answer: The assistant responds: 'The database does not contain records to answer that question'."
  },
  {
    "id": 71,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Intermediate",
    "q": "Why are old and new values stored as JSON rather than separate columns for each field?",
    "simple": "Because different tables have completely different columns! JSON allows one audit table to store changes for cases, evidence, or users flexibly.",
    "tech": "Schema genericity: creating specific before/after columns for each table would require 12 separate audit tables. Storing JSON objects provides a unified schema for audit_logs while MySQL 8's JSON_TABLE preserves relational querying power.",
    "analogy": "A universal shipping container that can hold clothes, electronics, or books without changing the container's shape.",
    "followup": "Faculty: 'Can MySQL index inside JSON columns?' -> Answer: Yes, MySQL 8 supports Multi-Valued Indexes and functional indexes on JSON expressions."
  },
  {
    "id": 72,
    "cat": "Project-Specific Tricky Questions",
    "diff": "Advanced",
    "q": "If an investigator claims someone spoofed their session, how do you verify?",
    "simple": "We cross-check the IP address in app_sessions and login_attempts with the client_ip stored in audit_logs.",
    "tech": "We cross-reference audit_logs.client_ip with app_sessions.ip_address and login_attempts history. A mismatch between the investigator's typical IP subnet and the audit log IP provides forensic proof of session hijacking or proxy abuse.",
    "analogy": "Checking security camera footage at the building entrance to see if someone else used the stolen badge.",
    "followup": "Faculty: 'What if they used the same computer?' -> Answer: We analyze keystroke intervals, consecutive activity timestamps, and active concurrent sessions in app_sessions."
  }
];

export const TEACH_ME_MODES = [
  {
    "id": "kid",
    "title": "Explain Like I'm 10",
    "badge": "5th-Standard Level",
    "desc": "Super simple analogies, no scary jargon, easy to picture.",
    "content": "Think of SQL Ghost Hunter as a magical school diary.\n\nWhen a teacher gives you marks in a notebook, someone might want to sneak in and erase a '40' and write '90'.\nIn a regular computer, when someone changes a number, the old number is forgotten forever!\n\nSQL Ghost Hunter does three magical things:\n1. It has an invisible guard (called a Database Trigger) that snaps a photo of the old number and the new number the split-second anyone tries to change it.\n2. It gives every important file a secret mathematical stamp (called SHA-256). If someone changes even a tiny dot or letter, the stamp breaks and turns bright red!\n3. It has a smart detective helper that watches out for suspicious tricks, like someone opening the diary at 3 in the morning or erasing five pages at once."
  },
  {
    "id": "btech",
    "title": "Explain Like a 2nd-Year BTech Student",
    "badge": "Academic DBMS Level",
    "desc": "Focuses on syllabus concepts: Relational model, 3NF, Triggers, Views, ACID.",
    "content": "SQL Ghost Hunter is a full-stack database forensics platform designed around MySQL 8.0 and Python FastAPI.\n\nHere is how the DBMS architecture connects:\n- **Schema & Normalization:** All 12 tables are normalized to 3NF. Transitive dependencies are removed\u2014for example, the current custodian is not stored in the evidence table; it is derived from `custody_transfers` using a stored function.\n- **Triggers for Active Monitoring:** Instead of passive polling, MySQL `AFTER INSERT/UPDATE/DELETE` triggers automatically capture row-level diffs into JSON objects and write append-only records to `audit_logs`.\n- **Integrity Constraints:** Declarative constraints like `CHECK (REGEXP_LIKE(original_hash, '^[0-9a-f]{64}$'))` and `ON DELETE RESTRICT` enforce referential consistency.\n- **ACID Transactions:** Stored procedures like `sp_register_evidence` bundle multi-table writes inside `START TRANSACTION ... COMMIT` to prevent orphan records.\n- **Security:** Least-privilege separation between `root` and application user `ghost_app` prevents log wiping."
  },
  {
    "id": "tech",
    "title": "Explain Technically (Senior Engineer)",
    "badge": "Production Architecture Level",
    "desc": "Under the hood: PyMySQL, connection checkout hooks, JSON_TABLE, and async event loops.",
    "content": "SQL Ghost Hunter implements defense-in-depth forensics via decoupled architectural layers:\n- **Identity Attribution:** During SQLAlchemy connection checkout, session context injects user variables `@app_investigator_id` and `@app_client_ip` directly into the MySQL connection session, cleared on check-in. Triggers read these along with `USER()` to reliably distinguish application users from raw DBA direct-access bypasses.\n- **Immutable Append-Only Semantics:** Triggers on `audit_logs`, `integrity_checks`, and `custody_transfers` raise SQLSTATE 45000 on `BEFORE UPDATE/DELETE`, enforcing WORM (Write Once, Read Many) behavior.\n- **Idempotent Anomaly Pipeline:** 11 detectors scan sliding temporal windows using z-score standardization and IsolationForest. Findings are upserted into `ai_alerts` with deterministic SHA-256 fingerprints to guarantee duplicate suppression.\n- **Grounding Architecture:** The optional local LLM runtime (Ollama) has zero database write access and strictly receives pre-queried relational facts from MySQL views, eliminating hallucinations."
  },
  {
    "id": "viva",
    "title": "Explain for Viva (Examiner Ready)",
    "badge": "Viva Examination Mode",
    "desc": "Punchy, academic, structured answers that score full marks with college professors.",
    "content": "When asked 'What is your project?' say:\n'Sir/Ma'am, SQL Ghost Hunter is an AI-assisted relational database forensics system built on MySQL 8 and FastAPI. Its primary objective is proving non-repudiation in database modifications and digital evidence management.\nKey highlights:\n1. Normalization: 12 tables designed in 3NF with zero transitive dependencies.\n2. Active Auditing: AFTER triggers capture old and new row values as JSON in an append-only audit log.\n3. Cryptographic Integrity: SHA-256 hashes detect file tampering via the avalanche effect.\n4. Relational Chain of Custody: Handover tracking with mandatory integrity re-verification.\n5. Least Privilege: Application connects as ghost_app with zero DELETE permissions on audit trails.\n6. DBMS Syllabus: 31 cataloged SQL queries covering joins, CTEs, subqueries, and window functions.'"
  },
  {
    "id": "pitch",
    "title": "Presentation Pitch (Auditorium)",
    "badge": "Demonstration Speech",
    "desc": "Engaging, professional opening speech for college project expos and seminars.",
    "content": "Good morning everyone. In traditional database systems, when an insider alters sensitive records\u2014such as payroll amounts or medical history\u2014the original data is lost, and web server logs tell you nothing if the database was accessed directly.\n\nWe built SQL Ghost Hunter to solve this exact problem.\n\nEvery single change in SQL Ghost Hunter leaves an indelible trace. By placing intelligence directly inside the MySQL database engine through triggers, we capture before-and-after JSON diffs regardless of whether the change came from the web app or direct command line. We seal evidence files with cryptographic SHA-256 hashes, maintain an immutable chain of custody, and run automated anomaly detection to spot threats in real-time. Let me now demonstrate this live."
  }
];

export const QUIZ_QUESTIONS = [
  {
    "id": 1,
    "q": "What does the motto 'Every Database Change Leaves a Trace' refer to in this project?",
    "options": [
      "Files are automatically deleted after 30 days",
      "MySQL triggers capture before-and-after values for every INSERT, UPDATE, and DELETE in an audit log",
      "The user's screen is recorded as a video file",
      "Only SELECT queries are saved in text files"
    ],
    "answer": 1,
    "explain": "MySQL triggers (AFTER INSERT/UPDATE/DELETE) automatically write old and new values as JSON into the append-only audit_logs table."
  },
  {
    "id": 2,
    "q": "Why is the current custodian of evidence NOT stored as a column in the evidence table?",
    "options": [
      "Because investigators do not care who holds the evidence",
      "To satisfy Third Normal Form (3NF) and avoid transitive dependency redundancy",
      "Because MySQL does not support text columns",
      "To save 4 bytes of disk space"
    ],
    "answer": 1,
    "explain": "In 3NF, non-key columns must not depend on other non-key columns. Storing current custodian directly in evidence would create redundancy with custody_transfers. Stored function fn_current_custodian derives it dynamically."
  },
  {
    "id": 3,
    "q": "What happens if someone attempts to run DELETE FROM audit_logs WHERE log_id = 1;?",
    "options": [
      "The row is permanently erased with no warning",
      "The entire database is dropped",
      "A BEFORE DELETE trigger blocks the query with error: 'Audit history is append-only'",
      "MySQL shuts down"
    ],
    "answer": 2,
    "explain": "Trigger trg_audit_bd intercepts all DELETE statements on audit_logs and executes SIGNAL SQLSTATE '45000', enforcing strict append-only immutability."
  },
  {
    "id": 4,
    "q": "What cryptographic algorithm is used to verify digital evidence file integrity?",
    "options": [
      "MD5",
      "SHA-256",
      "ROT13",
      "Base64"
    ],
    "answer": 1,
    "explain": "SHA-256 produces a collision-resistant 256-bit (64 hex character) hash. MD5 is cryptographically broken and Base64 is only an encoding, not a hash."
  },
  {
    "id": 5,
    "q": "Why does the application connect to MySQL as ghost_app rather than root?",
    "options": [
      "Because root has no password",
      "Principle of Least Privilege: ghost_app has no DELETE or DROP privileges on audit or custody tables",
      "Because root is not allowed on localhost",
      "It is faster than root"
    ],
    "answer": 1,
    "explain": "Applying the Principle of Least Privilege ensures that even if an attacker exploits a vulnerability in the Python backend, they cannot execute DROP or DELETE on audit logs."
  },
  {
    "id": 6,
    "q": "What does the trigger trg_evidence_protect_original_hash do?",
    "options": [
      "Deletes the evidence file if it changes",
      "Rejects any UPDATE that attempts to alter original_hash from its registration value",
      "Encrypts the hash with AES-256",
      "Sends an email to the admin"
    ],
    "answer": 1,
    "explain": "The original hash recorded at evidence registration must be immutable. The BEFORE UPDATE trigger checks IF NEW.original_hash <> OLD.original_hash and aborts."
  },
  {
    "id": 7,
    "q": "Why does audit_logs.related_case_id have NO foreign key constraint to cases.case_id?",
    "options": [
      "Because the developers forgot to add it",
      "Forensic history must survive even if a case is purged or modified in the future",
      "MySQL does not support foreign keys on integers",
      "To make insertions 100 times faster"
    ],
    "answer": 1,
    "explain": "In digital forensics, an audit log must never be cascaded or blocked by foreign key constraints from surviving independent of business entity lifecycles."
  },
  {
    "id": 8,
    "q": "What is the Cryptographic Avalanche Effect?",
    "options": [
      "When a server overheats during encryption",
      "When a single bit change in input drastically scrambles approximately 50% of output hash bits",
      "When database records cascade delete",
      "When network traffic spikes suddenly"
    ],
    "answer": 1,
    "explain": "The avalanche effect is a crucial property of cryptographic hashes where minute input alterations yield dramatically divergent digests."
  },
  {
    "id": 9,
    "q": "Which MySQL 8 feature allows converting JSON diffs into relational rows and columns?",
    "options": [
      "JSON_EXTRACT_ALL()",
      "JSON_TABLE()",
      "PARSER_JSON()",
      "CAST_AS_TABLE()"
    ],
    "answer": 1,
    "explain": "MySQL 8's JSON_TABLE() function maps JSON paths to relational columns, enabling SQL joins and filters on JSON data."
  },
  {
    "id": 10,
    "q": "How does the Python backend communicate user identity to MySQL triggers?",
    "options": [
      "By adding user_id to every single SQL table column manually",
      "By setting session user variables like SET @app_investigator_id = :uid on the connection",
      "By restarting MySQL with a new username",
      "It cannot communicate identity"
    ],
    "answer": 1,
    "explain": "SQLAlchemy connection checkout executes SET @app_investigator_id = :uid. Triggers read this variable inside MySQL."
  },
  {
    "id": 11,
    "q": "What happens if an investigator connects directly via MySQL Workbench and updates a record?",
    "options": [
      "The triggers fail to run",
      "The change is captured in audit_logs with investigator_id as NULL, exposing the direct database bypass",
      "The computer catches fire",
      "MySQL Workbench crashes"
    ],
    "answer": 1,
    "explain": "Because @app_investigator_id is unset, the trigger logs investigator_id = NULL. The anomaly detector flags this as a DIRECT_DB_MODIFICATION bypass."
  },
  {
    "id": 12,
    "q": "Which SQL clause is used to filter aggregate results produced by GROUP BY?",
    "options": [
      "WHERE",
      "HAVING",
      "ORDER BY",
      "FILTER"
    ],
    "answer": 1,
    "explain": "WHERE filters tuples before aggregation; HAVING filters groups after GROUP BY."
  },
  {
    "id": 13,
    "q": "What does a Common Table Expression (CTE) start with?",
    "options": [
      "USING",
      "WITH",
      "BEGIN",
      "DECLARE"
    ],
    "answer": 1,
    "explain": "CTEs are defined using the WITH keyword (or WITH RECURSIVE for recursive CTEs)."
  },
  {
    "id": 14,
    "q": "What is the primary difference between a Stored Procedure and a Stored Function?",
    "options": [
      "Procedures return a scalar value; functions return result sets",
      "Functions return a single scalar value and can be called inside SELECT statements; procedures are called with CALL and can manage transactions",
      "Functions can only be written in Python",
      "There is no difference"
    ],
    "answer": 1,
    "explain": "Stored functions compute and return a single scalar value usable in expressions. Stored procedures perform actions and transaction management."
  },
  {
    "id": 15,
    "q": "Why is ON DELETE RESTRICT preferred over CASCADE in forensic databases?",
    "options": [
      "Because CASCADE deletes evidence and suppresses trigger firing on child rows",
      "Because RESTRICT is 10 times faster",
      "Because MySQL does not support CASCADE",
      "To prevent disk space exhaustion"
    ],
    "answer": 0,
    "explain": "RESTRICT preserves evidentiary history. CASCADE deletes evidence without individual trigger events, which is fatal in digital forensics."
  },
  {
    "id": 16,
    "q": "How does the system defend against brute-force password guessing attacks?",
    "options": [
      "By shutting down the website",
      "By querying login_attempts and locking out emails with >= 5 failed attempts in 15 minutes",
      "By changing all passwords to 'password123'",
      "By deleting the investigator's account"
    ],
    "answer": 1,
    "explain": "login_attempts tracks authentication outcomes and temporarily locks the target email after 5 failed attempts within 15 minutes."
  },
  {
    "id": 17,
    "q": "What role does bcrypt play in user authentication?",
    "options": [
      "It encrypts database tables on disk",
      "It hashes passwords using an adaptive cost factor and random salt to prevent brute-force cracking",
      "It creates PDF reports",
      "It connects Python to MySQL"
    ],
    "answer": 1,
    "explain": "bcrypt is an adaptive salted password-hashing algorithm that is computationally intensive to defeat GPU brute-forcing."
  },
  {
    "id": 18,
    "q": "What is an anomaly detector's 'explainable risk score' in this project?",
    "options": [
      "A black-box prediction with no explanation",
      "A deterministic point breakdown (e.g. Base Score + Off-Hours + Direct DB Bypass) capped at 100",
      "A random number between 1 and 10",
      "A letter grade from A to F"
    ],
    "answer": 1,
    "explain": "Every alert provides a mathematical point breakdown in JSON, making the score transparent and admissible in court."
  },
  {
    "id": 19,
    "q": "Why is the AI Assistant strictly grounded in MySQL database facts?",
    "options": [
      "To prevent hallucinations and ensure answers reflect verified forensic records",
      "Because LLMs cannot read English",
      "To make queries run 10 times slower",
      "Because cloud APIs are illegal"
    ],
    "answer": 0,
    "explain": "Grounding supplies retrieved relational records directly into the LLM context, preventing made-up answers."
  },
  {
    "id": 20,
    "q": "Which MySQL storage engine is used in SQL Ghost Hunter?",
    "options": [
      "MyISAM",
      "MEMORY",
      "InnoDB",
      "CSV"
    ],
    "answer": 2,
    "explain": "InnoDB provides ACID transactions, foreign keys, row-level locking, and crash recovery."
  },
  {
    "id": 21,
    "q": "What is the purpose of the bridge table case_assignments?",
    "options": [
      "To model the Many-to-Many relationship between cases and investigators",
      "To store user passwords",
      "To backup database tables",
      "To generate charts"
    ],
    "answer": 0,
    "explain": "A case can have multiple investigators and an investigator can work on multiple cases (M:N)."
  },
  {
    "id": 22,
    "q": "How does the system prevent duplicate alert spam for the same incident?",
    "options": [
      "By deleting older alerts",
      "By enforcing a UNIQUE(fingerprint) constraint on ai_alerts and using INSERT ... ON DUPLICATE KEY UPDATE",
      "By only running the detector once a month",
      "By ignoring repeated errors"
    ],
    "answer": 1,
    "explain": "The fingerprint hash uniquely identifies each incident condition, ensuring idempotent upserts."
  },
  {
    "id": 23,
    "q": "Which constraint ensures that original_hash is always a valid 64-character lowercase hex string?",
    "options": [
      "FOREIGN KEY",
      "CHECK(REGEXP_LIKE(original_hash, '^[0-9a-f]{64}$'))",
      "DEFAULT '0000'",
      "AUTO_INCREMENT"
    ],
    "answer": 1,
    "explain": "MySQL 8's REGEXP_LIKE in a declarative CHECK constraint validates the exact 64-character hex format."
  },
  {
    "id": 24,
    "q": "What does a Window Function's OVER (PARTITION BY ... ORDER BY ...) clause do?",
    "options": [
      "Deletes duplicate rows",
      "Divides rows into subgroups and orders rows within each subgroup for ranking calculations",
      "Stops query execution",
      "Exports data to Excel"
    ],
    "answer": 1,
    "explain": "PARTITION BY divides the dataset into windows; ORDER BY determines calculation order within each window."
  },
  {
    "id": 25,
    "q": "What is the result of an INNER JOIN when a row in table A has no matching key in table B?",
    "options": [
      "The row is included with NULL values",
      "The row is completely omitted from the result set",
      "An error is thrown",
      "Table B creates a new row automatically"
    ],
    "answer": 1,
    "explain": "INNER JOIN requires matching keys in both relations; unmatched tuples are excluded."
  },
  {
    "id": 26,
    "q": "Why is the application user ghost_app denied DROP and DELETE privileges on audit_logs?",
    "options": [
      "Because the developers forgot to grant them",
      "Principle of Least Privilege: to prevent compromised backend credentials from erasing forensic audit history",
      "Because MySQL does not support DELETE on audit logs",
      "To speed up database connections"
    ],
    "answer": 1,
    "explain": "Least privilege isolates the application layer, ensuring the database vault remains secure."
  },
  {
    "id": 27,
    "q": "What is the difference between Authentication and Authorization?",
    "options": [
      "They are identical terms",
      "Authentication verifies identity (who you are); Authorization verifies permissions (what you are allowed to do)",
      "Authentication is for databases; Authorization is for networks",
      "Authentication happens after authorization"
    ],
    "answer": 1,
    "explain": "AuthN establishes identity (login); AuthZ governs resource access permissions (roles)."
  },
  {
    "id": 28,
    "q": "How does an AFTER UPDATE trigger access the values of the row before and after modification?",
    "options": [
      "Using OLD.column_name and NEW.column_name pseudo-records",
      "By reading the server log file from disk",
      "By querying the table with a subquery",
      "It cannot access old values"
    ],
    "answer": 0,
    "explain": "MySQL triggers have access to pseudo-records OLD and NEW for inspecting before-and-after states."
  },
  {
    "id": 29,
    "q": "What is the difference between a Stored Procedure and a Stored Function?",
    "options": [
      "Procedures return a scalar value; functions execute transactions",
      "Functions return a scalar value and can be called directly in SELECT statements; procedures are executed with CALL and can perform transactions",
      "There is no difference",
      "Functions can only be written in Python"
    ],
    "answer": 1,
    "explain": "Functions return a single value and can be embedded in SQL expressions. Procedures are invoked with CALL."
  },
  {
    "id": 30,
    "q": "Why is SQL Ghost Hunter considered an active database rather than a passive database?",
    "options": [
      "Because the server never sleeps",
      "Because it actively monitors, validates, and responds to internal state changes using triggers and stored procedures rather than just passively storing data",
      "Because it uses JavaScript",
      "Because it has charts"
    ],
    "answer": 1,
    "explain": "An active database uses Event-Condition-Action (ECA) rules (such as triggers and check constraints) to automatically detect and react to database modifications."
  }
];

export const DEMO_CHECKLIST = [
  {
    "id": 1,
    "title": "1. Verify MySQL 8 Service is Running",
    "desc": "Ensure Windows Service MySQL80 is active on localhost:3306.",
    "prompt": "Show services or MySQL Workbench connection status."
  },
  {
    "id": 2,
    "title": "2. Verify Web Application is Running",
    "desc": "Open http://127.0.0.1:8000 and verify login screen is loaded.",
    "prompt": "Show the brand logo and local demonstration account chips."
  },
  {
    "id": 3,
    "title": "3. Log in as Administrator (Ananya Rao)",
    "desc": "Click the 'Admin' chip and log in with admin@ghosthunter.local.",
    "prompt": "Explain password hashing with bcrypt and session creation."
  },
  {
    "id": 4,
    "title": "4. Present the Live Dashboard",
    "desc": "Walk through total cases, verified evidence, compromised items, and the 14-day chart.",
    "prompt": "Emphasize that all numbers come from views and recursive CTEs."
  },
  {
    "id": 5,
    "title": "5. Open Investigations & Case CASE-001",
    "desc": "Show 'Payroll Database Tampering' case details, assigned team, and priority.",
    "prompt": "Explain 1:N case-to-evidence and M:N case_assignments relationships."
  },
  {
    "id": 6,
    "title": "6. Register New Digital Evidence",
    "desc": "Upload a test document, watch SHA-256 calculation and atomic transaction.",
    "prompt": "Explain how sp_register_evidence runs an atomic 3-step transaction."
  },
  {
    "id": 7,
    "title": "7. Demonstrate SHA-256 Verification",
    "desc": "Click 'Verify Integrity Now' on a verified file to show side-by-side matching hashes.",
    "prompt": "Explain collision-resistance and append-only integrity_checks history."
  },
  {
    "id": 8,
    "title": "8. Demonstrate Evidence Tampering (EV-0007)",
    "desc": "Open EV-0007 (deliberately tampered CSV) and trigger verification.",
    "prompt": "Point out the bright red TAMPERED alert and explain the cryptographic avalanche effect."
  },
  {
    "id": 9,
    "title": "9. Inspect Database Audit Logs & JSON Diffs",
    "desc": "Navigate to Database Audit Logs, filter by UPDATE, and expand old/new JSON diff.",
    "prompt": "Highlight that MySQL triggers generated the JSON_OBJECT diff directly in the database."
  },
  {
    "id": 10,
    "title": "10. Demonstrate Immutability (Append-Only)",
    "desc": "Explain how BEFORE DELETE triggers prevent anyone from deleting audit records.",
    "prompt": "Quote MySQL Error 1644: 'Audit history is append-only'."
  },
  {
    "id": 11,
    "title": "11. Show Chain of Custody & Handover",
    "desc": "Open Chain of Custody, explain 3NF derived custodian, and transfer an item.",
    "prompt": "Explain stored function fn_current_custodian preventing transitive dependency."
  },
  {
    "id": 12,
    "title": "12. Run Anomaly Detection Engine",
    "desc": "Open AI Security Analysis, click 'Run Anomaly Analysis', and review score breakdowns.",
    "prompt": "Explain the explainable risk score breakdown (Base + Off-Hours + Root Bypass)."
  },
  {
    "id": 13,
    "title": "13. Demonstrate Role-Based Access Control",
    "desc": "Log out and sign in as Auditor (meera.iyer@ghosthunter.local).",
    "prompt": "Show that state-modifying buttons (New Case, Register Evidence) are hidden."
  },
  {
    "id": 14,
    "title": "14. Open SQL Demonstration Lab",
    "desc": "Navigate to SQL Demonstration, run live queries, and view the checklist.",
    "prompt": "Execute an INNER JOIN and correlated subquery live to prove syllabus compliance."
  },
  {
    "id": 15,
    "title": "15. Review Database ER Diagram & Normalization",
    "desc": "Show the normalized schema structure and explain primary and foreign keys.",
    "prompt": "Explain how all 12 tables satisfy 1NF, 2NF, and 3NF."
  },
  {
    "id": 16,
    "title": "16. Conclude Presentation & Answer Faculty Questions",
    "desc": "Deliver the closing speech and invite viva questions.",
    "prompt": "Use the Viva Preparation section if faculty asks tricky questions."
  }
];


// Alias for application tour export
export const APPLICATION_TOUR = MODULES_TOUR;


export const PERSISTENCE_EXPLAINER = {
  title: "HOW DOES THE APPLICATION REMEMBER MY DATA?",
  subtitle: "End-to-End Architectural Flow: From User Click to Persistent MySQL InnoDB Storage",
  summaryQuote: "When I create an investigation, the application sends the information to FastAPI. FastAPI communicates with MySQL. MySQL saves the record. When I reopen the application, the dashboard requests the information again from MySQL.",
  architectureFlow: [
    {
      layer: 1,
      name: "USER",
      icon: "user",
      role: "Human Forensic Investigator",
      simple: "You click a button, type a case title, or drag and drop a digital evidence file into the web browser.",
      technical: "End-user interacts with the presentation client, generating user-input DOM events (click, submit, change)."
    },
    {
      layer: 2,
      name: "FRONTEND (Single Page Application)",
      icon: "layout",
      role: "Vanilla JS (ESM) + Liquid Glass UI",
      simple: "The browser checks your input, wraps it into a tidy digital message (JSON), attaches your secret login badge (Session Token), and sends it across the network to FastAPI.",
      technical: "Single-Page Application (SPA) running in client browser runtime. Validates forms, attaches CSRF headers (X-Requested-With: GhostHunter) and session cookies, and initiates asynchronous HTTP requests via Fetch API."
    },
    {
      layer: 3,
      name: "FASTAPI BACKEND",
      icon: "cpu",
      role: "Asynchronous Python REST API Server",
      simple: "FastAPI acts like a strict security guard at the gate. It checks if you are allowed in, validates the data, and tells SQLAlchemy to prepare the database commands.",
      technical: "High-performance Python ASGI framework (Uvicorn). Handles route matching, Pydantic data validation, cryptographic session authentication (Bearer/Cookie), RBAC permission enforcement, and transaction boundary orchestration."
    },
    {
      layer: 4,
      name: "SQLALCHEMY / PYMYSQL",
      icon: "code",
      role: "ORM & Connection Pool Layer",
      simple: "The translator and courier. It translates Python requests into clean, safe SQL queries and manages a reusable pool of open phone lines (connections) to MySQL.",
      technical: "Database Abstraction Layer and connection pool manager (QueuePool). Enforces SQL parameterization against SQL Injection, sets session variables (SET @app_investigator_id = :uid), and manages the transactional lifecycle (session.begin(), session.commit(), session.rollback())."
    },
    {
      layer: 5,
      name: "MYSQL DATABASE (InnoDB Engine)",
      icon: "sql",
      role: "Relational DBMS Storage Engine",
      simple: "The high-security bank vault. It checks relational rules, executes active triggers that automatically log old vs new values, and writes the changes into its write-ahead log.",
      technical: "Relational Database Management System (MySQL 8.0) using the InnoDB ACID storage engine. Executes declarative constraints (PK, FK, UNIQUE, CHECK), executes event-driven procedural triggers (AFTER UPDATE, BEFORE DELETE), and enforces transaction isolation."
    },
    {
      layer: 6,
      name: "SAVED RECORDS (Persistent Storage)",
      icon: "server",
      role: "Non-Volatile Hard Drive Files",
      simple: "The information is permanently written to physical files on the hard drive. Even if you turn off the server or pull the power plug, the data is 100% safe and will still be there tomorrow.",
      technical: "Durable secondary storage: InnoDB tablespace files (ghost_hunter/*.ibd), doublewrite buffers, WAL redo log files (ib_logfile*), and evidence storage directory (storage/evidence/). Survives OS reboots, power cuts, and server process restarts."
    }
  ],
  deepDive: {
    title: "Why Does SQL Ghost Hunter Use MySQL Instead of In-Memory or SQLite?",
    reasons: [
      {
        title: "1. ACID Durability Guarantee",
        desc: "Committed transactions are written to the Write-Ahead Log (WAL) and flushed to non-volatile disk. Even if the FastAPI server process is killed or the machine crashes, zero committed data is lost."
      },
      {
        title: "2. Event-Driven Triggers",
        desc: "Unlike lightweight SQLite or client-side storage, MySQL executes native triggers synchronously within the transaction. Bypassing the web API to edit rows in MySQL still fires triggers, catching unauthorized tampering."
      },
      {
        title: "3. Least-Privilege User Isolation",
        desc: "The web application connects as restricted user ghost_app, which cannot DROP tables, modify triggers, or truncate audit logs. Administrative operations require separate root authentication."
      },
      {
        title: "4. Multi-Client Concurrency Control",
        desc: "InnoDB provides row-level locking and MVCC (Multi-Version Concurrency Control), allowing multiple forensic investigators to register evidence, transfer custody, and run queries simultaneously without data corruption."
      }
    ]
  }
};



export const PROOF_DEMO_SCRIPT = [
  {
    step: 1,
    title: "1. Open Web Application",
    action: "Navigate to http://127.0.0.1:8000 in your web browser.",
    execute: "Browser loads the Single Page Application assets and evaluates session state.",
    expected: "Login page renders with clean Liquid Glass aesthetic.",
    whatToTellTeacher: "SQL Ghost Hunter is a full-stack forensic application running locally. Notice that it does not use mock static HTML; all UI components are dynamically driven by backend APIs.",
    concept: "Client-Server Architecture, Asynchronous Web Delivery"
  },
  {
    step: 2,
    title: "2. Authenticate as Administrator",
    action: "Click Quick-Fill Admin or type admin@ghosthunter.local / Admin@Ghost2026, click Authenticate.",
    execute: "FastAPI POST /api/auth/login validates credentials against MySQL investigators and issues an authenticated session.",
    expected: "Dashboard opens displaying Dr. Ananya Rao (Badge GH-001) as authenticated admin.",
    whatToTellTeacher: "Authentication is verified against the `investigators` table in MySQL using bcrypt salt hashing. Successful logins write a session record to `app_sessions` and an audit entry to `login_attempts`.",
    concept: "Database Authentication, Salted Password Hashing, Session Management"
  },
  {
    step: 3,
    title: "3. Record Current Investigation Count",
    action: "Look at the 'Total Cases' metric card on the top left of the Dashboard.",
    execute: "GET /api/dashboard/stats runs view vw_dashboard_stats querying COUNT(*) FROM cases.",
    expected: "Display current case count (e.g., 6 cases).",
    whatToTellTeacher: "Notice the dashboard displays exactly 6 cases. This is not hardcoded text; it is computed by the database view `vw_dashboard_stats` querying `COUNT(*) FROM cases`.",
    concept: "Relational Views, SQL Aggregation Functions (COUNT())"
  },
  {
    step: 4,
    title: "4. Create a New Investigation",
    action: "Click 'Cases' in sidebar, click '+ New Case'. Fill Title: 'Classroom Live Fraud Audit', Priority: 'CRITICAL', and click 'Create Investigation'.",
    execute: "POST /api/cases starts an ACID transaction: INSERT INTO cases, assigns creator as lead, and fires trg_cases_after_insert.",
    expected: "Success toast appears: 'Case created and committed to MySQL'. Case list displays the new case with code CASE-007.",
    whatToTellTeacher: "When I clicked submit, FastAPI executed an `INSERT` statement against the `cases` table. Notice the case code `CASE-007` was generated and the creator was assigned as lead investigator.",
    concept: "DML INSERT, ACID Transactions, Auto-Increment Primary Keys"
  },
  {
    step: 5,
    title: "5. Return to Dashboard",
    action: "Click 'Dashboard' in the top navigation bar.",
    execute: "Dashboard mounts and fetches fresh JSON metrics from /api/dashboard/stats.",
    expected: "The Total Cases counter immediately increases by +1 (e.g. from 6 to 7) without a hard reload.",
    whatToTellTeacher: "Look at the Total Cases counter: it instantly increased from 6 to 7. This proves that the dashboard dynamically queries the live MySQL database, reflecting the new row we just committed.",
    concept: "Real-Time UI-Database Synchronization, State Consistency"
  },
  {
    step: 6,
    title: "6. Verify Updated Investigation Count",
    action: "Point out the green 'Live MySQL Sync' indicator pill in the dashboard header.",
    execute: "Background polling and visibilitychange listeners keep the dashboard live with MySQL.",
    expected: "Both the top KPI card and the recent cases table display Case 7 with priority CRITICAL.",
    whatToTellTeacher: "The dashboard automatically polls MySQL and refreshes upon tab focus, ensuring administrators see changes made by other investigators in real-time.",
    concept: "Relational Consistency, Multi-User Concurrency"
  },
  {
    step: 7,
    title: "7. Open MySQL Workbench / CLI",
    action: "Switch to MySQL Workbench or command line terminal connected to MySQL.",
    execute: "USE ghost_hunter;",
    expected: "Active database selected as ghost_hunter.",
    whatToTellTeacher: "Now we will inspect the database directly, bypassing the web application entirely, to prove that the record was genuinely written to persistent disk storage.",
    concept: "Direct RDBMS Query Execution, Engine Transparency"
  },
  {
    step: 8,
    title: "8. Query Cases Table Directly",
    action: "Run: SELECT case_id, case_code, title, priority, status, created_at FROM cases WHERE case_code = 'CASE-007';",
    execute: "MySQL query engine executes clustered index scan on cases.",
    expected: "One row returned matching the title 'Classroom Live Fraud Audit' and priority 'CRITICAL'.",
    whatToTellTeacher: "Here is the exact record in the MySQL storage engine. You can see the title, priority, timestamps, and foreign key references matches what we typed in the browser.",
    concept: "Clustered Index Scanning, Relational Row Retrieval"
  },
  {
    step: 9,
    title: "9. Show Relational Integrity & Case Assignments",
    action: "Run: SELECT * FROM case_assignments WHERE case_id = (SELECT case_id FROM cases WHERE case_code = 'CASE-007');",
    execute: "MySQL queries junction table case_assignments.",
    expected: "Row returned showing case_id linked to investigator_id = 1 with case_role = 'LEAD'.",
    whatToTellTeacher: "Notice how the system enforced relational integrity: the junction table `case_assignments` was automatically populated, maintaining 3NF normalization without duplicate investigator columns.",
    concept: "Third Normal Form (3NF), Foreign Key Constraints (FOREIGN KEY REFERENCES)"
  },
  {
    step: 10,
    title: "10. Modify Record Directly in MySQL (Bypass Web App)",
    action: "Execute raw SQL in MySQL: UPDATE cases SET case_description = 'TAMPERED VIA DIRECT MYSQL QUERY' WHERE case_code = 'CASE-007';",
    execute: "MySQL updates the row directly in InnoDB tablespace pages.",
    expected: "Query OK, 1 row affected.",
    whatToTellTeacher: "We have just performed an unauthorized modification directly inside MySQL, completely bypassing FastAPI, the web interface, and application security checks. In traditional systems, this change would be invisible!",
    concept: "Direct Database Modification, Privilege Escalation Threat"
  },
  {
    step: 11,
    title: "11. Show Trigger-Generated Audit Entry in MySQL",
    action: "Run: SELECT log_id, table_name, action, investigator_id, db_user, old_values, new_values, created_at FROM audit_logs ORDER BY log_id DESC LIMIT 1;",
    execute: "MySQL queries the audit_logs table populated by trg_cases_after_update.",
    expected: "Row displays: action = 'UPDATE', investigator_id = NULL, db_user = 'root@localhost', and old/new JSON diff showing the modified description.",
    whatToTellTeacher: "Look at the audit row: the `AFTER UPDATE` trigger caught the unauthorized modification! Notice that `investigator_id` is NULL, proving the change did not come from an authenticated web session, and `db_user` reveals the root MySQL user account!",
    concept: "Event-Driven Triggers (AFTER UPDATE), JSON Serialization (JSON_OBJECT), Forensic Provenance"
  },
  {
    step: 12,
    title: "12. Return to Web Application Audit Logs",
    action: "Switch back to the browser and navigate to 'Audit Logs' in the sidebar.",
    execute: "GET /api/audit runs view vw_audit_trail.",
    expected: "The direct database modification appears at the top of the audit log with a warning indicator.",
    whatToTellTeacher: "The web application immediately shows the tamper event. Our view `vw_audit_trail` uses a `LEFT JOIN` between `audit_logs` and `investigators` so that even when `investigator_id` is NULL, the event is never hidden!",
    concept: "LEFT OUTER JOIN vs INNER JOIN in Forensic Systems"
  },
  {
    step: 13,
    title: "13. Inspect Side-by-Side JSON Diff",
    action: "Click on the audit entry to view the detail modal.",
    execute: "Frontend parses old_values and new_values JSON attributes.",
    expected: "Side-by-side comparison displays old case_description vs 'TAMPERED VIA DIRECT MYSQL QUERY'.",
    whatToTellTeacher: "Here is the exact side-by-side JSON diff generated by MySQL. The investigator can see both the historical baseline and the tampered value with cryptographic precision.",
    concept: "Semi-Structured Data in RDBMS (JSON Columns & Functions)"
  },
  {
    step: 14,
    title: "14. Stop the FastAPI Backend Server",
    action: "Open the server terminal and press Ctrl+C to terminate FastAPI.",
    execute: "FastAPI ASGI process shuts down; server memory/RAM is completely cleared.",
    expected: "Server process exits. Web requests will now fail (Connection Refused).",
    whatToTellTeacher: "We have now completely killed the backend server. The Python process is dead, and all backend memory/RAM has been completely wiped.",
    concept: "Process Lifecycle, Volatile RAM vs Non-Volatile Storage"
  },
  {
    step: 15,
    title: "15. Restart FastAPI Backend Server",
    action: "In the terminal, run: python run.py",
    execute: "FastAPI initializes, reads .env, and opens fresh SQLAlchemy connection pools to MySQL.",
    expected: "Server console outputs: 'Uvicorn running on http://127.0.0.1:8000'.",
    whatToTellTeacher: "The server has been rebooted with a completely fresh runtime memory space. No temporary variables from our earlier session exist in Python.",
    concept: "Service Recovery, Stateless Backend Design, Database Connection Pooling"
  },
  {
    step: 16,
    title: "16. Log In Again",
    action: "Refresh the browser page and log in as administrator.",
    execute: "FastAPI re-authenticates credentials against MySQL investigators table.",
    expected: "Session is established; dashboard loads cleanly.",
    whatToTellTeacher: "We re-authenticate cleanly. The session and user credentials are confirmed against MySQL.",
    concept: "Stateless Authentication, Persistent Credentials"
  },
  {
    step: 17,
    title: "17. Verify That All Records Persisted 100% Unharmed",
    action: "Check Dashboard counters and open Cases and Audit Logs.",
    execute: "GET /api/dashboard/stats, GET /api/cases, and GET /api/audit retrieve records from MySQL.",
    expected: "Case 7, the direct database update, and the trigger audit trail entry are all 100% present and intact!",
    whatToTellTeacher: "Every single piece of data—the new case, the case assignment, the direct MySQL update, and the trigger audit trail—remains 100% intact after a complete server shutdown. This conclusively proves that SQL Ghost Hunter operates on true ACID-compliant persistent database storage, not temporary mock memory!",
    concept: "ACID Durability Property, Non-Volatile Relational Storage, Forensic Immobility"
  }
];

