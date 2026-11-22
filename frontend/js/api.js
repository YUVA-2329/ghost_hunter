// Thin fetch wrapper. The session lives in an HttpOnly cookie that JavaScript
// cannot read; every state-changing request carries X-Requested-With (CSRF).

export class ApiError extends Error {
  constructor(status, message, body) { super(message); this.status = status; this.body = body; }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(path, { method = 'GET', body, form, raw = false } = {}) {
  const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'GhostHunter' } };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(path, opts); }
  catch (e) { throw new ApiError(0, 'Cannot reach the server. Is the backend running?'); }
  if (res.status === 401 && !path.startsWith('/api/auth/login')) { onUnauthorized(); }
  if (raw && res.ok) return res;
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.detail) ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail))
                                      : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: body ?? {} });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const del = (p) => api(p, { method: 'DELETE' });
