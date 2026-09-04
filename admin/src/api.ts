// Cliente API — DEC-003: JWT en localStorage + Authorization: Bearer.
const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ACCESS_KEY = 'onetask_access';
const REFRESH_KEY = 'onetask_refresh';

export const getAccess = () => localStorage.getItem(ACCESS_KEY) ?? '';
export const isLoggedIn = () => !!getAccess();
export function logout() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccess(): Promise<boolean> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return false;
  const r = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!r.ok) return false;
  const data = (await r.json()) as { accessToken: string };
  localStorage.setItem(ACCESS_KEY, data.accessToken);
  return true;
}

export async function apiFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}), Authorization: `Bearer ${getAccess()}` },
  });
  if (r.status === 401 && !retried && (await refreshAccess())) {
    return apiFetch(path, init, true);
  }
  return r;
}

export async function login(username: string, password: string): Promise<void> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error('Login inválido');
  const data = (await r.json()) as { accessToken: string; refreshToken: string };
  localStorage.setItem(ACCESS_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
}

export const apiBase = BASE;
