import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import { api } from "../lib/api";
import { getRole, roleAtLeast } from "../lib/auth";
import { Language, t } from "../lib/i18n";

type Enrollment = {
  id: string;
  eventId: string;
  modelId?: string | null;
  categoryId?: string | null;
  checkedIn: boolean;
};

type AdminEnrollment = Enrollment & { userId: string };
type User = { id: string; email: string };
type Event = { id: string; name: string; status: string };
type Model = { id: string; name: string; categoryId: string; code?: string | null };
type Category = { id: string; eventId: string; name: string; status: string };

interface EnrollmentsProps {
  language: Language;
}

function downloadTextFile(content: string, filename: string, contentType = "application/vnd.ms-excel;charset=utf-8") {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function Enrollments({ language }: EnrollmentsProps) {
  const role = getRole();
  const isManager = role ? roleAtLeast(role, "manager") : false;

  const [eventId, setEventId] = useState("");
  const [modelId, setModelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [adminEnrollments, setAdminEnrollments] = useState<AdminEnrollment[]>([]);
  const [adminEventId, setAdminEventId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingMine, setExportingMine] = useState(false);
  const [exportingAdmin, setExportingAdmin] = useState(false);

  async function load() {
    setEnrollments(await api<Enrollment[]>("/enrollments"));
  }

  async function loadAdminEnrollments() {
    if (!isManager) {
      setAdminEnrollments([]);
      return;
    }
    const query = adminEventId ? `?eventId=${encodeURIComponent(adminEventId)}` : "";
    setAdminEnrollments(await api<AdminEnrollment[]>(`/admin/enrollments${query}`));
  }

  async function loadUsers() {
    if (!isManager) {
      setUsers([]);
      return;
    }
    const rows = await api<Array<{ id: string; email: string }>>("/admin/users");
    setUsers(rows);
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
    setSaving(true);
    try {
      await api(`/events/${eventId}/enroll`, {
        method: "POST",
        body: JSON.stringify({
          modelId: modelId || undefined,
          categoryId: categoryId || undefined
        })
      });
      setIsCreating(false);
      setEventId("");
      setModelId("");
      setCategoryId("");
      await load();
      if (isManager) {
        await loadAdminEnrollments();
      }
      setMessage(t(language, "enrollmentsSubmitted"));
    } catch (err: any) {
      setMessage(err.message || "Unable to enroll");
    } finally {
      setSaving(false);
    }
  }

  async function exportMyEnrollments() {
    setExportingMine(true);
    try {
      const excel = await api<string>("/exports/my-enrollments");
      downloadTextFile(excel, "my-enrollments.xls");
    } catch (err: any) {
      setMessage(err.message || "Export failed");
    } finally {
      setExportingMine(false);
    }
  }

  async function exportEnrollmentsByEvent() {
    if (!adminEventId) {
      setMessage(t(language, "enrollmentsEventSelect"));
      return;
    }
    setExportingAdmin(true);
    try {
      const excel = await api<string>(`/exports/enrollments?eventId=${encodeURIComponent(adminEventId)}`);
      downloadTextFile(excel, `enrollments-${adminEventId}.xls`);
    } catch (err: any) {
      setMessage(err.message || "Export failed");
    } finally {
      setExportingAdmin(false);
    }
  }

  function startCreate() {
    setEventId("");
    setModelId("");
    setCategoryId("");
    setIsCreating(true);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
    loadEvents();
    loadModels();
    loadCategories();
    loadUsers().catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    loadAdminEnrollments().catch((err) => setMessage(err.message));
  }, [adminEventId, isManager]);

  const getEventName = (id: string) => {
    const ev = allEvents.find((e) => e.id === id);
    return ev ? ev.name : id.slice(0, 8);
  };

  const getModelName = (id: string | null | undefined) => {
    if (!id) return "-";
    const m = models.find((model) => model.id === id);
    if (!m) return id.slice(0, 8);
    return m.code ? `${m.name} (${m.code})` : m.name;
  };

  const getCategoryName = (id: string | null | undefined) => {
    if (!id) return "-";
    const c = categories.find((cat) => cat.id === id);
    return c ? c.name : id.slice(0, 8);
  };

  const getUserLabel = (userId: string) => {
    const user = users.find((row) => row.id === userId);
    return user ? user.email : userId.slice(0, 8);
  };

  const activeEventIds = new Set(activeEvents.map((e) => e.id));
  const activeEnrollments = enrollments.filter((e) => activeEventIds.has(e.eventId));
  const pastEnrollments = enrollments.filter((e) => !activeEventIds.has(e.eventId));

  const createPanel = (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>{t(language, "enrollmentsEventSelect")}</InputLabel>
            <Select value={eventId} label={t(language, "enrollmentsEventSelect")} onChange={(e) => setEventId(e.target.value)}>
              {activeEvents.map((ev) => (
                <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>{t(language, "enrollmentsModelSelect")}</InputLabel>
            <Select value={modelId} label={t(language, "enrollmentsModelSelect")} onChange={(e) => setModelId(e.target.value)}>
              <MenuItem value="">-</MenuItem>
              {models.map((m) => (
                <MenuItem key={m.id} value={m.id}>{getModelName(m.id)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>{t(language, "enrollmentsCategorySelect")}</InputLabel>
            <Select value={categoryId} label={t(language, "enrollmentsCategorySelect")} onChange={(e) => setCategoryId(e.target.value)}>
              <MenuItem value="">-</MenuItem>
              {categories
                .filter((c) => c.status === "open" && (!eventId || c.eventId === eventId))
                .map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={2}>
          <Button variant="contained" onClick={enroll} fullWidth disabled={saving || !eventId}>
            {saving ? "..." : t(language, "enrollmentsButton")}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );

  const renderTable = (items: Enrollment[], isPast: boolean) => (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsEventSelect")}</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsModelColumn")}</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsCategoryColumn")}</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Check-in</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((enrollment) => (
            <TableRow key={enrollment.id} hover>
              <TableCell>
                <Typography fontWeight={600}>{getEventName(enrollment.eventId)}</Typography>
              </TableCell>
              <TableCell>{getModelName(enrollment.modelId)}</TableCell>
              <TableCell>{getCategoryName(enrollment.categoryId)}</TableCell>
              <TableCell>
                {enrollment.checkedIn ? (
                  <Chip label={t(language, "enrollmentsCheckedIn")} size="small" color="success" variant="outlined" />
                ) : (
                  <Chip label="No" size="small" variant="outlined" />
                )}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>-</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="h4">{t(language, "enrollmentsTitle")}</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={exportMyEnrollments}
              disabled={exportingMine}
            >
              {exportingMine ? "..." : "Export mie iscrizioni"}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
              {t(language, "enrollmentsButton")}
            </Button>
          </Stack>
        </Stack>

        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}

        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "enrollmentsButton")}</Typography>
              <IconButton size="small" onClick={() => setIsCreating(false)}><CloseIcon fontSize="small" /></IconButton>
            </Stack>
            {createPanel}
          </Paper>
        </Collapse>

        {isManager && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography variant="h6">Gestione iscrizioni evento</Typography>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={exportEnrollmentsByEvent}
                  disabled={exportingAdmin || !adminEventId}
                >
                  {exportingAdmin ? "..." : "Export iscrizioni evento"}
                </Button>
              </Stack>
              <FormControl size="small" sx={{ maxWidth: 360 }}>
                <InputLabel>{t(language, "enrollmentsEventSelect")}</InputLabel>
                <Select
                  value={adminEventId}
                  label={t(language, "enrollmentsEventSelect")}
                  onChange={(e) => setAdminEventId(e.target.value)}
                >
                  <MenuItem value="">Tutti gli eventi</MenuItem>
                  {allEvents.map((ev) => (
                    <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Partecipante</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsEventSelect")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsModelColumn")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsCategoryColumn")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Check-in</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adminEnrollments.map((enrollment) => (
                      <TableRow key={enrollment.id} hover>
                        <TableCell>{getUserLabel(enrollment.userId)}</TableCell>
                        <TableCell>{getEventName(enrollment.eventId)}</TableCell>
                        <TableCell>{getModelName(enrollment.modelId)}</TableCell>
                        <TableCell>{getCategoryName(enrollment.categoryId)}</TableCell>
                        <TableCell>{enrollment.checkedIn ? "yes" : "no"}</TableCell>
                      </TableRow>
                    ))}
                    {adminEnrollments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>-</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          </Paper>
        )}

        <Typography variant="h6">{t(language, "enrollmentsListTitle")}</Typography>
        {renderTable(activeEnrollments, false)}

        {pastEnrollments.length > 0 && (
          <>
            <Typography variant="h6">{t(language, "enrollmentsPastTitle")}</Typography>
            {renderTable(pastEnrollments, true)}
          </>
        )}
      </Stack>
    </Container>
  );
}
