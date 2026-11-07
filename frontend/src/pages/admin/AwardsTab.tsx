import React, { useEffect, useState } from "react";
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, IconButton, InputLabel,
  List, ListItem, ListItemText, MenuItem, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography
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
import type { AdminData } from "./useAdminData";

type SpecialMention = { id: string; eventId: string; modelId: string; title: string };
type ModificationRequest = { id: string; modelId: string; judgeId: string; reason: string; status: string };
type CorrectionRow = {
  id?: string; modelId: string; modelName?: string | null; categoryId: string; totalScore: number | null;
  medalLabel: string | null; medalRank: number | null;
  votes: number; source: string; averageRank: number | null;
};

export default function AwardsTab({ language, data }: { language: Language; data: AdminData }) {
  const { events, categoryName, modelName, ensureModels } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const toast = useToast();
  const [mentions, setMentions] = useState<SpecialMention[]>([]);
  const [modRequests, setModRequests] = useState<ModificationRequest[]>([]);
  const [mentionForm, setMentionForm] = useState({ eventId: "", modelId: "", title: "" });
  const [correctionsEventId, setCorrectionsEventId] = useState("");
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overridingAward, setOverridingAward] = useState<string | null>(null);
  const [overrideMedalLabel, setOverrideMedalLabel] = useState("");
  const [overrideMedalRank, setOverrideMedalRank] = useState(0);

  const { loading, errors, reload } = useSections(language, () => [
    { titleKey: "adminSpecialMentionsTitle", run: async () => setMentions(await api<SpecialMention[]>("/awards/mentions")) },
    { titleKey: "adminModRequestsTitle", run: async () => setModRequests(await api<ModificationRequest[]>("/admin/modification-requests")) }
  ]);

  // Model names (best effort, shared and fetched at most once) are needed only by this tab and the catalog.
  useEffect(() => { ensureModels(); }, [ensureModels]);

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
    toast.success(t(language, "adminMentionCreate"));
    await reload();
  }

  async function deleteMention(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/awards/mentions/${id}`, { method: "DELETE" });
    await reload();
  }

  async function updateModRequestStatus(id: string, status: string) {
    await api(`/admin/modification-requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await reload();
  }

  async function loadCorrections(eventId: string) {
    if (!eventId) { setCorrections([]); return; }
    try {
      setCorrections(await api<CorrectionRow[]>(`/awards/events/${encodeURIComponent(eventId)}`));
    } catch { setCorrections([]); }
  }

  async function saveOverride() {
    if (!overridingAward) return;
    try {
      await api(`/awards/${overridingAward}`, {
        method: "PATCH",
        body: JSON.stringify({ medalLabel: overrideMedalLabel, medalRank: overrideMedalRank })
      });
      toast.success(t(language, "profileSaveButton"));
      setOverrideOpen(false);
      await loadCorrections(correctionsEventId);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  return (
    <Stack spacing={2}>
      {toast.node}
      <SectionErrors language={language} errors={errors} onRetry={() => void reload()} />
      {loading && <PageSkeleton variant="table" />}
      {!loading && (
        <>
          <SectionCard title={t(language, "adminSpecialMentionsTitle")}>
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
            {mentions.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  {t(language, "adminMentionsList")}
                </Typography>
                <List dense>
                  {mentions.map((m) => (
                    <ListItem key={m.id} disableGutters>
                      <ListItemText
                        primary={m.title}
                        secondary={`${data.eventName(m.eventId)} - ${t(language, "adminModelLabel")}: ${modelName(m.modelId)}`}
                      />
                      <IconButton size="small" color="error" onClick={() => deleteMention(m.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </SectionCard>

          <SectionCard title={t(language, "adminModRequestsTitle")}>
            <Stack spacing={1}>
              {modRequests.map((req) => (
                <Stack key={req.id} spacing={1}>
                  <Typography variant="body2">
                    {t(language, "adminModelLabel")}: {modelName(req.modelId)} - {req.reason}
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
          </SectionCard>
        </>
      )}

      <SectionCard title={t(language, "judgeCorrectionsTitle")}>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
            <Select
              value={correctionsEventId}
              label={t(language, "adminJudgeEventPlaceholder")}
              onChange={(e) => { setCorrectionsEventId(e.target.value); void loadCorrections(e.target.value); }}
            >
              {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsModel")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsCategory")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsScore")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsAward")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsSource")}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {corrections.map((row) => (
                  <TableRow key={row.modelId} sx={{ bgcolor: row.source === "frozen" && !row.medalLabel ? "error.light" : undefined }}>
                    <TableCell>{row.modelName ?? modelName(row.modelId)}</TableCell>
                    <TableCell>{categoryName(row.categoryId)}</TableCell>
                    <TableCell>{row.totalScore ?? (row.averageRank != null ? row.averageRank.toFixed(2) : "-")}</TableCell>
                    <TableCell>
                      {row.medalLabel
                        ? <Chip size="small" label={row.medalLabel} color={row.source === "override" ? "warning" : "default"} />
                        : <Chip size="small" label="live" variant="outlined" />
                      }
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={t(language, row.source === "frozen" || row.source === "override" ? "judgeFrozenAward" : "judgeMonitorTitle")} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      {(row.source === "frozen" || row.source === "override") && (
                        <IconButton size="small" color="warning" onClick={() => {
                          // TODO: needs awardId from backend, using row.id (frozen) or modelId as placeholder
                          setOverridingAward(row.id ?? row.modelId);
                          setOverrideMedalLabel(row.medalLabel ?? "");
                          setOverrideMedalRank(row.medalRank ?? 0);
                          setOverrideOpen(true);
                        }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {corrections.length === 0 && correctionsEventId && (
                  <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">{t(language, "adminNoData")}</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </SectionCard>

      {confirmNode}
      <Dialog open={overrideOpen} onClose={() => setOverrideOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t(language, "judgeOverrideLabel")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField size="small" label={t(language, "judgeAwardBracketMedal")} value={overrideMedalLabel}
              onChange={(e) => setOverrideMedalLabel(e.target.value)} fullWidth />
            <TextField size="small" label={t(language, "judgeAwardBracketRank")} type="number" value={overrideMedalRank}
              onChange={(e) => setOverrideMedalRank(Number(e.target.value))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={saveOverride} variant="contained">{t(language, "profileSaveButton")}</Button>
          <Button onClick={() => setOverrideOpen(false)}>{t(language, "profileCancelButton")}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
