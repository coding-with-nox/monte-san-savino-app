import { describe, it, expect } from "bun:test";
import { isUuid, juryQrPayload, renderExhibitorsHtml, renderJuryListHtml, renderJuryQrHtml } from "../class-print.routes";
import { buildStatsOverview } from "../stats.routes";
import { renderSocialHtml } from "../export.routes";

const XSS = `<script>alert(1)</script>"'&`;

describe("class print", () => {
  it("validates uuid and builds jury payload", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(juryQrPayload("j", "c")).toBe("jury:j:c");
  });
  it("escapes all user values and has print CSS", () => {
    const outs = [
      renderExhibitorsHtml({ name: XSS }, [{ exhibitor: XSS, modelName: XSS, code: XSS }]),
      renderJuryListHtml({ name: XSS }, [{ judgeUserId: "j", name: XSS, email: XSS }]),
      renderJuryQrHtml({ name: XSS }, "c", [{ judgeUserId: "j", name: XSS, qrDataUrl: 'data:image/png;base64,"><x', }])
    ];
    for (const html of outs) {
      expect(html).not.toContain("<script>alert(1)");
      expect(html).toContain("&lt;script&gt;alert(1)");
      expect(html).toContain("@media print");
    }
    expect(outs[2]).not.toContain('"><x');
  });
  it("renders empty states", () => {
    expect(renderJuryListHtml({ name: "C" }, [])).toContain("Nessun giudice");
  });
});

describe("stats overview", () => {
  it("aggregates and returns empty arrays when no data", () => {
    const empty = buildStatsOverview({ users: [], models: [], categories: [], awards: [], mentions: [] });
    expect(empty).toEqual({ usersTotal: 0, usersByCountry: [], modelsPerUser: [], modelsPerCategory: [], medals: [], zeroModelUsers: [], honorsSummary: [] });
    const r = buildStatsOverview({
      users: [{ id: "a", email: "a@x", firstName: "A", country: "IT" }, { id: "b", email: "b@x" }],
      models: [{ userId: "a", categoryId: "c1" }, { userId: "a", categoryId: "c1" }],
      categories: [{ id: "c1", name: "K" }, { id: "c2", name: "Z" }],
      awards: [{ medalLabel: "Gold" }, { medalLabel: "Gold" }, { medalLabel: "Silver" }],
      mentions: [{ title: "Best" }]
    });
    expect(r.usersTotal).toBe(2);
    expect(r.modelsPerUser).toEqual([{ userId: "a", name: "A", count: 2 }]);
    expect(r.zeroModelUsers).toEqual([{ userId: "b", name: "b@x", email: "b@x" }]);
    expect(r.modelsPerCategory[1]).toEqual({ categoryId: "c2", name: "Z", count: 0 });
    expect(r.medals[0]).toEqual({ name: "Gold", count: 2 });
    expect(r.honorsSummary).toEqual([{ title: "Best", count: 1 }]);
    expect(r.usersByCountry).toContainEqual({ country: "N/D", count: 1 });
  });
});

describe("social html for new networks", () => {
  it("escapes and links patreon/pinterest/tiktok", () => {
    const html = renderSocialHtml({ tiktok: "mario", patreon: `x"><img>` });
    expect(html).toContain("https://www.tiktok.com/@mario");
    expect(html).not.toContain("<img>");
  });
});
