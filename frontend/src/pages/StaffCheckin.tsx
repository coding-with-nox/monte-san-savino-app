import React, { useState } from "react";
import {
  Button,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import useToast from "../components/useToast";

interface StaffCheckinProps {
  language: Language;
}

export default function StaffCheckin({ language }: StaffCheckinProps) {
  const toast = useToast();
  const [enrollmentId, setEnrollmentId] = useState("");

  async function checkIn() {
    try {
      await api(`/staff/checkin/${enrollmentId}`, { method: "POST" });
      toast.success(t(language, "staffCheckinCompleted"));
      setEnrollmentId("");
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  async function printBadge() {
    try {
      const res = await api<{ message: string }>(`/staff/print/${enrollmentId}`);
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "staffCheckinTitle")}</Typography>
        <SectionCard title="Check-in">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                label={t(language, "staffCheckinEnrollmentPlaceholder")}
                value={enrollmentId}
                onChange={(event) => setEnrollmentId(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button variant="contained" size="large" onClick={checkIn} fullWidth>
                {t(language, "staffCheckinButton")}
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button variant="outlined" onClick={printBadge} fullWidth>
                {t(language, "staffCheckinPrintButton")}
              </Button>
            </Grid>
          </Grid>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
