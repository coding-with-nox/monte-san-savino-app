import { getToken } from "./auth";
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: any = { "Content-Type": "application/json", ...(options.headers ?? {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return await res.json();
  return (await res.text()) as any;
}
