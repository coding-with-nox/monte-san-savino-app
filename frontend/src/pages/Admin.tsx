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
import { api, ApiError } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string };
type Category = { id: string; eventId: string; name: string; status: string };
type User = { id: string; email: string; role: string; isActive: boolean };
type Sponsor = { id: string; eventId: string; name: string; tier: string };
type SpecialMention = { id: string; eventId: string; modelId: string; title: string };
type ModificationRequest = { id: string; modelId: string; judgeId: string; reason: string; status: string };
type JudgeAssignmentEntry = { id: string; eventId: string; judgeId: string; categoryId?: string | null };

interface AdminProps {
  language: Language;
}

export default function Admin({ language }: AdminProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [modRequests, setModRequests] = useState<ModificationRequest[]>([]);
  const [judgeAssignments, setJudgeAssignments] = useState<JudgeAssignmentEntry[]>([]);
  const [specialMentions, setSpecialMentions] = useState<SpecialMention[]>([]);

  const [eventForm, setEventForm] = useState({ name: "", status: "" });
  const [categoryForm, setCategoryForm] = useState({ eventId: "", name: "" });
  const [judgeAssignment, setJudgeAssignment] = useState({ eventId: "", judgeId: "", categoryId: "" });
  const [sponsorForm, setSponsorForm] = useState({ eventId: "", name: "", tier: "bronze" });
  const [mentionForm, setMentionForm] = useState({ eventId: "", modelId: "", title: "" });
  const [message, setMessage] = useState("");

  // Category edit dialog state
  const [categoryEditDialog, setCategoryEditDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryEditName, setCategoryEditName] = useState("");
  const [judgeEditDialog, setJudgeEditDialog] = useState(false);
  const [editingJudgeAssignment, setEditingJudgeAssignment] = useState<JudgeAssignmentEntry | null>(null);
  const [judgeEditForm, setJudgeEditForm] = useState({ eventId: "", judgeId: "", categoryId: "" });

  async function load() {
    setEvents(await api<Event[]>("/events"));
    setCategories(await api<Category[]>("/categories"));
    setUsers(await api<User[]>("/admin/users"));
    setSponsors(await api<Sponsor[]>("/sponsors"));
    setModRequests(await api<ModificationRequest[]>("/admin/modification-requests"));
    setJudgeAssignments(await api<JudgeAssignmentEntry[]>("/admin/judges/assignments"));
    setSpecialMentions(await api<SpecialMention[]>("/awards/mentions"));
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
    try {
      await api("/categories", { method: "POST", body: JSON.stringify(categoryForm) });
      setCategoryForm({ eventId: "", name: "" });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setMessage(t(language, "adminCategoryDuplicate"));
      } else {
        throw err;
      }
    }
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

  async function assignJudge() {
    const body: Record<string, string> = { eventId: judgeAssignment.eventId, judgeId: judgeAssignment.judgeId };
    if (judgeAssignment.categoryId.trim()) body.categoryId = judgeAssignment.categoryId.trim();
    await api("/admin/judges/assignments", { method: "POST", body: JSON.stringify(body) });
    setJudgeAssignment({ eventId: "", judgeId: "", categoryId: "" });
    setMessage(t(language, "adminJudgeAssigned"));
    await load();
  }

  async function deleteJudgeAssignment(id: string) {
    await api(`/admin/judges/assignments/${id}`, { method: "DELETE" });
    await load();
  }

  function openJudgeEdit(assignment: JudgeAssignmentEntry) {
    setEditingJudgeAssignment(assignment);
    setJudgeEditForm({
      eventId: assignment.eventId,
      judgeId: assignment.judgeId,
      categoryId: assignment.categoryId ?? ""
    });
    setJudgeEditDialog(true);
  }

  async function saveJudgeEdit() {
    if (!editingJudgeAssignment) return;
    const body: Record<string, string> = {
      eventId: judgeEditForm.eventId,
      judgeId: judgeEditForm.judgeId
    };
    if (judgeEditForm.categoryId.trim()) {
      body.categoryId = judgeEditForm.categoryId.trim();
    }
    await api(`/admin/judges/assignments/${editingJudgeAssignment.id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    setJudgeEditDialog(false);
    setEditingJudgeAssignment(null);
    await load();
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
    await api("/awards/mentions", {
      method: "POST",
      body: JSON.stringify({
        eventId: mentionForm.eventId,
        modelId: mentionForm.modelId.trim(),
        title: mentionForm.title.trim()
      })
    });
    setMentionForm({ eventId: "", modelId: "", title: "" });
    setMessage(t(language, "adminMentionCreate"));
    await load();
  }

  async function deleteMention(id: string) {
    await api(`/awards/mentions/${id}`, { method: "DELETE" });
    await load();
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

  const eventStatuses = ["draft", "active", "closed"];
  const getEventName = (eid: string) => {
    const ev = events.find((e) => e.id === eid);
    return ev ? ev.name : eid.slice(0, 8);
  };

  const getUserEmail = (uid: string) => {
    const u = users.find((user) => user.id === uid);
    return u ? u.email : uid.slice(0, 8);
  };

  const getCategoryName = (cid: string | null | undefined) => {
    if (!cid) return t(language, "adminJudgeAllCategories");
    const c = categories.find((cat) => cat.id === cid);
    return c ? c.name : cid.slice(0, 8);
  };

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "adminTitle")}</Typography>
        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}
        <Grid container spacing={2}>
          {/* Events */}
          <Grid item xs={12}>
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
          <Grid item xs={12}>
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

          {/* Judge Assignments (with optional category) */}
          <Grid item xs={12}>
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
                    <Button
                      variant="contained"
                      onClick={assignJudge}
                      fullWidth
                      disabled={!judgeAssignment.eventId || !judgeAssignment.judgeId}
                    >
                      {t(language, "adminJudgeAssignButton")}
                    </Button>
                  </Grid>
                </Grid>
                {judgeAssignments.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                      {t(language, "adminJudgeAssignments")}
                    </Typography>
                    <List dense>
                      {judgeAssignments.map((ja) => (
                        <ListItem key={ja.id} disableGutters>
                          <ListItemText
                            primary={getUserEmail(ja.judgeId)}
                            secondary={`${getEventName(ja.eventId)} - ${getCategoryName(ja.categoryId)}`}
                          />
                          <IconButton size="small" onClick={() => openJudgeEdit(ja)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteJudgeAssignment(ja.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Sponsors */}
          <Grid item xs={12}>
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
                      <ListItemText primary={s.name} secondary={`${s.tier} - ${getEventName(s.eventId)}`} />
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
          <Grid item xs={12}>
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
                    <Button
                      variant="contained"
                      onClick={createMention}
                      fullWidth
                      disabled={!mentionForm.eventId || !mentionForm.modelId.trim() || !mentionForm.title.trim()}
                    >
                      {t(language, "adminMentionCreate")}
                    </Button>
                  </Grid>
                </Grid>
                {specialMentions.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                      {t(language, "adminMentionsList")}
                    </Typography>
                    <List dense>
                      {specialMentions.map((m) => (
                        <ListItem key={m.id} disableGutters>
                          <ListItemText
                            primary={m.title}
                            secondary={`${getEventName(m.eventId)} - Model: ${m.modelId.slice(0, 8)}`}
                          />
                          <IconButton size="small" color="error" onClick={() => deleteMention(m.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Modification Requests */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "adminModRequestsTitle")}
                </Typography>
                <Stack spacing={1}>
                  {modRequests.map((req) => (
                    <Stack key={req.id} spacing={1}>
                      <Typography variant="body2">
                        Model: {req.modelId.slice(0, 8)} - {req.reason}
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

        </Grid>
      </Stack>

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

      <Dialog open={judgeEditDialog} onClose={() => setJudgeEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t(language, "adminJudgeAssignTitle")}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
                <Select
                  value={judgeEditForm.eventId}
                  label={t(language, "adminJudgeEventPlaceholder")}
                  onChange={(e) => setJudgeEditForm({ ...judgeEditForm, eventId: e.target.value, categoryId: "" })}
                >
                  {events.map((ev) => (
                    <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeIdPlaceholder")}</InputLabel>
                <Select
                  value={judgeEditForm.judgeId}
                  label={t(language, "adminJudgeIdPlaceholder")}
                  onChange={(e) => setJudgeEditForm({ ...judgeEditForm, judgeId: e.target.value })}
                >
                  {users.filter((u) => u.role === "judge" || u.role === "manager" || u.role === "admin").map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeCategoryPlaceholder")}</InputLabel>
                <Select
                  value={judgeEditForm.categoryId}
                  label={t(language, "adminJudgeCategoryPlaceholder")}
                  onChange={(e) => setJudgeEditForm({ ...judgeEditForm, categoryId: e.target.value })}
                >
                  <MenuItem value="">{t(language, "adminJudgeAllCategories")}</MenuItem>
                  {categories
                    .filter((c) => !judgeEditForm.eventId || c.eventId === judgeEditForm.eventId)
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={saveJudgeEdit}
            variant="contained"
            disabled={!judgeEditForm.eventId || !judgeEditForm.judgeId}
          >
            {t(language, "profileSaveButton")}
          </Button>
          <Button onClick={() => setJudgeEditDialog(false)}>{t(language, "profileCancelButton")}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
