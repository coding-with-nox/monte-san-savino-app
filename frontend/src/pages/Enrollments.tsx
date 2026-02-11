import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
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

type Event = { id: string; name: string; status: string };
type Model = { id: string; name: string; categoryId: string };
type Category = { id: string; eventId: string; name: string; status: string };

interface EnrollmentsProps {
  language: Language;
}

export default function Enrollments({ language }: EnrollmentsProps) {
  const [eventId, setEventId] = useState("");
  const [modelId, setModelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    setEnrollments(await api<Enrollment[]>("/enrollments"));
  }

  async function loadEvents() {
    try {
      setActiveEvents(await api<Event[]>("/public/events"));
      setAllEvents(await api<Event[]>("/public/events?status=all"));
    } catch {
      setActiveEvents([]);
      setAllEvents([]);
    }
  }

  async function loadModels() {
    try {
      setModels(await api<Model[]>("/models"));
    } catch {
      setModels([]);
    }
  }

  async function loadCategories() {
    try {
      setCategories(await api<Category[]>("/public/categories"));
    } catch {
      setCategories([]);
    }
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
    loadEvents();
    loadModels();
    loadCategories();
  }, []);

  const getEventName = (id: string) => {
    const ev = allEvents.find((e) => e.id === id);
    return ev ? ev.name : id.slice(0, 8);
  };

  const getModelName = (id: string | null | undefined) => {
    if (!id) return "";
    const m = models.find((model) => model.id === id);
    return m ? m.name : id.slice(0, 8);
  };

  const getCategoryName = (id: string | null | undefined) => {
    if (!id) return "";
    const c = categories.find((cat) => cat.id === id);
    return c ? c.name : id.slice(0, 8);
  };

  // Split enrollments into active and past
  const activeEventIds = new Set(activeEvents.map((e) => e.id));
  const activeEnrollments = enrollments.filter((e) => activeEventIds.has(e.eventId));
  const pastEnrollments = enrollments.filter((e) => !activeEventIds.has(e.eventId));

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "enrollmentsTitle")}</Typography>
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>{t(language, "enrollmentsEventSelect")}</InputLabel>
                  <Select
                    value={eventId}
                    label={t(language, "enrollmentsEventSelect")}
                    onChange={(e) => setEventId(e.target.value)}
                  >
                    {activeEvents.map((ev) => (
                      <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t(language, "enrollmentsModelSelect")}</InputLabel>
                  <Select
                    value={modelId}
                    label={t(language, "enrollmentsModelSelect")}
                    onChange={(e) => setModelId(e.target.value)}
                  >
                    <MenuItem value="">&mdash;</MenuItem>
                    {models.map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t(language, "enrollmentsCategorySelect")}</InputLabel>
                  <Select
                    value={categoryId}
                    label={t(language, "enrollmentsCategorySelect")}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <MenuItem value="">&mdash;</MenuItem>
                    {categories.filter((c) => c.status === "open").map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="contained" onClick={enroll} fullWidth disabled={!eventId}>
                  {t(language, "enrollmentsButton")}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Active enrollments */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t(language, "enrollmentsListTitle")}
            </Typography>
            <List dense>
              {activeEnrollments.map((enrollment) => (
                <ListItem key={enrollment.id} disableGutters>
                  <ListItemText
                    primary={getEventName(enrollment.eventId)}
                    secondary={[
                      getModelName(enrollment.modelId),
                      getCategoryName(enrollment.categoryId),
                      enrollment.checkedIn ? t(language, "enrollmentsCheckedIn") : ""
                    ].filter(Boolean).join(" — ") || undefined}
                  />
                  <Chip
                    label={enrollment.status}
                    size="small"
                    color={
                      enrollment.status === "approved" ? "success"
                        : enrollment.status === "pending" ? "warning"
                        : enrollment.status === "paid" ? "info"
                        : enrollment.status === "rejected" ? "error"
                        : "default"
                    }
                    sx={{ ml: 1 }}
                  />
                </ListItem>
              ))}
              {activeEnrollments.length === 0 && (
                <Typography variant="body2" color="text.secondary">—</Typography>
              )}
            </List>
          </CardContent>
        </Card>

        {/* Past enrollments */}
        {pastEnrollments.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t(language, "enrollmentsPastTitle")}
              </Typography>
              <List dense>
                {pastEnrollments.map((enrollment) => (
                  <ListItem key={enrollment.id} disableGutters>
                    <ListItemText
                      primary={getEventName(enrollment.eventId)}
                      secondary={[
                        getModelName(enrollment.modelId),
                        getCategoryName(enrollment.categoryId),
                        enrollment.checkedIn ? t(language, "enrollmentsCheckedIn") : ""
                      ].filter(Boolean).join(" — ") || undefined}
                    />
                    <Chip
                      label={enrollment.status}
                      size="small"
                      color="default"
                      sx={{ ml: 1 }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}
      </Stack>
    </Container>
  );
}
