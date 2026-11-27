import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { escapeHtml } from "../../../shared/domain/escapeHtml";
import { parsePrintLang, pt, type PrintLang } from "../../../shared/domain/printI18n";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { eventsTable } from "../persistence/schema";
import { loadCeremony } from "../persistence/ceremony";
import type { CeremonyClass, CeremonyHonor } from "../../domain/ceremony";
import { isUuid, page } from "./class-print.routes";

/** Medals of the ceremony: one section per awarded class, in presentation order. */
export function renderPresentationMedalsHtml(event: { name: string }, classes: CeremonyClass[], lang: PrintLang = "it") {
  const sections = classes.map((c) => {
    const rows = c.prizes.map((p) => `<tr>
          <td>${escapeHtml(p.medalLabel)}</td>
          <td>${escapeHtml(String(p.displayNumber ?? ""))}</td>
          <td>${escapeHtml(p.exhibitor)}</td>
          <td>${escapeHtml(p.wholeDisplay ? pt(lang, "presentation.wholeDisplay") : (p.modelName ?? ""))}</td>
          <td>${escapeHtml(p.modelCode ?? "")}</td>
        </tr>`).join("");
    return `<section class="class">
    <h2>${escapeHtml(c.name)}</h2>
    <p class="sub"><strong>${pt(lang, "col.classNumber")}:</strong> ${escapeHtml(c.classNumber ?? "")}</p>
    <table><thead><tr><th>${pt(lang, "col.medal")}</th><th>${pt(lang, "col.displayNumber")}</th><th>${pt(lang, "col.exhibitor")}</th><th>${pt(lang, "col.model")}</th><th>${pt(lang, "col.code")}</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </section>`;
  }).join("");
  return page(lang, `${pt(lang, "presentation.medals.title")} ${event.name}`, `<h1>${pt(lang, "presentation.medals.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.event")}:</strong> ${escapeHtml(event.name)}</p>
    ${sections || `<p>${pt(lang, "presentation.noClasses")}</p>`}`);
}

/** Special awards in catalogue order. */
export function renderPresentationHonorsHtml(event: { name: string }, honors: CeremonyHonor[], lang: PrintLang = "it") {
  const rows = honors.map((h) => `<tr>
          <td>${escapeHtml(h.code)}</td>
          <td>${escapeHtml(h.name)}</td>
          <td>${escapeHtml(h.categoryName ?? "")}</td>
          <td>${escapeHtml(String(h.displayNumber))}</td>
          <td>${escapeHtml(h.exhibitor)}</td>
          <td>${escapeHtml(h.wholeDisplay ? pt(lang, "presentation.wholeDisplay") : (h.modelName ?? ""))}</td>
        </tr>`).join("");
  const table = rows
    ? `<table><thead><tr><th>${pt(lang, "col.code")}</th><th>${pt(lang, "col.honor")}</th><th>${pt(lang, "label.class")}</th><th>${pt(lang, "col.displayNumber")}</th><th>${pt(lang, "col.exhibitor")}</th><th>${pt(lang, "col.model")}</th></tr></thead>
    <tbody>${rows}</tbody></table>`
    : `<p>${pt(lang, "presentation.noHonors")}</p>`;
  return page(lang, `${pt(lang, "presentation.honors.title")} ${event.name}`, `<h1>${pt(lang, "presentation.honors.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.event")}:</strong> ${escapeHtml(event.name)}</p>
    ${table}`);
}

export const presentationPrintRoutes = new Elysia()
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/events/:eventId/presentation-medals", async ({ tenantDb, params, query, set }) => {
    if (!isUuid(params.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const [event] = await tenantDb.select({ id: eventsTable.id, name: eventsTable.name })
      .from(eventsTable).where(eq(eventsTable.id, params.eventId as any)).limit(1);
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }
    const lang = parsePrintLang(query?.lang);
    const { classes } = await loadCeremony(tenantDb, event.id);
    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename="presentation-medals.html"`;
    return renderPresentationMedalsHtml(event, classes, lang);
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: { summary: "Stampa premiazione: medaglie per classe (ordine di presentazione)", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  })
  .get("/events/:eventId/presentation-honors", async ({ tenantDb, params, query, set }) => {
    if (!isUuid(params.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const [event] = await tenantDb.select({ id: eventsTable.id, name: eventsTable.name })
      .from(eventsTable).where(eq(eventsTable.id, params.eventId as any)).limit(1);
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }
    const lang = parsePrintLang(query?.lang);
    const { honors } = await loadCeremony(tenantDb, event.id);
    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename="presentation-honors.html"`;
    return renderPresentationHonorsHtml(event, honors, lang);
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: { summary: "Stampa premiazione: premi speciali assegnati (ordine di catalogo)", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  });
