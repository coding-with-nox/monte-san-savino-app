/**
 * Returns `value` only if it is an in-app absolute path ("/judge?eventId=…"). Anything else
 * (absolute URLs, protocol-relative "//host", "/\host", control characters, the login page itself)
 * is rejected, so the `next` parameter cannot send the user off-site.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^\/login(?=[?#]|$)/.test(value)) return null;
  return value;
}

/** Login route for a protected page; the home page needs no `next` (it is the default after login). */
export function loginPathFor(pathname: string, search: string): string {
  const next = pathname + search;
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
