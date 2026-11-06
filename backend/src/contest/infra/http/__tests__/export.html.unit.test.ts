import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderSocialHtml, socialHref, modelQrPayload } from "../export.routes";

describe("export HTML helpers", () => {
  it("escapes social values in rendered HTML", () => {
    const html = renderSocialHtml({ instagram: `x"><img src=x onerror=alert(1)>`, website: `https://e.com/?a="b"<c>` });
    expect(html).not.toContain("<img");
    expect(html).not.toContain(`"><`);
    expect(html).toContain("&lt;img");
  });
  it("never produces non-http hrefs", () => {
    expect(socialHref("instagram", "javascript:alert(1)")).toBeNull();
    expect(renderSocialHtml({ website: "javascript:alert(1)" })).not.toContain("href=");
    expect(socialHref("instagram", "mario")).toBe("https://instagram.com/mario");
  });
  it("builds QR payload as model:<id>", () => {
    expect(modelQrPayload("abc")).toBe("model:abc");
  });
  it("export.routes interpolates no unescaped user values in HTML templates", () => {
    const src = readFileSync(join(import.meta.dir, "..", "export.routes.ts"), "utf8");
    for (const bad of ["${event?.name ?? eventId}</", "${row.utente}", "${u.email}</td>", "${model.name}</td>", "${profile.email}"]) {
      expect(src.includes(bad)).toBe(false);
    }
  });
});

describe("internal_notes confinement", () => {
  it("is referenced only by schema, ensureTenantSchema and admin-models routes", () => {
    const root = join(import.meta.dir, "..", "..", "..", "..");
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
      );
    const offenders = walk(root)
      .filter((f) => f.endsWith(".ts") && !f.includes("__tests__"))
      .filter((f) => /internalNotes|internal_notes/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(root.length + 1));
    expect(offenders.sort()).toEqual([
      "contest/infra/http/admin-models.routes.ts",
      "contest/infra/persistence/schema.ts",
      "tenancy/infra/persistence/ensureTenantSchema.ts"
    ]);
  });
});
