import { Language, t } from "./i18n";

/** Human label for a role code; roles without a translation are shown as-is. */
export function roleLabel(language: Language, role: string) {
  return role === "jury_president" ? t(language, "roleJuryPresident") : role;
}
