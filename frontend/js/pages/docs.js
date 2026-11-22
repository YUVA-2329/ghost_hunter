// PAGE 8 - Documentation: renders the project's Markdown files (and Mermaid diagrams).
import { get } from '../api.js';
import { esc, errorToast, loading, renderMarkdown } from '../ui.js';

const TITLES = {
  README: 'Overview & setup', ARCHITECTURE: 'Architecture & workflow', ER_DIAGRAM: 'ER diagram & normalization',
  SQL_EXPLANATION: 'SQL concepts', AI_EXPLANATION: 'AI architecture', SECURITY: 'Security features',
  DEMONSTRATION: 'Demonstration guide', VIVA_QUESTIONS: 'Viva questions', TEST_RESULTS: 'Test results',
  TRACEABILITY: 'Requirement traceability',
};

let mermaidPromise = null;
function loadMermaid() {
  if (window.mermaid) return Promise.resolve(window.mermaid);
  if (!mermaidPromise) {
    mermaidPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/vendor/mermaid.min.js';
      s.onload = () => { window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' }); resolve(window.mermaid); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return mermaidPromise;
}

export async function render({ el, params, navigate, isCurrent }) {
  const list = await get('/api/docs');
  if (!isCurrent()) return;
  const name = params[0] && TITLES[params[0]] ? params[0] : 'README';
  el.innerHTML = `
    <div style="margin-bottom:16px;padding:14px 20px;border-radius:12px;background:linear-gradient(135deg,rgba(239,246,255,0.9),rgba(240,253,250,0.9));border:1px solid #bfdbfe;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <strong style="color:#1d4ed8;font-size:14px;">🎓 Looking for the Interactive Explainer &amp; Viva Guide?</strong>
        <div class="muted small">Access 65+ viva questions, teacher presentation speech scripts, 3NF schema explorer, and interactive quizzes.</div>
      </div>
      <a href="#/help" class="btn btn-sm btn-glass-help">Open Interactive Help &amp; Guide &rarr;</a>
    </div>
    <div class="grid" style="grid-template-columns:minmax(200px,240px) minmax(0,1fr)">
      <div class="card" style="align-self:start"><div class="list">${list.map((d) => `
        <a class="list-item" href="#/docs/${d.name}" style="text-decoration:none;color:inherit;${d.name === name ? 'background:var(--primary-50);color:var(--primary-600);font-weight:600' : ''}">
          ${esc(TITLES[d.name] || d.name)}</a>`).join('')}</div></div>
      <div class="card"><div class="card-body markdown" id="doc">${loading()}</div></div>
    </div>`;
  try {
    const md = await get(`/api/docs/${name}`);
    if (!isCurrent()) return;
    const box = el.querySelector('#doc');
    box.innerHTML = renderMarkdown(md);
    const blocks = box.querySelectorAll('pre code.language-mermaid');
    if (blocks.length) {
      const mermaid = await loadMermaid();
      let i = 0;
      for (const code of blocks) {
        const div = document.createElement('div');
        div.className = 'mermaid';
        try {
          const { svg } = await mermaid.render(`mmd-${Date.now()}-${i++}`, code.textContent);
          div.innerHTML = svg;
        } catch (e) { div.textContent = 'Diagram could not be rendered: ' + e.message; }
        code.parentElement.replaceWith(div);
      }
    }
    box.querySelectorAll('a[href^="docs/"], a[href$=".md"]').forEach((a) => {
      const m = a.getAttribute('href').match(/([A-Z_]+)\.md$/);
      if (m && TITLES[m[1]]) a.setAttribute('href', `#/docs/${m[1]}`);
      else if (/README\.md$/.test(a.getAttribute('href'))) a.setAttribute('href', '#/docs/README');
    });
  } catch (e) { errorToast(e); }
}
