import { describe, it, expect } from "bun:test";
import { createHash } from "node:crypto";
import { PRINT_HTML_HEADERS, PRINT_SCRIPT } from "../printHeaders";

describe("PRINT_HTML_HEADERS (NEW-06)", () => {
  it("allows only the print script, by hash, and no other source of scripts", () => {
    const csp = PRINT_HTML_HEADERS["content-security-policy"];
    const hash = createHash("sha256").update(PRINT_SCRIPT).digest("base64");
    expect(csp).toContain(`script-src 'sha256-${hash}'`);
    expect(csp).not.toContain("unsafe-inline'; script");
    expect(csp.split(";").find((d) => d.trim().startsWith("script-src"))).not.toContain("unsafe");
    expect(csp).toContain("default-src 'none'");
    expect(PRINT_HTML_HEADERS["x-content-type-options"]).toBe("nosniff");
  });
});
