// Application shell: authentication, navigation and hash routing.
import { api, get, post, setUnauthorizedHandler } from './api.js';
import { icon } from './icons.js';
import { $, esc, errorToast, formData, loading } from './ui.js';
import * as dashboard from './pages/dashboard.js';
import * as cases from './pages/cases.js';
import * as evidence from './pages/evidence.js';
import * as custody from './pages/custody.js';
import * as audit from './pages/audit.js';
import * as ai from './pages/ai.js';
import * as sqldemo from './pages/sqldemo.js';
import * as docs from './pages/docs.js';
import * as help from './pages/help.js';

const PAGES = [
  { path: 'dashboard', title: 'Dashboard', icon: 'dashboard', mod: dashboard, section: 'Overview' },
  { path: 'cases', title: 'Investigations', icon: 'cases', mod: cases, section: 'Forensics' },
  { path: 'evidence', title: 'Evidence Management', icon: 'evidence', mod: evidence },
  { path: 'custody', title: 'Chain of Custody', icon: 'custody', mod: custody },
  { path: 'audit', title: 'Database Audit Logs', icon: 'audit', mod: audit },
  { path: 'ai', title: 'AI Security Analysis', icon: 'ai', mod: ai, section: 'Intelligence' },
  { path: 'sql', title: 'SQL Demonstration', icon: 'sql', mod: sqldemo, section: 'Academic' },
  { path: 'docs', title: 'Documentation', icon: 'docs', mod: docs },
  { path: 'help', title: 'Help & Project Explainer', icon: 'help', mod: help, section: 'Learning' },
];

const DEMO_ACCOUNTS = [
  ['Admin', 'admin@ghosthunter.local', 'Admin@Ghost2026'],
  ['Lead investigator', 'vikram.mehta@ghosthunter.local', 'Lead@Ghost2026'],
  ['Investigator', 'priya.sharma@ghosthunter.local', 'Priya@Ghost2026'],
  ['Investigator 2', 'rahul.verma@ghosthunter.local', 'Rahul@Ghost2026'],
  ['Auditor', 'meera.iyer@ghosthunter.local', 'Audit@Ghost2026'],
];

const state = { user: null, renderToken: 0 };

export function can(perm) { return !!(state.user && state.user.permissions.includes(perm)); }
export function currentUser() { return state.user; }
export function navigate(hash) { if (location.hash === hash) route(); else location.hash = hash; }

function buildNav() {
  $('#nav').innerHTML = PAGES.map((p) =>
    (p.section ? `<div class="nav-section">${esc(p.section)}</div>` : '') +
    `<a href="#/${p.path}" data-path="${p.path}">${icon(p.icon)}<span>${esc(p.title)}</span></a>`).join('');
}

async function refreshAiPill() {
  try {
    const s = await get('/api/ai/status');
    const on = s.llm.available;
    $('#ai-pill').innerHTML = `<span class="dot ${on ? 'on' : 'off'}"></span><span>${on ? 'LLM online' : 'LLM offline'} &middot; rules active</span>`;
    $('#ai-pill').title = s.llm.mode;
  } catch { /* ignore */ }
}

function showLogin() {
  state.user = null;
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  $('#login-form [name=email]').focus();
}

async function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#user-name').textContent = state.user.name;
  $('#user-role').textContent = state.user.role.replace(/_/g, ' ');
  buildNav();
  refreshAiPill();
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/dashboard';
  else route();
}

async function route() {
  if (!state.user) return;
  const [pathPart, queryPart = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart);
  const page = PAGES.find((p) => p.path === parts[0]) || PAGES[0];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === page.path));
  $('#page-title').textContent = page.title;
  document.title = `${page.title} - SQL Ghost Hunter`;
  $('#sidebar').classList.remove('open');
  const el = $('#page');
  el.innerHTML = loading();
  const token = ++state.renderToken;
  try {
    await page.mod.render({ el, params: parts.slice(1), query, can, user: state.user, navigate,
                            isCurrent: () => token === state.renderToken });
  } catch (err) {
    if (token === state.renderToken) {
      el.innerHTML = `<div class="card"><div class="card-body"><strong>Could not load this page.</strong>
        <div class="muted">${esc(err.message || err)}</div></div></div>`;
    }
    if (err.status !== 401) console.error(err);
  }
  el.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function wireLogin() {
  $('#login-mark').innerHTML = icon('ghost', 24);
  $('#side-mark').innerHTML = icon('ghost', 20);
  $('#demo-accounts').innerHTML = DEMO_ACCOUNTS.map(([label, email], i) =>
    `<button type="button" class="chip" data-i="${i}" title="${esc(email)}">${esc(label)}</button>`).join('');
  $('#demo-accounts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const [, email, pw] = DEMO_ACCOUNTS[Number(b.dataset.i)];
    $('#login-form [name=email]').value = email;
    $('#login-form [name=password]').value = pw;
  });
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const data = formData(e.target);
    $('#login-error').textContent = '';
    btn.disabled = true;
    try {
      await post('/api/auth/login', { email: data.email, password: data.password });
      state.user = await get('/api/auth/me');
      e.target.reset();
      showApp();
    } catch (err) { $('#login-error').textContent = err.message; }
    finally { btn.disabled = false; }
  });
  $('#logout-btn').innerHTML = icon('logout');
  $('#logout-btn').addEventListener('click', async () => {
    try { await post('/api/auth/logout'); } catch { /* session may already be gone */ }
    location.hash = '';
    showLogin();
  });
  $('#nav-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
}

// ---------------- Backend Status Indicator Trigger ----------------
let healthCheckInProgress = false;
let statusIndicatorTimer = null;

function wireBackendCommand() {
  const input = $('#global-command-input');
  const indicator = $('#backend-status-indicator');
  const iconSpan = $('#command-search-icon');
  if (iconSpan) iconSpan.innerHTML = icon('search', 14);

  if (!input || !indicator) return;

  function showStatus(isConnected) {
    if (statusIndicatorTimer) {
      clearTimeout(statusIndicatorTimer);
      statusIndicatorTimer = null;
    }

    if (isConnected) {
      indicator.className = 'backend-status-indicator connected';
      indicator.innerHTML = '<span class="status-indicator-dot green"></span><span class="status-text">BACKEND CONNECTED</span>';
    } else {
      indicator.className = 'backend-status-indicator disconnected';
      indicator.innerHTML = '<span class="status-indicator-dot red"></span><span class="status-text">BACKEND DISCONNECTED</span>';
    }

    indicator.hidden = false;

    // Show for exactly 5 seconds, then automatically disappear
    statusIndicatorTimer = setTimeout(() => {
      indicator.hidden = true;
      statusIndicatorTimer = null;
    }, 5000);
  }

  async function checkAndTrigger() {
    const raw = input.value.trim().toLowerCase();
    if (raw === 'backend') {
      if (healthCheckInProgress) return; // Prevent duplicate concurrent requests
      healthCheckInProgress = true;

      try {
        const res = await fetch('/api/health', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (res.ok) {
          const data = await res.json();
          // Real backend verification: operational must be true (meaning MySQL and backend are connected)
          if (data && data.operational === true && (data.status === 'HEALTHY' || data.status === 'DEGRADED')) {
            showStatus(true);
          } else {
            showStatus(false);
          }
        } else {
          showStatus(false);
        }
      } catch {
        showStatus(false);
      } finally {
        healthCheckInProgress = false;
      }
    }
  }

  input.addEventListener('input', checkAndTrigger);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkAndTrigger();
    }
  });
}

async function boot() {
  wireLogin();
  wireBackendCommand();
  setUnauthorizedHandler(() => { if (state.user) errorToast(new Error('Session expired - please sign in again.')); showLogin(); });
  window.addEventListener('hashchange', route);
  try {
    state.user = await api('/api/auth/me');
    showApp();
  } catch { showLogin(); }
  setInterval(() => { if (state.user) refreshAiPill(); }, 60000);
}

boot();
