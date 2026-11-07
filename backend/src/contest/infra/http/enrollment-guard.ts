import { eq } from "drizzle-orm";
import { categoriesTable, eventCampaignsTable } from "../persistence/schema";

/**
 * True when any campaign of the event has an enrollment close date in the past.
 * Date-only values are interpreted as end-of-day Italy time (T23:59:59+01:00).
 */
export function isEnrollmentClosed(campaigns: { enrollmentCloseDate: string | null }[], now: Date = new Date()): boolean {
  return campaigns.length > 0 && campaigns.some((c) => {
    if (!c.enrollmentCloseDate) return false;
    const raw = c.enrollmentCloseDate as string;
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59+01:00` : raw;
    const closeDate = new Date(dateStr);
    if (isNaN(closeDate.getTime())) return false;
    return closeDate < now;
  });
}

export async function isEventEnrollmentClosed(tenantDb: any, eventId: string): Promise<boolean> {
  const campaigns = await tenantDb
    .select({ enrollmentCloseDate: eventCampaignsTable.enrollmentCloseDate })
    .from(eventCampaignsTable)
    .where(eq(eventCampaignsTable.eventId, eventId as any));
  return isEnrollmentClosed(campaigns);
}

export async function checkEnrollmentOpen(
  tenantDb: any,
  categoryId: string,
  set: any
): Promise<{ blocked: boolean }> {
  const [catRow] = await tenantDb
    .select({ eventId: categoriesTable.eventId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any))
    .limit(1);

  if (!catRow) {
    set.status = 422;
    set.body = { error: "Invalid category" };
    return { blocked: true };
  }

  if (await isEventEnrollmentClosed(tenantDb, catRow.eventId)) {
    set.status = 403;
    set.body = { error: "Enrollment period is closed" };
    return { blocked: true };
  }

  return { blocked: false };
}
