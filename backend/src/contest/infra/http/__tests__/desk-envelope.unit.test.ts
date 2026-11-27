import { describe, it, expect } from "bun:test";
import { renderDeskEnvelopesHtml } from "../desk-print";

const base = { participantNumber: 12, name: "Mario Rossi", country: "Italia" };

describe("desk envelopes: login line", () => {
  it("prints the username when present", () => {
    const html = renderDeskEnvelopesHtml([{ ...base, email: "mario@example.com", username: "mario_painter" }], "it");
    expect(html).toContain('<p class="meta">mario_painter</p>');
    expect(html).not.toContain("mario@example.com");
  });
  it("falls back to the email when there is no username", () => {
    const html = renderDeskEnvelopesHtml([{ ...base, email: "mario@example.com", username: null }], "it");
    expect(html).toContain('<p class="meta">mario@example.com</p>');
  });
  it("escapes the printed value", () => {
    const html = renderDeskEnvelopesHtml([{ ...base, email: null, username: "<b>x</b>" }], "en");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});
