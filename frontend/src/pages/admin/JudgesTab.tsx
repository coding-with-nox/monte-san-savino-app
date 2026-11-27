import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PrintIcon from "@mui/icons-material/Print";
import { api } from "../../lib/api";
import { openHtmlExport } from "../../lib/exports";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import PageSkeleton from "../../components/PageSkeleton";
import { useConfirm } from "../../components/ConfirmDialog";
import useToast from "../../components/useToast";
import { SectionErrors, useSections } from "./useSections";
import type { AdminUser } from "./types";
import type { AdminData } from "./useAdminData";
import { ActionButton, TipIconButton } from "../../components/ActionButton";

type JudgeAssignmentEntry = { id: string; eventId: string; judgeId: string; categoryId?: string | null; standingIn?: boolean };
type MonitoringRow = {
  categoryId: string; categoryName: string; status: string;
  totalModels: number; scoredModels: number; percentComplete: number;
  totalJudges: number; completedJudges: number;
};

export default function JudgesTab({ language, data }: { language: Language; data: AdminData }) {
  const { events, categories, eventName, categoryName } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [assignments, setAssignments] = useState<JudgeAssignmentEntry[]>([]);
  const [form, setForm] = useState({ eventId: "", judgeId: "", categoryIds: [] as string[], standingIn: false });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<JudgeAssignmentEntry | null>(null);
  const [editForm, setEditForm] = useState({ eventId: "", judgeId: "", categoryId: "", standingIn: false });
  const [monitoringEventId, setMonitoringEventId] = useState("");
  const [monitoringData, setMonitoringData] = useState<MonitoringRow[]>([]);
  const [sheetsBusy, setSheetsBusy] = useState(false);

  const { loading, errors, reload } = useSections(language, () => [
    { titleKey: "usersTitle", run: async () => setUsers(await api<AdminUser[]>("/admin/users")) },
    { titleKey: "adminJudgeAssignments", run: async () => setAssignments(await api<JudgeAssignmentEntry[]>("/admin/judges/assignments")) }
  ]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const userEmail = (uid: string) => usersById.get(uid)?.email ?? uid.slice(0, 8);
  const judgeCandidates = useMemo(
    () => users.filter((u) => u.role === "judge" || u.role === "jury_president" || u.role === "manager" || u.role === "admin"),
    [users]
  );
  const categoryLabel = useCallback(
    (cid: string | null | undefined) => (!cid ? t(language, "adminJudgeAllCategories") : categoryName(cid)),
    [categoryName, language]
  );

  async function assignJudge() {
    // One assignment per selected class; no class selected means all classes of the event.
    const categoryIds = form.categoryIds.length > 0 ? form.categoryIds : [""];
    try {
      for (const cid of categoryIds) {
        const body: Record<string, string | boolean> = { eventId: form.eventId, judgeId: form.judgeId, standingIn: form.standingIn };
        if (cid) body.categoryId = cid;
        await api("/admin/judges/assignments", { method: "POST", body: JSON.stringify(body) });
      }
      setForm({ eventId: "", judgeId: "", categoryIds: [], standingIn: false });
      toast.success(t(language, "adminJudgeAssigned"));
    } finally {
      await reload();
    }
  }

  async function deleteAssignment(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/admin/judges/assignments/${id}`, { method: "DELETE" });
    await reload();
  }

  async function toggleStandIn(assignment: JudgeAssignmentEntry) {
    const body: Record<string, string | boolean> = {
      eventId: assignment.eventId,
      judgeId: assignment.judgeId,
      standingIn: !assignment.standingIn,
    };
    if (assignment.categoryId) body.categoryId = assignment.categoryId;
    await api(`/admin/judges/assignments/${assignment.id}`, { method: "PATCH", body: JSON.stringify(body) });
    await reload();
  }

  function openEdit(assignment: JudgeAssignmentEntry) {
    setEditing(assignment);
    setEditForm({
      eventId: assignment.eventId,
      judgeId: assignment.judgeId,
      categoryId: assignment.categoryId ?? "",
      standingIn: !!assignment.standingIn,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    const body: Record<string, string | boolean> = { eventId: editForm.eventId, judgeId: editForm.judgeId, standingIn: editForm.standingIn };
    if (editForm.categoryId.trim()) body.categoryId = editForm.categoryId.trim();
    await api(`/admin/judges/assignments/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditOpen(false);
    setEditing(null);
    await reload();
  }

  /** GET /exports/events/:eventId/judge-sheets: one printable page per judge. */
  async function printJudgeSheets(eventId: string) {
    setSheetsBusy(true);
    try {
      await openHtmlExport(`/exports/events/${encodeURIComponent(eventId)}/judge-sheets`);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSheetsBusy(false);
    }
  }

  async function loadMonitoring(eventId: string) {
    if (!eventId) { setMonitoringData([]); return; }
    try {
      setMonitoringData(await api<MonitoringRow[]>(`/awards/monitoring/${encodeURIComponent(eventId)}`));
    } catch { setMonitoringData([]); }
  }

  return (
    <Stack spacing={2}>
      <SectionErrors language={language} errors={errors} onRetry={() => void reload()} />
      {loading && <PageSkeleton variant="table" />}
      {!loading && (
        <SectionCard tourId="admin-judges-assign" title={t(language, "adminJudgeAssignTitle")}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
                <Select
                  value={form.eventId}
                  label={t(language, "adminJudgeEventPlaceholder")}
                  onChange={(e) => setForm({ ...form, eventId: e.target.value, categoryIds: [] })}
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
                  value={form.judgeId}
                  label={t(language, "adminJudgeIdPlaceholder")}
                  onChange={(e) => setForm({ ...form, judgeId: e.target.value })}
                >
                  {judgeCandidates.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeCategoryPlaceholder")}</InputLabel>
                <Select
                  multiple
                  value={form.categoryIds}
                  label={t(language, "adminJudgeCategoryPlaceholder")}
                  renderValue={(selected) => (selected.length === 0 ? t(language, "adminJudgeAllCategories") : selected.map(categoryLabel).join(", "))}
                  onChange={(e) => setForm({ ...form, categoryIds: e.target.value as string[] })}
                >
                  {categories
                    .filter((c) => !form.eventId || c.eventId === form.eventId)
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack spacing={0.5}>
                <Tooltip title={t(language, "tipJudgeStandIn")} describeChild>
                  <FormControlLabel
                    control={<Checkbox checked={form.standingIn} onChange={(e) => setForm({ ...form, standingIn: e.target.checked })} />}
                    label={t(language, "adminJudgeStandIn")}
                  />
                </Tooltip>
                <ActionButton tip={t(language, "tipJudgeAssign")} variant="contained" onClick={assignJudge} fullWidth disabled={!form.eventId || !form.judgeId}>
                  {t(language, "adminJudgeAssignButton")}
                </ActionButton>
              </Stack>
            </Grid>
          </Grid>
          {assignments.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                {t(language, "adminJudgeAssignments")}
              </Typography>
              <List dense>
                {assignments.map((ja) => (
                  <ListItem key={ja.id} disableGutters>
                    <ListItemText
                      primary={userEmail(ja.judgeId)}
                      secondary={`${eventName(ja.eventId)} - ${categoryLabel(ja.categoryId)}`}
                    />
                    {ja.standingIn && <Chip size="small" label={t(language, "adminJudgeStandIn")} sx={{ mr: 1 }} />}
                    <TipIconButton
                      tip={t(language, "tipAssignmentStandIn")}
                      aria-label={`${t(language, "adminJudgeStandIn")} ${userEmail(ja.judgeId)}`}
                      aria-pressed={!!ja.standingIn}
                      size="small"
                      onClick={() => toggleStandIn(ja)}
                    >
                      <SwapHorizIcon fontSize="small" />
                    </TipIconButton>
                    <TipIconButton tip={t(language, "tipAssignmentEdit")} aria-label={`${t(language, "actionEdit")} ${userEmail(ja.judgeId)}`} size="small" onClick={() => openEdit(ja)}>
                      <EditIcon fontSize="small" />
                    </TipIconButton>
                    <TipIconButton tip={t(language, "tipAssignmentDelete")} aria-label={`${t(language, "actionDelete")} ${userEmail(ja.judgeId)}`} size="small" color="error" onClick={() => deleteAssignment(ja.id)}>
                      <DeleteIcon fontSize="small" />
                    </TipIconButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </SectionCard>
      )}

      <SectionCard tourId="admin-judges-monitor" title={t(language, "judgeMonitorTitle")}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
              <Select
                value={monitoringEventId}
                label={t(language, "adminJudgeEventPlaceholder")}
                onChange={(e) => { setMonitoringEventId(e.target.value); void loadMonitoring(e.target.value); }}
              >
                {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
              </Select>
            </FormControl>
            <ActionButton tip={t(language, "tipMonitorRefresh")} size="small" variant="outlined" onClick={() => loadMonitoring(monitoringEventId)} disabled={!monitoringEventId}>
              {t(language, "adminRefreshButton")}
            </ActionButton>
            <ActionButton
              tip={t(language, "tipJudgeSheets")}
              size="small"
              variant="outlined"
              startIcon={<PrintIcon fontSize="small" />}
              disabled={!monitoringEventId || sheetsBusy}
              onClick={() => printJudgeSheets(monitoringEventId)}
            >
              {t(language, "judgeSheetsButton")}
            </ActionButton>
          </Stack>

          {monitoringData.map((cat) => (
            <Box key={cat.categoryId} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2">{cat.categoryName}</Typography>
                <Chip
                  size="small"
                  label={cat.status === "closed" ? t(language, "adminCategoryClosed") : t(language, "adminCategoryOpen")}
                  color={cat.status === "closed" ? "default" : "success"}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  {t(language, "judgePercentComplete")}: {cat.percentComplete}% ({cat.scoredModels}/{cat.totalModels})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(language, "judgeCompletedCount")}: {cat.completedJudges}/{cat.totalJudges}
                </Typography>
              </Stack>
              <Box sx={{ mt: 0.5, height: 6, bgcolor: "grey.200", borderRadius: 3 }}>
                <Box sx={{ height: 6, bgcolor: cat.status === "closed" ? "grey.500" : "primary.main", borderRadius: 3, width: `${cat.percentComplete}%` }} />
              </Box>
            </Box>
          ))}
          {monitoringData.length === 0 && monitoringEventId && (
            <Typography variant="body2" color="text.secondary">{t(language, "adminNoData")}</Typography>
          )}
        </Stack>
      </SectionCard>

      {toast.node}
      {confirmNode}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t(language, "adminJudgeAssignTitle")}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
                <Select
                  value={editForm.eventId}
                  label={t(language, "adminJudgeEventPlaceholder")}
                  onChange={(e) => setEditForm({ ...editForm, eventId: e.target.value, categoryId: "" })}
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
                  value={editForm.judgeId}
                  label={t(language, "adminJudgeIdPlaceholder")}
                  onChange={(e) => setEditForm({ ...editForm, judgeId: e.target.value })}
                >
                  {judgeCandidates.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeCategoryPlaceholder")}</InputLabel>
                <Select
                  value={editForm.categoryId}
                  label={t(language, "adminJudgeCategoryPlaceholder")}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                >
                  <MenuItem value="">{t(language, "adminJudgeAllCategories")}</MenuItem>
                  {categories
                    .filter((c) => !editForm.eventId || c.eventId === editForm.eventId)
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Tooltip title={t(language, "tipJudgeStandIn")} describeChild>
                <FormControlLabel
                  control={<Checkbox checked={editForm.standingIn} onChange={(e) => setEditForm({ ...editForm, standingIn: e.target.checked })} />}
                  label={t(language, "adminJudgeStandIn")}
                />
              </Tooltip>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <ActionButton tip={t(language, "tipAssignmentSave")} onClick={saveEdit} variant="contained" disabled={!editForm.eventId || !editForm.judgeId}>
            {t(language, "profileSaveButton")}
          </ActionButton>
          <ActionButton tip={t(language, "tipDialogCancel")} onClick={() => setEditOpen(false)}>{t(language, "profileCancelButton")}</ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
