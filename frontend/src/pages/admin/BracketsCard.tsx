import React, { useMemo, useState } from "react";
import {
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import { useConfirm } from "../../components/ConfirmDialog";
import useToast from "../../components/useToast";
import type { AdminData } from "./useAdminData";
import { DEFAULT_VOTES_PER_EXHIBIT, MAX_VOTE_POINTS } from "./JudgingRulesCard";
import { ActionButton, TipIconButton } from "../../components/ActionButton";

type AwardBracket = { id: string; eventId: string; medalLabel: string; medalRank: number; lowLimit: number; highLimit: number };
type BracketDraft = { medalLabel: string; medalRank: string; lowLimit: string; highLimit: string };

const toWhole = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);
const rangeLabel = (b: AwardBracket) => `${b.medalLabel} (${b.lowLimit}-${b.highLimit})`;

/** Loads brackets on demand: only when an event is picked, never at tab open. */
export default function BracketsCard({ language, data }: { language: Language; data: AdminData }) {
  const { events } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const toast = useToast();
  const [brackets, setBrackets] = useState<AwardBracket[]>([]);
  const [eventId, setEventId] = useState("");
  const [form, setForm] = useState({ medalLabel: "", medalRank: 0, lowLimit: 0, highLimit: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BracketDraft>({ medalLabel: "", medalRank: "", lowLimit: "", highLimit: "" });
  const [votesPerExhibit, setVotesPerExhibit] = useState(DEFAULT_VOTES_PER_EXHIBIT);
  const sorted = useMemo(() => [...brackets].sort((a, b) => a.medalRank - b.medalRank), [brackets]);

  // Scores go from 0 to votes × MAX_VOTE_POINTS: brackets must not overlap and must cover that range.
  const coverage = useMemo(() => {
    const overlaps: [AwardBracket, AwardBracket][] = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (a.lowLimit <= b.highLimit && b.lowLimit <= a.highLimit) overlaps.push([a, b]);
      }
    }
    const maxTotal = votesPerExhibit * MAX_VOTE_POINTS;
    const gaps: string[] = [];
    let start: number | null = null;
    for (let point = 0; point <= maxTotal; point++) {
      const covered = sorted.some((b) => b.lowLimit <= point && point <= b.highLimit);
      if (!covered && start === null) start = point;
      if (start !== null && (covered || point === maxTotal)) {
        const end = covered ? point - 1 : point;
        gaps.push(start === end ? `${start}` : `${start}-${end}`);
        start = null;
      }
    }
    return { overlaps, gaps, maxTotal };
  }, [sorted, votesPerExhibit]);

  async function loadBrackets(id: string) {
    if (!id) { setBrackets([]); return; }
    try { setBrackets(await api<AwardBracket[]>(`/admin/award-brackets?eventId=${encodeURIComponent(id)}`)); }
    catch { setBrackets([]); }
    // The coverage check needs the judging rule (votes per exhibit): read it with the brackets, never at tab open.
    api<Record<string, string>>("/settings")
      .then((s) => {
        const n = Number.parseInt(s.maxVotesPerExhibitor ?? "", 10);
        if (Number.isFinite(n) && n >= 1) setVotesPerExhibit(n);
      })
      .catch(() => undefined);
  }
  async function createBracket() {
    if (!eventId || !form.medalLabel.trim()) return;
    await api("/admin/award-brackets", { method: "POST", body: JSON.stringify({ eventId, ...form }) });
    setForm({ medalLabel: "", medalRank: 0, lowLimit: 0, highLimit: 0 });
    await loadBrackets(eventId);
  }
  async function loadMssPreset() {
    if (!eventId) return;
    if (!(await confirm(t(language, "judgeAwardBracketMssConfirm"), { destructive: false }))) return;
    try {
      await api("/admin/award-brackets/preset", { method: "POST", body: JSON.stringify({ eventId }) });
      await loadBrackets(eventId);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }
  function startEdit(br: AwardBracket) {
    setEditingId(br.id);
    setDraft({ medalLabel: br.medalLabel, medalRank: String(br.medalRank), lowLimit: String(br.lowLimit), highLimit: String(br.highLimit) });
  }
  async function saveEdit() {
    if (!editingId) return;
    const rank = toWhole(draft.medalRank);
    const low = toWhole(draft.lowLimit);
    const high = toWhole(draft.highLimit);
    if (!draft.medalLabel.trim() || rank === null || low === null || high === null || low > high) {
      toast.error(t(language, "judgeAwardBracketInvalid"));
      return;
    }
    try {
      await api(`/admin/award-brackets/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ medalLabel: draft.medalLabel.trim(), medalRank: rank, lowLimit: low, highLimit: high })
      });
      setEditingId(null);
      await loadBrackets(eventId);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }
  async function deleteBracket(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/admin/award-brackets/${id}`, { method: "DELETE" });
    await loadBrackets(eventId);
  }

  return (
    <>
      <SectionCard tourId="admin-brackets" title={t(language, "judgeAwardBracketsTitle")}>
        <Stack spacing={1} sx={{ mb: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
            <Select
              value={eventId}
              label={t(language, "adminJudgeEventPlaceholder")}
              onChange={(e) => { setEventId(e.target.value); setEditingId(null); void loadBrackets(e.target.value); }}
            >
              {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row">
            <ActionButton tip={t(language, "tipBracketMss")} variant="outlined" size="small" onClick={loadMssPreset} disabled={!eventId}>
              {t(language, "judgeAwardBracketMss")}
            </ActionButton>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField size="small" label={t(language, "judgeAwardBracketMedal")} value={form.medalLabel}
              onChange={(e) => setForm({ ...form, medalLabel: e.target.value })} sx={{ minWidth: 160 }} />
            <TextField size="small" label={t(language, "judgeAwardBracketRank")} type="number" value={form.medalRank}
              onChange={(e) => setForm({ ...form, medalRank: Number(e.target.value) })} sx={{ width: 80 }} />
            <TextField size="small" label={t(language, "judgeAwardBracketLow")} type="number" value={form.lowLimit}
              onChange={(e) => setForm({ ...form, lowLimit: Number(e.target.value) })} sx={{ width: 90 }} />
            <TextField size="small" label={t(language, "judgeAwardBracketHigh")} type="number" value={form.highLimit}
              onChange={(e) => setForm({ ...form, highLimit: Number(e.target.value) })} sx={{ width: 90 }} />
            <ActionButton tip={t(language, "tipBracketAdd")} variant="contained" size="small" onClick={createBracket}
              disabled={!eventId || !form.medalLabel.trim()}>
              {t(language, "judgeAwardBracketAdd")}
            </ActionButton>
          </Stack>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketMedal")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketRank")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketLow")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketHigh")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((br) => editingId === br.id ? (
                <TableRow key={br.id}>
                  <TableCell>
                    <TextField size="small" value={draft.medalLabel} onChange={(e) => setDraft({ ...draft, medalLabel: e.target.value })} sx={{ minWidth: 120 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={draft.medalRank} onChange={(e) => setDraft({ ...draft, medalRank: e.target.value })} sx={{ width: 80 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={draft.lowLimit} onChange={(e) => setDraft({ ...draft, lowLimit: e.target.value })} sx={{ width: 90 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={draft.highLimit} onChange={(e) => setDraft({ ...draft, highLimit: e.target.value })} sx={{ width: 90 }} />
                  </TableCell>
                  <TableCell align="right">
                    <ActionButton tip={t(language, "tipBracketSaveEdit")} variant="contained" size="small" onClick={saveEdit} sx={{ mr: 1 }}>
                      {t(language, "adminSave")}
                    </ActionButton>
                    <ActionButton tip={t(language, "tipDialogCancel")} size="small" onClick={() => setEditingId(null)}>
                      {t(language, "profileCancelButton")}
                    </ActionButton>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={br.id}>
                  <TableCell>{br.medalLabel}</TableCell>
                  <TableCell>{br.medalRank}</TableCell>
                  <TableCell>{br.lowLimit}</TableCell>
                  <TableCell>{br.highLimit}</TableCell>
                  <TableCell align="right">
                    <TipIconButton tip={t(language, "tipBracketEdit")} aria-label={`${t(language, "actionEdit")} ${br.medalLabel}`} size="small" onClick={() => startEdit(br)}>
                      <EditIcon fontSize="small" />
                    </TipIconButton>
                    <TipIconButton tip={t(language, "tipBracketDelete")} aria-label={`${t(language, "actionDelete")} ${br.medalLabel}`} size="small" color="error" onClick={() => deleteBracket(br.id)}>
                      <DeleteIcon fontSize="small" />
                    </TipIconButton>
                  </TableCell>
                </TableRow>
              ))}
              {brackets.length === 0 && eventId && (
                <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">{t(language, "adminNoData")}</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {sorted.length > 0 && (coverage.overlaps.length > 0 || coverage.gaps.length > 0) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {coverage.overlaps.length > 0 && (
              <Typography variant="body2">
                {t(language, "judgeAwardBracketOverlap").replace("{pairs}", coverage.overlaps.map(([a, b]) => `${rangeLabel(a)} / ${rangeLabel(b)}`).join("; "))}
              </Typography>
            )}
            {coverage.gaps.length > 0 && (
              <Typography variant="body2">
                {t(language, "judgeAwardBracketGap").replace("{max}", String(coverage.maxTotal)).replace("{gaps}", coverage.gaps.join(", "))}
              </Typography>
            )}
          </Alert>
        )}
      </SectionCard>
      {toast.node}
      {confirmNode}
    </>
  );
}
