import { describe, it, expect, afterEach } from "bun:test";
import {
  siteverify, setTurnstileVerifier, verifyTurnstile, TURNSTILE_VERIFY_URL, turnstileSecretFromEnv, turnstileSiteKeyFromEnv
} from "../turnstile";

type Answer = { ok?: boolean; body?: unknown } | Error;

function fakeFetch(answer: Answer) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    return { ok: answer.ok ?? true, json: async () => answer.body ?? {} } as Pick<Response, "ok" | "json">;
  };
  return { fn, calls };
}

afterEach(() => setTurnstileVerifier());

describe("siteverify", () => {
  it("posts secret, response and remoteip to Cloudflare and accepts success: true", async () => {
    const { fn, calls } = fakeFetch({ body: { success: true } });
    const ok = await siteverify({ secret: "s3cr3t", token: "tok", remoteIp: "10.0.0.1" }, fn);
    expect(ok).toBe(true);
    expect(calls[0].url).toBe(TURNSTILE_VERIFY_URL);
    expect(calls[0].init?.method).toBe("POST");
    const sent = new URLSearchParams(calls[0].init?.body as URLSearchParams);
    expect(sent.get("secret")).toBe("s3cr3t");
    expect(sent.get("response")).toBe("tok");
    expect(sent.get("remoteip")).toBe("10.0.0.1");
  });
  it("omits remoteip when unknown", async () => {
    const { fn, calls } = fakeFetch({ body: { success: true } });
    await siteverify({ secret: "s", token: "t" }, fn);
    expect(new URLSearchParams(calls[0].init?.body as URLSearchParams).has("remoteip")).toBe(false);
  });
  it("rejects a failed answer, an HTTP error, a malformed answer and network errors", async () => {
    expect(await siteverify({ secret: "s", token: "t" }, fakeFetch({ body: { success: false } }).fn)).toBe(false);
    expect(await siteverify({ secret: "s", token: "t" }, fakeFetch({ ok: false, body: { success: true } }).fn)).toBe(false);
    expect(await siteverify({ secret: "s", token: "t" }, fakeFetch({ body: { success: "yes" } }).fn)).toBe(false);
    expect(await siteverify({ secret: "s", token: "t" }, fakeFetch(new Error("socket hang up")).fn)).toBe(false);
  });
});

describe("verifier injection", () => {
  it("routes verifyTurnstile through the injected verifier", async () => {
    const seen: unknown[] = [];
    setTurnstileVerifier(async (input) => { seen.push(input); return input.token === "good"; });
    expect(await verifyTurnstile({ secret: "s", token: "good" })).toBe(true);
    expect(await verifyTurnstile({ secret: "s", token: "bad" })).toBe(false);
    expect(seen).toHaveLength(2);
  });
});

describe("turnstile env", () => {
  it("reads the secret and site key, null when blank or missing", () => {
    expect(turnstileSecretFromEnv({ TURNSTILE_SECRET_KEY: " abc " } as any)).toBe("abc");
    expect(turnstileSecretFromEnv({ TURNSTILE_SECRET_KEY: "  " } as any)).toBeNull();
    expect(turnstileSecretFromEnv({} as any)).toBeNull();
    expect(turnstileSiteKeyFromEnv({ TURNSTILE_SITE_KEY: "0x4AAA" } as any)).toBe("0x4AAA");
    expect(turnstileSiteKeyFromEnv({} as any)).toBeNull();
  });
});
