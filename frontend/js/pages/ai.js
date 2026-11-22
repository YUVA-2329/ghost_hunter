// PAGE 6 - AI Security Analysis: anomalies, risk scores, explanations,
// forensic assistant, investigation reports and configurable rules.
import { api, get, patch, post } from '../api.js';
import { icon } from '../icons.js';
import { badge, esc, errorToast, fmtDate, formData, loading, rawTable, renderMarkdown, scorebar, table, toast } from '../ui.js';

const TABS = [['alerts', 'Detected anomalies', 'alert'], ['assistant', 'Forensic assistant', 'ai'],
              ['reports', 'Investigation reports', 'report'], ['rules', 'Detection rules', 'settings']];
const chatHistory = [];

export async function render(ctx) {
  const tab = TABS.some((t) => t[0] === ctx.params[0]) ? ctx.params[0] : 'alerts';
  const st = await get('/api/ai/status');
  if (!ctx.isCurrent()) return;
  const llm = st.llm;
  ctx.el.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card stat"><div class="stat-label">${icon('ai', 15)} Local LLM (Ollama)</div>
        <div class="row" style="gap:6px"><span class="dot ${llm.available ? 'on' : 'off'}"></span><strong>${llm.available ? 'Online' : 'Offline'}</strong></div>
        <div class="stat-sub">${esc(llm.mode)}</div></div>
      <div class="card stat"><div class="stat-label">${icon('shield', 15)} Anomaly detection</div>
        <div class="row" style="gap:6px"><span class="dot on"></span><strong>Online</strong></div>
        <div class="stat-sub">Rule-based + statistical (z-score)${st.ml_available ? ' + optional ML (IsolationForest)' : ' &middot; ML not installed'}</div></div>
      <div class="card stat"><div class="stat-label">${icon('cpu', 15)} Assistant mode</div>
        <strong>${esc(st.assistant_mode)}</strong>
        <div class="stat-sub">Answers come from allowlisted read-only queries. The LLM never writes SQL.</div></div>
    </div>
    <div class="tabs">${TABS.map(([k, label, ic]) => `<a class="tab ${k === tab ? 'active' : ''}" href="#/ai/${k}">${icon(ic, 15)} ${label}</a>`).join('')}</div>
    <div id="tab-body">${loading()}</div>`;
  const body = ctx.el.querySelector('#tab-body');
  const fn = { alerts: renderAlerts, assistant: renderAssistant, reports: renderReports, rules: renderRules }[tab];
  await fn(body, ctx);
}

// ---------------------------------------------------------------- alerts
async function renderAlerts(box, { can, navigate, query, isCurrent }) {
  const status = query.get('status') || 'active';
  const qs = status === 'active' ? '' : `?status=${encodeURIComponent(status)}`;
  const [alerts, ranking] = await Promise.all([get(`/api/ai/alerts${qs}`), get('/api/ai/case-risk')]);
  if (!isCurrent()) return;
  const shown = status === 'active' ? alerts.filter((a) => a.status === 'OPEN' || a.status === 'ESCALATED') : alerts;
  box.innerHTML = `
    <div class="grid grid-main">
      <div class="stack">
        <div class="row-between">
          <div class="row"><select id="alert-status" aria-label="Alert status">
            ${[['active', 'Open + escalated'], ['OPEN', 'Open'], ['ESCALATED', 'Escalated'], ['ACKNOWLEDGED', 'Acknowledged'], ['DISMISSED', 'Dismissed']]
              .map(([v, l]) => `<option value="${v}" ${v === status ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <span class="muted small">${shown.length} alert(s)</span></div>
          ${can('ai.analyze') ? `<button class="btn btn-primary" id="run">${icon('cpu', 16)} Run anomaly analysis</button>` : ''}
        </div>
        <div id="run-result"></div>
        ${shown.length ? shown.map((a) => alertCard(a, can)).join('') : '<div class="card"><div class="empty">No alerts in this view.</div></div>'}
      </div>
      <div class="stack">
        <div class="card"><div class="card-head"><h2>Investigations by risk</h2></div><div class="card-body flush">${table(ranking, [
          { label: 'Case', render: (r) => `<a href="#/cases/${r.case_id}"><strong>${esc(r.case_code)}</strong></a><div class="muted small truncate" style="max-width:190px">${esc(r.case_title)}</div>` },
          { label: 'Risk', render: (r) => scorebar(r.risk_score) },
          { label: 'Alerts', key: 'open_alerts', cls: 'num' }], { compact: true })}</div>
          <div class="card-foot muted small">Case risk = highest open alert score + 5 per additional open alert (SQL function <code>fn_case_risk_score</code>).</div></div>
        <div class="card"><div class="card-body small">
          <div class="section-title">How to read an alert</div>
          <p><span class="badge method">RULE</span> deterministic rule with configurable threshold.<br>
          <span class="badge method">STATISTICAL</span> z-score against the activity baseline.<br>
          <span class="badge method">ML</span> unsupervised IsolationForest (optional).</p>
          <p class="muted">Scores: 0-34 LOW, 35-59 MEDIUM, 60-84 HIGH, 85-100 CRITICAL. An alert is an indicator for review, not proof of wrongdoing.</p>
        </div></div>
      </div>
    </div>`;
  box.querySelector('#alert-status').addEventListener('change', (e) => navigate(`#/ai/alerts?status=${e.target.value}`));
  const run = box.querySelector('#run');
  if (run) run.addEventListener('click', async () => {
    run.disabled = true;
    box.querySelector('#run-result').innerHTML = loading('Analysing audit logs, logins and integrity checks...');
    try {
      const r = await post('/api/ai/analyze');
      box.querySelector('#run-result').innerHTML = `<div class="notice">Analysed ${r.events_analysed} audit events and
        ${r.login_attempts_analysed} login attempts (last ${r.lookback_days} days): <strong>${r.findings} findings</strong>,
        ${r.new_alerts} new alert(s), ${r.updated_alerts} updated. ${Object.entries(r.by_rule).map(([k, v]) => `${esc(k)}: ${v}`).join(', ')}</div>`;
      toast('Analysis complete', 'success');
      setTimeout(() => { if (isCurrent()) navigate(location.hash); }, 1600);
    } catch (e) { errorToast(e); box.querySelector('#run-result').innerHTML = ''; } finally { run.disabled = false; }
  });
  box.querySelectorAll('[data-alert-action]').forEach((b) => b.addEventListener('click', async () => {
    try { await patch(`/api/ai/alerts/${b.dataset.id}`, { status: b.dataset.alertAction }); toast(`Alert #${b.dataset.id} ${b.dataset.alertAction.toLowerCase()}`, 'success'); navigate(location.hash); }
    catch (e) { errorToast(e); }
  }));
  box.querySelectorAll('[data-why]').forEach((b) => b.addEventListener('click', () => {
    sessionStorage.setItem('gh-ask', `Why was alert ${b.dataset.why} flagged?`);
    navigate('#/ai/assistant');
  }));
}

function alertCard(a, can) {
  const bd = (a.supporting_facts && a.supporting_facts.score_breakdown) || [];
  const explanation = String(a.explanation || '').replace(/\s*Risk score .*$/, '');
  return `<div class="alert-card ${esc(a.severity)}">
    <div class="row-between"><div class="row">${badge(a.severity)} <span class="badge method">${esc(a.detection_method)}</span>
      <strong>${esc(a.title)}</strong></div><div style="width:150px">${scorebar(a.risk_score)}</div></div>
    <div class="explain">${esc(explanation)}</div>
    <div class="breakdown">${bd.map((b) => `<div class="b"><span>${esc(b.factor)}</span><span class="p ${b.points < 0 ? 'neg' : ''}">${b.points > 0 ? '+' : ''}${esc(b.points)}</span></div>`).join('')}
      <div class="b" style="border-top:1px solid var(--border);padding-top:4px"><strong>Risk score</strong><span class="p">${esc(a.risk_score)}</span></div></div>
    <div class="row-between"><div class="muted small">#${a.alert_id} &middot; rule ${esc(a.rule_code)} &middot; ${a.case_code ? `<a href="#/cases/${a.related_case_id}">${esc(a.case_code)}</a> &middot; ` : ''}
      events ${fmtDate(a.first_event_at)} - ${fmtDate(a.last_event_at)} &middot; ${badge(a.status)}${a.reviewed_by_name ? ` by ${esc(a.reviewed_by_name)}` : ''}</div>
      <div class="row" style="gap:4px">
        <button class="btn btn-sm btn-ghost" data-why="${a.alert_id}">${icon('ai', 14)} Ask why</button>
        ${can('ai.alert_review') ? `
          ${a.status !== 'ACKNOWLEDGED' ? `<button class="btn btn-sm" data-alert-action="ACKNOWLEDGED" data-id="${a.alert_id}">Acknowledge</button>` : ''}
          ${a.status !== 'ESCALATED' ? `<button class="btn btn-sm" data-alert-action="ESCALATED" data-id="${a.alert_id}">Escalate</button>` : ''}
          ${a.status !== 'DISMISSED' ? `<button class="btn btn-sm btn-ghost" data-alert-action="DISMISSED" data-id="${a.alert_id}">Dismiss</button>` : `<button class="btn btn-sm" data-alert-action="OPEN" data-id="${a.alert_id}">Re-open</button>`}` : ''}
      </div></div></div>`;
}

// ---------------------------------------------------------------- assistant
const SUGGESTIONS = ['What suspicious activities happened today?', 'What suspicious activities happened yesterday?',
  'Which evidence files failed verification?', 'Summarize the suspicious activities in Case 001.',
  'Who modified evidence 2?', 'Show the custody history of EV-0001', 'Which investigation currently has the highest risk?',
  'Why was alert 1 flagged?', 'Show failed logins this week'];

async function renderAssistant(box, { isCurrent }) {
  box.innerHTML = `
    <div class="grid grid-main">
      <div class="card"><div class="card-head"><h2>Ask the forensic assistant</h2>
          <label class="row small" style="gap:6px"><input type="checkbox" id="use-llm" checked> use local LLM when online</label></div>
        <div class="card-body">
          <div class="chat" id="chat">${chatHistory.length ? '' : '<div class="muted">Ask a question about cases, evidence, the audit trail or alerts.</div>'}</div>
          <form class="row" id="ask-form" style="margin-top:16px">
            <input name="q" style="flex:1;min-width:220px" maxlength="500" placeholder="e.g. Summarize the suspicious activities in Case 001" autocomplete="off">
            <button class="btn btn-primary">${icon('send', 15)} Ask</button></form>
          <div class="chips">${SUGGESTIONS.map((s) => `<button type="button" class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        </div></div>
      <div class="card"><div class="card-body small">
        <div class="section-title">How answers are produced</div>
        <ol style="padding-left:18px;margin:8px 0">
          <li><strong>Route</strong> the question to one allowlisted intent (rules first, the LLM only picks from the list).</li>
          <li><strong>Retrieve</strong> facts with fixed, parameterized, read-only SQL that respects your case access.</li>
          <li><strong>Answer</strong>: <span class="label-facts">Verified facts</span> are copied from MySQL; the
            <span class="label-ai">AI narrative</span> only rephrases them (or a deterministic summary is shown when the LLM is offline).</li>
          <li><strong>Guard</strong>: codes mentioned by the LLM that are not in the facts are flagged.</li></ol>
        <p class="muted">The LLM never receives database credentials and cannot run SQL. Every question is written to the audit log (AI_QUERY).</p>
      </div></div>
    </div>`;
  const chat = box.querySelector('#chat');
  chatHistory.forEach((h) => chat.insertAdjacentHTML('beforeend', h));
  const ask = async (q) => {
    if (!q) return;
    const qHtml = `<div class="msg-q">${esc(q)}</div>`;
    chat.querySelector('.muted:only-child')?.remove();
    chat.insertAdjacentHTML('beforeend', qHtml + `<div class="msg-a" id="pending">${loading('Retrieving facts from MySQL...')}</div>`);
    chatHistory.push(qHtml);
    try {
      const r = await post('/api/ai/assistant', { question: q, use_llm: box.querySelector('#use-llm').checked });
      const html = answerHtml(r);
      chatHistory.push(html);
      if (isCurrent()) chat.querySelector('#pending').outerHTML = html;
    } catch (e) {
      const html = `<div class="msg-a"><div class="warn">${esc(e.message)}</div></div>`;
      chatHistory.push(html);
      if (isCurrent()) chat.querySelector('#pending').outerHTML = html;
    }
    if (chatHistory.length > 30) chatHistory.splice(0, chatHistory.length - 30);
  };
  box.querySelector('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); const q = e.target.q.value.trim(); e.target.q.value = ''; ask(q); });
  box.querySelectorAll('[data-s]').forEach((c) => c.addEventListener('click', () => ask(c.dataset.s)));
  const pre = sessionStorage.getItem('gh-ask');
  if (pre) { sessionStorage.removeItem('gh-ask'); ask(pre); }
}

function answerHtml(r) {
  return `<div class="msg-a">
    <div class="row-between"><strong>${esc(r.title)}</strong><span class="muted small">intent: ${esc(r.intent)} (via ${esc(r.routed_by)})</span></div>
    <div style="margin-top:8px"><span class="${r.narrative_source.startsWith('AI') ? 'label-ai' : 'label-facts'}">${r.narrative_source.startsWith('AI') ? 'AI narrative' : 'Summary'}</span>
      <div style="white-space:pre-wrap;margin-top:4px">${esc(r.narrative)}</div>
      <div class="src">${esc(r.narrative_source)}</div></div>
    ${(r.warnings || []).map((w) => `<div class="warn">${icon('alert', 14)} ${esc(w)}</div>`).join('')}
    <div class="label-facts">Verified facts (retrieved from MySQL: ${esc((r.sources || []).join(', '))})</div>
    <ul class="facts">${r.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    ${(r.tables || []).map((t) => `<details style="margin-top:8px"><summary class="small">${esc(t.title)} (${t.rows.length} rows)</summary>${rawTable(t.columns, t.rows)}</details>`).join('')}
  </div>`;
}

// ---------------------------------------------------------------- reports
async function renderReports(box, { params, navigate, isCurrent }) {
  const cases = await get('/api/cases');
  if (!isCurrent()) return;
  const selected = params[1] ? Number(params[1]) : null;
  box.innerHTML = `
    <div class="card" style="margin-bottom:16px"><div class="card-body">
      <form class="row" id="rep-form">
        <select name="case" required><option value="">Select an investigation...</option>
          ${cases.map((c) => `<option value="${c.case_id}" ${c.case_id === selected ? 'selected' : ''}>${esc(c.case_code)} - ${esc(c.case_title)}</option>`).join('')}</select>
        <label class="row small" style="gap:6px"><input type="checkbox" name="ai" checked> include AI narrative (if LLM online)</label>
        <button class="btn btn-primary">${icon('report', 16)} Generate report</button>
      </form>
      <div class="muted small" style="margin-top:8px">Reports separate <strong>verified facts</strong> (from MySQL), <strong>rule-based recommendations</strong>
        and the optional <strong>AI-generated narrative</strong>.</div></div></div>
    <div id="report-out"></div>`;
  box.querySelector('#rep-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    if (d.case) navigate(`#/ai/reports/${d.case}${e.target.ai.checked ? '' : '?ai=0'}`);
  });
  if (!selected) return;
  const withAi = new URLSearchParams(location.hash.split('?')[1] || '').get('ai') !== '0';
  const out = box.querySelector('#report-out');
  out.innerHTML = loading('Building report from the database...');
  try {
    const res = await api(`/api/reports/case/${selected}?format=md&ai=${withAi}`, { raw: true });
    const md = await res.text();
    if (!isCurrent()) return;
    out.innerHTML = `<div class="card"><div class="card-head"><h2>Investigation report</h2>
        <a class="btn btn-sm" href="/api/reports/case/${selected}?format=html&ai=${withAi}" target="_blank" rel="noopener">${icon('eye', 14)} Printable version</a>
        <button class="btn btn-sm" id="dl-md">${icon('download', 14)} Markdown</button></div>
      <div class="card-body markdown">${renderMarkdown(md)}</div></div>`;
    out.querySelector('#dl-md').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
      a.download = `report_case_${selected}.md`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  } catch (e) { out.innerHTML = ''; errorToast(e); }
}

// ---------------------------------------------------------------- rules
async function renderRules(box, { can, navigate, isCurrent }) {
  const rules = await get('/api/ai/rules');
  if (!isCurrent()) return;
  const editable = can('ai.rules_edit');
  box.innerHTML = `
    <div class="card"><div class="card-head"><h2>Detection rules (table detection_rules)</h2>
      <span class="muted small">${editable ? 'Changes are audited (a disabled rule is a HIGH-risk event).' : 'Read-only for your role.'}</span></div>
      <div class="card-body flush">${table(rules, [
        { label: 'Rule', render: (r) => `<strong>${esc(r.rule_code)}</strong><div class="small">${esc(r.rule_name)}</div><div class="muted small" style="max-width:420px">${esc(r.description)}</div>` },
        { label: 'Method', render: (r) => `<span class="badge method">${esc(r.detection_method)}</span>` },
        { label: 'Threshold', render: (r) => editable ? `<input type="number" step="any" min="0.01" style="width:84px" data-f="threshold" data-r="${esc(r.rule_code)}" value="${esc(r.threshold)}">` : esc(r.threshold) },
        { label: 'Window (min)', render: (r) => editable ? `<input type="number" min="1" style="width:84px" data-f="window_minutes" data-r="${esc(r.rule_code)}" value="${esc(r.window_minutes)}">` : esc(r.window_minutes) },
        { label: 'Base score', render: (r) => editable ? `<input type="number" min="0" max="100" style="width:70px" data-f="base_score" data-r="${esc(r.rule_code)}" value="${esc(r.base_score)}">` : esc(r.base_score) },
        { label: 'Enabled', render: (r) => editable ? `<input type="checkbox" data-f="is_enabled" data-r="${esc(r.rule_code)}" ${r.is_enabled ? 'checked' : ''}>` : (r.is_enabled ? 'yes' : 'no') },
        { label: 'Parameters', render: (r) => r.rule_code === 'OFF_HOURS_ACTIVITY' && editable
          ? `<div class="row nowrap" style="gap:4px">work <input type="number" min="0" max="23" style="width:58px" data-f="start_hour" data-r="${esc(r.rule_code)}" value="${esc(r.params.start_hour)}">-<input type="number" min="1" max="24" style="width:58px" data-f="end_hour" data-r="${esc(r.rule_code)}" value="${esc(r.params.end_hour)}"></div>`
          : `<code class="small">${esc(r.params ? JSON.stringify(r.params) : '')}</code>` },
        { label: '', render: (r) => editable ? `<button class="btn btn-sm" data-save="${esc(r.rule_code)}">Save</button>` : '' }])}</div></div>`;
  box.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async () => {
    const code = b.dataset.save;
    const body = {};
    box.querySelectorAll(`[data-r="${code}"]`).forEach((inp) => {
      body[inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
    });
    if (code !== 'OFF_HOURS_ACTIVITY') { delete body.start_hour; delete body.end_hour; }
    try { await patch(`/api/ai/rules/${encodeURIComponent(code)}`, body); toast(`Rule ${code} saved - run the analysis to apply it`, 'success'); navigate('#/ai/rules'); }
    catch (e) { errorToast(e); }
  }));
}
