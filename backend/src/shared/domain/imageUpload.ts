const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Allowlist content-type -> file extension.
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Normalizes (lowercase, no parameters) and checks the allowlist. Returns null when not allowed. */
export function normalizeImageContentType(contentType: unknown): { contentType: string; ext: string } | null {
  if (typeof contentType !== "string") return null;
  const base = contentType.split(";")[0]!.trim().toLowerCase();
  const ext = Object.prototype.hasOwnProperty.call(IMAGE_TYPES, base) ? IMAGE_TYPES[base]! : undefined;
  return ext ? { contentType: base, ext } : null;
}

/** Object key: models/<modelId>/<random uuid>.<ext>. modelId must already be a valid UUID. */
export function buildModelImageKey(modelId: string, ext: string, rand: () => string = () => crypto.randomUUID()): string {
  if (!isUuid(modelId)) throw new Error("invalid modelId");
  return `models/${modelId}/${rand()}.${ext}`;
}

export function resolveMaxImageBytes(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.MAX_IMAGE_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_IMAGE_BYTES;
}
