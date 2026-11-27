/**
 * Self-registration status and public landing page. Pure rules, no I/O.
 *
 * `registrationStatus` = "open" | "openday" | "closed" (default "open"):
 *  - "closed": POST /auth/register and enrollment writes by non-privileged users are refused (REGISTRATION_CLOSED);
 *  - "openday" behaves like "open".
 * `defaultPublicPage` = "login" | "register" (default "login"): the page the public site opens first.
 */

export const REGISTRATION_STATUS_KEY = "registrationStatus";
export const DEFAULT_PUBLIC_PAGE_KEY = "defaultPublicPage";

export const REGISTRATION_STATUSES = ["open", "openday", "closed"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const PUBLIC_PAGES = ["login", "register"] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

export function parseRegistrationStatus(raw: string | null | undefined): RegistrationStatus {
  return (REGISTRATION_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as RegistrationStatus) : "open";
}

export function parseDefaultPublicPage(raw: string | null | undefined): PublicPage {
  return raw === "register" ? "register" : "login";
}

/** GET /public/registration: `defaultPage` is "register" for openday or when the setting says so. */
export function publicRegistration(status: RegistrationStatus, defaultPublicPage: PublicPage): { status: RegistrationStatus; defaultPage: PublicPage } {
  const defaultPage: PublicPage = status === "openday" || defaultPublicPage === "register" ? "register" : "login";
  return { status, defaultPage };
}

/** PUT /admin/settings validation: error message for an invalid value, else null. */
export function registrationSettingError(entries: [string, string][]): string | null {
  for (const [key, value] of entries) {
    if (key === REGISTRATION_STATUS_KEY && !(REGISTRATION_STATUSES as readonly string[]).includes(value)) {
      return `${REGISTRATION_STATUS_KEY} must be one of ${REGISTRATION_STATUSES.join(", ")}`;
    }
    if (key === DEFAULT_PUBLIC_PAGE_KEY && !(PUBLIC_PAGES as readonly string[]).includes(value)) {
      return `${DEFAULT_PUBLIC_PAGE_KEY} must be one of ${PUBLIC_PAGES.join(", ")}`;
    }
  }
  return null;
}
