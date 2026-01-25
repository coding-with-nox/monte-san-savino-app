import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

interface StaffCheckinProps {
  language: Language;
}

export default function StaffCheckin({ language }: StaffCheckinProps) {
  const [enrollmentId, setEnrollmentId] = useState("");
  const [message, setMessage] = useState("");

  async function checkIn() {
    await api(`/staff/checkin/${enrollmentId}`, { method: "POST" });
    setMessage(t(language, "staffCheckinCompleted"));
    setEnrollmentId("");
  }

  async function printBadge() {
    const res = await api<{ message: string }>(`/staff/print/${enrollmentId}`);
    setMessage(res.message);
  }

  return (
    <Container maxWidth="md">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "staffCheckinTitle")}</Typography>
        <Card>
          <CardContent>
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
                <Button variant="contained" onClick={checkIn} fullWidth>
                  {t(language, "staffCheckinButton")}
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="outlined" onClick={printBadge} fullWidth>
                  {t(language, "staffCheckinPrintButton")}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        {message && <Alert severity="info">{message}</Alert>}
      </Stack>
    </Container>
  );
}
