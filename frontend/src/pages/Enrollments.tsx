import React, { useEffect, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  Grid,
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
import PrintIcon from "@mui/icons-material/Print";
import { api } from "../lib/api";
import { getRole, roleAtLeast } from "../lib/auth";
import { downloadAuthenticatedFile } from "../lib/download";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import EmptyState from "../components/EmptyState";
import AbsentToggle from "../components/AbsentToggle";
import useToast from "../components/useToast";
import SectionCard from "../components/SectionCard";
import PriceSummary from "../components/PriceSummary";
import { openHtmlExport } from "../lib/exports";
import { EventPricing, PricingResponse } from "../lib/pricing";
import { ActionButton, TipIconButton } from "../components/ActionButton";

type Enrollment = {
  id: string;
  eventId: string;
  modelId?: string | null;
  categoryId?: string | null;
  checkedIn: boolean;
};

type AdminEnrollment = Enrollment & { userId: string; absent?: boolean };
type User = { id: string; email: string };
type Event = { id: string; name: string; status: string };
type Model = { id: string; name: string; categoryId: string; code?: string | null };
type Category = { id: string; eventId: string; name: string; status: string };

interface EnrollmentsProps {
  language: Language;
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
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingMine, setExportingMine] = useState(false);
  const [exportingAdmin, setExportingAdmin] = useState(false);
  const [pricing, setPricing] = useState<EventPricing[]>([]);
  const [printingId, setPrintingId] = useState<string | null>(null);

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

  // The fee breakdown is optional information: the page works without it.
  async function loadPricing() {
    try {
      const res = await api<PricingResponse>("/pricing/me");
      setPricing(res?.events ?? []);
    } catch {
      setPricing([]);
    }
  }

  async function printEnrollment(id: string) {
    setPrintingId(id);
    try {
      await openHtmlExport("/exports/model-card/pdf", { eventId: id });
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setPrintingId(null);
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
      await loadPricing();
      if (isManager) {
        await loadAdminEnrollments();
      }
      toast.success(t(language, "enrollmentsSubmitted"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function exportMyEnrollments() {
    setExportingMine(true);
    try {
      await downloadAuthenticatedFile("/exports/my-enrollments", "my-enrollments.xlsx");
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setExportingMine(false);
    }
  }

  async function exportEnrollmentsByEvent() {
    if (!adminEventId) {
      toast.info(t(language, "enrollmentsEventSelect"));
      return;
    }
    setExportingAdmin(true);
    try {
      await downloadAuthenticatedFile(`/exports/enrollments?eventId=${encodeURIComponent(adminEventId)}`, `enrollments-${adminEventId}.xlsx`);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
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
    load().catch((err) => toast.error(err?.message ?? String(err)));
    loadEvents();
    loadModels();
    loadCategories();
    loadPricing();
    loadUsers().catch((err) => toast.error(err?.message ?? String(err)));
  }, []);

  useEffect(() => {
    loadAdminEnrollments().catch((err) => toast.error(err?.message ?? String(err)));
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
          <ActionButton tip={t(language, "tipEnrollSubmit")} variant="contained" onClick={enroll} fullWidth disabled={saving || !eventId}>
            {saving ? "..." : t(language, "enrollmentsButton")}
          </ActionButton>
        </Grid>
      </Grid>
    </Box>
  );

  const renderTable = (items: Enrollment[], isPast: boolean) => (
    items.length === 0 ? (
      <EmptyState
        title={t(language, isPast ? "emptyEnrollmentsPastTitle" : "emptyEnrollmentsActiveTitle")}
        description={t(language, "emptyEnrollmentsDescription")}
        action={isPast ? undefined : { label: t(language, "enrollmentsEmptyAction"), tip: t(language, "tipEnrollNew"), onClick: startCreate }}
      />
    ) : (
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsEventSelect")}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsModelColumn")}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsCategoryColumn")}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsCheckinColumn")}</TableCell>
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
                    <Chip label={t(language, "enrollmentsNotCheckedIn")} size="small" variant="outlined" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  );

  return (
    <PageContainer maxWidth="lg">
      {toast.node}
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="h4">{t(language, "enrollmentsTitle")}</Typography>
          <Stack direction="row" spacing={1}>
            <ActionButton
              tip={t(language, "tipExportMine")}
              data-tour="enr-export"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={exportMyEnrollments}
              disabled={exportingMine}
            >
              {exportingMine ? "..." : t(language, "enrollmentsExportMine")}
            </ActionButton>
            <ActionButton tip={t(language, "tipEnrollNew")} data-tour="enr-new" variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
              {t(language, "enrollmentsButton")}
            </ActionButton>
          </Stack>
        </Stack>

        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "enrollmentsButton")}</Typography>
              <TipIconButton tip={t(language, "tipPanelClose")} size="small" aria-label={t(language, "wizardClose")} onClick={() => setIsCreating(false)}><CloseIcon fontSize="small" /></TipIconButton>
            </Stack>
            {createPanel}
          </Paper>
        </Collapse>

        {isManager && (
          <Paper data-tour="enr-manage" variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography variant="h6">{t(language, "enrollmentsManageTitle")}</Typography>
                <ActionButton
                  tip={t(language, "tipExportEvent")}
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={exportEnrollmentsByEvent}
                  disabled={exportingAdmin || !adminEventId}
                >
                  {exportingAdmin ? "..." : t(language, "enrollmentsExportEvent")}
                </ActionButton>
              </Stack>
              <FormControl size="small" sx={{ maxWidth: 360 }}>
                <InputLabel>{t(language, "enrollmentsEventSelect")}</InputLabel>
                <Select
                  value={adminEventId}
                  label={t(language, "enrollmentsEventSelect")}
                  onChange={(e) => setAdminEventId(e.target.value)}
                >
                  <MenuItem value="">{t(language, "enrollmentsAllEvents")}</MenuItem>
                  {allEvents.map((ev) => (
                    <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsParticipantColumn")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsEventSelect")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsModelColumn")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsCategoryColumn")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsCheckinColumn")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t(language, "enrollmentsAbsentColumn")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adminEnrollments.map((enrollment) => (
                      <TableRow key={enrollment.id} hover>
                        <TableCell>{getUserLabel(enrollment.userId)}</TableCell>
                        <TableCell>{getEventName(enrollment.eventId)}</TableCell>
                        <TableCell>{getModelName(enrollment.modelId)}</TableCell>
                        <TableCell>{getCategoryName(enrollment.categoryId)}</TableCell>
                        <TableCell>{t(language, enrollment.checkedIn ? "enrollmentsCheckedIn" : "enrollmentsNotCheckedIn")}</TableCell>
                        <TableCell>
                          <AbsentToggle
                            language={language}
                            enrollmentId={enrollment.id}
                            absent={!!enrollment.absent}
                            onChanged={(absent) =>
                              setAdminEnrollments((rows) => rows.map((r) => (r.id === enrollment.id ? { ...r, absent } : r)))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {adminEnrollments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
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

        {pricing.map((p) => (
          <SectionCard
            tourId="enr-fee"
            key={p.eventId}
            title={`${t(language, "priceSummaryTitle")}: ${p.eventName}`}
            action={
              <ActionButton
                tip={t(language, "tipPrintEnrollment")}
                variant="outlined"
                size="small"
                startIcon={<PrintIcon />}
                onClick={() => printEnrollment(p.eventId)}
                disabled={printingId !== null}
              >
                {t(language, "enrollmentsPrint")}
              </ActionButton>
            }
          >
            <PriceSummary language={language} pricing={p} />
          </SectionCard>
        ))}

        <Typography data-tour="enr-list" variant="h6">{t(language, "enrollmentsListTitle")}</Typography>
        {renderTable(activeEnrollments, false)}

        {pastEnrollments.length > 0 && (
          <>
            <Typography variant="h6">{t(language, "enrollmentsPastTitle")}</Typography>
            {renderTable(pastEnrollments, true)}
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
