// PAGE 7 - SQL demonstration: tables, concepts, catalogue of read-only queries.
import { get, post } from '../api.js';
import { icon } from '../icons.js';
import { esc, errorToast, highlightSql, loading, rawTable, table } from '../ui.js';

let cache = null;

export async function render({ el, isCurrent }) {
  if (!cache) cache = await get('/api/sql/catalog');
  const tables = await get('/api/sql/tables');
  if (!isCurrent()) return;
  const groups = {};
  cache.queries.forEach((q) => { (groups[q.file] = groups[q.file] || []).push(q); });
  el.innerHTML = `
    <p class="page-intro">Academic view of the MySQL implementation. Queries below come from a fixed server-side catalogue and run
      inside <code>START TRANSACTION READ ONLY</code> - there is deliberately no box for typing arbitrary SQL.
      The complete scripts (with 80+ commented queries and their captured output) are in the <code>sql/</code> folder.</p>
    <div class="tabs" id="sql-tabs">
      <button class="tab active" data-t="queries">${icon('play', 15)} Example queries (${cache.queries.length})</button>
      <button class="tab" data-t="tables">${icon('sql', 15)} Database tables (${tables.filter((t) => t.type === 'TABLE').length} + ${tables.filter((t) => t.type === 'VIEW').length} views)</button>
      <button class="tab" data-t="concepts">${icon('check', 15)} SQL concepts implemented</button>
      <button class="tab" data-t="scripts">${icon('file', 15)} SQL scripts</button>
    </div>
    <div data-p="queries"><div class="grid" style="grid-template-columns:minmax(240px,320px) minmax(0,1fr)">
      <div class="card"><div class="list" id="qlist">${Object.entries(groups).map(([file, qs]) => `
        <div class="nav-section" style="padding:12px 16px 4px">${esc(file)}</div>
        ${qs.map((q) => `<div class="list-item clickable" data-q="${esc(q.id)}" style="padding:8px 16px"><div class="grow">
          <div class="small" style="font-weight:600">${esc(q.concept)}</div><div class="muted small truncate">${esc(q.title)}</div></div></div>`).join('')}`).join('')}</div></div>
      <div id="qview"></div></div></div>
    <div data-p="tables" hidden><div class="card"><div class="card-body flush">${table(tables, [
        { label: 'Name', render: (t) => `<strong>${esc(t.table_name)}</strong>` },
        { label: 'Type', render: (t) => `<span class="badge ${t.type === 'VIEW' ? 'method' : 'outline'}">${t.type}</span>` },
        { label: 'Rows', render: (t) => t.rows === null ? '<span class="muted">-</span>' : esc(t.rows), cls: 'num' },
        { label: 'Columns', render: (t) => `<details><summary class="small">${t.columns.length} columns</summary>${table(t.columns, [
          { label: 'Column', render: (c) => `<code>${esc(c.column_name)}</code>` }, { label: 'Type', key: 'column_type' },
          { label: 'Null', key: 'is_nullable' }, { label: 'Key', key: 'column_key' }, { label: 'Default', render: (c) => esc(c.column_default ?? '') },
          { label: 'Extra', key: 'extra' }], { compact: true })}</details>` }])}</div></div></div>
    <div data-p="concepts" hidden><div class="card"><div class="card-body flush">${table(cache.concepts, [
        { label: 'Concept', render: (c) => `<strong>${esc(c.concept)}</strong>` }, { label: 'Implemented as', key: 'items' },
        { label: 'Script(s)', render: (c) => `<code>${esc(c.files)}</code>` }])}</div></div></div>
    <div data-p="scripts" hidden><div class="card"><div class="card-head"><h2>SQL script viewer</h2>
        <select id="script-sel">${cache.files.map((f) => `<option>${esc(f)}</option>`).join('')}</select></div>
      <div class="card-body"><pre class="code" id="script-view">${loading()}</pre></div></div></div>`;

  el.querySelectorAll('#sql-tabs .tab').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('#sql-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
    el.querySelectorAll('[data-p]').forEach((p) => { p.hidden = p.dataset.p !== b.dataset.t; });
    if (b.dataset.t === 'scripts') loadScript();
  }));
  const loadScript = async () => {
    const name = el.querySelector('#script-sel').value;
    try { const txt = await get(`/api/sql/scripts/${encodeURIComponent(name)}`); el.querySelector('#script-view').innerHTML = highlightSql(txt); }
    catch (e) { errorToast(e); }
  };
  el.querySelector('#script-sel').addEventListener('change', loadScript);

  const show = (id) => {
    const q = cache.queries.find((x) => x.id === id);
    el.querySelectorAll('[data-q]').forEach((n) => n.classList.toggle('selected', n.dataset.q === id));
    el.querySelectorAll('[data-q]').forEach((n) => { n.style.background = n.dataset.q === id ? 'var(--primary-50)' : ''; });
    el.querySelector('#qview').innerHTML = `<div class="card"><div class="card-head"><h2>${esc(q.title)}</h2><span class="badge method">${esc(q.concept)}</span></div>
      <div class="card-body"><p style="margin-top:0">${esc(q.explanation)}</p>
        <pre class="code">${highlightSql(q.sql)}</pre>
        <div class="row" style="margin-top:12px"><button class="btn btn-primary" id="run-q">${icon('play', 15)} Run on live database</button>
          <span class="muted small">Source: sql/${esc(q.file)}</span></div>
        <div id="q-result" style="margin-top:14px"></div></div></div>`;
    el.querySelector('#run-q').addEventListener('click', async () => {
      const out = el.querySelector('#q-result');
      out.innerHTML = loading('Running...');
      try {
        const r = await post(`/api/sql/run/${encodeURIComponent(id)}`);
        out.innerHTML = `<div class="muted small" style="margin-bottom:6px">${r.row_count} row(s) returned</div>${rawTable(r.columns, r.rows)}`;
      } catch (e) { out.innerHTML = ''; errorToast(e); }
    });
  };
  el.querySelectorAll('[data-q]').forEach((n) => n.addEventListener('click', () => show(n.dataset.q)));
  show(cache.queries[0].id);
}
