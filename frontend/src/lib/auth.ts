export type Role = "user" | "staff" | "judge" | "manager" | "admin";

export function getToken(): string | null { return localStorage.getItem("token"); }
export function setToken(token: string) { localStorage.setItem("token", token); }
export function clearToken() { localStorage.removeItem("token"); }

export function decodeJwt(token: string): any {
  const parts = token.split(".");
  if (parts.length < 2) { try { return JSON.parse(atob(token)); } catch { return {}; } }
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, "=");
  return JSON.parse(atob(padded));
}
export function getRole(): Role | null {
  const t = getToken(); if (!t) return null;
  try { return (decodeJwt(t).role as Role) ?? null; } catch { return null; }
}
const order: Role[] = ["user","staff","judge","manager","admin"];
export function roleAtLeast(actual: Role, minimum: Role) { return order.indexOf(actual) >= order.indexOf(minimum); }
