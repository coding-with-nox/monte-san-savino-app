import { escapeHtml } from "../../../shared/domain/escapeHtml";
import { pt, type PrintLang } from "../../../shared/domain/printI18n";
import type { PhotographyRow } from "../../domain/photography";
import { page } from "./class-print.routes";
import { formatParticipantNumber } from "./desk-print";

/** Class cell: name, with the class number when there is one. */
export function photographyClassLabel(r: PhotographyRow): string {
  return r.classNumber ? `${r.classNumber} - ${r.className}` : r.className;
}

/** Photography list: awarded models at or above the minimum medal, in ceremony order. */
export function renderPhotographyHtml(event: { name: string }, rows: PhotographyRow[], lang: PrintLang = "it") {
  const tr = rows.map((r) => `<tr>
          <td>${escapeHtml(photographyClassLabel(r))}</td>
          <td>${escapeHtml(String(r.displayNumber ?? ""))}</td>
          <td>${escapeHtml(r.participantNumber === null ? "" : formatParticipantNumber(r.participantNumber))}</td>
          <td>${escapeHtml(r.exhibitor)}</td>
          <td>${escapeHtml(r.wholeDisplay ? pt(lang, "presentation.wholeDisplay") : (r.modelName ?? ""))}</td>
          <td>${escapeHtml(r.modelCode ?? "")}</td>
          <td>${escapeHtml(r.medalLabel)}</td>
        </tr>`).join("");
  return page(lang, `${pt(lang, "photography.title")} ${event.name}`, `<h1>${pt(lang, "photography.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.event")}:</strong> ${escapeHtml(event.name)}</p>
    ${tr
      ? `<table><thead><tr><th>${pt(lang, "label.class")}</th><th>${pt(lang, "col.displayNumber")}</th><th>${pt(lang, "col.participantNumber")}</th><th>${pt(lang, "col.exhibitor")}</th><th>${pt(lang, "col.model")}</th><th>${pt(lang, "col.code")}</th><th>${pt(lang, "col.medal")}</th></tr></thead>
    <tbody>${tr}</tbody></table>`
      : `<p>${pt(lang, "photography.noModels")}</p>`}`);
}
