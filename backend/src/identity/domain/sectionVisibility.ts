import { ROLES, type Role } from "./Role";

/** Stable keys of the app sections whose visibility the admin can configure per role. */
export const SECTIONS = [
  "dashboard", "stats", "judge", "podium", "enrollments", "models",
  "labels", "checkin", "users", "teams", "settings", "admin"
] as const;
export type Section = (typeof SECTIONS)[number];
export type SectionVisibility = Record<Role, Section[]>;

const USER: Section[] = ["dashboard", "models", "enrollments", "teams"];
const STAFF: Section[] = [...USER, "checkin"];
const JUDGE: Section[] = [...STAFF, "judge"];

/** Mirrors the navigation before visibility became configurable. */
export const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
  user: USER,
  staff: STAFF,
  judge: JUDGE,
  jury_president: [...JUDGE, "stats"],
  manager: SECTIONS.filter((s) => s !== "settings"),
  admin: [...SECTIONS]
};

/** Merges the stored JSON over the defaults; unknown roles/sections are ignored. Admin always sees everything. */
export function parseSectionVisibility(value: string | null | undefined): SectionVisibility {
  let stored: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(value ?? "");
    if (parsed && typeof parsed === "object") stored = parsed;
  } catch {
    // missing or malformed setting: defaults
  }
  const out = {} as SectionVisibility;
  for (const role of ROLES) {
    const list = stored[role];
    out[role] = role !== "admin" && Array.isArray(list)
      ? SECTIONS.filter((s) => list.includes(s))
      : [...DEFAULT_SECTION_VISIBILITY[role]];
  }
  return out;
}

/** Returns the first unknown role or section of an admin update, or null when valid. */
export function findInvalidVisibilityEntry(input: Record<string, string[]>): string | null {
  for (const [role, sections] of Object.entries(input)) {
    if (!(ROLES as readonly string[]).includes(role)) return role;
    const bad = sections.find((s) => !(SECTIONS as readonly string[]).includes(s));
    if (bad !== undefined) return bad;
  }
  return null;
}
