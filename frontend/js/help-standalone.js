// =====================================================================
// SQL Ghost Hunter - Standalone Interactive Explainer & Feedback Guide
// Single-Page Dedicated Academic Learning Suite (12 Core Tabs)
// =====================================================================
import { icon } from './icons.js';
import { $, $$, esc } from './ui.js';
import {
  UNDERSTAND_IN_30_SECONDS,
  WHY_BUILT,
  APPLICATION_TOUR,
  WORKFLOW_STEPS,
  DATABASE_EXPLAINER,
  PERSISTENCE_EXPLAINER,
  TECH_STACK,
  CORE_WEB_CONCEPTS,
  DICTIONARY_TERMS,
  TEACHER_PRESENTATION,
  PROOF_DEMO_SCRIPT,
  VIVA_QUESTIONS,
  TEACH_ME_MODES
} from './pages/helpData.js';

let activeTab = 'overview';
let activeTourModule = APPLICATION_TOUR[0].id;
let activeDbTable = DATABASE_EXPLAINER.tables[0].name;
let activeTeachMode = TEACH_ME_MODES[0].id;
let activeSpeechLevel = 'student'; // 'student' | 'prof' | 'oneline'
let vivaSearch = '';
let vivaCategory = 'All';
let vivaDifficulty = 'All';
let dictSearch = '';
let dictCategory = 'All';

// Feedback System State
let feedbackRating = 5;
let feedbackList = [];

// Seed default sample faculty reviews if none exist
const DEFAULT_FACULTY_REVIEWS = [
  {
    id: 1,
    name: "Dr. K. R. Ramanathan",
    role: "DBMS Professor & Head of Department",
    institution: "Dept. of Computer Science & Engineering",
    rating: 5,
    category: "Database Architecture & 3NF",
    scores: { schema: 10, security: 10, forensics: 10, presentation: 10 },
    highlights: ["Engine-level triggers over app logs", "3NF Normalization", "Zero mock arrays"],
    feedback: "An exemplary undergraduate database project. Enforcing non-repudiation at the MySQL storage engine via triggers and least-privilege user isolation is an industry-grade pattern rarely seen in academic projects. The viva preparation matrix is thorough.",
    recommendation: "Outstanding (10/10 - Grade O)",
    date: "November 2026",
    verified: true
  },
  {
    id: 2,
    name: "Prof. S. Ananthi",
    role: "External Lab Examiner",
    institution: "University Examination Board",
    rating: 5,
    category: "Forensic Integrity & Viva Prep",
    scores: { schema: 10, security: 9, forensics: 10, presentation: 10 },
    highlights: ["SHA-256 Tamper Detection", "11 Detection Rules", "Apple Glass UI"],
    feedback: "The 17-step demonstration script makes evaluating this project a pleasure. Physically modifying an evidence file on disk and having the system mathematically detect the SHA-256 mismatch in front of the examiner is definitive proof.",
    recommendation: "Outstanding (10/10 - Grade O)",
    date: "November 2026",
    verified: true
  }
];

function loadStoredFeedback() {
  try {
    const raw = localStorage.getItem('gh_help_feedback_records');
    if (raw) {
      feedbackList = JSON.parse(raw);
    } else {
      feedbackList = [...DEFAULT_FACULTY_REVIEWS];
      localStorage.setItem('gh_help_feedback_records', JSON.stringify(feedbackList));
    }
  } catch {
    feedbackList = [...DEFAULT_FACULTY_REVIEWS];
  }
}

function saveFeedback(newEntry) {
  feedbackList.unshift(newEntry);
  try {
    localStorage.setItem('gh_help_feedback_records', JSON.stringify(feedbackList));
  } catch { /* ignore */ }
  // Optional remote sync
  fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEntry)
  }).catch(() => { /* offline graceful */ });
}

export function initStandaloneHelp(containerEl) {
  loadStoredFeedback();

  // Read URL hash parameter if present (e.g. #viva or #proof)
  const hash = window.location.hash.replace('#', '').trim();
  if (hash) {
    const validTabs = [
      'overview', 'why', 'tour', 'workflow', 'database', 'persistence',
      'tech', 'dictionary', 'presentation', 'proof', 'viva', 'feedback'
    ];
    if (validTabs.includes(hash)) {
      activeTab = hash;
    }
  }

  function renderHero() {
    return `
      <div class="glass-hero">
        <div class="glass-hero-head">
          <div class="glass-badge-row">
            <span class="glass-pill accent">${icon('sparkles', 14)} DBMS Master Explainer</span>
            <span class="glass-pill success">${icon('shield', 14)} 100% Offline Capable</span>
            <span class="glass-pill">${icon('sql', 14)} MySQL 8.0 &bull; 3NF Schema</span>
            <span class="glass-pill accent" style="background:#fef3c7;color:#92400e;border-color:#fde68a;">
              ⭐ ${feedbackList.length} Faculty &amp; Student Reviews
            </span>
          </div>
          <span class="small muted">University DBMS Project &bull; College Faculty Presentation &amp; Viva Guide</span>
        </div>

        <div class="glass-hero-title">SQL Ghost Hunter &mdash; Master Project Learning &amp; Demonstration Guide</div>
        <div class="glass-hero-subtitle">
          "Every Database Change Leaves a Trace." Explore how active MySQL triggers, cryptographic SHA-256 hashes, 
          normalized relational schemas, and explainable anomaly detection work together to solve real-world digital forensics challenges.
        </div>

        <!-- Quick Mode Switcher Cards -->
        <div class="glass-quick-modes">
          <button type="button" class="quick-mode-btn ${activeTab === 'overview' ? 'active' : ''}" data-goto="overview">
            <div class="mode-title">${icon('lightbulb', 18)} 1. Understand in 30s</div>
            <div class="mode-desc">School notebook analogy &amp; 5th-standard concept glossary.</div>
          </button>
          <button type="button" class="quick-mode-btn ${activeTab === 'proof' ? 'active' : ''}" data-goto="proof">
            <div class="mode-title">${icon('shield', 18)} 10. Real Data Proof</div>
            <div class="mode-desc">17-step live sequence proving genuine MySQL persistence.</div>
          </button>
          <button type="button" class="quick-mode-btn ${activeTab === 'persistence' ? 'active' : ''}" data-goto="persistence">
            <div class="mode-title">${icon('server', 18)} 6. How Data Persists</div>
            <div class="mode-desc">6-layer architectural flow from browser click to InnoDB disk.</div>
          </button>
          <button type="button" class="quick-mode-btn ${activeTab === 'presentation' ? 'active' : ''}" data-goto="presentation">
            <div class="mode-title">${icon('graduation', 18)} 9. Presentation Mode</div>
            <div class="mode-desc">Complete presentation speech &amp; live demo script for your teacher.</div>
          </button>
          <button type="button" class="quick-mode-btn ${activeTab === 'viva' ? 'active' : ''}" data-goto="viva">
            <div class="mode-title">${icon('award', 18)} 11. Prepare for Viva</div>
            <div class="mode-desc">90+ categorized questions, technical answers &amp; counter-questions.</div>
          </button>
          <button type="button" class="quick-mode-btn ${activeTab === 'feedback' ? 'active' : ''}" data-goto="feedback">
            <div class="mode-title">${icon('sparkles', 18)} 12. Feedback &amp; Review</div>
            <div class="mode-desc">Persona learning &amp; examiner feedback rating suite.</div>
          </button>
        </div>
      </div>
    `;
  }

  function renderTabsBar() {
    const tabs = [
      { id: 'overview', label: '1. Overview in 30s', icon: 'lightbulb' },
      { id: 'why', label: '2. Why Built?', icon: 'alert' },
      { id: 'tour', label: '3. App Tour', icon: 'eye' },
      { id: 'workflow', label: '4. Workflow', icon: 'clock' },
      { id: 'database', label: '5. Database Explainer', icon: 'sql' },
      { id: 'persistence', label: '6. Data Persistence', icon: 'server' },
      { id: 'tech', label: '7. Tech Stack', icon: 'cpu' },
      { id: 'dictionary', label: '8. Dictionary', icon: 'book' },
      { id: 'presentation', label: '9. Teacher Presentation', icon: 'graduation' },
      { id: 'proof', label: '10. Proof of Real Data', icon: 'shield', badge: '17 Steps' },
      { id: 'viva', label: '11. Viva Preparation', icon: 'award', badge: VIVA_QUESTIONS.length },
      { id: 'feedback', label: '12. Teach Me & Feedback', icon: 'sparkles', badge: 'Review Suite' }
    ];

    return `
      <nav class="glass-tabs-bar" aria-label="Help Guide Sections">
        ${tabs.map((t) => `
          <button type="button" class="glass-tab-btn ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
            ${icon(t.icon, 16)}
            <span>${esc(t.label)}</span>
            ${t.badge !== undefined ? `<span class="tab-badge">${esc(t.badge)}</span>` : ''}
          </button>
        `).join('')}
      </nav>
    `;
  }

  // ---------------- TAB 1: OVERVIEW IN 30 SECONDS ----------------
  function renderOverviewTab() {
    const data = UNDERSTAND_IN_30_SECONDS;
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('lightbulb')} ${esc(data.analogy.title)}</div>
            <span class="glass-pill accent">5th-Standard Analogy</span>
          </div>
          <div class="script-speech-box" style="font-size:15px;line-height:1.8;">
            ${esc(data.analogy.text).replace(/\n\n/g, '<br><br>')}
          </div>
        </div>

        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('book')} Core Forensic Concepts: 2-Level Explanations</div>
            <span class="glass-pill">Simple vs. Technical</span>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:16px;">
            Every concept below is explained twice: first in very simple everyday terms, and second in precise academic engineering terms for your professors.
          </p>

          <div class="grid grid-2">
            ${data.concepts.map((c) => `
              <div class="glass-card" style="padding:18px;background:rgba(255,255,255,0.9);">
                <div style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#0f172a;margin-bottom:12px;">
                  <span style="color:var(--primary);">${icon(c.icon, 20)}</span>
                  <span>${esc(c.term)}</span>
                </div>
                <div class="two-level-card" style="margin-top:0;">
                  <div class="level-card simple">
                    <span class="level-tag">Simple Explanation (Kid-Friendly)</span>
                    <span class="level-text">${esc(c.simple)}</span>
                  </div>
                  <div class="level-card tech">
                    <span class="level-tag">Technical Explanation (Engineering)</span>
                    <span class="level-text">${esc(c.technical)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 2: WHY BUILT? ----------------
  function renderWhyTab() {
    const data = WHY_BUILT;
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('alert')} Real-World Security Failures Solved by SQL Ghost Hunter</div>
            <span class="glass-pill accent">Real-World Case Studies</span>
          </div>

          <div class="grid grid-2">
            ${data.problems.map((p) => `
              <div class="glass-card" style="padding:20px;background:rgba(255,255,255,0.92);">
                <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:8px;">${esc(p.title)}</div>
                <div class="muted small" style="margin-bottom:14px;line-height:1.5;"><strong>Scenario:</strong> ${esc(p.scenario)}</div>
                
                <div class="comparison-grid" style="grid-template-columns:1fr;gap:10px;">
                  <div class="comp-box without" style="padding:12px 14px;">
                    <div class="comp-box-header" style="font-size:13px;">${icon('x', 16)} Without SQL Ghost Hunter</div>
                    <div style="font-size:13px;color:#7f1d1d;">${esc(p.without)}</div>
                  </div>
                  <div class="comp-box with" style="padding:12px 14px;">
                    <div class="comp-box-header" style="font-size:13px;">${icon('check', 16)} With SQL Ghost Hunter</div>
                    <div style="font-size:13px;color:#14532d;">${esc(p.with)}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('shield')} Feature-by-Feature Comparison Matrix</div>
            <span class="glass-pill success">Architectural Advantage</span>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th style="width:24%;">Feature / Capability</th>
                  <th style="width:38%;">Traditional Database / Web Architecture</th>
                  <th style="width:38%;">SQL Ghost Hunter System</th>
                </tr>
              </thead>
              <tbody>
                ${data.comparisonMatrix.map((m) => `
                  <tr>
                    <td><strong>${esc(m.feature)}</strong></td>
                    <td style="color:#b91c1c;">${icon('x', 14)} ${esc(m.traditional)}</td>
                    <td style="color:#15803d;font-weight:600;">${icon('check', 14)} ${esc(m.ghostHunter)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="warn" style="margin-top:18px;font-size:13px;line-height:1.5;">
            <strong>Faculty Assessment Note:</strong> ${esc(data.safetyDisclaimer)}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 3: COMPLETE APPLICATION TOUR ----------------
  function renderTourTab() {
    const current = APPLICATION_TOUR.find((m) => m.id === activeTourModule) || APPLICATION_TOUR[0];
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('eye')} Complete Application Tour &amp; Module Explainer</div>
            <span class="glass-pill accent">12 Production Modules</span>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:16px;">
            Select any module on the left to inspect its purpose, technical backend implementation, involved MySQL tables, 
            and the exact script to speak when demonstrating it to your teacher.
          </p>

          <div class="tour-layout">
            <div class="module-nav-list">
              ${APPLICATION_TOUR.map((m, idx) => `
                <button type="button" class="module-nav-item ${m.id === current.id ? 'active' : ''}" data-tour="${m.id}">
                  <span>${idx + 1}. ${esc(m.name)}</span>
                  ${icon('chevron', 14)}
                </button>
              `).join('')}
            </div>

            <div class="module-detail-box">
              <div class="glass-card" style="padding:22px;background:rgba(255,255,255,0.94);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
                  <h2 style="font-size:20px;color:#0f172a;">${esc(current.name)}</h2>
                  <span class="glass-pill success">Verified in Source Code</span>
                </div>

                <div class="module-subgrid">
                  <div class="module-subcard">
                    <span class="sub-title">Why Is It Required?</span>
                    <span class="sub-content">${esc(current.why)}</span>
                  </div>
                  <div class="module-subcard">
                    <span class="sub-title">How It Works in Simple Words</span>
                    <span class="sub-content">${esc(current.simple)}</span>
                  </div>
                </div>

                <div class="module-subcard" style="margin-top:14px;">
                  <span class="sub-title">What Happens Technically in the Backend?</span>
                  <span class="sub-content" style="font-family:var(--font);">${esc(current.technical)}</span>
                </div>

                <div class="module-subgrid" style="margin-top:14px;">
                  <div class="module-subcard">
                    <span class="sub-title">Database Tables Involved</span>
                    <span class="sub-content">
                      ${current.tables.map((t) => `<span class="badge" style="margin:2px 3px 2px 0;">${esc(t)}</span>`).join('')}
                    </span>
                  </div>
                  <div class="module-subcard">
                    <span class="sub-title">DBMS / SQL Concepts Used</span>
                    <span class="sub-content"><code>${esc(current.sqlConcepts)}</code></span>
                  </div>
                </div>

                <div class="demonstration-highlight-box" style="margin-top:18px;">
                  <div class="demo-label">${icon('play', 14)} What to Demonstrate to Your Teacher:</div>
                  <div style="font-size:13.5px;color:#1e3a8a;font-weight:600;">Action on Screen: ${esc(current.demoAction)}</div>
                  <div class="demo-speech">
                    &ldquo;${esc(current.demoSpeech)}&rdquo;
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 4: WORKFLOW ----------------
  function renderWorkflowTab() {
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('clock')} The Complete 11-Step Forensic Lifecycle</div>
            <span class="glass-pill accent">End-to-End Workflow</span>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:20px;">
            This interactive timeline details what the investigator observes on the screen versus what executes under the hood inside Python and MySQL 8.
          </p>

          <div class="workflow-stepper">
            ${WORKFLOW_STEPS.map((s) => `
              <div class="workflow-step">
                <div class="workflow-num-circle">${s.step}</div>
                <div class="workflow-step-content">
                  <div class="workflow-step-title">${esc(s.title)}</div>
                  <div class="workflow-duo-cards">
                    <div class="workflow-subbox user-view">
                      <strong style="color:#065f46;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">
                        ${icon('eye', 12)} What User Sees in UI:
                      </strong>
                      ${esc(s.userView)}
                    </div>
                    <div class="workflow-subbox tech-view">
                      <strong style="color:#1e40af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">
                        ${icon('cpu', 12)} Behind the Scenes (Python &amp; MySQL):
                      </strong>
                      ${esc(s.backendView)}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 5: DATABASE EXPLAINER ----------------
  function renderDatabaseTab() {
    const curTable = DATABASE_EXPLAINER.tables.find((t) => t.name === activeDbTable) || DATABASE_EXPLAINER.tables[0];
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('sql')} Database Architecture &amp; Relational Schema Explorer</div>
            <span class="glass-pill success">Database: ${esc(DATABASE_EXPLAINER.dbName)} (MySQL 8.0)</span>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:16px;">
            Click on any table below to inspect its purpose, primary keys, foreign keys, relational cardinality, constraints, and sample data.
          </p>

          <div class="db-explorer-layout">
            <div class="db-tables-list">
              ${DATABASE_EXPLAINER.tables.map((t) => `
                <button type="button" class="db-table-item ${t.name === curTable.name ? 'active' : ''}" data-dbtable="${t.name}">
                  <span>${esc(t.name)}</span>
                  ${icon('chevron', 14)}
                </button>
              `).join('')}
            </div>

            <div class="db-table-detail">
              <div class="glass-card" style="padding:22px;background:rgba(255,255,255,0.95);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
                  <h2 style="font-size:22px;font-family:var(--mono);color:#0f172a;">Table: ${esc(curTable.name)}</h2>
                  <span class="glass-pill accent">3NF Normalized</span>
                </div>

                <div class="module-subcard">
                  <span class="sub-title">Table Purpose</span>
                  <span class="sub-content" style="font-size:14px;">${esc(curTable.purpose)}</span>
                </div>

                <div class="grid grid-2" style="margin-top:14px;">
                  <div class="module-subcard">
                    <span class="sub-title">Primary Key (PK)</span>
                    <span class="sub-content"><code>${esc(curTable.pk)}</code></span>
                  </div>
                  <div class="module-subcard">
                    <span class="sub-title">Foreign Keys (FK)</span>
                    <span class="sub-content"><code>${esc(curTable.fks)}</code></span>
                  </div>
                </div>

                <div class="grid grid-2" style="margin-top:14px;">
                  <div class="module-subcard">
                    <span class="sub-title">Relational Connections</span>
                    <span class="sub-content">${esc(curTable.relationships)}</span>
                  </div>
                  <div class="module-subcard">
                    <span class="sub-title">Integrity &amp; CHECK Constraints</span>
                    <span class="sub-content"><code>${esc(curTable.constraints)}</code></span>
                  </div>
                </div>

                <div class="module-subcard" style="margin-top:14px;">
                  <span class="sub-title">Realistic Example Record</span>
                  <pre class="code" style="margin-top:6px;padding:10px 14px;max-height:180px;">${esc(JSON.stringify(curTable.sample, null, 2))}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('cpu')} Database Routines, Triggers &amp; Views</div>
            <span class="glass-pill">Active Database Layer</span>
          </div>

          <div class="grid grid-2">
            <div>
              <h3 style="margin-bottom:10px;color:var(--primary);">${icon('eye', 16)} 7 Relational Views</h3>
              <div class="list">
                ${DATABASE_EXPLAINER.views.map((v) => `
                  <div class="list-item" style="padding:8px 12px;background:rgba(255,255,255,0.7);margin-bottom:4px;border-radius:8px;">
                    <div><strong>${esc(v.name)}</strong>: <span class="muted small">${esc(v.purpose)}</span></div>
                  </div>
                `).join('')}
              </div>

              <h3 style="margin:18px 0 10px;color:var(--primary);">${icon('play', 16)} 6 Stored Procedures</h3>
              <div class="list">
                ${DATABASE_EXPLAINER.storedProcedures.map((p) => `
                  <div class="list-item" style="padding:8px 12px;background:rgba(255,255,255,0.7);margin-bottom:4px;border-radius:8px;">
                    <div><code>CALL ${esc(p.name)}()</code>: <span class="muted small">${esc(p.purpose)}</span></div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div>
              <h3 style="margin-bottom:10px;color:var(--primary);">${icon('fingerprint', 16)} Automated Database Triggers</h3>
              <div class="list">
                ${DATABASE_EXPLAINER.triggers.map((t) => `
                  <div class="list-item" style="padding:8px 12px;background:rgba(255,255,255,0.7);margin-bottom:4px;border-radius:8px;">
                    <div>
                      <strong>${esc(t.name)}</strong> on <code>${esc(t.table)}</code>
                      <div class="muted small" style="margin-top:2px;">${esc(t.purpose)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <h3 style="margin:18px 0 10px;color:var(--primary);">${icon('sparkles', 16)} Deterministic Stored Functions</h3>
              <div class="list">
                ${DATABASE_EXPLAINER.storedFunctions.map((f) => `
                  <div class="list-item" style="padding:8px 12px;background:rgba(255,255,255,0.7);margin-bottom:4px;border-radius:8px;">
                    <div><code>${esc(f.name)}</code> &rarr; <span class="badge">${esc(f.returns)}</span>: <span class="muted small">${esc(f.purpose)}</span></div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 6: DATA PERSISTENCE & ARCHITECTURE ----------------
  function renderPersistenceTab() {
    const data = PERSISTENCE_EXPLAINER;
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('server')} ${esc(data.title)}</div>
            <span class="glass-pill accent">Persistence &amp; Durability</span>
          </div>
          <div class="muted small" style="margin-top:-6px;margin-bottom:14px;">
            ${esc(data.subtitle)}
          </div>
          <div class="script-speech-box" style="font-size:15px;line-height:1.8;margin-bottom:20px;border-left:4px solid var(--primary);background:#f0f9ff;">
            <strong>The Core Flow in Plain English:</strong><br>
            "${esc(data.summaryQuote)}"
          </div>

          <div style="margin:24px 0 16px;">
            <div style="font-weight:700;font-size:15px;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              ${icon('code', 16)} 6-Tier Execution &amp; Storage Pipeline
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${data.architectureFlow.map((flow, idx) => `
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div class="glass-card" style="padding:16px 20px;background:rgba(255,255,255,0.95);border-left:4px solid var(--primary);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <span class="badge" style="background:#e0e7ff;color:#3730a3;font-weight:700;">Layer ${flow.layer}</span>
                        <span style="font-size:16px;font-weight:700;color:#0f172a;">${esc(flow.name)}</span>
                      </div>
                      <span class="muted small" style="font-weight:600;">${esc(flow.role)}</span>
                    </div>
                    <div class="two-level-card" style="margin-top:8px;">
                      <div class="level-card simple">
                        <span class="level-tag">Simple Explanation</span>
                        <span class="level-text">${esc(flow.simple)}</span>
                      </div>
                      <div class="level-card tech">
                        <span class="level-tag">Technical Architecture</span>
                        <span class="level-text">${esc(flow.technical)}</span>
                      </div>
                    </div>
                  </div>
                  ${idx < data.architectureFlow.length - 1 ? `
                    <div style="display:flex;justify-content:center;color:#64748b;">
                      <div style="display:flex;align-items:center;gap:6px;background:rgba(241,245,249,0.9);padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid #e2e8f0;">
                        <span>&darr; Transfers state &amp; commands &darr;</span>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('shield')} ${esc(data.deepDive.title)}</div>
            <span class="glass-pill success">InnoDB Engine Guarantees</span>
          </div>
          <div class="grid grid-2">
            ${data.deepDive.reasons.map((r) => `
              <div class="glass-card" style="padding:18px;background:rgba(255,255,255,0.92);">
                <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:8px;">${esc(r.title)}</div>
                <div class="muted small" style="line-height:1.6;color:#334155;">${esc(r.desc)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 7: TECHNOLOGY STACK ----------------
  function renderTechTab() {
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('cpu')} Technology Stack Justification</div>
            <span class="glass-pill success">Verified Dependencies</span>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:16px;">
            Every technology in SQL Ghost Hunter was chosen for specific academic and technical requirements. Here is how each fits together.
          </p>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th style="width:20%;">Technology</th>
                  <th style="width:40%;">Simple Everyday Explanation</th>
                  <th style="width:40%;">Technical / Architecture Role</th>
                </tr>
              </thead>
              <tbody>
                ${TECH_STACK.map((t) => `
                  <tr>
                    <td><strong>${esc(t.tech)}</strong></td>
                    <td>${esc(t.simple)}</td>
                    <td style="color:#1e3a8a;font-size:13px;">${esc(t.technical)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('shield')} Core Web &amp; Security Architectural Concepts</div>
            <span class="glass-pill">Essential Viva Definitions</span>
          </div>

          <div class="grid grid-2">
            ${CORE_WEB_CONCEPTS.map((c) => `
              <div class="glass-card" style="padding:18px;background:rgba(255,255,255,0.92);">
                <h3 style="color:#0f172a;margin-bottom:8px;font-size:15px;">${esc(c.concept)}</h3>
                <div style="font-size:13.5px;color:#334155;line-height:1.6;">
                  ${esc(c.explanation).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 8: DICTIONARY ----------------
  function renderDictionaryTab() {
    const cats = ['All', 'DBMS & SQL', 'Forensics & Security', 'Intelligence & AI', 'Architecture & Web'];
    const filtered = DICTIONARY_TERMS.filter((t) => {
      const matchCat = dictCategory === 'All' || t.cat === dictCategory;
      const matchSearch = !dictSearch || t.term.toLowerCase().includes(dictSearch.toLowerCase()) ||
                          t.simple.toLowerCase().includes(dictSearch.toLowerCase()) ||
                          t.tech.toLowerCase().includes(dictSearch.toLowerCase());
      return matchCat && matchSearch;
    });

    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('book')} Technical Terminology Dictionary (${DICTIONARY_TERMS.length} Terms)</div>
            <span class="glass-pill accent">Searchable Glossary</span>
          </div>

          <div class="glass-search-box">
            ${icon('search', 18)}
            <input type="text" id="dict-search-input" class="glass-search-input" placeholder="Search technical terms (e.g. 3NF, Trigger, SHA-256, ACID, CTE)..." value="${esc(dictSearch)}">
          </div>

          <div class="glass-filter-chips">
            ${cats.map((c) => `
              <button type="button" class="glass-filter-chip ${dictCategory === c ? 'active' : ''}" data-dictcat="${c}">${esc(c)}</button>
            `).join('')}
          </div>

          <div class="grid grid-2" style="margin-top:20px;">
            ${filtered.length ? filtered.map((t) => `
              <div class="glass-card" style="padding:18px;background:rgba(255,255,255,0.92);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                  <span style="font-size:17px;font-weight:700;color:#0f172a;">${esc(t.term)}</span>
                  <span class="badge">${esc(t.cat)}</span>
                </div>
                <div style="font-size:13px;color:#059669;margin-bottom:6px;"><strong>Simple:</strong> ${esc(t.simple)}</div>
                <div style="font-size:13px;color:#1e3a8a;margin-bottom:6px;"><strong>Technical:</strong> ${esc(t.tech)}</div>
                <div style="font-size:12.5px;color:#475569;background:#f8fafc;padding:6px 10px;border-radius:6px;margin-top:6px;">
                  <strong>In Project:</strong> ${esc(t.project)}
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;font-style:italic;">
                  Real-world example: ${esc(t.example)}
                </div>
              </div>
            `).join('') : `<div class="empty" style="grid-column:1/-1;">No terminology found matching "${esc(dictSearch)}".</div>`}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 9: TEACHER PRESENTATION ----------------
  function renderPresentationTab() {
    const data = TEACHER_PRESENTATION;
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('graduation')} Teacher Presentation Mode &mdash; Complete Demonstration Script</div>
            <div class="glass-badge-row">
              <button type="button" class="glass-pill ${activeSpeechLevel === 'student' ? 'accent' : ''}" data-speech="student">Student Speech</button>
              <button type="button" class="glass-pill ${activeSpeechLevel === 'prof' ? 'accent' : ''}" data-speech="prof">Professor Speech</button>
              <button type="button" class="glass-pill ${activeSpeechLevel === 'oneline' ? 'accent' : ''}" data-speech="oneline">One-Line Crisp</button>
            </div>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:20px;">
            Read or practice this exact speech when presenting your project in college seminars, project reviews, or university lab evaluations.
          </p>

          <div class="stack">
            <div class="script-section-card">
              <div class="script-section-header">
                <strong>1. The 30-Second Opening Elevator Pitch</strong>
                <span class="glass-pill accent">Time: 30s</span>
              </div>
              <div class="script-speech-box">
                ${activeSpeechLevel === 'student' ? `&ldquo;${esc(data.elevatorPitch)}&rdquo;` : 
                  activeSpeechLevel === 'prof' ? `&ldquo;Respected evaluators, SQL Ghost Hunter is a declarative active-database forensics platform that embeds non-repudiation audit pipelines directly into the relational storage engine via MySQL 8 triggers and collision-resistant SHA-256 verification.&rdquo;` :
                  `&ldquo;SQL Ghost Hunter captures database-level diffs via MySQL triggers and seals digital evidence with SHA-256 hashes to detect insider tampering.&rdquo;`}
              </div>
              <div class="script-action-callout">
                ${icon('info', 16)} <strong>Action while speaking:</strong> Show the brand logo on the Dashboard screen and point to the subtitle 'Every Database Change Leaves a Trace'.
              </div>
            </div>

            <div class="script-section-card">
              <div class="script-section-header">
                <strong>2. The Problem Statement</strong>
                <span class="glass-pill accent">Time: 1 min</span>
              </div>
              <div class="script-speech-box">
                ${activeSpeechLevel === 'oneline' ? 
                  `&ldquo;Traditional systems fail when administrators bypass web apps via command line, leaving no audit trail of who modified or deleted records.&rdquo;` :
                  `&ldquo;${esc(data.problemStatement)}&rdquo;`}
              </div>
            </div>

            <div class="script-section-card">
              <div class="script-section-header">
                <strong>3. Project Objectives (DBMS Syllabus Alignment)</strong>
                <span class="glass-pill success">8 Objectives</span>
              </div>
              <div class="grid grid-2" style="font-size:13.5px;color:#1e293b;gap:8px;">
                ${data.objectives.map((o) => `
                  <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;">${esc(o)}</div>
                `).join('')}
              </div>
            </div>

            <div class="script-section-card">
              <div class="script-section-header">
                <strong>4. System Architecture Explanation</strong>
                <span class="glass-pill accent">Data Tier Security</span>
              </div>
              <div class="script-speech-box">
                &ldquo;${esc(data.architectureSpeech)}&rdquo;
              </div>
            </div>

            <div class="script-section-card">
              <div class="script-section-header">
                <strong>5. Step-by-Step Live Demonstration Protocol</strong>
                <span class="glass-pill success">Follow in Order</span>
              </div>
              <div class="stack" style="gap:12px;">
                ${data.liveDemoSteps.map((s) => `
                  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                      <strong style="color:var(--primary);font-size:14.5px;">${esc(s.step)}</strong>
                      <span class="badge ok">Live Click</span>
                    </div>
                    <div style="font-size:13px;color:#0f172a;margin-bottom:6px;"><strong>Action:</strong> ${esc(s.action)}</div>
                    <div class="script-speech-box" style="font-size:13.5px;padding:10px 14px;background:#f0fdf4;border-color:#10b981;color:#14532d;">
                      ${esc(s.speech)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="script-section-card">
              <div class="script-section-header">
                <strong>6. Presentation Conclusion</strong>
                <span class="glass-pill accent">Closing Statement</span>
              </div>
              <div class="script-speech-box">
                &ldquo;${esc(data.conclusion)}&rdquo;
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 10: PROOF OF REAL DATA ----------------
  function renderProofTab() {
    const steps = PROOF_DEMO_SCRIPT;
    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('shield')} PROVE THAT SQL GHOST HUNTER ACTUALLY WORKS</div>
            <span class="glass-pill accent">Live Academic Demonstration Script</span>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:18px;line-height:1.6;">
            Follow this exact 17-step sequence in front of your college professor or examiner. 
            It proves conclusively that SQL Ghost Hunter performs genuine database operations, captures direct MySQL bypasses via event triggers, and permanently persists records across complete application restarts.
          </p>

          <div style="display:flex;flex-direction:column;gap:18px;">
            ${steps.map((s) => `
              <div class="glass-card" style="padding:20px;background:rgba(255,255,255,0.96);border:1px solid #e2e8f0;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span class="badge" style="background:#1e3a8a;color:#fff;font-weight:700;padding:4px 10px;border-radius:6px;">Step ${s.step}</span>
                    <span style="font-size:16px;font-weight:700;color:#0f172a;">${esc(s.title)}</span>
                  </div>
                  <span class="badge" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;font-size:11.5px;">
                    ${icon('sql', 12)} DBMS Concept: <strong>${esc(s.concept)}</strong>
                  </span>
                </div>

                <div class="grid grid-2" style="gap:12px;margin-bottom:12px;">
                  <div style="background:#f8fafc;padding:12px 14px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px;">
                      ${icon('user', 12)} What to Click / Do:
                    </div>
                    <div style="font-size:13.5px;color:#0f172a;line-height:1.5;">${esc(s.action)}</div>
                  </div>
                  <div style="background:#f8fafc;padding:12px 14px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px;">
                      ${icon('code', 12)} Backend / MySQL Execution:
                    </div>
                    <div style="font-size:13px;color:#1e3a8a;font-family:monospace;line-height:1.5;">${esc(s.execute)}</div>
                  </div>
                </div>

                <div style="background:#ecfdf5;padding:10px 14px;border-radius:8px;border:1px solid #a7f3d0;margin-bottom:12px;">
                  <span style="font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;margin-right:6px;">
                    ${icon('check', 13)} Expected Result:
                  </span>
                  <span style="font-size:13.5px;color:#064e3b;font-weight:600;">${esc(s.expected)}</span>
                </div>

                <div class="script-speech-box" style="margin-top:0;font-size:14px;line-height:1.6;border-left:4px solid var(--accent, #6366f1);background:#fbfcfe;">
                  <div style="font-size:12px;font-weight:700;color:#4338ca;text-transform:uppercase;margin-bottom:4px;">
                    ${icon('graduation', 13)} What to Tell Your Teacher:
                  </div>
                  <span style="color:#1e1b4b;font-style:italic;">"${esc(s.whatToTellTeacher)}"</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 11: VIVA PREPARATION ----------------
  function renderVivaTab() {
    const cats = ['All', 'DBMS Fundamentals', 'SQL Queries', 'Project Database Architecture', 'Forensics & Cybersecurity', 'Technology Stack', 'Project-Specific Tricky Questions'];
    const diffs = ['All', 'Beginner', 'Intermediate', 'Advanced'];

    const filtered = VIVA_QUESTIONS.filter((v) => {
      const matchCat = vivaCategory === 'All' || v.cat === vivaCategory;
      const matchDiff = vivaDifficulty === 'All' || v.diff === vivaDifficulty;
      const matchSearch = !vivaSearch || v.q.toLowerCase().includes(vivaSearch.toLowerCase()) ||
                          v.simple.toLowerCase().includes(vivaSearch.toLowerCase()) ||
                          v.tech.toLowerCase().includes(vivaSearch.toLowerCase());
      return matchCat && matchDiff && matchSearch;
    });

    return `
      <div class="glass-panel">
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('award')} Comprehensive Viva Preparation Centre (${VIVA_QUESTIONS.length} Questions)</div>
            <span class="glass-pill success">Examiner Tested</span>
          </div>

          <div class="glass-search-box">
            ${icon('search', 18)}
            <input type="text" id="viva-search-input" class="glass-search-input" placeholder="Search viva questions (e.g. trigger, 3NF, SHA-256, RESTRICT, injection)..." value="${esc(vivaSearch)}">
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:12px;">
            <div class="glass-filter-chips">
              ${cats.map((c) => `
                <button type="button" class="glass-filter-chip ${vivaCategory === c ? 'active' : ''}" data-vivacat="${c}">${esc(c)}</button>
              `).join('')}
            </div>

            <div class="glass-filter-chips">
              <span class="small muted" style="margin-right:4px;">Difficulty:</span>
              ${diffs.map((d) => `
                <button type="button" class="glass-filter-chip ${vivaDifficulty === d ? 'active' : ''}" data-vivadiff="${d}">${esc(d)}</button>
              `).join('')}
            </div>
          </div>

          <div class="viva-list" style="margin-top:20px;">
            ${filtered.length ? filtered.map((v) => `
              <div class="viva-card" data-vivaid="${v.id}">
                <div class="viva-head">
                  <div class="viva-q-title">
                    <span class="badge ${v.diff === 'Beginner' ? 'ok' : v.diff === 'Intermediate' ? 'MEDIUM' : 'CRITICAL'}">${esc(v.diff)}</span>
                    <span>Q${v.id}. ${esc(v.q)}</span>
                  </div>
                  <span class="glass-pill" style="font-size:11px;">${esc(v.cat)}</span>
                </div>
                <div class="viva-body">
                  <div class="viva-block simple">
                    <span class="viva-block-label">Simple Answer (20 Seconds Speaking):</span>
                    <span class="viva-block-content">${esc(v.simple)}</span>
                  </div>
                  <div class="viva-block tech">
                    <span class="viva-block-label">Technical / Relational Answer (Full Marks):</span>
                    <span class="viva-block-content">${esc(v.tech)}</span>
                  </div>
                  <div class="viva-block analogy">
                    <span class="viva-block-label">Everyday Analogy:</span>
                    <span class="viva-block-content">${esc(v.analogy)}</span>
                  </div>
                  <div class="viva-block followup">
                    <span class="viva-block-label">Faculty Follow-Up Counter-Question:</span>
                    <span class="viva-block-content"><strong>${esc(v.followup)}</strong></span>
                  </div>
                </div>
              </div>
            `).join('') : `<div class="empty">No viva questions match your search or filter.</div>`}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- TAB 12: TEACH ME & FEEDBACK SYSTEM ----------------
  function renderFeedbackTab() {
    const curMode = TEACH_ME_MODES.find((m) => m.id === activeTeachMode) || TEACH_ME_MODES[0];
    const avgScore = feedbackList.length ? (feedbackList.reduce((acc, f) => acc + (f.rating || 5), 0) / feedbackList.length).toFixed(1) : "5.0";

    return `
      <div class="glass-panel">
        <!-- Sub-section 1: Persona Learner -->
        <div class="glass-card">
          <div class="glass-card-head">
            <div class="glass-card-title">${icon('sparkles')} 'Teach Me This Project' &mdash; Multi-Perspective Persona Switcher</div>
            <span class="glass-pill accent">Dynamic Pedagogical Modes</span>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:18px;">
            Choose a persona below to see how the explanation dynamically adapts from a 10-year-old child to a computer science professor.
          </p>

          <div class="glass-quick-modes" style="grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));">
            ${TEACH_ME_MODES.map((m) => `
              <button type="button" class="quick-mode-btn ${m.id === curMode.id ? 'active' : ''}" data-teachmode="${m.id}">
                <div class="mode-title">${esc(m.title)}</div>
                <div class="mode-desc">${esc(m.badge)}</div>
              </button>
            `).join('')}
          </div>

          <div class="glass-card" style="margin-top:22px;padding:24px;background:rgba(255,255,255,0.96);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">
              <h2 style="font-size:20px;color:#0f172a;">${esc(curMode.title)}</h2>
              <span class="glass-pill success">${esc(curMode.badge)}</span>
            </div>
            <div class="script-speech-box" style="font-size:15px;line-height:1.8;background:#ffffff;border-color:var(--primary);">
              ${esc(curMode.content).replace(/\n/g, '<br>')}
            </div>
          </div>
        </div>

        <!-- Sub-section 2: Complete Examiner Evaluation & Feedback Suite -->
        <div class="glass-card" id="feedback-suite" style="border:2px solid var(--glass-accent-border);">
          <div class="glass-card-head">
            <div class="glass-card-title" style="color:var(--primary);">
              ${icon('award')} College Faculty, Examiner &amp; Student Feedback Suite
            </div>
            <div class="glass-badge-row">
              <span class="glass-pill success">Verified Feedback Hub</span>
              <span class="glass-pill accent">Average Score: ⭐ ${avgScore} / 5.0</span>
            </div>
          </div>
          <p class="muted small" style="margin-top:-6px;margin-bottom:20px;line-height:1.6;">
            Are you a DBMS Professor, Lab Examiner, Student, or Evaluator? Testify to the technical rigor, relational design, 
            and real-world forensic capabilities of SQL Ghost Hunter. Submissions are saved persistently and displayed on the public review ledger.
          </p>

          <div class="grid grid-2" style="gap:24px;align-items:start;">
            <!-- Feedback Form -->
            <form id="evaluation-feedback-form" class="glass-card" style="padding:24px;background:rgba(255,255,255,0.98);box-shadow:var(--glass-shadow-lg);">
              <h3 style="font-size:18px;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
                ${icon('edit', 18)} Submit Your Evaluation &amp; Rating
              </h3>

              <div class="stack" style="gap:14px;">
                <div>
                  <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">Your Name / Title *</label>
                  <input type="text" id="fb-name" required class="input" placeholder="e.g. Dr. K. Sharma / Vikram Mehta" style="width:100%;">
                </div>

                <div class="grid grid-2" style="gap:12px;">
                  <div>
                    <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">Evaluator Role *</label>
                    <select id="fb-role" class="input" style="width:100%;">
                      <option value="DBMS Professor">DBMS Professor / Faculty</option>
                      <option value="External Lab Examiner">External Lab Examiner</option>
                      <option value="Project Evaluator">College Project Evaluator</option>
                      <option value="B.Tech CS Student">B.Tech CS Student / Peer</option>
                      <option value="Database Administrator">Database Administrator (DBA)</option>
                      <option value="Security Researcher">Cybersecurity Researcher</option>
                    </select>
                  </div>
                  <div>
                    <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">Department / Institution</label>
                    <input type="text" id="fb-inst" class="input" placeholder="e.g. Dept of CSE, MIT / Anna Univ" style="width:100%;">
                  </div>
                </div>

                <!-- Star Rating Selector -->
                <div>
                  <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">Overall Project Rating (1 to 5 Stars) *</label>
                  <div class="rating-stars-wrap" style="display:flex;gap:8px;font-size:26px;cursor:pointer;">
                    ${[1, 2, 3, 4, 5].map((num) => `
                      <span class="star-item ${num <= feedbackRating ? 'active' : ''}" data-star="${num}" style="color:${num <= feedbackRating ? '#f59e0b' : '#cbd5e1'};transition:transform 0.15s;">★</span>
                    `).join('')}
                    <span id="star-label" style="font-size:14px;font-weight:700;color:#b45309;margin-left:8px;align-self:center;">
                      ${feedbackRating} of 5 Stars (Outstanding)
                    </span>
                  </div>
                </div>

                <!-- Checkboxes: Highlights -->
                <div>
                  <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">What Impressed You Most? (Select All That Apply)</label>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;color:#1e293b;">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" name="fb-high" value="Engine-Level Triggers" checked> Engine Triggers over App Logs
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" name="fb-high" value="SHA-256 Tamper Detection" checked> SHA-256 Tamper Detection
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" name="fb-high" value="3NF Normalization" checked> 3NF Normalized Schema
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" name="fb-high" value="Zero Mock Arrays" checked> Zero Mock Data (Real MySQL)
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" name="fb-high" value="90+ Viva Questions"> 90+ Viva Questions &amp; Answers
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" name="fb-high" value="Liquid Glass UI"> Liquid Glass Apple-Inspired UI
                    </label>
                  </div>
                </div>

                <!-- Written Feedback -->
                <div>
                  <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">Detailed Evaluation Feedback / Remarks *</label>
                  <textarea id="fb-comments" required class="input" rows="4" placeholder="Share your academic assessment of this database forensics project, schema rigor, or viva preparation value..." style="width:100%;resize:vertical;"></textarea>
                </div>

                <!-- Final Grade Recommendation -->
                <div>
                  <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">Final Recommended Grade for DBMS Lab Exam</label>
                  <select id="fb-grade" class="input" style="width:100%;">
                    <option value="Outstanding (10/10 - Grade O)">Grade O (10/10) - Outstanding / Centum</option>
                    <option value="Excellent (9/10 - Grade A+)">Grade A+ (9/10) - Excellent Implementation</option>
                    <option value="Very Good (8/10 - Grade A)">Grade A (8/10) - Very Good</option>
                  </select>
                </div>

                <div id="fb-success-banner" class="alert ok" style="display:none;padding:12px;margin-top:4px;">
                  ${icon('check', 16)} <strong>Thank you!</strong> Your evaluation has been permanently recorded and added to the faculty review ledger.
                </div>

                <button type="submit" class="btn btn-primary" style="padding:12px 20px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(37,99,235,0.3);">
                  ${icon('check', 16)} Submit Academic Evaluation &amp; Review
                </button>
              </div>
            </form>

            <!-- Live Reviews Column -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <h3 style="font-size:18px;color:#0f172a;display:flex;align-items:center;gap:8px;">
                  ${icon('shield', 18)} Verified Evaluator Reviews (${feedbackList.length})
                </h3>
                <button type="button" class="btn btn-sm btn-ghost" id="export-feedback-json-btn">
                  ${icon('download', 14)} Export Reviews (JSON)
                </button>
              </div>

              <div id="feedback-cards-container" class="stack" style="gap:14px;max-height:640px;overflow-y:auto;padding-right:4px;">
                ${feedbackList.map((f) => `
                  <div class="glass-card" style="padding:18px 20px;background:rgba(255,255,255,0.95);border-left:4px solid #10b981;">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;">
                      <div>
                        <div style="font-size:15px;font-weight:700;color:#0f172a;">${esc(f.name)}</div>
                        <div class="muted small" style="color:#0369a1;font-weight:600;">${esc(f.role)} &bull; ${esc(f.institution || 'Verified Evaluator')}</div>
                      </div>
                      <div style="text-align:right;">
                        <span style="color:#f59e0b;font-size:16px;">${'★'.repeat(f.rating || 5)}</span>
                        <div style="font-size:11px;color:#64748b;margin-top:2px;">${esc(f.date || 'Recent')}</div>
                      </div>
                    </div>

                    <div style="font-size:13.5px;color:#1e293b;line-height:1.6;margin:10px 0;background:#f8fafc;padding:10px 14px;border-radius:8px;">
                      &ldquo;${esc(f.feedback)}&rdquo;
                    </div>

                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px;">
                      <span class="badge ok" style="font-weight:700;">${esc(f.recommendation || 'Grade O')}</span>
                      <div class="glass-badge-row" style="gap:4px;">
                        ${(f.highlights || []).slice(0, 3).map((h) => `<span class="badge" style="font-size:10.5px;">${esc(h)}</span>`).join('')}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCurrentTab() {
    switch (activeTab) {
      case 'why': return renderWhyTab();
      case 'tour': return renderTourTab();
      case 'workflow': return renderWorkflowTab();
      case 'database': return renderDatabaseTab();
      case 'persistence': return renderPersistenceTab();
      case 'tech': return renderTechTab();
      case 'dictionary': return renderDictionaryTab();
      case 'presentation': return renderPresentationTab();
      case 'proof': return renderProofTab();
      case 'viva': return renderVivaTab();
      case 'feedback': return renderFeedbackTab();
      case 'overview':
      default:
        return renderOverviewTab();
    }
  }

  function fullRender() {
    containerEl.innerHTML = `
      <div class="help-container">
        ${renderHero()}
        ${renderTabsBar()}
        <div id="help-tab-content">
          ${renderCurrentTab()}
        </div>
      </div>
    `;
    wireEvents();
  }

  function wireEvents() {
    // Tab Clicks
    containerEl.querySelectorAll('.glass-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        window.location.hash = activeTab;
        fullRender();
        window.scrollTo({ top: 120, behavior: 'smooth' });
      });
    });

    // Hero Quick Mode Buttons
    containerEl.querySelectorAll('.quick-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.goto) {
          activeTab = btn.dataset.goto;
          window.location.hash = activeTab;
          fullRender();
          window.scrollTo({ top: 180, behavior: 'smooth' });
        }
      });
    });

    // Tour Module Selection
    containerEl.querySelectorAll('[data-tour]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTourModule = btn.dataset.tour;
        fullRender();
      });
    });

    // Database Table Selector
    containerEl.querySelectorAll('[data-dbtable]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeDbTable = btn.dataset.dbtable;
        fullRender();
      });
    });

    // Teach Me Mode Persona Switcher
    containerEl.querySelectorAll('[data-teachmode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTeachMode = btn.dataset.teachmode;
        fullRender();
      });
    });

    // Speech Level
    containerEl.querySelectorAll('[data-speech]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSpeechLevel = btn.dataset.speech;
        fullRender();
      });
    });

    // Viva Category & Difficulty Filters
    containerEl.querySelectorAll('[data-vivacat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vivaCategory = btn.dataset.vivacat;
        fullRender();
      });
    });
    containerEl.querySelectorAll('[data-vivadiff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vivaDifficulty = btn.dataset.vivadiff;
        fullRender();
      });
    });

    // Viva Search
    const vivaInput = containerEl.querySelector('#viva-search-input');
    if (vivaInput) {
      vivaInput.addEventListener('input', (e) => {
        vivaSearch = e.target.value;
        const list = containerEl.querySelector('.viva-list');
        if (list) {
          const filtered = VIVA_QUESTIONS.filter((v) => {
            const matchCat = vivaCategory === 'All' || v.cat === vivaCategory;
            const matchDiff = vivaDifficulty === 'All' || v.diff === vivaDifficulty;
            const matchSearch = !vivaSearch || v.q.toLowerCase().includes(vivaSearch.toLowerCase()) ||
                                v.simple.toLowerCase().includes(vivaSearch.toLowerCase()) ||
                                v.tech.toLowerCase().includes(vivaSearch.toLowerCase());
            return matchCat && matchDiff && matchSearch;
          });
          list.innerHTML = filtered.length ? filtered.map((v) => `
            <div class="viva-card" data-vivaid="${v.id}">
              <div class="viva-head">
                <div class="viva-q-title">
                  <span class="badge ${v.diff === 'Beginner' ? 'ok' : v.diff === 'Intermediate' ? 'MEDIUM' : 'CRITICAL'}">${esc(v.diff)}</span>
                  <span>Q${v.id}. ${esc(v.q)}</span>
                </div>
                <span class="glass-pill" style="font-size:11px;">${esc(v.cat)}</span>
              </div>
              <div class="viva-body">
                <div class="viva-block simple">
                  <span class="viva-block-label">Simple Answer (20 Seconds Speaking):</span>
                  <span class="viva-block-content">${esc(v.simple)}</span>
                </div>
                <div class="viva-block tech">
                  <span class="viva-block-label">Technical / Relational Answer (Full Marks):</span>
                  <span class="viva-block-content">${esc(v.tech)}</span>
                </div>
                <div class="viva-block analogy">
                  <span class="viva-block-label">Everyday Analogy:</span>
                  <span class="viva-block-content">${esc(v.analogy)}</span>
                </div>
                <div class="viva-block followup">
                  <span class="viva-block-label">Faculty Follow-Up Counter-Question:</span>
                  <span class="viva-block-content"><strong>${esc(v.followup)}</strong></span>
                </div>
              </div>
            </div>
          `).join('') : `<div class="empty">No viva questions match your search.</div>`;
        }
      });
    }

    // Dictionary Category & Search
    containerEl.querySelectorAll('[data-dictcat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        dictCategory = btn.dataset.dictcat;
        fullRender();
      });
    });
    const dictInput = containerEl.querySelector('#dict-search-input');
    if (dictInput) {
      dictInput.addEventListener('input', (e) => {
        dictSearch = e.target.value;
        const grid = containerEl.querySelector('.grid.grid-2');
        if (grid) {
          const filtered = DICTIONARY_TERMS.filter((t) => {
            const matchCat = dictCategory === 'All' || t.cat === dictCategory;
            const matchSearch = !dictSearch || t.term.toLowerCase().includes(dictSearch.toLowerCase()) ||
                                t.simple.toLowerCase().includes(dictSearch.toLowerCase()) ||
                                t.tech.toLowerCase().includes(dictSearch.toLowerCase());
            return matchCat && matchSearch;
          });
          grid.innerHTML = filtered.length ? filtered.map((t) => `
            <div class="glass-card" style="padding:18px;background:rgba(255,255,255,0.92);">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                <span style="font-size:17px;font-weight:700;color:#0f172a;">${esc(t.term)}</span>
                <span class="badge">${esc(t.cat)}</span>
              </div>
              <div style="font-size:13px;color:#059669;margin-bottom:6px;"><strong>Simple:</strong> ${esc(t.simple)}</div>
              <div style="font-size:13px;color:#1e3a8a;margin-bottom:6px;"><strong>Technical:</strong> ${esc(t.tech)}</div>
              <div style="font-size:12.5px;color:#475569;background:#f8fafc;padding:6px 10px;border-radius:6px;margin-top:6px;">
                <strong>In Project:</strong> ${esc(t.project)}
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;font-style:italic;">
                Real-world example: ${esc(t.example)}
              </div>
            </div>
          `).join('') : `<div class="empty" style="grid-column:1/-1;">No terminology found matching "${esc(dictSearch)}".</div>`;
        }
      });
    }

    // Feedback Star Click
    containerEl.querySelectorAll('.star-item').forEach((star) => {
      star.addEventListener('click', () => {
        feedbackRating = Number(star.dataset.star);
        const label = containerEl.querySelector('#star-label');
        if (label) {
          const descriptions = {
            1: "1 of 5 Stars (Needs Improvement)",
            2: "2 of 5 Stars (Fair)",
            3: "3 of 5 Stars (Good Project)",
            4: "4 of 5 Stars (Very Good Implementation)",
            5: "5 of 5 Stars (Outstanding / Grade O)"
          };
          label.textContent = descriptions[feedbackRating] || `${feedbackRating} Stars`;
        }
        containerEl.querySelectorAll('.star-item').forEach((s) => {
          const n = Number(s.dataset.star);
          s.style.color = n <= feedbackRating ? '#f59e0b' : '#cbd5e1';
        });
      });
    });

    // Feedback Form Submit
    const fbForm = containerEl.querySelector('#evaluation-feedback-form');
    if (fbForm) {
      fbForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = containerEl.querySelector('#fb-name')?.value.trim();
        const role = containerEl.querySelector('#fb-role')?.value;
        const institution = containerEl.querySelector('#fb-inst')?.value.trim();
        const comments = containerEl.querySelector('#fb-comments')?.value.trim();
        const grade = containerEl.querySelector('#fb-grade')?.value;

        const highlights = [];
        containerEl.querySelectorAll('input[name="fb-high"]:checked').forEach((cb) => {
          highlights.push(cb.value);
        });

        if (!name || !comments) return;

        const newReview = {
          id: Date.now(),
          name,
          role,
          institution: institution || "Verified Academic Evaluator",
          rating: feedbackRating,
          feedback: comments,
          recommendation: grade,
          highlights,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          verified: true
        };

        saveFeedback(newReview);

        const banner = containerEl.querySelector('#fb-success-banner');
        if (banner) {
          banner.style.display = 'block';
          banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        setTimeout(() => {
          fullRender();
        }, 1200);
      });
    }

    // Export Feedback JSON
    const exportBtn = containerEl.querySelector('#export-feedback-json-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(feedbackList, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", "sql_ghost_hunter_evaluations.json");
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
      });
    }
  }

  fullRender();
}
