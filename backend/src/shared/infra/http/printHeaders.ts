import { createHash } from "node:crypto";

/** The only script of the printable HTML pages: it opens the print dialog. */
export const PRINT_SCRIPT = "window.onload = () => window.print();";

const PRINT_SCRIPT_HASH = createHash("sha256").update(PRINT_SCRIPT).digest("base64");

/**
 * Headers of every printable HTML page (NEW-06, defence in depth): user values are already escaped,
 * and if one ever slipped through, the CSP lets no script run except the print one (by hash).
 */
export const PRINT_HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy":
    `default-src 'none'; style-src 'unsafe-inline'; img-src data: blob: https: http:; script-src 'sha256-${PRINT_SCRIPT_HASH}'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`,
  "x-content-type-options": "nosniff"
} as const;
