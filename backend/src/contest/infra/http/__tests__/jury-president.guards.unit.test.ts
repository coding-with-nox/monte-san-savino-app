import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { JwtTokenService } from "../../../../identity/infra/tokens/jwtTokenService";
import { awardRoutes } from "../award.routes";
import { adminEnrollmentRoutes } from "../enrollment.routes";
import { renderPricingHtml } from "../export.routes";
import { computePricing } from "../../../domain/pricing";

const originalSecret = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = "unit-test-secret-0123456789abcdef0123"; });
afterAll(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

const ID = "11111111-1111-1111-1111-111111111111";
const status = async (app: { handle: (r: Request) => Promise<Response> }, role: string, method: string, path: string, body?: unknown) => {
  const token = (await new JwtTokenService().signAccess({ sub: "u1", email: "a@b.it", role })).token;
  const res = await app.handle(new Request(`http://localhost${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  }));
  return res.status;
};

// Only rejections are asserted: allowed requests would reach the database.
describe("jury_president is read-only", () => {
  it("cannot reach manager routes of awards and enrollments", async () => {
    expect(await status(awardRoutes, "jury_president", "PATCH", `/awards/${ID}`, { medalLabel: "Gold", medalRank: 4 })).toBe(403);
    expect(await status(awardRoutes, "jury_president", "GET", `/awards/events/${ID}`)).toBe(403);
    expect(await status(adminEnrollmentRoutes, "jury_president", "PATCH", `/admin/enrollments/${ID}/absent`, { absent: true })).toBe(403);
  });

  it("judges still cannot read monitoring or enrollments", async () => {
    expect(await status(awardRoutes, "judge", "GET", `/awards/monitoring/${ID}`)).toBe(403);
    expect(await status(adminEnrollmentRoutes, "judge", "GET", "/admin/enrollments")).toBe(403);
  });
});

describe("renderPricingHtml", () => {
  it("prints the total and escapes user values", () => {
    const summary = computePricing({
      baseFeeCents: 2500,
      models: [{
        modelId: "m", modelName: "<b>x</b>", modelCode: null, free: false,
        members: [{ name: "<i>", surname: "N", roleId: null, roleName: "Pittore", priceCents: 1500 }]
      }]
    });
    const html = renderPricingHtml([{ eventName: "<script>", ...summary }]);
    expect(html).toContain("€ 40,00");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<i>");
  });

  it("is empty without models", () => {
    expect(renderPricingHtml([])).toBe("");
  });
});
