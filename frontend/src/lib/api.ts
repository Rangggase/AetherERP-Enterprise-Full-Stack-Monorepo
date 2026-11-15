const BASE = "/api/v1";
const KEY = "aether.tokens";

interface Tokens {
  access_token: string;
  refresh_token: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function load(): Tokens | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function saveTokens(t: Tokens | null): void {
  try {
    if (t) sessionStorage.setItem(KEY, JSON.stringify(t));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

export const hasSession = (): boolean => load() !== null;

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  const t = load();
  if (!t) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: t.refresh_token }),
  });
  if (!res.ok) {
    saveTokens(null);
    return false;
  }
  saveTokens((await res.json()) as Tokens);
  return true;
}

function message(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? ""}`).join("; ");
  }
  return fallback;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; params?: Record<string, unknown> } = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init.params ?? {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const url = `${BASE}${path}${qs.size ? `?${qs}` : ""}`;

  const attempt = () =>
    fetch(url, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(load() ? { Authorization: `Bearer ${load()!.access_token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  let res = await attempt();
  if (res.status === 401 && load()) {
    refreshing ??= refresh().finally(() => (refreshing = null));
    if (await refreshing) res = await attempt();
  }
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("aether:logout"));
    throw new ApiError(res.status, message(body, res.statusText));
  }
  return body as T;
}

export async function login(email: string, password: string): Promise<void> {
  const t = await api<Tokens>("/auth/login", { method: "POST", body: { email, password } });
  saveTokens(t);
}

export function logout(): void {
  const t = load();
  saveTokens(null);
  if (t) void fetch(`${BASE}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: t.refresh_token }) });
}
