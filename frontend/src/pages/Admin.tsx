import React, { useState } from "react";
import { Alert, Box, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import PageSkeleton from "../components/PageSkeleton";
import { useAdminData } from "./admin/useAdminData";
import EventsTab from "./admin/EventsTab";
import JudgesTab from "./admin/JudgesTab";
import AwardsTab from "./admin/AwardsTab";
import SponsorsTab from "./admin/SponsorsTab";
import CatalogTab from "./admin/CatalogTab";
import RulesTab from "./admin/RulesTab";
import JudgingRulesCard from "./admin/JudgingRulesCard";
import BracketsCard from "./admin/BracketsCard";
import { getRole } from "../lib/auth";
import { ActionButton } from "../components/ActionButton";

type TabKey = "events" | "judges" | "awards" | "sponsors" | "catalog" | "judging" | "rules";

interface AdminProps {
  language: Language;
}

/**
 * Admin shell. Events and categories are shared by several tabs and load once. Every tab loads its
 * own data when it is first opened; afterwards it stays mounted (hidden) so switching back does not
 * refetch anything and keeps the form state.
 */
export default function Admin({ language }: AdminProps) {
  const data = useAdminData(language);
  // "?tab=awards" (help page) opens that tab.
  const [tab, setTab] = useState<TabKey>(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
    const allowed: TabKey[] = ["events", "judges", "awards", "sponsors", "catalog", "judging", ...(getRole() === "admin" ? ["rules" as const] : [])];
    return wanted && allowed.includes(wanted) ? wanted : "events";
  });
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set<TabKey>([tab]));

  const changeTab = (next: TabKey) => {
    setTab(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  };

  const panel = (key: TabKey, content: () => React.ReactNode) =>
    visited.has(key) ? <Box key={key} hidden={tab !== key} data-tour-scope={`admin-${key}`}>{content()}</Box> : null;

  return (
    <PageContainer maxWidth="lg">
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "adminTitle")}</Typography>

        {data.errors.map((section) => (
          <Alert
            key={section}
            severity="error"
            action={<ActionButton tip={t(language, "tipRetry")} color="inherit" size="small" onClick={() => void data.refresh()}>{t(language, "retryButton")}</ActionButton>}
          >
            {t(language, "adminLoadSectionError")}: {section}
          </Alert>
        ))}

        {data.loading && <PageSkeleton variant="table" />}

        {!data.loading && (
          <Paper data-tour="admin-tabs" variant="outlined">
            <Tabs value={tab} onChange={(_, v) => changeTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
              <Tab value="events" label={t(language, "adminTabEvents")} />
              <Tab value="judges" label={t(language, "adminTabJudges")} />
              <Tab value="awards" label={t(language, "adminTabAwards")} />
              <Tab value="sponsors" label={t(language, "adminTabSponsors")} />
              <Tab value="catalog" label={t(language, "adminTabCatalog")} />
              <Tab value="judging" label={t(language, "adminTabJudging")} />
              {getRole() === "admin" && <Tab value="rules" label={t(language, "adminTabRules")} />}
            </Tabs>
          </Paper>
        )}

        {!data.loading && (
          <>
            {panel("events", () => <EventsTab language={language} data={data} />)}
            {panel("judges", () => <JudgesTab language={language} data={data} />)}
            {panel("awards", () => <AwardsTab language={language} data={data} />)}
            {panel("sponsors", () => <SponsorsTab language={language} data={data} />)}
            {panel("catalog", () => <CatalogTab language={language} data={data} />)}
            {panel("judging", () => (
              <Stack spacing={3}>
                <JudgingRulesCard language={language} />
                <BracketsCard language={language} data={data} />
              </Stack>
            ))}
            {panel("rules", () => <RulesTab language={language} />)}
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
