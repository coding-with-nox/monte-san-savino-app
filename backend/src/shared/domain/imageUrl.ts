/**
 * Accepts only URLs that live under the public MinIO base (MINIO_PUBLIC_URL + bucket).
 * Same origin (scheme+host+port) and path prefix "/<bucket>/" are required; credentials,
 * query-less traversal ("..", encoded) and other hosts/schemes are rejected.
 *
 * `publicBase` should be `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}` (see allowedImageBase()).
 */
export function isAllowedImageUrl(url: unknown, publicBase: string): boolean {
  if (typeof url !== "string" || url.length === 0 || url.length > 2048) return false;
  let u: URL, base: URL;
  try {
    u = new URL(url);
    base = new URL(publicBase);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.protocol !== base.protocol || u.host !== base.host) return false;
  if (u.username || u.password) return false;
  const prefix = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  if (!u.pathname.startsWith(prefix) || u.pathname.length === prefix.length) return false;
  let decoded: string;
  try { decoded = decodeURIComponent(u.pathname); } catch { return false; }
  if (decoded.split("/").some((s) => s === "..")) return false;
  return true;
}

export function allowedImageBase(env: Record<string, string | undefined> = process.env): string {
  const pub = (env.MINIO_PUBLIC_URL ?? "http://localhost:9000").replace(/\/+$/, "");
  return `${pub}/${env.MINIO_BUCKET ?? "models"}`;
}

/**
 * Object key (relative to the bucket) for an allowed image URL, or null when the URL is not
 * under `publicBase` or the key is unsafe (empty, traversal).
 */
export function objectKeyFromImageUrl(url: unknown, publicBase: string): string | null {
  if (!isAllowedImageUrl(url, publicBase)) return null;
  // URL parsing normalizes dot segments (also %2e%2e); reject them on the raw string instead.
  let raw: string;
  try { raw = decodeURIComponent(url as string); } catch { return null; }
  if (/(^|[\/\\])\.\.([\/\\?#]|$)/.test(raw)) return null;
  const u = new URL(url as string);
  const basePath = new URL(publicBase).pathname.replace(/\/+$/, "");
  const prefix = `${basePath}/`;
  if (!u.pathname.startsWith(prefix)) return null;
  let key: string;
  try { key = decodeURIComponent(u.pathname.slice(prefix.length)); } catch { return null; }
  if (!key || key.includes("\\") || key.split("/").some((s) => s === ".." || s === "")) return null;
  return key;
}
