import { getToken } from "./auth";

const rawApiBase = import.meta.env.VITE_API_BASE;
const trimmedBase = rawApiBase && rawApiBase.trim() !== "" ? rawApiBase.trim() : "http://localhost:3000";
const API_BASE = trimmedBase.endsWith("/") ? trimmedBase.slice(0, -1) : trimmedBase;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const body = options.body;
  if (body && typeof body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(API_BASE + path, { ...options, headers });
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
