import React, { useCallback, useMemo, useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, IconButton,
  InputLabel, List, ListItem, ListItemText, MenuItem, Select, Stack, Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import PageSkeleton from "../../components/PageSkeleton";
import { useConfirm } from "../../components/ConfirmDialog";
import useToast from "../../components/useToast";
import { SectionErrors, useSections } from "./useSections";
import type { AdminUser } from "./types";
import type { AdminData } from "./useAdminData";

type JudgeAssignmentEntry = { id: string; eventId: string; judgeId: string; categoryId?: string | null };
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
  const [form, setForm] = useState({ eventId: "", judgeId: "", categoryId: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<JudgeAssignmentEntry | null>(null);
  const [editForm, setEditForm] = useState({ eventId: "", judgeId: "", categoryId: "" });
  const [monitoringEventId, setMonitoringEventId] = useState("");
  const [monitoringData, setMonitoringData] = useState<MonitoringRow[]>([]);

  const { loading, errors, reload } = useSections(language, () => [
    { titleKey: "usersTitle", run: async () => setUsers(await api<AdminUser[]>("/admin/users")) },
    { titleKey: "adminJudgeAssignments", run: async () => setAssignments(await api<JudgeAssignmentEntry[]>("/admin/judges/assignments")) }
  ]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const userEmail = (uid: string) => usersById.get(uid)?.email ?? uid.slice(0, 8);
  const judgeCandidates = useMemo(
    () => users.filter((u) => u.role === "judge" || u.role === "manager" || u.role === "admin"),
    [users]
  );
  const categoryLabel = useCallback(
    (cid: string | null | undefined) => (!cid ? t(language, "adminJudgeAllCategories") : categoryName(cid)),
    [categoryName, language]
  );

  async function assignJudge() {
    const body: Record<string, string> = { eventId: form.eventId, judgeId: form.judgeId };
    if (form.categoryId.trim()) body.categoryId = form.categoryId.trim();
    await api("/admin/judges/assignments", { method: "POST", body: JSON.stringify(body) });
    setForm({ eventId: "", judgeId: "", categoryId: "" });
    toast.success(t(language, "adminJudgeAssigned"));
    await reload();
  }

  async function deleteAssignment(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/admin/judges/assignments/${id}`, { method: "DELETE" });
    await reload();
  }

  function openEdit(assignment: JudgeAssignmentEntry) {
    setEditing(assignment);
    setEditForm({ eventId: assignment.eventId, judgeId: assignment.judgeId, categoryId: assignment.categoryId ?? "" });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    const body: Record<string, string> = { eventId: editForm.eventId, judgeId: editForm.judgeId };
    if (editForm.categoryId.trim()) body.categoryId = editForm.categoryId.trim();
    await api(`/admin/judges/assignments/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditOpen(false);
    setEditing(null);
    await reload();
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
        <SectionCard title={t(language, "adminJudgeAssignTitle")}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
                <Select
                  value={form.eventId}
                  label={t(language, "adminJudgeEventPlaceholder")}
                  onChange={(e) => setForm({ ...form, eventId: e.target.value })}
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
                  value={form.categoryId}
                  label={t(language, "adminJudgeCategoryPlaceholder")}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  <MenuItem value="">{t(language, "adminJudgeAllCategories")}</MenuItem>
                  {categories
                    .filter((c) => !form.eventId || c.eventId === form.eventId)
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button variant="contained" onClick={assignJudge} fullWidth disabled={!form.eventId || !form.judgeId}>
                {t(language, "adminJudgeAssignButton")}
              </Button>
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
                    <IconButton size="small" onClick={() => openEdit(ja)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => deleteAssignment(ja.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </SectionCard>
      )}

      <SectionCard title={t(language, "judgeMonitorTitle")}>
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
            <Button size="small" variant="outlined" onClick={() => loadMonitoring(monitoringEventId)} disabled={!monitoringEventId}>
              {t(language, "adminRefreshButton")}
            </Button>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={saveEdit} variant="contained" disabled={!editForm.eventId || !editForm.judgeId}>
            {t(language, "profileSaveButton")}
          </Button>
          <Button onClick={() => setEditOpen(false)}>{t(language, "profileCancelButton")}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
