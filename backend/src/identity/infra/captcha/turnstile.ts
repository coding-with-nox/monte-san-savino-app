import { logger } from "../../../shared/infra/logger/logger";

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_TIMEOUT_MS = 10_000;

export type TurnstileInput = { secret: string; token: string; remoteIp?: string };
export type TurnstileVerifier = (input: TurnstileInput) => Promise<boolean>;

/**
 * Server-side check of a Cloudflare Turnstile token (siteverify). Any failure (network, timeout,
 * malformed answer) counts as "not verified".
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

export async function siteverify(
  input: TurnstileInput,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
  timeoutMs = TURNSTILE_TIMEOUT_MS
): Promise<boolean> {
  try {
    const form = new URLSearchParams({ secret: input.secret, response: input.token });
    if (input.remoteIp) form.set("remoteip", input.remoteIp);
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return false;
    const answer = await res.json() as { success?: unknown };
    return answer.success === true;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "turnstile verification failed");
    return false;
  }
}

let verifier: TurnstileVerifier = (input) => siteverify(input);

/** Replaces the verifier (tests inject a mock); call without argument to restore the Cloudflare one. */
export function setTurnstileVerifier(next?: TurnstileVerifier) {
  verifier = next ?? ((input) => siteverify(input));
}

export function verifyTurnstile(input: TurnstileInput): Promise<boolean> {
  return verifier(input);
}

/** TURNSTILE_SECRET_KEY when set (anti-bot on self registration is then mandatory), else null. */
export function turnstileSecretFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.TURNSTILE_SECRET_KEY?.trim() || null;
}

/** TURNSTILE_SITE_KEY for the frontend widget, or null. */
export function turnstileSiteKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.TURNSTILE_SITE_KEY?.trim() || null;
}
