import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Link,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api, API_BASE } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string };
type Category = { id: string; eventId: string; name: string; status: string };
type Enrollment = { id: string; eventId: string; status: string; userId: string };
type User = { id: string; email: string; role: string; isActive: boolean };
type Sponsor = { id: string; eventId: string; name: string; tier: string };
type SpecialMention = { id: string; eventId: string; modelId: string; title: string };
type ModificationRequest = { id: string; modelId: string; judgeId: string; reason: string; status: string };

interface AdminProps {
  language: Language;
}

export default function Admin({ language }: AdminProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [modRequests, setModRequests] = useState<ModificationRequest[]>([]);

  const [eventForm, setEventForm] = useState({ name: "", status: "" });
  const [categoryForm, setCategoryForm] = useState({ eventId: "", name: "" });
  const [judgeAssignment, setJudgeAssignment] = useState({ eventId: "", judgeId: "", categoryId: "" });
  const [sponsorForm, setSponsorForm] = useState({ eventId: "", name: "", tier: "bronze" });
  const [mentionForm, setMentionForm] = useState({ eventId: "", modelId: "", title: "" });
  const [message, setMessage] = useState("");

  async function load() {
    setEvents(await api<Event[]>("/events"));
    setCategories(await api<Category[]>("/categories"));
    setEnrollments(await api<Enrollment[]>("/admin/enrollments"));
    setUsers(await api<User[]>("/admin/users"));
    setSponsors(await api<Sponsor[]>("/sponsors"));
    setModRequests(await api<ModificationRequest[]>("/admin/modification-requests"));
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
    const body: Record<string, string> = { eventId: judgeAssignment.eventId, judgeId: judgeAssignment.judgeId };
    if (judgeAssignment.categoryId) body.categoryId = judgeAssignment.categoryId;
    await api("/admin/judges/assignments", { method: "POST", body: JSON.stringify(body) });
    setJudgeAssignment({ eventId: "", judgeId: "", categoryId: "" });
    setMessage(t(language, "adminJudgeAssigned"));
  }

  async function resetPassword(userId: string) {
    const res = await api<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`, { method: "POST" });
    setMessage(`${t(language, "adminTempPassword")}: ${res.temporaryPassword}`);
  }

  async function createSponsor() {
    await api("/sponsors", { method: "POST", body: JSON.stringify(sponsorForm) });
    setSponsorForm({ eventId: "", name: "", tier: "bronze" });
    await load();
  }

  async function deleteSponsor(id: string) {
    await api(`/sponsors/${id}`, { method: "DELETE" });
    await load();
  }

  async function createMention() {
    await api("/awards/mentions", { method: "POST", body: JSON.stringify(mentionForm) });
    setMentionForm({ eventId: "", modelId: "", title: "" });
    setMessage(t(language, "adminMentionCreate"));
  }

  async function toggleCategoryStatus(cat: Category) {
    const newStatus = cat.status === "open" ? "closed" : "open";
    try {
      await api(`/categories/${cat.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      await load();
    } catch {
      setMessage(t(language, "adminCategoryCloseError"));
    }
  }

  async function updateModRequestStatus(id: string, status: string) {
    await api(`/admin/modification-requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  const enrollmentStatuses = ["pending", "approved", "rejected", "paid"];

  return (
    <Container maxWidth="xl">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "adminTitle")}</Typography>
        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}
        <Grid container spacing={2}>
          {/* Events */}
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

          {/* Categories with Status */}
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
                      <Chip
                        label={category.status === "open" ? t(language, "adminCategoryOpen") : t(language, "adminCategoryClosed")}
                        color={category.status === "open" ? "success" : "default"}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => toggleCategoryStatus(category)}
                      >
                        {category.status === "open" ? t(language, "adminCategoryClose") : t(language, "adminCategoryReopen")}
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Enrollments */}
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

          {/* Judge Assignments (with optional category) */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminJudgeAssignTitle")}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminJudgeEventPlaceholder")}
                      value={judgeAssignment.eventId}
                      onChange={(event) => setJudgeAssignment({ ...judgeAssignment, eventId: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminJudgeIdPlaceholder")}
                      value={judgeAssignment.judgeId}
                      onChange={(event) => setJudgeAssignment({ ...judgeAssignment, judgeId: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminJudgeCategoryPlaceholder")}
                      value={judgeAssignment.categoryId}
                      onChange={(event) => setJudgeAssignment({ ...judgeAssignment, categoryId: event.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button variant="contained" onClick={assignJudge} fullWidth>
                      {t(language, "adminJudgeAssignButton")}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Sponsors */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminSponsorsTitle")}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminSponsorEvent")}
                      value={sponsorForm.eventId}
                      onChange={(e) => setSponsorForm({ ...sponsorForm, eventId: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminSponsorName")}
                      value={sponsorForm.name}
                      onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Select
                      value={sponsorForm.tier}
                      onChange={(e) => setSponsorForm({ ...sponsorForm, tier: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="bronze">Bronze</MenuItem>
                      <MenuItem value="silver">Silver</MenuItem>
                      <MenuItem value="gold">Gold</MenuItem>
                      <MenuItem value="platinum">Platinum</MenuItem>
                    </Select>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button variant="contained" onClick={createSponsor} fullWidth>
                      {t(language, "adminSponsorCreate")}
                    </Button>
                  </Grid>
                </Grid>
                <List dense sx={{ mt: 2 }}>
                  {sponsors.map((s) => (
                    <ListItem key={s.id} disableGutters>
                      <ListItemText primary={s.name} secondary={`${s.tier} — ${s.eventId}`} />
                      <Button variant="outlined" size="small" color="error" onClick={() => deleteSponsor(s.id)}>
                        X
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Special Mentions */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminSpecialMentionsTitle")}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminMentionEvent")}
                      value={mentionForm.eventId}
                      onChange={(e) => setMentionForm({ ...mentionForm, eventId: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminMentionModel")}
                      value={mentionForm.modelId}
                      onChange={(e) => setMentionForm({ ...mentionForm, modelId: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label={t(language, "adminMentionTitle")}
                      value={mentionForm.title}
                      onChange={(e) => setMentionForm({ ...mentionForm, title: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button variant="contained" onClick={createMention} fullWidth>
                      {t(language, "adminMentionCreate")}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Users */}
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

          {/* Modification Requests */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminModRequestsTitle")}
                </Typography>
                <Stack spacing={1}>
                  {modRequests.map((req) => (
                    <Stack key={req.id} spacing={1}>
                      <Typography variant="body2">
                        Model: {req.modelId.slice(0, 8)} — {req.reason}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={req.status}
                          size="small"
                          color={req.status === "pending" ? "warning" : req.status === "resolved" ? "success" : "default"}
                        />
                        {req.status === "pending" && (
                          <>
                            <Button size="small" variant="outlined" onClick={() => updateModRequestStatus(req.id, "resolved")}>
                              {t(language, "adminModRequestResolved")}
                            </Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => updateModRequestStatus(req.id, "rejected")}>
                              {t(language, "adminModRequestRejected")}
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Export */}
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
