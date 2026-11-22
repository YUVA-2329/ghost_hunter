// PAGE 4 - Chain of custody: current custodian, chronological history, transfers.
import { get, post } from '../api.js';
import { icon } from '../icons.js';
import { badge, esc, errorToast, fmtDate, formData, shortHash, table, toast } from '../ui.js';

export async function render({ el, params, can, navigate, isCurrent }) {
  const list = await get('/api/custody');
  if (!isCurrent()) return;
  const selected = params[0] ? Number(params[0]) : (list[0] && list[0].evidence_id);
  el.innerHTML = `
    <p class="page-intro">Who held each evidence item, when, and why. Transfers are executed by <code>sp_transfer_custody</code>,
      which checks authorisation, re-computes the file's SHA-256 at the moment of hand-over and appends a row to the
      append-only <code>custody_transfers</code> table (edits and deletes are blocked by triggers).</p>
    <div class="grid grid-main">
      <div class="card"><div class="card-head"><h2>Current custodians</h2></div><div class="card-body flush">${table(list, [
        { label: 'Evidence', render: (r) => `<strong>${esc(r.evidence_code)}</strong><div class="muted small">${esc(r.evidence_name)}</div>` },
        { label: 'Case', render: (r) => `<span class="nowrap">${esc(r.case_code || '')}</span>` },
        { label: 'Current custodian', render: (r) => `${icon('user', 14)} ${esc(r.custodian_name)}` },
        { label: 'Transfers', key: 'transfers', cls: 'num' },
        { label: 'Last transfer', render: (r) => `<span class="small nowrap">${fmtDate(r.last_transfer_at)}</span>` },
        { label: 'Integrity', render: (r) => badge(r.integrity_status) }],
        { rowAttrs: (r) => `class="clickable ${r.evidence_id === selected ? 'selected' : ''}" data-id="${r.evidence_id}"`, empty: 'No evidence visible to you.' })}</div></div>
      <div id="custody-detail"></div>
    </div>`;
  el.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => navigate(`#/custody/${tr.dataset.id}`)));
  if (selected) await renderDetail(el.querySelector('#custody-detail'), selected, { can, navigate, isCurrent });
}

async function renderDetail(box, id, { navigate, isCurrent }) {
  const h = await get(`/api/custody/${id}`);
  if (!isCurrent()) return;
  box.innerHTML = `
    <div class="card"><div class="card-head"><h2>${esc(h.evidence_code)} - custody history</h2>${badge(h.integrity_status)}</div>
      <div class="card-body">
        <div class="muted small">${esc(h.evidence_name)} &middot; <a href="#/cases/${h.case_id}">${esc(h.case_code)}</a></div>
        <div style="margin:10px 0 16px" class="notice">Current custodian: <strong>${esc(h.custodian_name)}</strong></div>
        <div class="timeline">${h.transfers.map((t, i) => `
          <div class="tl-item ${i === 0 ? 'first' : ''} ${t.verification_status !== 'VERIFIED' ? 'bad' : ''}">
            <div class="tl-title">${i === 0 ? 'Acquired by' : 'Transferred'} ${i === 0 ? esc(t.to_name) : `${esc(t.from_name)} &rarr; ${esc(t.to_name)}`}</div>
            <div class="tl-meta">${fmtDate(t.transfer_timestamp, true)} &middot; recorded by ${esc(t.performed_by_name)}</div>
            <div class="small">${esc(t.transfer_reason)}</div>
            <div class="small">Hash at hand-over: ${badge(t.verification_status)} ${shortHash(t.hash_at_transfer, 12)}</div>
          </div>`).join('')}</div>
      </div>
      ${h.can_transfer ? `<div class="card-foot"><form class="form" id="transfer-form">
        <div class="section-title">Transfer custody</div>
        <label>New custodian <select name="to" required><option value="">Select receiver...</option>
          ${h.eligible_receivers.map((r) => `<option value="${r.investigator_id}">${esc(r.investigator_name)} (${esc(r.role.replace(/_/g, ' '))})</option>`).join('')}</select></label>
        <label>Reason <input name="reason" required minlength="5" maxlength="300" placeholder="e.g. Hand-over for malware analysis"></label>
        <button class="btn btn-primary">${icon('arrow', 16)} Transfer evidence</button></form></div>`
        : `<div class="card-foot muted small">${icon('lock', 14)} Only the current custodian, a lead investigator or an admin can transfer this item.</div>`}
    </div>`;
  const f = box.querySelector('#transfer-form');
  if (f) f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(f);
    if (!d.to) return errorToast(new Error('Select the receiving investigator'));
    try {
      const t = await post('/api/custody/transfer', { evidence_id: id, to_investigator_id: Number(d.to), transfer_reason: d.reason });
      toast(`Transferred to ${t.to_name} - hash ${t.verification_status}`, t.verification_status === 'VERIFIED' ? 'success' : 'error');
      navigate(`#/custody/${id}`);
    } catch (err) { errorToast(err); }
  });
}
