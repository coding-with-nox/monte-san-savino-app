import { describe, it, expect } from "bun:test";
import { renderPresentationHonorsHtml, renderPresentationMedalsHtml } from "../presentation-print.routes";

const XSS = `<script>alert(1)</script>"'&`;

describe("presentation prints", () => {
  const classes = [{
    categoryId: "c1",
    name: "Pittura",
    classNumber: "3",
    presentationOrder: 1,
    prizes: [
      { medalLabel: "Gold", medalRank: 4, displayNumber: 7, exhibitor: "Mario Rossi", modelName: null, modelCode: null, wholeDisplay: true },
      { medalLabel: "Silver", medalRank: 3, displayNumber: 8, exhibitor: "Luca", modelName: "Cavaliere", modelCode: "M1-8-2", wholeDisplay: false }
    ]
  }];

  it("prints one section per class with medals, whole-display label and escaped values", () => {
    const html = renderPresentationMedalsHtml({ name: "Gara" }, classes, "it");
    expect(html).toContain('<html lang="it">');
    expect(html.match(/<section class="class">/g)).toHaveLength(1);
    expect(html).toContain("<h2>Pittura</h2>");
    expect(html).toContain("<td>Gold</td>");
    expect(html).toContain("Intero display");
    expect(html).toContain("<td>Cavaliere</td>");
    expect(html).toContain("@media print");
  });

  it("uses english labels for lang en", () => {
    const html = renderPresentationMedalsHtml({ name: "Gara" }, classes, "en");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h1>Ceremony: medals</h1>");
    expect(html).toContain("Whole display");
    expect(html).toContain("<th>Medal</th>");
  });

  it("renders empty states and escapes user values", () => {
    expect(renderPresentationMedalsHtml({ name: "Gara" }, [])).toContain("Nessuna classe premiata");
    const xss = renderPresentationMedalsHtml({ name: XSS }, [{ ...classes[0], name: XSS, prizes: [{ ...classes[0].prizes[1], exhibitor: XSS, modelName: XSS }] }]);
    expect(xss).not.toContain("<script>alert(1)");
    expect(xss).toContain("&lt;script&gt;alert(1)");
  });

  it("prints special awards, with empty state", () => {
    const honors = [{ code: "bos", name: "Best Of Show", sortOrder: 2, categoryName: "Pittura", displayNumber: 7, exhibitor: "Mario Rossi", modelName: null, wholeDisplay: true }];
    const html = renderPresentationHonorsHtml({ name: "Gara" }, honors, "en");
    expect(html).toContain("<h1>Special awards</h1>");
    expect(html).toContain("<td>bos</td>");
    expect(html).toContain("<td>Whole display</td>");
    expect(renderPresentationHonorsHtml({ name: "Gara" }, [], "it")).toContain("Nessun premio speciale assegnato");
  });
});
