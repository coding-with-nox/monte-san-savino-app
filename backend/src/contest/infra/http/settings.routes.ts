import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { settingsTable } from "../persistence/schema";
import { loadSectionVisibility, SECTION_VISIBILITY_KEY } from "../../../identity/infra/http/section.middleware";
import { findInvalidVisibilityEntry, parseSectionVisibility, SECTIONS } from "../../../identity/domain/sectionVisibility";
import { PERMISSIONS, parseRolePermissions } from "../../../identity/domain/permissions";
import { loadRolePermissions, ROLE_PERMISSIONS_KEY } from "../../../identity/infra/http/permission.middleware";
import { ROLES, type Role } from "../../../identity/domain/Role";
import { parsePrizeOrder } from "../../domain/prizeOrder";
import { DEFAULT_BASE_FEE_CENTS } from "../../domain/pricing";
import { judgingSettingsError } from "../../domain/categoryClosure";

const PRIZE_ORDER_KEY = "prizeOrder";
const BASE_FEE_KEY = "baseFeeCents";

async function saveSetting(tenantDb: any, key: string, value: string) {
  await tenantDb
    .insert(settingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

const DEFAULTS: Record<string, string> = {
  modelImages: "true",
  printCodePrefix: "MSS",
  printCodeDigits: "5",
  appTheme: "light",
  themePreset: "savino",
  exportIncludeModelCode: "true",
  exportIncludeModelDescription: "true",
  exportIncludeParticipantEmail: "true",
  excelSheetName: "Export",
  excelFilePrefix: "contest-export",
  maxVotesPerExhibitor: "3",
  maxVoteDifferent: "2",
  app_name: "Miniatures Contest",
  [BASE_FEE_KEY]: String(DEFAULT_BASE_FEE_CENTS)
};

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    const rows = await tenantDb.select().from(settingsTable);
    const result: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }, {
    detail: {
      summary: "Leggi impostazioni",
      tags: ["Settings"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/section-visibility", async ({ tenantDb, user }) => {
    const role = user!.role as Role;
    const visibility = await loadSectionVisibility(tenantDb);
    const permissions = await loadRolePermissions(tenantDb);
    return { role, sections: visibility[role] ?? [], permissions: permissions[role] ?? [] };
  }, {
    detail: { summary: "Sezioni visibili e permessi per il proprio ruolo", tags: ["Settings"], security: [{ bearerAuth: [] }] }
  })
  .get("/prize-order", async ({ tenantDb }) => {
    const rows = await tenantDb.select().from(settingsTable);
    return { order: parsePrizeOrder(rows.find((r) => r.key === PRIZE_ORDER_KEY)?.value) };
  }, {
    detail: { summary: "Ordine di presentazione dei premi", tags: ["Settings"], security: [{ bearerAuth: [] }] }
  });

export const adminSettingsRoutes = new Elysia({ prefix: "/admin/settings" })
  .use(tenantMiddleware)
  .use(requireRole("admin"))
  .put("/", async ({ tenantDb, body, set }) => {
    const entries = Object.entries(body as Record<string, string>);
    if (entries.some(([key, value]) => key === BASE_FEE_KEY && !/^\d{1,7}$/.test(value))) {
      set.status = 422;
      return { error: `${BASE_FEE_KEY} must be a non-negative integer (cents)` };
    }
    const judgingError = judgingSettingsError(entries);
    if (judgingError) {
      set.status = 422;
      return { error: judgingError };
    }
    for (const [key, value] of entries) await saveSetting(tenantDb, key, String(value));
    return { updated: true };
  }, {
    body: t.Record(t.String(), t.String()),
    detail: {
      summary: "Aggiorna impostazioni (admin)",
      tags: ["Settings"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/section-visibility", async ({ tenantDb }) => {
    return {
      sections: SECTIONS,
      roles: ROLES,
      visibility: await loadSectionVisibility(tenantDb),
      permissions: await loadRolePermissions(tenantDb),
      availablePermissions: PERMISSIONS
    };
  }, {
    detail: { summary: "Configurazione visibilità sezioni e permessi (admin)", tags: ["Settings"], security: [{ bearerAuth: [] }] }
  })
  .put("/section-visibility", async ({ tenantDb, body, set }) => {
    const invalid = findInvalidVisibilityEntry(body.visibility);
    if (invalid !== null) {
      set.status = 422;
      return { error: `Unknown role or section: ${invalid}` };
    }
    const merged = { ...(await loadSectionVisibility(tenantDb)), ...body.visibility };
    const visibility = parseSectionVisibility(JSON.stringify(merged));
    await saveSetting(tenantDb, SECTION_VISIBILITY_KEY, JSON.stringify(visibility));
    // Unknown roles/permissions are ignored and admin is forced by the parser.
    let permissions = await loadRolePermissions(tenantDb);
    if (body.permissions) {
      permissions = parseRolePermissions(JSON.stringify({ ...permissions, ...body.permissions }));
      await saveSetting(tenantDb, ROLE_PERMISSIONS_KEY, JSON.stringify(permissions));
    }
    return { updated: true, visibility, permissions };
  }, {
    body: t.Object({
      visibility: t.Record(t.String(), t.Array(t.String())),
      permissions: t.Optional(t.Record(t.String(), t.Array(t.String())))
    }),
    detail: { summary: "Aggiorna visibilità sezioni e permessi (admin)", tags: ["Settings"], security: [{ bearerAuth: [] }] }
  })
  .put("/prize-order", async ({ tenantDb, body }) => {
    const order = parsePrizeOrder(JSON.stringify(body.order));
    await saveSetting(tenantDb, PRIZE_ORDER_KEY, JSON.stringify(order));
    return { updated: true, order };
  }, {
    body: t.Object({ order: t.Array(t.String({ minLength: 1, maxLength: 60, pattern: "\\S" }), { minItems: 1, maxItems: 20 }) }),
    detail: { summary: "Aggiorna ordine di presentazione premi (admin)", tags: ["Settings"], security: [{ bearerAuth: [] }] }
  });
