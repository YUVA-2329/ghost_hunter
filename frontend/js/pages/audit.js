// PAGE 5 - Database audit logs written by MySQL triggers / procedures.
import { get } from '../api.js';
import { icon } from '../icons.js';
import { badge, diffTable, esc, fmtDate, formData } from '../ui.js';

const FILTER_KEYS = ['date_from', 'date_to', 'investigator', 'action', 'risk', 'table', 'source', 'case'];

export async function render({ el, query, navigate, isCurrent }) {
  const opts = await get('/api/audit/options');
  if (!isCurrent()) return;
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, query.get(k) || '']));
  const page = Number(query.get('page') || 1);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k === 'case' ? 'case_id' : k, v);
  qs.set('page', page); qs.set('page_size', 40);
  const data = await get(`/api/audit?${qs}`);
  if (!isCurrent()) return;
  const sel = (name, values, labelAll, labeler = (v) => v) => `<select name="${name}"><option value="">${labelAll}</option>
    ${values.map((v) => `<option value="${esc(v)}" ${String(v) === f[name] ? 'selected' : ''}>${esc(labeler(v))}</option>`).join('')}</select>`;
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));

  el.innerHTML = `
    <p class="page-intro">Genuine database events. Rows with source <strong>TRIGGER</strong> were written by MySQL triggers on
      INSERT/UPDATE/DELETE (old and new row values stored as JSON); <strong>APPLICATION</strong> rows (logins, downloads,
      reports) were written by <code>sp_log_app_event</code>. The table is append-only - UPDATE and DELETE are blocked.</p>
    <div class="card" style="margin-bottom:16px"><div class="card-body">
      <form id="filters" class="filters">
        <label>From <input type="date" name="date_from" value="${esc(f.date_from)}"></label>
        <label>To <input type="date" name="date_to" value="${esc(f.date_to)}"></label>
        <label>Investigator <select name="investigator"><option value="">Anyone</option>
          <option value="none" ${f.investigator === 'none' ? 'selected' : ''}>UNIDENTIFIED (outside app)</option>
          ${opts.investigators.map((i) => `<option value="${i.investigator_id}" ${String(i.investigator_id) === f.investigator ? 'selected' : ''}>${esc(i.investigator_name)}</option>`).join('')}</select></label>
        <label>Operation ${sel('action', opts.actions, 'All operations', (v) => v.replace(/_/g, ' '))}</label>
        <label>Risk level <select name="risk"><option value="">All levels</option>
          ${['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'HIGH,CRITICAL'].map((v) => `<option value="${v}" ${v === f.risk ? 'selected' : ''}>${v === 'HIGH,CRITICAL' ? 'HIGH + CRITICAL' : v}</option>`).join('')}</select></label>
        <label>Table ${sel('table', opts.tables, 'All tables')}</label>
        <label>Source ${sel('source', ['TRIGGER', 'APPLICATION'], 'Any source')}</label>
        <input type="hidden" name="case" value="${esc(f.case)}">
        <div class="row" style="flex-wrap:nowrap"><button class="btn btn-primary">${icon('filter', 15)} Apply</button><button type="button" class="btn" id="reset">Reset</button></div>
      </form>
      ${f.case ? `<div class="muted small" style="margin-top:8px">Filtered to case id ${esc(f.case)}.</div>` : ''}
    </div></div>
    <div class="card"><div class="card-head"><h2>${data.total} event(s)</h2><span class="muted small">click a row to see old vs new values</span></div>
      <div class="card-body flush"><div class="table-wrap"><table class="table">
        <thead><tr><th>Time</th><th>Operation</th><th>Source</th><th>Investigator</th><th>Table</th><th class="num">Record</th><th>Case</th><th>Changes</th><th>Risk</th></tr></thead>
        <tbody>${data.rows.length ? data.rows.map((r) => `
          <tr class="clickable" data-log="${r.log_id}">
            <td class="nowrap">${fmtDate(r.timestamp, true)}</td>
            <td>${badge(r.action_type)}</td>
            <td><span class="small muted">${esc(r.event_source)}</span></td>
            <td>${r.investigator_id ? esc(r.investigator_name) : `<span style="color:var(--critical)">${icon('alert', 13)} ${esc(r.investigator_name)}</span>`}</td>
            <td>${esc(r.table_name || '-')}</td>
            <td class="num">${esc(r.record_id ?? '-')}</td>
            <td class="nowrap">${esc(r.case_code || '')}</td>
            <td class="small">${changeSummary(r)}</td>
            <td>${badge(r.risk_level)}</td></tr>
          <tr class="expand-row" data-for="${r.log_id}" hidden><td colspan="9">
            <div class="row small muted" style="margin-bottom:8px;gap:16px">
              <span>Log #${r.log_id}</span><span>IP: ${esc(r.ip_address || 'n/a')}</span><span>MySQL account: ${esc(r.db_user || 'n/a')}</span>
              ${r.details ? `<span>${esc(r.details)}</span>` : ''}</div>
            ${['INSERT', 'UPDATE', 'DELETE'].includes(r.action_type) ? diffTable(r.old_values, r.new_values) : '<div class="small muted">Application event - no row values.</div>'}
          </td></tr>`).join('') : '<tr><td colspan="9"><div class="empty">No events match these filters.</div></td></tr>'}</tbody></table></div></div>
      <div class="card-foot row-between"><span class="muted small">Page ${page} of ${pages}</span>
        <div class="row"><button class="btn btn-sm" id="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn-sm" id="next" ${page >= pages ? 'disabled' : ''}>Next</button></div></div></div>`;

  const go = (p) => {
    const q = new URLSearchParams();
    const d = formData(el.querySelector('#filters'));
    for (const k of FILTER_KEYS) if (d[k]) q.set(k, d[k]);
    if (p > 1) q.set('page', p);
    navigate(`#/audit${q.toString() ? '?' + q : ''}`);
  };
  el.querySelector('#filters').addEventListener('submit', (e) => { e.preventDefault(); go(1); });
  el.querySelector('#reset').addEventListener('click', () => navigate('#/audit'));
  el.querySelector('#prev').addEventListener('click', () => go(page - 1));
  el.querySelector('#next').addEventListener('click', () => go(page + 1));
  el.querySelectorAll('tr[data-log]').forEach((tr) => tr.addEventListener('click', () => {
    const x = el.querySelector(`tr[data-for="${tr.dataset.log}"]`); x.hidden = !x.hidden;
  }));
}

function changeSummary(r) {
  if (r.action_type === 'UPDATE') {
    const ch = (r.changes || []).filter((c) => c.field !== 'last_verified_at');
    return ch.slice(0, 3).map((c) => `<code>${esc(c.field)}</code>`).join(', ') + (ch.length > 3 ? ` +${ch.length - 3}` : '');
  }
  if (r.action_type === 'INSERT') return '<span class="muted">new row</span>';
  if (r.action_type === 'DELETE') return '<span style="color:var(--critical)">row deleted (preserved)</span>';
  return `<span class="muted">${esc((r.details || '').slice(0, 60))}</span>`;
}
