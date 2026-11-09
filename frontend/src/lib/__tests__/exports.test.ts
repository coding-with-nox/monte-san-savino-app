import { describe, it, expect } from "vitest";
import { buildQuery } from "../exports";
import { buildDymoLabelXml, getDymoSdkUrl } from "../dymo";

describe("exports helpers", () => {
  it("builds a query string skipping empty values", () => {
    expect(buildQuery({ eventId: "e1", categoryId: undefined, modelId: "" })).toBe("?eventId=e1");
    expect(buildQuery({})).toBe("");
  });
});

describe("dymo helpers", () => {
  it("escapes XML special characters in label data", () => {
    const xml = buildDymoLabelXml({ utente: "A & B", categoria: "<c>", nomeModello: "\"m\"", codice: "1" });
    expect(xml).toContain("A &amp; B");
    expect(xml).toContain("&lt;c&gt;");
    expect(xml).not.toContain("<String><c>");
  });

  it("uses an https SDK url by default", () => {
    expect(getDymoSdkUrl().startsWith("https://")).toBe(true);
  });
});
