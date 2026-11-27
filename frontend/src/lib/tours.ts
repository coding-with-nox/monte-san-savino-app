import { Role, roleAtLeast, roleReaches } from "./auth";
import { Permission, hasPermission } from "./access";

/**
 * Guided tour definitions, one per page or tab. Texts live in i18n: `${key}Name` / `${key}Desc`
 * for the tour and `${stepKey}Title` / `${stepKey}Text` for each step. The /help page is generated
 * from these same definitions.
 */
export type TourCondition = "manager" | "overview" | "judgeOnly" | "basic" | "signedIn" | Permission;

export type TourStepDef = { target: string; key: string; only?: TourCondition };

export type TourDef = {
  id: string;
  key: string;
  path: string;
  /** Tab or panel inside the page: the tour applies while [data-tour-scope=scope] is visible. */
  scope?: string;
  /** Minimum role; null = public. */
  audience: Role | null;
  /** Section of the backend visibility matrix. */
  section?: string;
  /** Where the help page sends the user to start this tour (default: path). */
  helpPath?: string;
  steps: TourStepDef[];
};

export type TourContext = { role: Role | null; permissions: string[]; sections: string[] | null };

export const TOURS: TourDef[] = [
  {
    id: "login", key: "tourLogin", path: "/login", audience: null,
    steps: [
      { target: "login-form", key: "tourLoginLoginForm" },
      { target: "login-submit", key: "tourLoginLoginSubmit" },
      { target: "login-signup", key: "tourLoginLoginSignup" }
    ]
  },
  {
    id: "home", key: "tourHome", path: "/", audience: "user",
    steps: [
      { target: "dash-event", key: "tourHomeDashEvent", only: "overview" },
      { target: "dash-judge-categories", key: "tourHomeDashJudgeCategories", only: "judgeOnly" },
      { target: "dash-judge-go", key: "tourHomeDashJudgeGo", only: "judgeOnly" },
      { target: "dash-models", key: "tourHomeDashModels", only: "basic" },
      { target: "dash-enrollments", key: "tourHomeDashEnrollments", only: "basic" },
      { target: "dash-actions", key: "tourHomeDashActions" }
    ]
  },
  {
    id: "models", key: "tourModels", path: "/models", audience: "user", section: "models",
    steps: [
      { target: "models-new", key: "tourModelsModelsNew" },
      { target: "models-list", key: "tourModelsModelsList" },
      { target: "models-print", key: "tourModelsModelsPrint" }
    ]
  },
  {
    id: "models-wizard", key: "tourModelsWizard", path: "/models", scope: "models-wizard", audience: "user", section: "models", helpPath: "/models?new=1",
    steps: [
      { target: "wizard-stepper", key: "tourModelsWizardWizardStepper" },
      { target: "wizard-owner", key: "tourModelsWizardWizardOwner", only: "enrollOnBehalf" },
      { target: "wizard-fields", key: "tourModelsWizardWizardFields" },
      { target: "wizard-nav", key: "tourModelsWizardWizardNav" }
    ]
  },
  {
    id: "enrollments", key: "tourEnrollments", path: "/enrollments", audience: "user", section: "enrollments",
    steps: [
      { target: "enr-new", key: "tourEnrollmentsEnrNew" },
      { target: "enr-list", key: "tourEnrollmentsEnrList" },
      { target: "enr-fee", key: "tourEnrollmentsEnrFee" },
      { target: "enr-export", key: "tourEnrollmentsEnrExport" },
      { target: "enr-manage", key: "tourEnrollmentsEnrManage", only: "manager" }
    ]
  },
  {
    id: "events", key: "tourEvents", path: "/public-events", audience: null,
    steps: [
      { target: "events-list", key: "tourEventsEventsList" },
      { target: "events-refresh", key: "tourEventsEventsRefresh" }
    ]
  },
  {
    id: "teams", key: "tourTeams", path: "/teams", audience: "user",
    steps: [
      { target: "teams-new", key: "tourTeamsTeamsNew" },
      { target: "teams-list", key: "tourTeamsTeamsList" }
    ]
  },
  {
    id: "checkin", key: "tourCheckin", path: "/staff-checkin", audience: "staff", section: "checkin",
    steps: [
      { target: "checkin-number", key: "tourCheckinCheckinNumber" },
      { target: "checkin-counter", key: "tourCheckinCheckinCounter" }
    ]
  },
  {
    id: "judge", key: "tourJudge", path: "/judge", audience: "judge", section: "judge",
    steps: [
      { target: "judge-filters", key: "tourJudgeJudgeFilters" },
      { target: "judge-search", key: "tourJudgeJudgeSearch" },
      { target: "judge-grid", key: "tourJudgeJudgeGrid" },
      { target: "judge-complete", key: "tourJudgeJudgeComplete" }
    ]
  },
  {
    id: "judge-score", key: "tourJudgeScore", path: "/judge", scope: "judge-score", audience: "judge", section: "judge", helpPath: "/judge",
    steps: [
      { target: "score-mode", key: "tourJudgeScoreScoreMode" },
      { target: "score-values", key: "tourJudgeScoreScoreValues" },
      { target: "score-models", key: "tourJudgeScoreScoreModels" },
      { target: "score-submit", key: "tourJudgeScoreScoreSubmit" },
      { target: "score-back", key: "tourJudgeScoreScoreBack" }
    ]
  },
  {
    id: "users", key: "tourUsers", path: "/users", audience: "manager", section: "users",
    steps: [
      { target: "users-list", key: "tourUsersUsersList" },
      { target: "users-new", key: "tourUsersUsersNew" },
      { target: "users-export", key: "tourUsersUsersExport" }
    ]
  },
  {
    id: "admin-events", key: "tourAdminEvents", path: "/admin", scope: "admin-events", audience: "manager", section: "admin", helpPath: "/admin?tab=events",
    steps: [
      { target: "admin-tabs", key: "tourAdminEventsAdminTabs" },
      { target: "admin-events-form", key: "tourAdminEventsAdminEventsForm" },
      { target: "admin-categories", key: "tourAdminEventsAdminCategories" },
      { target: "admin-campaigns", key: "tourAdminEventsAdminCampaigns" }
    ]
  },
  {
    id: "admin-judging", key: "tourAdminJudging", path: "/admin", scope: "admin-judging", audience: "manager", section: "admin", helpPath: "/admin?tab=judging",
    steps: [
      { target: "admin-judging", key: "tourAdminJudgingAdminJudging" },
      { target: "admin-brackets", key: "tourAdminEventsAdminBrackets" }
    ]
  },
  {
    id: "admin-judges", key: "tourAdminJudges", path: "/admin", scope: "admin-judges", audience: "manager", section: "admin", helpPath: "/admin?tab=judges",
    steps: [
      { target: "admin-judges-assign", key: "tourAdminJudgesAdminJudgesAssign" },
      { target: "admin-judges-monitor", key: "tourAdminJudgesAdminJudgesMonitor" }
    ]
  },
  {
    id: "admin-awards", key: "tourAdminAwards", path: "/admin", scope: "admin-awards", audience: "manager", section: "admin", helpPath: "/admin?tab=awards",
    steps: [
      { target: "admin-honors", key: "tourAdminAwardsAdminHonors" },
      { target: "admin-mentions", key: "tourAdminAwardsAdminMentions" },
      { target: "admin-modrequests", key: "tourAdminAwardsAdminModrequests" },
      { target: "admin-corrections", key: "tourAdminAwardsAdminCorrections" }
    ]
  },
  {
    id: "admin-sponsors", key: "tourAdminSponsors", path: "/admin", scope: "admin-sponsors", audience: "manager", section: "admin", helpPath: "/admin?tab=sponsors",
    steps: [
      { target: "admin-sponsors", key: "tourAdminSponsorsAdminSponsors" }
    ]
  },
  {
    id: "admin-catalog", key: "tourAdminCatalog", path: "/admin", scope: "admin-catalog", audience: "manager", section: "admin", helpPath: "/admin?tab=catalog",
    steps: [
      { target: "admin-move", key: "tourAdminCatalogAdminMove" },
      { target: "admin-import", key: "tourAdminCatalogAdminImport" },
      { target: "admin-levels", key: "tourAdminCatalogAdminLevels" },
      { target: "admin-roles", key: "tourAdminCatalogAdminRoles" }
    ]
  },
  {
    id: "admin-rules", key: "tourAdminRules", path: "/admin", scope: "admin-rules", audience: "admin", section: "admin", helpPath: "/admin?tab=rules",
    steps: [
      { target: "rules-fee", key: "tourAdminRulesRulesFee" },
      { target: "rules-visibility", key: "tourAdminRulesRulesVisibility" },
      { target: "rules-permissions", key: "tourAdminRulesRulesPermissions" },
      { target: "rules-prize", key: "tourAdminRulesRulesPrize" }
    ]
  },
  {
    id: "labels", key: "tourLabels", path: "/labels", audience: "manager", section: "labels",
    steps: [
      { target: "labels-event", key: "tourLabelsLabelsEvent" },
      { target: "labels-actions", key: "tourLabelsLabelsActions" }
    ]
  },
  {
    id: "stats", key: "tourStats", path: "/stats", audience: "jury_president", section: "stats",
    steps: [
      { target: "stats-kpis", key: "tourStatsStatsKpis" },
      { target: "stats-charts", key: "tourStatsStatsCharts" },
      { target: "stats-filter", key: "tourStatsStatsFilter" },
      { target: "stats-projection", key: "tourStatsStatsProjection" },
      { target: "stats-zero", key: "tourStatsStatsZero" }
    ]
  },
  {
    id: "podium", key: "tourPodium", path: "/podium", audience: "manager", section: "podium",
    steps: [
      { target: "podium-event", key: "tourPodiumPodiumEvent" },
      { target: "podium-start", key: "tourPodiumPodiumStart" },
      { target: "podium-exit", key: "tourPodiumPodiumExit" }
    ]
  },
  {
    id: "settings-general", key: "tourSettingsGeneral", path: "/settings", scope: "settings-general", audience: "admin", section: "settings", helpPath: "/settings?tab=general",
    steps: [
      { target: "settings-tabs", key: "tourSettingsGeneralSettingsTabs" },
      { target: "settings-general", key: "tourSettingsGeneralSettingsGeneral" }
    ]
  },
  {
    id: "settings-theme", key: "tourSettingsTheme", path: "/settings", scope: "settings-theme", audience: "admin", section: "settings", helpPath: "/settings?tab=theme",
    steps: [
      { target: "settings-theme", key: "tourSettingsThemeSettingsTheme" }
    ]
  },
  {
    id: "settings-export", key: "tourSettingsExport", path: "/settings", scope: "settings-export", audience: "admin", section: "settings", helpPath: "/settings?tab=export",
    steps: [
      { target: "settings-export", key: "tourSettingsExportSettingsExport" }
    ]
  },
  {
    id: "settings-team", key: "tourSettingsTeam", path: "/settings", scope: "settings-team", audience: "admin", section: "settings", helpPath: "/settings?tab=team",
    steps: [
      { target: "settings-team", key: "tourSettingsTeamSettingsTeam" }
    ]
  },
  {
    id: "profile", key: "tourProfile", path: "/profile", audience: "user",
    steps: [
      { target: "profile-data", key: "tourProfileProfileData" },
      { target: "profile-social", key: "tourProfileProfileSocial" },
      { target: "profile-edit", key: "tourProfileProfileEdit" }
    ]
  },
  {
    id: "help", key: "tourHelp", path: "/help", audience: null,
    steps: [
      { target: "topbar-nav", key: "tourHelpTopbarNav" },
      { target: "topbar-lang", key: "tourHelpTopbarLang" },
      { target: "topbar-theme", key: "tourHelpTopbarTheme" },
      { target: "topbar-help", key: "tourHelpTopbarHelp" },
      { target: "topbar-account", key: "tourHelpTopbarAccount", only: "signedIn" },
      { target: "help-sections", key: "tourHelpHelpSections" }
    ]
  }
];

export function canSeeTour(tour: TourDef, { role, sections }: TourContext) {
  if (!tour.audience) return true;
  if (!role || !roleReaches(role, tour.audience)) return false;
  return !tour.section || sections === null || role === "admin" || sections.includes(tour.section);
}

function matches(only: TourCondition, { role, permissions }: TourContext) {
  if (!role) return false;
  switch (only) {
    case "signedIn": return true;
    case "manager": return roleAtLeast(role, "manager");
    case "overview": return role === "jury_president" || roleAtLeast(role, "manager");
    case "judgeOnly": return role === "judge";
    case "basic": return role === "user" || role === "staff";
    default: return hasPermission(role, permissions, only);
  }
}

/** Steps of a tour that apply to this role and these permissions. */
export function tourSteps(tour: TourDef, ctx: TourContext) {
  return tour.steps.filter((s) => !s.only || matches(s.only, ctx));
}

/* ---------------- which tours were already shown ---------------- */

export const TOURS_SEEN_KEY = "guidedTours.seen";
/** Set to "true" (e.g. by end-to-end tests) to never start a tour automatically. */
export const TOURS_DISABLED_KEY = "guidedTours.disabled";
// Used only when storage is unavailable, so that a tour still starts at most once per page load.
const memory = new Set<string>();

function readSeen(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(TOURS_SEEN_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function isTourSeen(id: string) {
  return memory.has(id) || readSeen().includes(id);
}

export function markTourSeen(id: string) {
  try {
    const seen = readSeen();
    if (!seen.includes(id)) window.localStorage.setItem(TOURS_SEEN_KEY, JSON.stringify([...seen, id]));
  } catch {
    memory.add(id);
  }
}

export function resetTours() {
  memory.clear();
  try {
    window.localStorage.removeItem(TOURS_SEEN_KEY);
  } catch {
    // storage unavailable: the in-memory list was already cleared
  }
}

export function toursAutoStartDisabled() {
  try {
    return window.localStorage.getItem(TOURS_DISABLED_KEY) === "true";
  } catch {
    return false;
  }
}
