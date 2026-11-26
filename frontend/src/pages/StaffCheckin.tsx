import React, { useState } from "react";
import {
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { openHtmlExport } from "../lib/exports";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import useToast from "../components/useToast";
import { ActionButton } from "../components/ActionButton";

interface StaffCheckinProps {
  language: Language;
}

export default function StaffCheckin({ language }: StaffCheckinProps) {
  const toast = useToast();
  const [enrollmentId, setEnrollmentId] = useState("");

  async function checkIn() {
    const id = enrollmentId.trim();
    if (!id) {
      toast.error(t(language, "staffCheckinIdRequired"));
      return;
    }
    try {
      await api(`/staff/checkin/${encodeURIComponent(id)}`, { method: "POST" });
      toast.success(t(language, "staffCheckinCompleted"));
      setEnrollmentId("");
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  async function printBadge() {
    const id = enrollmentId.trim();
    if (!id) {
      toast.error(t(language, "staffCheckinIdRequired"));
      return;
    }
    try {
      await openHtmlExport(`/staff/print/${encodeURIComponent(id)}`);
    } catch (err: any) {
      const status = err?.status;
      const fallback = status === 404 ? t(language, "staffBadgeNotFound") : status === 422 ? t(language, "staffBadgeUnavailable") : "";
      toast.error(err?.message || fallback || String(err));
    }
  }

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "staffCheckinTitle")}</Typography>
        <SectionCard title={t(language, "staffCheckinButton")}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6} data-tour="checkin-id">
              <TextField
                label={t(language, "staffCheckinEnrollmentPlaceholder")}
                value={enrollmentId}
                onChange={(event) => setEnrollmentId(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <ActionButton tip={t(language, "tipCheckin")} data-tour="checkin-confirm" variant="contained" size="large" onClick={checkIn} fullWidth>
                {t(language, "staffCheckinButton")}
              </ActionButton>
            </Grid>
            <Grid item xs={12} md={3}>
              <ActionButton tip={t(language, "tipPrintBadge")} data-tour="checkin-print" variant="outlined" onClick={printBadge} fullWidth>
                {t(language, "staffCheckinPrintButton")}
              </ActionButton>
            </Grid>
          </Grid>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
