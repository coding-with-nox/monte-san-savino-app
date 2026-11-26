import { eq } from "drizzle-orm";
import { settingsTable } from "../../../contest/infra/persistence/schema";
import { parseSectionVisibility, type Section, type SectionVisibility } from "../../domain/sectionVisibility";

export const SECTION_VISIBILITY_KEY = "sectionVisibility";

export async function loadSectionVisibility(db: any): Promise<SectionVisibility> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, SECTION_VISIBILITY_KEY))
    .limit(1);
  return parseSectionVisibility(row?.value);
}

/** beforeHandle: server-side enforcement of the section visibility, only for jury_president. */
export function requireVisibleSection(section: Section) {
  return async ({ tenantDb, user, set }: any) => {
    if (user?.role !== "jury_president") return;
    const visibility = await loadSectionVisibility(tenantDb);
    if (!visibility.jury_president.includes(section)) {
      set.status = 403;
      return { error: "Section not visible", code: "SECTION_HIDDEN" };
    }
  };
}
