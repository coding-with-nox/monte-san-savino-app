import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Enrollment = {
  id: string;
  eventId: string;
  modelId?: string | null;
  categoryId?: string | null;
  status: string;
  checkedIn: boolean;
};

interface EnrollmentsProps {
  language: Language;
}

export default function Enrollments({ language }: EnrollmentsProps) {
  const [eventId, setEventId] = useState("");
  const [modelId, setModelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    setEnrollments(await api<Enrollment[]>("/enrollments"));
  }

  async function enroll() {
    await api(`/events/${eventId}/enroll`, { method: "POST", body: JSON.stringify({ modelId: modelId || undefined, categoryId: categoryId || undefined }) });
    setEventId("");
    setModelId("");
    setCategoryId("");
    await load();
    setMessage(t(language, "enrollmentsSubmitted"));
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "enrollmentsTitle")}</Typography>
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  label={t(language, "enrollmentsEventPlaceholder")}
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label={t(language, "enrollmentsModelPlaceholder")}
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label={t(language, "enrollmentsCategoryPlaceholder")}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={enroll}>
                  {t(language, "enrollmentsButton")}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t(language, "enrollmentsListTitle")}
            </Typography>
            <List dense>
              {enrollments.map((enrollment) => (
                <ListItem key={enrollment.id} disableGutters>
                  <ListItemText
                    primary={`${enrollment.eventId} — ${enrollment.status}`}
                    secondary={enrollment.checkedIn ? t(language, "enrollmentsCheckedIn") : undefined}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
        {message && <Alert severity="info">{message}</Alert>}
      </Stack>
    </Container>
  );
}
