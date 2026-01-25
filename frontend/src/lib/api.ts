import { clearToken, getRefreshToken, getToken, getTokenExpiresAt, setSession } from "./auth";

const rawApiBase = import.meta.env.VITE_API_BASE;
const trimmedBase = rawApiBase && rawApiBase.trim() !== "" ? rawApiBase.trim() : "http://localhost:3000";
export const API_BASE = trimmedBase.endsWith("/") ? trimmedBase.slice(0, -1) : trimmedBase;

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    try {
      const res = await fetch(API_BASE + "/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) {
        clearToken();
        return false;
      }
      const payload = await res.json();
      setSession(payload.accessToken, payload.refreshToken, payload.expiresIn ?? payload.expires_in ?? 0);
      return true;
    } catch {
      clearToken();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const expiresAt = getTokenExpiresAt();
  if (expiresAt && expiresAt - Date.now() <= REFRESH_THRESHOLD_MS) {
    await refreshSession();
  }

  const headers = new Headers(options.headers ?? {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const body = options.body;
  if (body && typeof body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryHeaders = new Headers(options.headers ?? {});
      const retryToken = getToken();
      if (retryToken) retryHeaders.set("Authorization", `Bearer ${retryToken}`);
      if (body && typeof body === "string" && !retryHeaders.has("Content-Type")) {
        retryHeaders.set("Content-Type", "application/json");
      }
      const retry = await fetch(API_BASE + path, { ...options, headers: retryHeaders });
      if (!retry.ok) {
        const ct = retry.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const payload = await retry.json().catch(() => null);
          const message = payload?.error ?? payload?.message;
          if (message) throw new Error(String(message));
        }
        const message = await retry.text();
        throw new Error(message || retry.statusText);
      }
      if (retry.status === 204) return undefined as T;
      const retryCt = retry.headers.get("content-type") ?? "";
      if (retryCt.includes("application/json")) return await retry.json();
      return (await retry.text()) as any;
    }
  }
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const payload = await res.json().catch(() => null);
      const message = payload?.error ?? payload?.message;
      if (message) throw new Error(String(message));
    }
    const message = await res.text();
    throw new Error(message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return await res.json();
  return (await res.text()) as any;
}
