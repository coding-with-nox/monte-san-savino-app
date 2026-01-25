export type Role = "user" | "staff" | "judge" | "manager" | "admin";

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const EXPIRES_AT_KEY = "tokenExpiresAt";

export function getToken(): string | null { return localStorage.getItem(ACCESS_TOKEN_KEY); }
export function getRefreshToken(): string | null { return localStorage.getItem(REFRESH_TOKEN_KEY); }
export function getTokenExpiresAt(): number | null {
  const value = localStorage.getItem(EXPIRES_AT_KEY);
  return value ? Number(value) : null;
}

export function setSession(accessToken: string, refreshToken: string, expiresIn: number) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + expiresIn * 1000));
}

export function clearToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

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

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(length = 64) {
  const size = Math.min(Math.max(length, 43), 128);
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}
