/** Backend origin. Empty = same origin (Vite dev proxy, cookie session). Set VITE_API_URL=https://fork-it.onrender.com to call the hosted API directly. */
export const API_ORIGIN = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim().replace(/\/+$/, '');
export const apiUrl = (path: string) => `${API_ORIGIN}${path}`;

const TOKEN_KEY = 'pf-token';
/** Token mode is used only when the API is on another origin: browsers (Safari) block cross-site cookies, so the session travels as a bearer token. Same-origin keeps the HttpOnly cookie. */
export const tokenMode = API_ORIGIN !== '';
export const getToken = () => { try { return tokenMode ? localStorage.getItem(TOKEN_KEY) : null; } catch { return null; } };
export const setToken = (t: string | null) => { try { if (!tokenMode) return; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } };
export const authHeaders = (): Record<string, string> => { if (!tokenMode) return {}; const t = getToken(); return { 'X-Token-Auth': '1', ...(t && { Authorization: `Bearer ${t}` }) }; };

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string[]>) { super(message); }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(`/api/v1${path}`), {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'projectforge', ...authHeaders(), ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') setToken(null); // expired/revoked session
    throw new ApiError(res.status, data?.error?.message ?? 'Request failed', data?.error?.details);
  }
  if (typeof data?.token === 'string') setToken(data.token); // login / register / change-password
  if (path === '/auth/logout') setToken(null);
  return data as T;
}
/** Multipart upload (browser sets the boundary header itself). */
async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(apiUrl(`/api/v1${path}`), { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'projectforge', ...authHeaders() }, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Upload failed', data?.error?.details);
  return data as T;
}
export const api = {
  upload,
  get: <T,>(p: string) => request<T>(p),
  post: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T,>(p: string) => request<T>(p, { method: 'DELETE' }),
  patch: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
};

/** Saves a protected file. Cookie mode: browser navigation. Token mode: fetch with the bearer header, then save the blob. */
export async function downloadFile(url: string) {
  if (!tokenMode) { window.location.assign(url); return; }
  const res = await fetch(apiUrl(url), { credentials: 'include', headers: authHeaders() });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(res.status, d?.error?.message ?? 'Download failed'); }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'download';
  const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
