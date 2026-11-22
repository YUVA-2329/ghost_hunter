// PAGE 1 - Dashboard: every figure comes from /api/dashboard (live MySQL queries).
import { get, post } from '../api.js';
import { icon } from '../icons.js';
import { badge, esc, errorToast, fmtDate, scorebar, table, toast } from '../ui.js';

let charts = [];
let pollTimer = null;
let visHandler = null;

function stat(label, value, sub, ic, accent = '') {
  return `<div class="card stat ${accent}"><div class="stat-label">${icon(ic, 15)} ${esc(label)}</div>
    <div class="stat-value">${esc(value)}</div><div class="stat-sub">${sub}</div></div>`;
}

export async function render({ el, can, navigate, isCurrent }) {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (visHandler) { document.removeEventListener('visibilitychange', visHandler); visHandler = null; }

  const d = await get('/api/dashboard');
  if (!isCurrent()) return;
  charts.forEach((c) => c.destroy()); charts = [];
  const s = d.stats;
  const llm = d.ai_status.llm;
  el.innerHTML = `
    <p class="page-intro">Live view of the forensic database. Every number on this page is produced by a live MySQL query
      (view <code>vw_dashboard_stats</code>, <code>vw_audit_trail</code>, <code>vw_case_summary</code>).</p>
    <div class="row-between" style="margin-bottom:14px">
      <div class="row" style="gap:8px">
        ${can('ai.analyze') ? `<button class="btn btn-primary" id="run-analysis">${icon('cpu', 16)} Run anomaly analysis</button>` : ''}
        ${can('evidence.verify') ? `<button class="btn" id="verify-all">${icon('fingerprint', 16)} Verify all evidence</button>` : ''}
        <button class="btn" id="btn-refresh-dashboard" title="Refresh live metrics from MySQL database">${icon('refresh', 16)} Refresh Data</button>
      </div>
      <div class="row" style="gap:10px;align-items:center">
        <span class="badge badge-success" style="font-size:11px;display:inline-flex;align-items:center;gap:5px"><span class="dot on" style="width:6px;height:6px"></span> Live MySQL Sync</span>
        <span class="muted small" id="dash-updated-at">Updated ${fmtDate(new Date().toISOString().replace('T', ' '), true)}</span>
      </div>
    </div>
    <div class="grid grid-4">
      ${stat('Total investigations', s.total_cases, `${s.open_cases} open`, 'cases')}
      ${stat('Total evidence', s.total_evidence, `${s.integrity_checks} integrity checks recorded`, 'evidence')}
      ${stat('Verified evidence', s.verified_evidence, 'hash matches original', 'check', 'accent-green')}
      ${stat('Compromised evidence', s.compromised_evidence, 'TAMPERED or MISSING', 'alert', s.compromised_evidence ? 'accent-red' : '')}
      ${stat('Total audit events', s.total_audit_events, 'written by triggers &amp; procedures', 'audit')}
      ${stat('High-risk activities', s.high_risk_events, 'HIGH/CRITICAL audit events', 'alert-octagon', s.high_risk_events ? 'accent-orange' : '')}
      ${stat('Open AI alerts', s.open_alerts, `${s.high_risk_alerts} high or critical`, 'shield', s.high_risk_alerts ? 'accent-red' : '')}
      <div class="card stat"><div class="stat-label">${icon('ai', 15)} AI system status</div>
        <div class="row" style="gap:6px"><span class="dot ${llm.available ? 'on' : 'off'}"></span><strong>${llm.available ? 'LLM online' : 'LLM offline'}</strong></div>
        <div class="stat-sub">Anomaly detection: rules + statistics${d.ai_status.ml_available ? ' + ML' : ''}<br>${esc(llm.available ? llm.model : 'Using deterministic fallback')}</div></div>
    </div>

    <div class="grid grid-main" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>Database activity - last 14 days</h2></div>
        <div class="card-body"><div class="chart-box"><canvas id="ch-activity"></canvas></div></div></div>
      <div class="card"><div class="card-head"><h2>Audit events by risk level</h2></div>
        <div class="card-body"><div class="chart-box"><canvas id="ch-risk"></canvas></div></div></div>
    </div>

    <div class="grid grid-main" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>Recent modifications</h2><a href="#/audit" class="small">Open audit log</a></div>
        <div class="card-body flush">${table(d.recent_modifications, [
          { label: 'Time', render: (r) => `<span class="nowrap">${fmtDate(r.timestamp)}</span>` },
          { label: 'Operation', render: (r) => badge(r.action_type) },
          { label: 'Record', render: (r) => `${esc(r.table_name)} #${esc(r.record_id)}` },
          { label: 'Case', render: (r) => `<span class="nowrap">${esc(r.case_code || '')}</span>` },
          { label: 'Investigator', render: (r) => esc(r.investigator_name) },
          { label: 'Risk', render: (r) => badge(r.risk_level) }], { empty: 'No modifications yet.', compact: true })}</div></div>
      <div class="stack">
        <div class="card"><div class="card-head"><h2>Top open alerts</h2><a href="#/ai" class="small">AI analysis</a></div>
          <div class="list">${d.top_alerts.length ? d.top_alerts.map((a) => `
            <a class="list-item" href="#/ai/alerts" style="text-decoration:none;color:inherit">
              ${badge(a.severity)}<div class="grow"><div class="truncate">${esc(a.title)}</div>
              <div class="muted small">${esc(a.case_code || 'no case')} &middot; ${esc(a.detection_method)} &middot; ${fmtDate(a.last_event_at)}</div></div>
              <strong>${esc(a.risk_score)}</strong></a>`).join('') : '<div class="empty">No open alerts.</div>'}</div></div>
        <div class="card"><div class="card-head"><h2>Investigations by risk</h2></div>
          <div class="list">${d.cases_by_risk.map((c) => `
            <div class="list-item clickable" data-case="${esc(c.case_code)}"><div class="grow"><div class="truncate"><strong>${esc(c.case_code)}</strong> ${esc(c.case_title)}</div>
            <div class="muted small">${esc(c.case_status.replace('_', ' '))}</div></div><div style="width:130px">${scorebar(c.risk_score)}</div></div>`).join('')}</div></div>
      </div>
    </div>`;

  const Chart = window.Chart;
  if (Chart) {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = '#64748b';
    charts.push(new Chart(el.querySelector('#ch-activity'), {
      type: 'bar',
      data: { labels: d.daily_activity.map((r) => String(r.day).slice(5)),
        datasets: [
          { label: 'All events', data: d.daily_activity.map((r) => r.events), backgroundColor: '#bfd3fb', borderRadius: 4 },
          { label: 'High / critical', data: d.daily_activity.map((r) => r.high_risk), backgroundColor: '#ea580c', borderRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f7' } }, x: { grid: { display: false } } } },
    }));
    const colors = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#ea580c', CRITICAL: '#dc2626' };
    charts.push(new Chart(el.querySelector('#ch-risk'), {
      type: 'doughnut',
      data: { labels: d.risk_distribution.map((r) => r.risk_level),
        datasets: [{ data: d.risk_distribution.map((r) => r.events), backgroundColor: d.risk_distribution.map((r) => colors[r.risk_level]), borderWidth: 2 }] },
      options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } },
    }));
  }

  el.querySelectorAll('[data-case]').forEach((n) => n.addEventListener('click', async () => {
    const all = await get('/api/cases');
    const c = all.find((x) => x.case_code === n.dataset.case);
    if (c) navigate(`#/cases/${c.case_id}`);
  }));
  const runBtn = el.querySelector('#run-analysis');
  if (runBtn) runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    try {
      const r = await post('/api/ai/analyze');
      toast(`Analysis complete: ${r.findings} findings, ${r.new_alerts} new alert(s).`, 'success');
      navigate('#/dashboard');
    } catch (e) { errorToast(e); } finally { runBtn.disabled = false; }
  });
  const vBtn = el.querySelector('#verify-all');
  if (vBtn) vBtn.addEventListener('click', async () => {
    vBtn.disabled = true;
    try {
      const r = await post('/api/evidence/verify-all');
      const sm = r.summary;
      toast(`Verified ${r.checked} item(s): ${sm.VERIFIED} verified, ${sm.TAMPERED} tampered, ${sm.MISSING} missing.`,
        sm.TAMPERED || sm.MISSING ? 'error' : 'success', 7000);
      navigate('#/dashboard');
    } catch (e) { errorToast(e); } finally { vBtn.disabled = false; }
  });

  const refBtn = el.querySelector('#btn-refresh-dashboard');
  if (refBtn) {
    refBtn.addEventListener('click', async () => {
      refBtn.disabled = true;
      try {
        await render({ el, can, navigate, isCurrent });
        toast('Dashboard live metrics refreshed from MySQL database.', 'success', 2500);
      } catch (e) {
        errorToast(e);
      } finally {
        refBtn.disabled = false;
      }
    });
  }

  // Periodic live refresh: polls MySQL every 8 seconds while current tab is dashboard
  pollTimer = setInterval(async () => {
    if (!isCurrent()) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    try {
      await render({ el, can, navigate, isCurrent });
    } catch { /* ignore network error on poll */ }
  }, 8000);

  // Tab visibility change: refresh immediately when returning to tab
  visHandler = async () => {
    if (document.visibilityState === 'visible' && isCurrent()) {
      try {
        await render({ el, can, navigate, isCurrent });
      } catch { /* ignore */ }
    }
  };
  document.addEventListener('visibilitychange', visHandler, { once: true });
}

