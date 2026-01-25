type PkceRecord = {
  codeChallenge: string;
  user: { id: string; email: string; role: string; tenantId?: string | null };
  expiresAt: number;
};

const PKCE_TTL_MS = 5 * 60 * 1000;
const store = new Map<string, PkceRecord>();

export function createAuthCode(record: Omit<PkceRecord, "expiresAt">) {
  const code = crypto.randomUUID();
  store.set(code, { ...record, expiresAt: Date.now() + PKCE_TTL_MS });
  return code;
}

export function consumeAuthCode(code: string) {
  const record = store.get(code);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    store.delete(code);
    return null;
  }
  store.delete(code);
  return record;
}
