import { PRINT_SCRIPT } from "../../../shared/infra/http/printHeaders";
import { escapeHtml } from "../../../shared/domain/escapeHtml";
import { pt, type PrintLang } from "../../../shared/domain/printI18n";
import { page } from "./class-print.routes";

/** Desk batch prints (lists, envelopes, labels). HTML only: routes live in export.routes.ts. */

/** Participant number as printed on lists and envelopes (4 digits, like the model card). */
export function formatParticipantNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export type DeskListModel = { code: string; className: string; displayNumber: number | null; name: string };
export type DeskListParticipant = { participantNumber: number; name: string; country: string; models: DeskListModel[] };

/** "Check your entries": one page per participant. */
export function renderDeskListsHtml(event: { name: string }, participants: DeskListParticipant[], lang: PrintLang = "it") {
  const sections = participants.map((p, i) => {
    const rows = p.models.map((m) => `<tr>
          <td>${escapeHtml(m.code)}</td>
          <td>${escapeHtml(m.className)}</td>
          <td>${escapeHtml(String(m.displayNumber ?? ""))}</td>
          <td>${escapeHtml(m.name)}</td>
        </tr>`).join("");
    return `<section class="desk-page"${i > 0 ? ` style="page-break-before: always; break-before: page;"` : ""}>
    <h1>${pt(lang, "desk.lists.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.event")}:</strong> ${escapeHtml(event.name)}</p>
    <table><tbody>
      <tr><th>${pt(lang, "col.participantNumber")}</th><td>${escapeHtml(formatParticipantNumber(p.participantNumber))}</td></tr>
      <tr><th>${pt(lang, "col.name")}</th><td>${escapeHtml(p.name)}</td></tr>
      <tr><th>${pt(lang, "label.country")}</th><td>${escapeHtml(p.country)}</td></tr>
    </tbody></table>
    ${rows
      ? `<table><thead><tr><th>${pt(lang, "col.code")}</th><th>${pt(lang, "label.class")}</th><th>${pt(lang, "col.displayNumber")}</th><th>${pt(lang, "col.modelName")}</th></tr></thead>
    <tbody>${rows}</tbody></table>`
      : `<p>${pt(lang, "common.noModels")}</p>`}
  </section>`;
  }).join("");
  return page(lang, `${pt(lang, "desk.lists.title")} ${event.name}`, sections || `<p>${pt(lang, "common.noData")}</p>`);
}

export type DeskEnvelope = { participantNumber: number; name: string; email: string | null; username?: string | null; country: string };

/** One envelope per participant: the 220 x 110 mm page size is set on @page. Shows the username when set, else the email. */
export function renderDeskEnvelopesHtml(envelopes: DeskEnvelope[], lang: PrintLang = "it") {
  const body = envelopes.map((e) => `<section class="envelope">
      <p class="number">${escapeHtml(formatParticipantNumber(e.participantNumber))}</p>
      <p class="name">${escapeHtml(e.name)}</p>
      ${e.username || e.email ? `<p class="meta">${escapeHtml(e.username || e.email)}</p>` : ""}
      ${e.country ? `<p class="meta">${escapeHtml(e.country)}</p>` : ""}
    </section>`).join("");
  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(pt(lang, "desk.envelopes.title"))}</title>
    <style>
      @page { size: 220mm 110mm; margin: 0; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .envelope { box-sizing: border-box; width: 220mm; height: 110mm; padding: 12mm 14mm; overflow: hidden; page-break-after: always; break-after: page; }
      .envelope:last-child { page-break-after: auto; break-after: auto; }
      .number { font-size: 60pt; font-weight: bold; line-height: 1; margin: 0; }
      .name { font-size: 20pt; margin: 6mm 0 2mm; }
      .meta { font-size: 12pt; margin: 1mm 0; color: #333; }
    </style>
  </head>
  <body>
    ${body || `<p>${pt(lang, "common.noData")}</p>`}
    <script>${PRINT_SCRIPT}</script>
  </body>
</html>`;
}

export type DeskLabelRow = { utente: string; categoria: string; nomeModello: string; codice: string; qrPayload: string; qr: string };

/** One label per model, same content as the labels of /exports/labels/pdf (model code included). */
export function renderDeskLabelsHtml(event: { name: string }, rows: DeskLabelRow[], lang: PrintLang = "it") {
  const cards = rows.map((r) => `<div class="qr">
      <img alt="${escapeHtml(r.qrPayload)}" src="${escapeHtml(r.qr)}" width="160" height="160"/>
      <h2>${escapeHtml(r.nomeModello)}</h2>
      <p>${pt(lang, "label.code")}: ${escapeHtml(r.codice)}</p>
      <p>${escapeHtml(r.categoria)}</p>
      <p>${escapeHtml(r.utente)}</p>
    </div>`).join("");
  return page(lang, `${pt(lang, "labels.title")} ${event.name}`, `<h1>${pt(lang, "labels.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.event")}:</strong> ${escapeHtml(event.name)}</p>
    ${cards || `<p>${pt(lang, "common.noData")}</p>`}`);
}
