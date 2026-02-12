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
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setMessage(t(language, "enrollmentsSubmitted"));
    } catch (err: any) {
      setMessage(err.message || "Unable to enroll");
    } finally {
      setSaving(false);
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
  }, []);

  const getEventName = (id: string) => {
    const ev = allEvents.find((e) => e.id === id);
    return ev ? ev.name : id.slice(0, 8);
  };

  const getModelName = (id: string | null | undefined) => {
    if (!id) return "—";
    const m = models.find((model) => model.id === id);
    return m ? m.name : id.slice(0, 8);
  };

  const getCategoryName = (id: string | null | undefined) => {
    if (!id) return "—";
    const c = categories.find((cat) => cat.id === id);
    return c ? c.name : id.slice(0, 8);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": return "success";
      case "pending": return "warning";
      case "paid": return "info";
      case "rejected": return "error";
      default: return "default";
    }
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
              <MenuItem value="">&mdash;</MenuItem>
              {models.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>{t(language, "enrollmentsCategorySelect")}</InputLabel>
            <Select value={categoryId} label={t(language, "enrollmentsCategorySelect")} onChange={(e) => setCategoryId(e.target.value)}>
              <MenuItem value="">&mdash;</MenuItem>
              {categories.filter((c) => c.status === "open").map((c) => (
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
            <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsModelSelect")}</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsCategorySelect")}</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
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
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={enrollment.status}
                    size="small"
                    color={isPast ? "default" : statusColor(enrollment.status) as any}
                  />
                  {enrollment.checkedIn && (
                    <Chip label={t(language, "enrollmentsCheckedIn")} size="small" color="success" variant="outlined" />
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>—</Typography>
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
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "enrollmentsTitle")}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
            {t(language, "enrollmentsButton")}
          </Button>
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
