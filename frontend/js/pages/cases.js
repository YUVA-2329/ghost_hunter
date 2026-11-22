// PAGE 2 - Investigations: create, view, update status, assign investigators.
import { del, get, patch, post } from '../api.js';
import { icon } from '../icons.js';
import { badge, confirmDialog, esc, errorToast, fmtDate, formData, modal, scorebar, table, toast } from '../ui.js';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export async function render(ctx) {
  if (ctx.params[0] === 'team') return renderTeam(ctx);
  if (ctx.params[0]) return renderDetail(ctx, Number(ctx.params[0]));
  return renderList(ctx);
}

async function renderList({ el, can, navigate, isCurrent }) {
  const filter = sessionStorage.getItem('gh-case-filter') || '';
  const rows = await get(`/api/cases${filter ? `?status=${encodeURIComponent(filter)}` : ''}`);
  if (!isCurrent()) return;
  el.innerHTML = `
    <p class="page-intro">Investigations (cases) with their team, evidence and risk. Creating a case calls the stored procedure
      <code>sp_create_case</code>, which inserts the case and the creator's LEAD assignment in one transaction.</p>
    <div class="row-between" style="margin-bottom:14px">
      <div class="row">
        <select id="status-filter" aria-label="Filter by status"><option value="">All statuses</option>
          ${STATUSES.map((s) => `<option ${s === filter ? 'selected' : ''} value="${s}">${s.replace('_', ' ')}</option>`).join('')}</select>
        ${can('investigators.manage') ? `<a class="btn" href="#/cases/team">${icon('users', 16)} Manage investigators</a>` : ''}
      </div>
      ${can('case.create') ? `<button class="btn btn-primary" id="new-case">${icon('plus', 16)} New case</button>` : ''}
    </div>
    <div class="card"><div class="card-body flush">${table(rows, [
      { label: 'Case', render: (r) => `<strong>${esc(r.case_code)}</strong>` },
      { label: 'Title', render: (r) => `${esc(r.case_title)}<div class="muted small">created by ${esc(r.created_by_name)}, ${fmtDate(r.created_at)}</div>` },
      { label: 'Status', render: (r) => badge(r.case_status) },
      { label: 'Priority', render: (r) => badge(r.priority, 'outline') },
      { label: 'Evidence', render: (r) => `${r.evidence_count} <span class="muted small">(${r.verified_count} ok${r.compromised_count ? `, <span style="color:var(--critical)">${r.compromised_count} compromised</span>` : ''})</span>` },
      { label: 'Team', key: 'active_members', cls: 'num' },
      { label: 'Open alerts', key: 'open_alerts', cls: 'num' },
      { label: 'Risk', render: (r) => scorebar(r.risk_score) }],
      { empty: 'No cases visible to you.', rowAttrs: (r) => `class="clickable" data-id="${r.case_id}"` })}</div></div>`;
  el.querySelector('#status-filter').addEventListener('change', (e) => {
    sessionStorage.setItem('gh-case-filter', e.target.value); navigate('#/cases');
  });
  el.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => navigate(`#/cases/${tr.dataset.id}`)));
  const nb = el.querySelector('#new-case');
  if (nb) nb.addEventListener('click', () => modal({
    title: 'New investigation case',
    body: `<form class="form" id="case-form">
      <label>Title <input name="case_title" required minlength="5" maxlength="200"></label>
      <label>Description <textarea name="case_description" maxlength="5000"></textarea></label>
      <label>Priority <select name="priority">${PRIORITIES.map((p) => `<option ${p === 'MEDIUM' ? 'selected' : ''}>${p}</option>`).join('')}</select></label></form>`,
    actions: [{ label: 'Cancel' }, { label: 'Create case', cls: 'btn-primary', onClick: async (m) => {
      const d = formData(m.querySelector('#case-form'));
      const c = await post('/api/cases', { case_title: d.case_title, case_description: d.case_description || null, priority: d.priority });
      toast(`${c.case_code} created`, 'success');
      navigate(`#/cases/${c.case_id}`);
    } }],
  }));
}

async function renderDetail({ el, can, navigate, user, isCurrent }, id) {
  const [c, investigators] = await Promise.all([get(`/api/cases/${id}`), get('/api/investigators')]);
  if (!isCurrent()) return;
  const active = c.team.filter((t) => t.assignment_status === 'ACTIVE');
  const assignable = investigators.filter((i) => i.is_active && i.role !== 'AUDITOR' && !active.some((t) => t.investigator_id === i.investigator_id));
  el.innerHTML = `
    <div class="row" style="margin-bottom:12px"><a href="#/cases" class="small">&larr; All cases</a></div>
    <div class="card"><div class="card-body">
      <div class="row-between"><div><div class="muted small">${esc(c.case_code)}</div><h2 style="font-size:20px">${esc(c.case_title)}</h2></div>
        <div class="row">${badge(c.case_status)} ${badge(c.priority, 'outline')}<div style="width:150px">${scorebar(c.risk_score)}</div></div></div>
      <p class="muted" style="margin:10px 0 0">${esc(c.case_description || 'No description.')}</p>
      <div class="row" style="margin-top:14px">
        ${can('case.update') ? `<label class="row small" style="gap:6px">Status
            <select id="status-sel">${STATUSES.map((s) => `<option ${s === c.case_status ? 'selected' : ''} value="${s}">${s.replace('_', ' ')}</option>`).join('')}</select></label>
          <button class="btn btn-sm" id="edit-case">${icon('edit', 14)} Edit</button>` : ''}
        <a class="btn btn-sm" href="#/evidence?case=${c.case_id}">${icon('upload', 14)} Evidence</a>
        <button class="btn btn-sm" id="ask-ai">${icon('ai', 14)} Summarize with AI assistant</button>
        <a class="btn btn-sm" href="#/ai/reports/${c.case_id}">${icon('report', 14)} Investigation report</a>
        <a class="btn btn-sm" href="#/audit?case=${c.case_id}">${icon('audit', 14)} Audit trail</a>
        ${can('case.delete') && !c.evidence_count && !c.alerts.length ? `<button class="btn btn-sm btn-danger" id="delete-case">${icon('trash', 14)} Delete empty case</button>` : ''}
      </div>
    </div></div>

    <div class="grid grid-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>Team</h2></div>
        <div class="card-body flush">${table(c.team, [
          { label: 'Investigator', render: (t) => `${esc(t.investigator_name)}<div class="muted small">${esc(t.role.replace(/_/g, ' '))}</div>` },
          { label: 'Case role', render: (t) => badge(t.assignment_role, 'outline') },
          { label: 'Status', render: (t) => badge(t.assignment_status) },
          { label: 'Assigned', render: (t) => `<span class="small">${fmtDate(t.assigned_at)}</span>` },
          { label: '', render: (t) => can('case.assign') && t.assignment_status === 'ACTIVE' && t.investigator_id !== user.investigator_id
            ? `<button class="btn btn-sm btn-ghost" data-remove="${t.investigator_id}" title="Remove from case">${icon('x', 14)}</button>` : '' }], { compact: true })}</div>
        ${can('case.assign') && c.case_status !== 'CLOSED' ? `<div class="card-foot"><form class="row" id="assign-form">
          <select name="investigator_id" required><option value="">Assign investigator...</option>
            ${assignable.map((i) => `<option value="${i.investigator_id}">${esc(i.investigator_name)} (${esc(i.role.replace(/_/g, ' '))})</option>`).join('')}</select>
          <select name="assignment_role"><option>MEMBER</option><option>REVIEWER</option><option>LEAD</option></select>
          <button class="btn btn-sm btn-primary">${icon('plus', 14)} Assign</button></form></div>` : ''}
      </div>
      <div class="card"><div class="card-head"><h2>Evidence (${c.evidence.length})</h2></div>
        <div class="card-body flush">${table(c.evidence, [
          { label: 'Code', render: (e) => `<a href="#/evidence/${e.evidence_id}">${esc(e.evidence_code)}</a>` },
          { label: 'Name', key: 'evidence_name' },
          { label: 'Integrity', render: (e) => badge(e.integrity_status) },
          { label: 'Custodian', key: 'custodian_name' }], { empty: 'No evidence registered yet.', compact: true })}</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>AI alerts for this case</h2><a class="small" href="#/ai/alerts">All alerts</a></div>
        <div class="card-body flush">${table(c.alerts, [
          { label: 'Severity', render: (a) => badge(a.severity) },
          { label: 'Finding', render: (a) => `${esc(a.title)}<div class="muted small">${esc(a.detection_method)} &middot; ${fmtDate(a.last_event_at)}</div>` },
          { label: 'Score', key: 'risk_score', cls: 'num' },
          { label: 'Status', render: (a) => badge(a.status) }], { empty: 'No alerts.', compact: true })}</div></div>
      <div class="card"><div class="card-head"><h2>Recent activity (audit trail)</h2></div>
        <div class="card-body flush">${table(c.recent_activity, [
          { label: 'Time', render: (r) => `<span class="nowrap small">${fmtDate(r.timestamp)}</span>` },
          { label: 'Operation', render: (r) => badge(r.action_type) },
          { label: 'Record', render: (r) => `<span class="small">${esc(r.table_name || '')} ${r.record_id ? '#' + esc(r.record_id) : ''}</span>` },
          { label: 'By', render: (r) => `<span class="small">${esc(r.investigator_name)}</span>` },
          { label: 'Risk', render: (r) => badge(r.risk_level) }], { compact: true })}</div></div>
    </div>`;

  const reload = () => navigate(`#/cases/${id}`);
  const sel = el.querySelector('#status-sel');
  if (sel) sel.addEventListener('change', async () => {
    try { await post(`/api/cases/${id}/status`, { case_status: sel.value }); toast('Status updated - recorded in the audit log', 'success'); reload(); }
    catch (e) { errorToast(e); sel.value = c.case_status; }
  });
  const af = el.querySelector('#assign-form');
  if (af) af.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(af);
    if (!d.investigator_id) return;
    try { await post(`/api/cases/${id}/assignments`, { investigator_id: Number(d.investigator_id), assignment_role: d.assignment_role }); toast('Investigator assigned', 'success'); reload(); }
    catch (err) { errorToast(err); }
  });
  el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    if (!await confirmDialog('Remove from case', 'The assignment is kept in history with status REMOVED.', 'Remove', 'btn-danger')) return;
    try { await del(`/api/cases/${id}/assignments/${b.dataset.remove}`); toast('Assignment removed', 'success'); reload(); }
    catch (err) { errorToast(err); }
  }));
  const eb = el.querySelector('#edit-case');
  if (eb) eb.addEventListener('click', () => modal({
    title: `Edit ${c.case_code}`,
    body: `<form class="form" id="edit-form">
      <label>Title <input name="case_title" value="${esc(c.case_title)}" required minlength="5" maxlength="200"></label>
      <label>Description <textarea name="case_description" maxlength="5000">${esc(c.case_description || '')}</textarea></label>
      <label>Priority <select name="priority">${PRIORITIES.map((p) => `<option ${p === c.priority ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <div class="notice">The UPDATE trigger will store the previous and new values of this case in <code>audit_logs</code>.</div></form>`,
    actions: [{ label: 'Cancel' }, { label: 'Save changes', cls: 'btn-primary', onClick: async (m) => {
      const d = formData(m.querySelector('#edit-form'));
      await patch(`/api/cases/${id}`, { case_title: d.case_title, case_description: d.case_description, priority: d.priority });
      toast('Case updated', 'success'); reload();
    } }],
  }));
  const dc = el.querySelector('#delete-case');
  if (dc) dc.addEventListener('click', async () => {
    if (!await confirmDialog('Delete case', `Delete ${c.case_code}? The DELETE trigger preserves the deleted row in the audit log.`, 'Delete', 'btn-danger')) return;
    try { await del(`/api/cases/${id}`); toast('Case deleted (captured by the audit trigger)', 'success'); navigate('#/cases'); }
    catch (err) { errorToast(err); }
  });
  el.querySelector('#ask-ai').addEventListener('click', () => {
    sessionStorage.setItem('gh-ask', `Summarize the suspicious activities in ${c.case_code}`);
    navigate('#/ai/assistant');
  });
}

async function renderTeam({ el, can, user, navigate, isCurrent }) {
  if (!can('investigators.manage')) { el.innerHTML = '<div class="empty">Only administrators can manage investigators.</div>'; return; }
  const rows = await get('/api/investigators');
  if (!isCurrent()) return;
  const roles = ['ADMIN', 'LEAD_INVESTIGATOR', 'INVESTIGATOR', 'AUDITOR'];
  el.innerHTML = `
    <div class="row" style="margin-bottom:12px"><a href="#/cases" class="small">&larr; All cases</a></div>
    <div class="grid grid-main">
      <div class="card"><div class="card-head"><h2>Investigators</h2></div><div class="card-body flush">${table(rows, [
        { label: 'Name', render: (r) => `${esc(r.investigator_name)}<div class="muted small">${esc(r.email)}</div>` },
        { label: 'Role', render: (r) => r.investigator_id === user.investigator_id ? badge(r.role, 'outline')
          : `<select data-role="${r.investigator_id}">${roles.map((x) => `<option ${x === r.role ? 'selected' : ''}>${x}</option>`).join('')}</select>` },
        { label: 'Status', render: (r) => badge(r.is_active ? 'ACTIVE' : 'REMOVED') },
        { label: '', render: (r) => r.investigator_id === user.investigator_id ? '' :
          `<button class="btn btn-sm" data-toggle="${r.investigator_id}" data-active="${r.is_active}">${r.is_active ? 'Deactivate' : 'Activate'}</button>` }])}</div></div>
      <div class="card"><div class="card-head"><h2>Add investigator</h2></div><div class="card-body">
        <form class="form" id="inv-form">
          <label>Full name <input name="investigator_name" required minlength="2" maxlength="100"></label>
          <label>E-mail <input name="email" type="email" required></label>
          <label>Role <select name="role">${roles.map((x) => `<option ${x === 'INVESTIGATOR' ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label>Initial password <input name="password" type="password" required minlength="10" autocomplete="new-password"></label>
          <div class="muted small">At least 10 characters with upper and lower case, a digit and a symbol. Stored as a bcrypt hash.</div>
          <button class="btn btn-primary">${icon('plus', 16)} Create account</button>
        </form></div></div>
    </div>`;
  el.querySelectorAll('[data-role]').forEach((s) => s.addEventListener('change', async () => {
    try { await patch(`/api/investigators/${s.dataset.role}`, { role: s.value }); toast('Role changed - recorded as a HIGH-risk audit event', 'success'); }
    catch (e) { errorToast(e); navigate('#/cases/team'); }
  }));
  el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
    try { await patch(`/api/investigators/${b.dataset.toggle}`, { is_active: b.dataset.active !== '1' }); navigate('#/cases/team'); }
    catch (e) { errorToast(e); }
  }));
  el.querySelector('#inv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(e.target);
    try { await post('/api/investigators', d); toast('Investigator created', 'success'); navigate('#/cases/team'); }
    catch (err) { errorToast(err); }
  });
}
