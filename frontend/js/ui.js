// UI helpers. All dynamic text goes through esc() before being placed in HTML.
import { icon } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtDate(v, withSeconds = false) {
  if (!v) return '<span class="muted">-</span>';
  const s = String(v).replace('T', ' ');
  return esc(withSeconds ? s.slice(0, 19) : s.slice(0, 16));
}

export function fmtBytes(n) {
  if (n === null || n === undefined) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export const badge = (v, extra = '') => v ? `<span class="badge ${esc(String(v).replace(/\s/g, '_'))} ${extra}">${esc(String(v).replace(/_/g, ' '))}</span>` : '';

export function riskColor(score) {
  if (score >= 85) return '#dc2626';
  if (score >= 60) return '#ea580c';
  if (score >= 35) return '#d97706';
  return '#16a34a';
}

export function scorebar(score) {
  const s = Number(score) || 0;
  return `<div class="scorebar"><div class="track"><div class="fill" style="width:${s}%;background:${riskColor(s)}"></div></div><span class="val">${s}</span></div>`;
}

export function shortHash(h, n = 16) {
  if (!h) return '<span class="muted">-</span>';
  return `<span class="hash" title="${esc(h)}">${esc(h.slice(0, n))}&hellip;</span>`;
}

export const evCode = (id) => `EV-${String(id).padStart(4, '0')}`;

export function toast(message, kind = 'info', ms = 4200) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = message;
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function errorToast(err) { toast(err && err.message ? err.message : String(err), 'error', 6000); }

export const loading = (text = 'Loading...') => `<div class="loading"><span class="spinner"></span> ${esc(text)}</div>`;

/** Render a table. columns: [{key, label, render?(row), cls?}] */
export function table(rows, columns, { empty = 'No records.', rowAttrs, compact = false } = {}) {
  if (!rows || !rows.length) return `<div class="empty">${esc(empty)}</div>`;
  const head = columns.map((c) => `<th class="${c.cls || ''}">${esc(c.label)}</th>`).join('');
  const body = rows.map((r, i) => {
    const attrs = rowAttrs ? rowAttrs(r, i) : '';
    return `<tr ${attrs}>` + columns.map((c) => `<td class="${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('') + '</tr>';
  }).join('');
  return `<div class="table-wrap"><table class="table ${compact ? 'compact' : ''}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** Generic table for {columns, rows} payloads (SQL demo, assistant). */
export function rawTable(columns, rows, empty = 'No rows.') {
  if (!rows || !rows.length) return `<div class="empty">${esc(empty)}</div>`;
  const val = (v) => (v === null || v === undefined) ? '<span class="muted">NULL</span>'
    : (typeof v === 'object' ? `<code>${esc(JSON.stringify(v))}</code>` : esc(v));
  return `<div class="table-wrap"><table class="table compact"><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`
    + rows.map((r) => `<tr>${r.map((v) => `<td>${val(v)}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
}

export function diffTable(oldV, newV) {
  const o = oldV || {}, n = newV || {};
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])];
  if (!keys.length) return '<div class="muted small">No row values recorded.</div>';
  const show = (v) => v === undefined ? '' : esc(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
  const rows = keys.map((k) => {
    const same = oldV && newV && JSON.stringify(o[k]) === JSON.stringify(n[k]);
    return `<tr class="${same ? 'same' : ''}"><td class="k">${esc(k)}</td><td class="old">${show(o[k])}</td><td class="new">${show(n[k])}</td></tr>`;
  }).join('');
  return `<table class="diff"><thead><tr><th>Field</th><th>Previous value (old_values)</th><th>New value (new_values)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function modal({ title, body, actions = [], wide = false }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="btn btn-ghost btn-sm" data-close aria-label="Close">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>
    ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-action="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
  </div></div>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelector('.modal-backdrop').addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-backdrop')) close(); });
  actions.forEach((a, i) => root.querySelector(`[data-action="${i}"]`).addEventListener('click', async (ev) => {
    if (!a.onClick) return close();
    const btn = ev.currentTarget; btn.disabled = true;
    try { const keep = await a.onClick(root.querySelector('.modal')); if (keep !== true) close(); }
    catch (err) { errorToast(err); }
    finally { btn.disabled = false; }
  }));
  const first = root.querySelector('input, select, textarea');
  if (first) first.focus();
  return { close, el: root.querySelector('.modal') };
}

export function confirmDialog(title, message, label = 'Confirm', cls = 'btn-primary') {
  return new Promise((resolve) => {
    const m = modal({ title, body: `<p>${esc(message)}</p>`, actions: [
      { label: 'Cancel', onClick: () => resolve(false) },
      { label, cls, onClick: () => resolve(true) }] });
    m.el.querySelector('[data-close]').addEventListener('click', () => resolve(false));
  });
}

export function formData(form) {
  const out = {};
  new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v.trim() : v; });
  return out;
}

/** very small SQL syntax highlighter (keywords, strings, comments) */
const KW = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|JOIN|INNER|LEFT|RIGHT|CROSS|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|WITH|RECURSIVE|UNION|ALL|EXISTS|BETWEEN|LIKE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|VIEW|INDEX|PROCEDURE|FUNCTION|TRIGGER|BEGIN|DECLARE|IF|RETURN|RETURNS|CALL|START|TRANSACTION|COMMIT|ROLLBACK|SAVEPOINT|OVER|PARTITION|DESC|ASC|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|CHECK|UNIQUE|DEFAULT|DROP|ALTER|ADD|INTERVAL|USE|DATABASE|AFTER|BEFORE|FOR|EACH|ROW|SIGNAL|SQLSTATE|DELIMITER|GRANT|REVOKE|TO|USER|IDENTIFIED|COLUMNS|PATH|JSON_TABLE)\b/gi;
export function highlightSql(sql) {
  let out = '';
  const re = /(--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.|'')*')|([^'\-#/]+|[\-#/])/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    if (m[1]) out += `<span class="cm">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="str">${esc(m[2])}</span>`;
    else out += esc(m[3]).replace(KW, (k) => `<span class="kw">${k}</span>`);
  }
  return out;
}

export function renderMarkdown(md) {
  if (!window.marked || !window.DOMPurify) return `<pre>${esc(md)}</pre>`;
  const html = window.marked.parse(md, { gfm: true });
  return window.DOMPurify.sanitize(html);
}
