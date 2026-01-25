import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api, API_BASE } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string };
type Category = { id: string; eventId: string; name: string };
type Enrollment = { id: string; eventId: string; status: string; userId: string };
type User = { id: string; email: string; role: string; isActive: boolean };

interface AdminProps {
  language: Language;
}

export default function Admin({ language }: AdminProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [eventForm, setEventForm] = useState({ name: "", status: "" });
  const [categoryForm, setCategoryForm] = useState({ eventId: "", name: "" });
  const [judgeAssignment, setJudgeAssignment] = useState({ eventId: "", judgeId: "" });
  const [message, setMessage] = useState("");

  async function load() {
    setEvents(await api<Event[]>("/events"));
    setCategories(await api<Category[]>("/categories"));
    setEnrollments(await api<Enrollment[]>("/admin/enrollments"));
    setUsers(await api<User[]>("/admin/users"));
  }

  async function createEvent() {
    await api("/events", { method: "POST", body: JSON.stringify(eventForm) });
    setEventForm({ name: "", status: "" });
    await load();
  }

  async function createCategory() {
    await api("/categories", { method: "POST", body: JSON.stringify(categoryForm) });
    setCategoryForm({ eventId: "", name: "" });
    await load();
  }

  async function updateEnrollment(id: string, status: string) {
    await api(`/admin/enrollments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  }

  async function assignJudge() {
    await api("/admin/judges/assignments", { method: "POST", body: JSON.stringify(judgeAssignment) });
    setJudgeAssignment({ eventId: "", judgeId: "" });
    setMessage(t(language, "adminJudgeAssigned"));
  }

  async function resetPassword(userId: string) {
    const res = await api<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`, { method: "POST" });
    setMessage(`${t(language, "adminTempPassword")}: ${res.temporaryPassword}`);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  const enrollmentStatuses = ["pending", "approved", "rejected", "paid"];

  return (
    <Container maxWidth="xl">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "adminTitle")}</Typography>
        {message && <Alert severity="info">{message}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminEventsTitle")}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <TextField
                      label={t(language, "adminEventNamePlaceholder")}
                      value={eventForm.name}
                      onChange={(event) => setEventForm({ ...eventForm, name: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label={t(language, "adminEventStatusPlaceholder")}
                      value={eventForm.status}
                      onChange={(event) => setEventForm({ ...eventForm, status: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button variant="contained" onClick={createEvent} fullWidth>
                      {t(language, "adminEventCreateButton")}
                    </Button>
                  </Grid>
                </Grid>
                <List dense sx={{ mt: 2 }}>
                  {events.map((event) => (
                    <ListItem key={event.id} disableGutters>
                      <ListItemText primary={event.name} secondary={event.status} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminCategoriesTitle")}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <TextField
                      label={t(language, "adminCategoryEventPlaceholder")}
                      value={categoryForm.eventId}
                      onChange={(event) => setCategoryForm({ ...categoryForm, eventId: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label={t(language, "adminCategoryNamePlaceholder")}
                      value={categoryForm.name}
                      onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button variant="contained" onClick={createCategory} fullWidth>
                      {t(language, "adminCategoryCreateButton")}
                    </Button>
                  </Grid>
                </Grid>
                <List dense sx={{ mt: 2 }}>
                  {categories.map((category) => (
                    <ListItem key={category.id} disableGutters>
                      <ListItemText primary={category.name} secondary={category.eventId} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminEnrollmentsTitle")}
                </Typography>
                <Stack spacing={2}>
                  {enrollments.map((enrollment) => (
                    <Stack key={enrollment.id} spacing={1}>
                      <Typography variant="subtitle2">
                        {enrollment.eventId} — {enrollment.status}
                      </Typography>
                      <Grid container spacing={1}>
                        {enrollmentStatuses.map((status) => (
                          <Grid item key={status}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => updateEnrollment(enrollment.id, status)}
                            >
                              {status}
                            </Button>
                          </Grid>
                        ))}
                      </Grid>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminJudgeAssignTitle")}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <TextField
                      label={t(language, "adminJudgeEventPlaceholder")}
                      value={judgeAssignment.eventId}
                      onChange={(event) => setJudgeAssignment({ ...judgeAssignment, eventId: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField
                      label={t(language, "adminJudgeIdPlaceholder")}
                      value={judgeAssignment.judgeId}
                      onChange={(event) => setJudgeAssignment({ ...judgeAssignment, judgeId: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button variant="contained" onClick={assignJudge} fullWidth>
                      {t(language, "adminJudgeAssignButton")}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminUsersTitle")}
                </Typography>
                <Stack spacing={1}>
                  {users.map((user) => (
                    <Stack key={user.id} direction="row" spacing={2} alignItems="center">
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {user.email} — {user.role}
                      </Typography>
                      <Button variant="outlined" size="small" onClick={() => resetPassword(user.id)}>
                        {t(language, "adminResetPasswordButton")}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminExportTitle")}
                </Typography>
                <Stack spacing={1}>
                  <Link href={`${API_BASE}/exports/enrollments`} target="_blank" rel="noreferrer">
                    {t(language, "adminExportEnrollments")}
                  </Link>
                  <Link href={`${API_BASE}/exports/models`} target="_blank" rel="noreferrer">
                    {t(language, "adminExportModels")}
                  </Link>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
}
