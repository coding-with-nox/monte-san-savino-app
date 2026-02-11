import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { api, API_BASE } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string };
type Category = { id: string; eventId: string; name: string; status: string };
type Enrollment = { id: string; eventId: string; status: string; userId: string };
type User = { id: string; email: string; role: string; isActive: boolean };
type Sponsor = { id: string; eventId: string; name: string; tier: string };
type SpecialMention = { id: string; eventId: string; modelId: string; title: string };
type ModificationRequest = { id: string; modelId: string; judgeId: string; reason: string; status: string };

type UserProfile = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
};

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

  // User profile dialog state
  const [profileDialog, setProfileDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});

  // Category edit dialog state
  const [categoryEditDialog, setCategoryEditDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryEditName, setCategoryEditName] = useState("");

  async function load() {
    setEvents(await api<Event[]>("/events"));
    setCategories(await api<Category[]>("/categories"));
    setEnrollments(await api<Enrollment[]>("/admin/enrollments"));
    setUsers(await api<User[]>("/admin/users"));
    setSponsors(await api<Sponsor[]>("/sponsors"));
    setModRequests(await api<ModificationRequest[]>("/admin/modification-requests"));
  }

  async function createEvent() {
    await api("/events", { method: "POST", body: JSON.stringify({ ...eventForm, status: eventForm.status || "draft" }) });
    setEventForm({ name: "", status: "" });
    await load();
  }

  async function updateEventStatus(eventId: string, status: string) {
    await api(`/events/${eventId}`, { method: "PUT", body: JSON.stringify({ status }) });
    await load();
  }

  async function createCategory() {
    await api("/categories", { method: "POST", body: JSON.stringify(categoryForm) });
    setCategoryForm({ eventId: "", name: "" });
    await load();
  }

  async function deleteCategory(categoryId: string) {
    await api(`/categories/${categoryId}`, { method: "DELETE" });
    await load();
  }

  async function openCategoryEdit(cat: Category) {
    setEditingCategory(cat);
    setCategoryEditName(cat.name);
    setCategoryEditDialog(true);
  }

  async function saveCategoryEdit() {
    if (!editingCategory) return;
    await api(`/categories/${editingCategory.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: categoryEditName })
    });
    setCategoryEditDialog(false);
    setEditingCategory(null);
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

  async function updateUserRole(userId: string, role: string) {
    await api(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) });
    await load();
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    await api(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
    await load();
  }

  async function openUserProfile(userId: string) {
    const profile = await api<UserProfile>(`/admin/users/${userId}/profile`);
    setSelectedProfile(profile);
    setProfileForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      city: profile.city,
      address: profile.address,
      emergencyContact: profile.emergencyContact
    });
    setEditingProfile(false);
    setProfileDialog(true);
  }

  async function saveUserProfile() {
    if (!selectedProfile) return;
    await api(`/admin/users/${selectedProfile.id}/profile`, {
      method: "PUT",
      body: JSON.stringify(profileForm)
    });
    setEditingProfile(false);
    await openUserProfile(selectedProfile.id);
    setMessage(t(language, "adminProfileSaved"));
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
  const eventStatuses = ["draft", "active", "closed"];
  const roles = ["user", "staff", "judge", "manager", "admin"];

  const getEventName = (eventId: string) => {
    const ev = events.find((e) => e.id === eventId);
    return ev ? ev.name : eventId.slice(0, 8);
  };

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
                    <FormControl fullWidth>
                      <InputLabel>{t(language, "adminEventStatusPlaceholder")}</InputLabel>
                      <Select
                        value={eventForm.status}
                        label={t(language, "adminEventStatusPlaceholder")}
                        onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
                      >
                        {eventStatuses.map((s) => (
                          <MenuItem key={s} value={s}>{s}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
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
                      <ListItemText primary={event.name} />
                      <FormControl size="small" sx={{ minWidth: 110, ml: 1 }}>
                        <Select
                          value={event.status || "draft"}
                          onChange={(e) => updateEventStatus(event.id, e.target.value)}
                          size="small"
                        >
                          {eventStatuses.map((s) => (
                            <MenuItem key={s} value={s}>{s}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
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
                    <FormControl fullWidth>
                      <InputLabel>{t(language, "adminCategoryEventPlaceholder")}</InputLabel>
                      <Select
                        value={categoryForm.eventId}
                        label={t(language, "adminCategoryEventPlaceholder")}
                        onChange={(e) => setCategoryForm({ ...categoryForm, eventId: e.target.value })}
                      >
                        {events.map((ev) => (
                          <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
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
                    <Button variant="contained" onClick={createCategory} fullWidth disabled={!categoryForm.eventId || !categoryForm.name}>
                      {t(language, "adminCategoryCreateButton")}
                    </Button>
                  </Grid>
                </Grid>
                <List dense sx={{ mt: 2 }}>
                  {categories.map((category) => (
                    <ListItem key={category.id} disableGutters>
                      <ListItemText primary={category.name} secondary={getEventName(category.eventId)} />
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
                        sx={{ mr: 1 }}
                      >
                        {category.status === "open" ? t(language, "adminCategoryClose") : t(language, "adminCategoryReopen")}
                      </Button>
                      <IconButton size="small" onClick={() => openCategoryEdit(category)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteCategory(category.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
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
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">
                          {getEventName(enrollment.eventId)}
                        </Typography>
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
                        />
                      </Stack>
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
                    <FormControl fullWidth>
                      <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
                      <Select
                        value={judgeAssignment.eventId}
                        label={t(language, "adminJudgeEventPlaceholder")}
                        onChange={(e) => setJudgeAssignment({ ...judgeAssignment, eventId: e.target.value })}
                      >
                        {events.map((ev) => (
                          <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>{t(language, "adminJudgeIdPlaceholder")}</InputLabel>
                      <Select
                        value={judgeAssignment.judgeId}
                        label={t(language, "adminJudgeIdPlaceholder")}
                        onChange={(e) => setJudgeAssignment({ ...judgeAssignment, judgeId: e.target.value })}
                      >
                        {users.filter((u) => u.role === "judge" || u.role === "manager" || u.role === "admin").map((u) => (
                          <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>{t(language, "adminJudgeCategoryPlaceholder")}</InputLabel>
                      <Select
                        value={judgeAssignment.categoryId}
                        label={t(language, "adminJudgeCategoryPlaceholder")}
                        onChange={(e) => setJudgeAssignment({ ...judgeAssignment, categoryId: e.target.value })}
                      >
                        <MenuItem value="">{t(language, "adminJudgeAllCategories")}</MenuItem>
                        {categories
                          .filter((c) => !judgeAssignment.eventId || c.eventId === judgeAssignment.eventId)
                          .map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                          ))
                        }
                      </Select>
                    </FormControl>
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
                    <FormControl fullWidth>
                      <InputLabel>{t(language, "adminSponsorEvent")}</InputLabel>
                      <Select
                        value={sponsorForm.eventId}
                        label={t(language, "adminSponsorEvent")}
                        onChange={(e) => setSponsorForm({ ...sponsorForm, eventId: e.target.value })}
                      >
                        {events.map((ev) => (
                          <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
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
                      <ListItemText primary={s.name} secondary={`${s.tier} — ${getEventName(s.eventId)}`} />
                      <IconButton size="small" color="error" onClick={() => deleteSponsor(s.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
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
                    <FormControl fullWidth>
                      <InputLabel>{t(language, "adminMentionEvent")}</InputLabel>
                      <Select
                        value={mentionForm.eventId}
                        label={t(language, "adminMentionEvent")}
                        onChange={(e) => setMentionForm({ ...mentionForm, eventId: e.target.value })}
                      >
                        {events.map((ev) => (
                          <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
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
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminUsersTitle")}
                </Typography>
                <Stack spacing={1}>
                  {users.map((user) => (
                    <Stack key={user.id} direction="row" spacing={2} alignItems="center">
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {user.email}
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          size="small"
                        >
                          {roles.map((r) => (
                            <MenuItem key={r} value={r}>{r}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Chip
                        label={user.isActive ? t(language, "adminUserActive") : t(language, "adminUserInactive")}
                        color={user.isActive ? "success" : "default"}
                        size="small"
                        onClick={() => toggleUserActive(user.id, user.isActive)}
                      />
                      <IconButton size="small" onClick={() => openUserProfile(user.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
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

      {/* User Profile Dialog */}
      <Dialog open={profileDialog} onClose={() => setProfileDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedProfile?.email ?? ""} — {t(language, "adminProfileTitle")}
        </DialogTitle>
        <DialogContent>
          {selectedProfile && !editingProfile && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileFirstName")}</Typography>
                  <Typography>{selectedProfile.firstName || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileLastName")}</Typography>
                  <Typography>{selectedProfile.lastName || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profilePhone")}</Typography>
                  <Typography>{selectedProfile.phone || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileEmergencyContact")}</Typography>
                  <Typography>{selectedProfile.emergencyContact || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileCity")}</Typography>
                  <Typography>{selectedProfile.city || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileAddress")}</Typography>
                  <Typography>{selectedProfile.address || "—"}</Typography>
                </Grid>
              </Grid>
            </Stack>
          )}
          {selectedProfile && editingProfile && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label={t(language, "profileFirstName")}
                    value={profileForm.firstName ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t(language, "profileLastName")}
                    value={profileForm.lastName ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t(language, "profilePhone")}
                    value={profileForm.phone ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t(language, "profileEmergencyContact")}
                    value={profileForm.emergencyContact ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, emergencyContact: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t(language, "profileCity")}
                    value={profileForm.city ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t(language, "profileAddress")}
                    value={profileForm.address ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!editingProfile ? (
            <>
              <Button onClick={() => setEditingProfile(true)}>{t(language, "profileEditButton")}</Button>
              <Button onClick={() => setProfileDialog(false)}>{t(language, "adminDialogClose")}</Button>
            </>
          ) : (
            <>
              <Button onClick={saveUserProfile} variant="contained">{t(language, "profileSaveButton")}</Button>
              <Button onClick={() => setEditingProfile(false)}>{t(language, "profileCancelButton")}</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Category Edit Dialog */}
      <Dialog open={categoryEditDialog} onClose={() => setCategoryEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t(language, "adminCategoryEditTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            label={t(language, "adminCategoryNamePlaceholder")}
            value={categoryEditName}
            onChange={(e) => setCategoryEditName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={saveCategoryEdit} variant="contained">{t(language, "profileSaveButton")}</Button>
          <Button onClick={() => setCategoryEditDialog(false)}>{t(language, "profileCancelButton")}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
