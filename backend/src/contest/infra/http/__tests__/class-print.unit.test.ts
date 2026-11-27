import { describe, it, expect } from "bun:test";
import {
  buildJudgeSheets, isUuid, judgeAppUrl, publicAppUrl, renderExhibitorsHtml, renderJudgeSheetsHtml, renderJuryListHtml, renderJuryQrHtml
} from "../class-print.routes";
import { buildStatsOverview } from "../stats.routes";
import { renderSocialHtml } from "../export.routes";

const XSS = `<script>alert(1)</script>"'&`;

describe("class print", () => {
  it("validates uuid and builds the judge page URL of a class", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(judgeAppUrl("http://a.it", "e1", "c1")).toBe("http://a.it/judge?eventId=e1&categoryId=c1");
    expect(publicAppUrl({ PUBLIC_APP_URL: " https://gara.it/// " })).toBe("https://gara.it");
    expect(publicAppUrl({})).toBe("http://localhost:5173");
  });
  it("escapes all user values and has print CSS", () => {
    const outs = [
      renderExhibitorsHtml({ name: XSS }, [{ exhibitor: XSS, modelName: XSS, code: XSS }]),
      renderJuryListHtml({ name: XSS }, [{ judgeUserId: "j", name: XSS, email: XSS }]),
      renderJuryQrHtml({ name: XSS }, "http://a.it/judge", [{ judgeUserId: "j", name: XSS, qrDataUrl: 'data:image/png;base64,"><x', }])
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
  it("renders english headings and html lang for lang en", () => {
    const en = renderExhibitorsHtml({ name: "Pittura" }, [], "en");
    expect(en).toContain('<html lang="en">');
    expect(en).toContain("<h1>Exhibitors and models</h1>");
    expect(en).toContain("<strong>Class:</strong> Pittura");
    expect(en).toContain("<th>Exhibitor</th>");
    expect(en).toContain("No models");
    expect(en).not.toContain("Espositori e modelli");
    expect(renderExhibitorsHtml({ name: "Pittura" }, [])).toContain('<html lang="it">');
  });
});

describe("stats overview", () => {
  it("aggregates and returns empty arrays when no data", () => {
    const empty = buildStatsOverview({ usersByCountryRaw: [], users: [], modelsByUser: [], modelsByCategory: [], categories: [], awardsByMedal: [], mentionsByTitle: [] });
    expect(empty).toEqual({
      usersTotal: 0, usersByCountry: [], modelsPerUser: [], modelsPerCategory: [], medals: [], zeroModelUsers: { count: 0, list: [] }, honorsSummary: [],
      honors: { total: 0, assigned: 0, list: [] }, commendedTotal: 0
    });
    const r = buildStatsOverview({
      usersByCountryRaw: [{ country: "IT", count: 1 }, { country: null, count: 1 }],
      users: [{ id: "a", email: "a@x", firstName: "A" }, { id: "b", email: "b@x" }],
      modelsByUser: [{ userId: "a", count: 2 }],
      modelsByCategory: [{ categoryId: "c1", count: 2 }],
      categories: [{ id: "c1", name: "K" }, { id: "c2", name: "Z" }],
      awardsByMedal: [{ medalLabel: "Gold", count: 2 }, { medalLabel: "Silver", count: 1 }],
      mentionsByTitle: [{ title: "Best", count: 1 }]
    });
    expect(r.usersTotal).toBe(2);
    expect(r.modelsPerUser).toEqual([{ userId: "a", name: "A", count: 2 }]);
    expect(r.zeroModelUsers).toEqual({ count: 1, list: [{ userId: "b", participantNumber: null, name: "b@x", email: "b@x" }] });
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

describe("judge sheets", () => {
  const cats = [
    { id: "c2", name: "Scultura", classNumber: "2" },
    { id: "c1", name: "Pittura", classNumber: "1" }
  ];
  // Anna: two classes, stand-in in Scultura. Bruno: whole-event assignment.
  const rows = [
    { judgeUserId: "j1", name: "Anna Verdi", email: "anna@x.it", categoryId: "c2", standingIn: true },
    { judgeUserId: "j1", name: "Anna Verdi", email: "anna@x.it", categoryId: "c1", standingIn: false },
    { judgeUserId: "j2", name: "Bruno Neri", email: null, categoryId: null, standingIn: false }
  ];
  const qr = { c1: "data:image/png;base64,AAA", c2: "data:image/png;base64,BBB" };
  const opts = (lang: "it" | "en", sessionHours = 24) => ({ lang, appUrl: "http://app.test", sessionHours, qrByCategory: qr });

  it("builds one sheet per judge: class rows, stand-in flag, whole-event judge gets every class", () => {
    const sheets = buildJudgeSheets(rows, cats);
    expect(sheets.map((s) => s.name)).toEqual(["Anna Verdi", "Bruno Neri"]);
    expect(sheets[0].classes.map((c) => [c.name, c.classNumber, c.standingIn])).toEqual([["Pittura", "1", false], ["Scultura", "2", true]]);
    expect(sheets[1].classes.map((c) => c.name)).toEqual(["Pittura", "Scultura"]);
    expect(sheets[1].classes.some((c) => c.standingIn)).toBe(false);
    // a class-level row decides the stand-in flag even when the judge also has a whole-event row
    const withWhole = buildJudgeSheets([...rows, { judgeUserId: "j1", name: "Anna Verdi", email: "anna@x.it", categoryId: null, standingIn: false }], cats);
    expect(withWhole[0].classes.find((c) => c.categoryId === "c2")?.standingIn).toBe(true);
  });

  it("renders an Italian sheet per judge with classes, stand-in marker, app URL and QR", () => {
    const html = renderJudgeSheetsHtml({ id: "e1", name: "Fiera" }, buildJudgeSheets(rows, cats), opts("it"));
    expect(html).toContain('<html lang="it">');
    expect(html.match(/<section class="judge-sheet">/g)).toHaveLength(2);
    expect(html).toContain("<h1>Scheda giudice</h1>");
    expect(html).toContain("Anna Verdi");
    expect(html).toContain("anna@x.it");
    expect(html.match(/\[Sostituto\]/g)).toHaveLength(1);
    expect(html).toContain("Accedi con la tua email e password: la sessione resta valida per 24 ore.");
    expect(html).toContain("http://app.test");
    expect(html).toContain("http://app.test/judge?eventId=e1&amp;categoryId=c2");
    expect(html).toContain("data:image/png;base64,BBB");
    expect(html).toContain(".judge-sheet + .judge-sheet");
  });

  it("renders the English sheet and the configured session length", () => {
    const html = renderJudgeSheetsHtml({ id: "e1", name: "Fair" }, buildJudgeSheets(rows, cats), opts("en", 12));
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h1>Judge sheet</h1>");
    expect(html.match(/\[Stand-in\]/g)).toHaveLength(1);
    expect(html).toContain("Log in with your email and password: the session stays valid for 12 hours.");
    expect(html).not.toContain("Scheda giudice");
    expect(html).not.toContain("Sostituto");
  });

  it("renders the empty states and escapes names", () => {
    const noClasses = renderJudgeSheetsHtml({ id: "e1", name: "E" }, buildJudgeSheets([rows[2]], []), opts("en"));
    expect(noClasses).toContain("No class assigned");
    expect(renderJudgeSheetsHtml({ id: "e1", name: "E" }, [], opts("it"))).toContain("Nessun giudice assegnato");
    const xss = renderJudgeSheetsHtml({ id: "e1", name: XSS }, buildJudgeSheets([{ ...rows[2], name: XSS }], cats), opts("it"));
    expect(xss).not.toContain("<script>alert(1)");
    expect(xss).toContain("&lt;script&gt;alert(1)");
  });
});
