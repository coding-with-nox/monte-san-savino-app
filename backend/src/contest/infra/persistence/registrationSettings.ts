import { eq } from "drizzle-orm";
import { settingsTable } from "./schema";
import {
  DEFAULT_PUBLIC_PAGE_KEY, parseDefaultPublicPage, parseRegistrationStatus, publicRegistration, REGISTRATION_STATUS_KEY,
  type PublicPage, type RegistrationStatus
} from "../../domain/registration";

export async function loadSettingValue(tenantDb: any, key: string): Promise<string | null> {
  const [row] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function loadRegistrationStatus(tenantDb: any): Promise<RegistrationStatus> {
  return parseRegistrationStatus(await loadSettingValue(tenantDb, REGISTRATION_STATUS_KEY));
}

export async function isRegistrationClosed(tenantDb: any): Promise<boolean> {
  return (await loadRegistrationStatus(tenantDb)) === "closed";
}

export async function loadPublicRegistration(tenantDb: any): Promise<{ status: RegistrationStatus; defaultPage: PublicPage }> {
  const status = await loadRegistrationStatus(tenantDb);
  const defaultPublicPage = parseDefaultPublicPage(await loadSettingValue(tenantDb, DEFAULT_PUBLIC_PAGE_KEY));
  return publicRegistration(status, defaultPublicPage);
}
