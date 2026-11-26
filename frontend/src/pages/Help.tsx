import React from "react";
import { useNavigate } from "react-router-dom";
import { Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { getRole, Role } from "../lib/auth";
import { Language, t, TranslationKey } from "../lib/i18n";
import { useAccess } from "../lib/access";
import { canSeeTour, TourDef, TOURS, tourSteps } from "../lib/tours";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import { ActionButton } from "../components/ActionButton";

const AUDIENCE: Record<Role, TranslationKey> = {
  user: "audienceUser",
  staff: "audienceStaff",
  judge: "audienceJudge",
  jury_president: "audienceJury",
  manager: "audienceManager",
  admin: "audienceAdmin"
};

/** Documents every feature available to the current user, generated from the tour definitions. */
export default function Help({ language }: { language: Language }) {
  const navigate = useNavigate();
  const { sections, permissions } = useAccess();
  const ctx = { role: getRole(), sections, permissions };
  const tours = TOURS.filter((tour) => canSeeTour(tour, ctx));
  const text = (key: string) => t(language, key as TranslationKey);
  const startTour = (tour: TourDef) => navigate(tour.helpPath ?? tour.path, { state: { startTour: tour.id } });

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "helpTitle")}</Typography>
        <Typography color="text.secondary">{t(language, "helpIntro")}</Typography>
        {tours.map((tour) => (
          <SectionCard
            key={tour.id}
            tourId="help-sections"
            title={text(`${tour.key}Name`)}
            action={
              <ActionButton
                tip={t(language, "tipHelpStart")}
                size="small"
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                aria-label={`${t(language, "helpStart")}: ${text(`${tour.key}Name`)}`}
                onClick={() => startTour(tour)}
              >
                {t(language, "helpStart")}
              </ActionButton>
            }
          >
            <Typography>{text(`${tour.key}Desc`)}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t(language, "helpAudience")}: {t(language, tour.audience ? AUDIENCE[tour.audience] : "audiencePublic")}
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 1.5 }}>{t(language, "helpSteps")}</Typography>
            <ol style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>
              {tourSteps(tour, ctx).map((s) => (
                <Typography key={s.key} component="li" variant="body2">
                  <strong>{text(`${s.key}Title`)}.</strong> {text(`${s.key}Text`)}
                </Typography>
              ))}
            </ol>
          </SectionCard>
        ))}
      </Stack>
    </PageContainer>
  );
}
