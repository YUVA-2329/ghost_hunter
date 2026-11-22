// PAGE 3 - Evidence management: upload, SHA-256, verification and history.
import { api, get, post } from '../api.js';
import { icon } from '../icons.js';
import { badge, esc, errorToast, evCode, fmtBytes, fmtDate, loading, modal, shortHash, table, toast } from '../ui.js';

export async function render(ctx) {
  if (ctx.params[0]) return renderDetail(ctx, Number(ctx.params[0]));
  return renderList(ctx);
}

function hashCompare(expected, actual, result) {
  const ok = result === 'VERIFIED';
  return `<div class="hash-compare">
    <div class="h"><div class="muted small">Original SHA-256 (stored at registration, immutable)</div><div class="hash">${esc(expected)}</div></div>
    <div class="h ${ok ? 'good' : 'bad'}"><div class="muted small">SHA-256 computed now from the stored file</div>
      <div class="hash">${actual ? esc(actual) : '<strong>FILE MISSING</strong>'}</div></div></div>`;
}

export function showVerifyResult(r) {
  const ok = r.result === 'VERIFIED';
  modal({
    title: `${evCode(r.evidence_id)} - ${ok ? 'integrity verified' : r.result}`,
    body: `<p>${ok ? 'The file is byte-for-byte identical to the file that was registered.'
      : r.result === 'MISSING' ? '<strong>The stored file could not be found.</strong>'
      : '<strong>The file has changed since registration.</strong> The original hash was NOT overwritten; a new integrity check row was appended and an alert raised.'}</p>
      ${hashCompare(r.expected_hash, r.actual_hash, r.result)}
      ${r.alert_id ? `<div class="warn">AI alert #${esc(r.alert_id)} created/updated (rule INTEGRITY_FAILURE). <a href="#/ai/alerts">View alerts</a></div>` : ''}`,
    actions: [{ label: 'Close', cls: 'btn-primary' }],
  });
}

async function verify(id, after) {
  try {
    const r = await post(`/api/evidence/${id}/verify`);
    showVerifyResult(r);
    toast(`${evCode(id)}: ${r.result}`, r.result === 'VERIFIED' ? 'success' : 'error');
    if (after) after();
  } catch (e) { errorToast(e); }
}

async function download(id, name) {
  try {
    const res = await api(`/api/evidence/${id}/download`, { raw: true });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name || evCode(id);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Download recorded in the audit log (EVIDENCE_DOWNLOAD)');
  } catch (e) { errorToast(e); }
}

async function renderList({ el, can, navigate, query, isCurrent }) {
  const caseFilter = query.get('case') || '';
  const [rows, cases] = await Promise.all([
    get(`/api/evidence${caseFilter ? `?case_id=${encodeURIComponent(caseFilter)}` : ''}`), get('/api/cases')]);
  if (!isCurrent()) return;
  const openCases = cases.filter((c) => c.case_status !== 'CLOSED');
  el.innerHTML = `
    <p class="page-intro">Register digital evidence and verify its integrity. The backend validates the file type by content,
      stores it under a random name, computes its <strong>SHA-256</strong> while saving, and calls <code>sp_register_evidence</code>
      (evidence row + first custody entry + baseline integrity check in one transaction).</p>
    <div class="grid grid-main">
      <div class="card"><div class="card-head"><h2>Evidence records</h2>
          <select id="case-filter" aria-label="Filter by case"><option value="">All cases</option>
            ${cases.map((c) => `<option value="${c.case_id}" ${String(c.case_id) === caseFilter ? 'selected' : ''}>${esc(c.case_code)}</option>`).join('')}</select>
          ${can('evidence.verify') ? `<button class="btn btn-sm" id="verify-all">${icon('fingerprint', 14)} Verify all</button>` : ''}</div>
        <div class="card-body flush">${table(rows, [
          { label: 'Code', render: (r) => `<a href="#/evidence/${r.evidence_id}"><strong>${esc(r.evidence_code)}</strong></a>` },
          { label: 'Name', render: (r) => `${esc(r.evidence_name)}<div class="muted small">${esc(r.case_code)} &middot; ${esc(r.evidence_type)} &middot; ${fmtBytes(r.file_size_bytes)}</div>` },
          { label: 'Integrity', render: (r) => badge(r.integrity_status) + (r.failed_checks ? `<div class="muted small">${r.failed_checks} failed check(s)</div>` : '') },
          { label: 'Original SHA-256', render: (r) => shortHash(r.original_hash, 12) },
          { label: 'Custodian', render: (r) => esc(r.custodian_name) },
          { label: 'Last verified', render: (r) => `<span class="small nowrap">${fmtDate(r.last_verified_at)}</span>` },
          { label: '', render: (r) => `<div class="row nowrap" style="gap:4px">
              ${can('evidence.verify') ? `<button class="btn btn-sm" data-verify="${r.evidence_id}" title="Verify SHA-256">${icon('fingerprint', 14)} Verify</button>` : ''}
              <button class="btn btn-sm btn-ghost" data-dl="${r.evidence_id}" data-name="${esc(r.evidence_name)}" title="Download">${icon('download', 14)}</button></div>` }],
          { empty: 'No evidence registered.' })}</div></div>

      <div class="card"><div class="card-head"><h2>Register evidence</h2></div><div class="card-body">
        ${can('evidence.register') ? `<form class="form" id="upload-form">
          <label>Case <select name="case_id" required><option value="">Select case...</option>
            ${openCases.map((c) => `<option value="${c.case_id}" ${String(c.case_id) === caseFilter ? 'selected' : ''}>${esc(c.case_code)} - ${esc(c.case_title)}</option>`).join('')}</select></label>
          <label>Description <textarea name="description" maxlength="500" placeholder="Where and how was this evidence acquired?"></textarea></label>
          <div class="dropzone" id="dropzone" tabindex="0">${icon('upload', 22)}<div><strong>Choose a file</strong> or drag it here</div>
            <div class="small">PDF, PNG, JPG, TXT, CSV, JSON, LOG</div><div id="file-name" class="small" style="margin-top:6px;color:var(--text)"></div>
            <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json,.log"></div>
          <button class="btn btn-primary" id="upload-btn">${icon('shield', 16)} Register &amp; hash</button>
          <div id="upload-result"></div></form>`
          : '<div class="muted">Your role cannot register evidence (auditors are read-only).</div>'}
      </div></div>
    </div>`;

  el.querySelector('#case-filter').addEventListener('change', (e) =>
    navigate(e.target.value ? `#/evidence?case=${e.target.value}` : '#/evidence'));
  el.querySelectorAll('[data-verify]').forEach((b) => b.addEventListener('click', () => verify(b.dataset.verify, () => setTimeout(() => navigate(location.hash), 50))));
  el.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => download(b.dataset.dl, b.dataset.name)));
  const va = el.querySelector('#verify-all');
  if (va) va.addEventListener('click', async () => {
    va.disabled = true;
    try {
      const r = await post('/api/evidence/verify-all');
      const s = r.summary;
      toast(`${r.checked} verified: ${s.VERIFIED} OK, ${s.TAMPERED} tampered, ${s.MISSING} missing`, s.TAMPERED || s.MISSING ? 'error' : 'success', 7000);
      navigate(location.hash);
    } catch (e) { errorToast(e); } finally { va.disabled = false; }
  });

  const form = el.querySelector('#upload-form');
  if (!form) return;
  const dz = form.querySelector('#dropzone');
  const input = dz.querySelector('input');
  const showName = () => { form.querySelector('#file-name').textContent = input.files[0] ? `${input.files[0].name} (${fmtBytes(input.files[0].size)})` : ''; };
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', showName);
  ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; showName(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = form.querySelector('#upload-result');
    if (!form.case_id.value) return errorToast(new Error('Select a case'));
    if (!input.files[0]) return errorToast(new Error('Choose a file'));
    const fd = new FormData();
    fd.append('case_id', form.case_id.value);
    if (form.description.value.trim()) fd.append('description', form.description.value.trim());
    fd.append('file', input.files[0]);
    const btn = form.querySelector('#upload-btn'); btn.disabled = true;
    out.innerHTML = loading('Uploading and hashing...');
    try {
      const r = await api('/api/evidence', { method: 'POST', form: fd });
      out.innerHTML = `<div class="notice"><strong>${evCode(r.evidence_id)} registered</strong> - status ${badge(r.integrity_status)}<br>
        <span class="small">SHA-256:</span><div class="hash">${esc(r.sha256)}</div>
        <span class="small">${esc(r.evidence_type)}, ${fmtBytes(r.size)}. <a href="#/evidence/${r.evidence_id}">Open record</a></span></div>`;
      toast('Evidence registered - SHA-256 stored in MySQL', 'success');
      form.reset(); showName();
      const listBody = el.querySelector('.card .card-body.flush');
      const fresh = await get(`/api/evidence${caseFilter ? `?case_id=${encodeURIComponent(caseFilter)}` : ''}`);
      if (isCurrent() && listBody) listBody.insertAdjacentHTML('afterbegin',
        `<div class="notice row" style="margin:10px">${fresh.length} evidence record(s) now. <button type="button" class="btn btn-sm" data-refresh>Refresh list</button></div>`);
      const rb = el.querySelector('[data-refresh]');
      if (rb) rb.addEventListener('click', () => navigate(location.hash));
    } catch (err) { out.innerHTML = ''; errorToast(err); } finally { btn.disabled = false; }
  });
}

async function renderDetail({ el, can, navigate, isCurrent }, id) {
  const e = await get(`/api/evidence/${id}`);
  if (!isCurrent()) return;
  const mismatch = e.current_hash && e.current_hash !== e.original_hash;
  el.innerHTML = `
    <div class="row" style="margin-bottom:12px"><a href="#/evidence" class="small">&larr; All evidence</a></div>
    <div class="grid grid-main">
      <div class="card"><div class="card-head"><h2>${esc(e.evidence_code)} &middot; ${esc(e.evidence_name)}</h2>${badge(e.integrity_status)}</div>
        <div class="card-body">
          <dl class="kv">
            <dt>Case</dt><dd><a href="#/cases/${e.case_id}">${esc(e.case_code)}</a> - ${esc(e.case_title)}</dd>
            <dt>Type / size</dt><dd>${esc(e.evidence_type)}, ${fmtBytes(e.file_size_bytes)}</dd>
            <dt>Description</dt><dd>${esc(e.description || '-')}</dd>
            <dt>Registered</dt><dd>${fmtDate(e.uploaded_at, true)} by ${esc(e.uploaded_by_name)}</dd>
            <dt>Current custodian</dt><dd>${esc(e.custodian_name)} <a class="small" href="#/custody/${e.evidence_id}">(chain of custody)</a></dd>
            <dt>Last verified</dt><dd>${fmtDate(e.last_verified_at, true)}</dd>
          </dl>
          <div style="margin-top:14px">${hashCompare(e.original_hash, e.current_hash, mismatch ? 'TAMPERED' : e.integrity_status)}</div>
          <div class="row" style="margin-top:14px">
            ${can('evidence.verify') ? `<button class="btn btn-primary" id="verify">${icon('fingerprint', 16)} Verify integrity now</button>` : ''}
            <button class="btn" id="download">${icon('download', 16)} Download</button>
            <button class="btn" id="ask">${icon('ai', 16)} Who modified this record?</button>
          </div>
        </div></div>
      <div class="card"><div class="card-head"><h2>Chain of custody</h2></div><div class="card-body">
        <div class="timeline">${e.custody_history.map((t, i) => `
          <div class="tl-item ${i === 0 ? 'first' : ''} ${t.verification_status !== 'VERIFIED' ? 'bad' : ''}">
            <div class="tl-title">${esc(t.from_name)} &rarr; ${esc(t.to_name)}</div>
            <div class="tl-meta">${fmtDate(t.transfer_timestamp)} &middot; hash ${badge(t.verification_status)}</div>
            <div class="small">${esc(t.transfer_reason)}</div></div>`).join('')}</div></div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>Integrity verification history (${e.integrity_history.length})</h2>
      <span class="muted small">append-only &middot; table integrity_checks</span></div>
      <div class="card-body flush">${table(e.integrity_history, [
        { label: 'Time', render: (r) => `<span class="nowrap">${fmtDate(r.checked_at, true)}</span>` },
        { label: 'Result', render: (r) => badge(r.verification_result) },
        { label: 'Context', render: (r) => esc(r.check_context.replace('_', ' ')) },
        { label: 'Checked by', key: 'checked_by_name' },
        { label: 'Expected hash', render: (r) => shortHash(r.expected_hash) },
        { label: 'Computed hash', render: (r) => r.actual_hash ? `<span class="hash" style="${r.actual_hash !== r.expected_hash ? 'color:var(--critical)' : ''}">${esc(r.actual_hash.slice(0, 16))}&hellip;</span>` : '<span class="muted">file missing</span>' }])}</div></div>`;
  const vb = el.querySelector('#verify');
  if (vb) vb.addEventListener('click', () => verify(id, () => setTimeout(() => navigate(`#/evidence/${id}`), 50)));
  el.querySelector('#download').addEventListener('click', () => download(id, e.evidence_name));
  el.querySelector('#ask').addEventListener('click', () => {
    sessionStorage.setItem('gh-ask', `Who modified evidence ${id}?`);
    navigate('#/ai/assistant');
  });
}
