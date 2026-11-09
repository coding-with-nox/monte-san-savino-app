import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { BADGE_HEADERS, renderBadgeHtml, staffCheckinRoutes } from "../enrollment.routes";

describe("badge", () => {
  it("escapes every interpolated value", () => {
    const x = `<script>alert(1)</script>"'&`;
    const html = renderBadgeHtml({ name: x, city: x, enrollmentId: x + "12345678", qrDataUrl: `data:"><img src=x onerror=1>` });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
  it("has restrictive headers", () => {
    expect(BADGE_HEADERS["content-security-policy"]).toBe("default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    expect(BADGE_HEADERS["x-content-type-options"]).toBe("nosniff");
    expect(BADGE_HEADERS["content-type"]).toContain("text/html");
  });
  it("staff routes reject unauthenticated requests", async () => {
    const app = new Elysia().use(staffCheckinRoutes);
    const res = await app.handle(new Request("http://localhost/staff/checkin/not-a-uuid", { method: "POST" }));
    expect([401, 403]).toContain(res.status);
  });
});
