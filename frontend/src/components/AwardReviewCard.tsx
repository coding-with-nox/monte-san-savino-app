import React, { useState } from "react";
import {
  Alert, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import useToast from "./useToast";
import { ActionButton, TipIconButton } from "./ActionButton";

type ReviewCategory = { id: string; eventId: string; name: string; status: string };
type Bracket = { id: string; medalLabel: string; medalRank: number };
type ReviewResponse = {
  brackets?: { medalLabel: string; medalRank: number }[];
  rows?: (Omit<ReviewRow, "modelName"> & { name?: string | null; modelName?: string | null })[];
};
/** One row of GET /awards/categories/:categoryId/review (closed classes only). */
export type ReviewRow = {
  modelId: string;
  modelName: string;
  code?: string | null;
  displayNumber?: number | null;
  totalScore: number | null;
  award: { id: string; medalLabel: string | null; medalRank: number | null } | null;
  issues?: string[];
  source: string;
  overrideNote?: string | null;
  votes?: { judgeName: string; rank: number }[];
};

const ISSUE_KEYS: Record<string, { label: "adminIssuePartialVotes" | "adminIssueDiscordantVotes"; tip: "tipIssuePartialVotes" | "tipIssueDiscordantVotes" }> = {
  PARTIAL_VOTES: { label: "adminIssuePartialVotes", tip: "tipIssuePartialVotes" },
  DISCORDANT_VOTES: { label: "adminIssueDiscordantVotes", tip: "tipIssueDiscordantVotes" }
};

const knownIssues = (row: ReviewRow) => (row.issues ?? []).filter((issue) => issue in ISSUE_KEYS);

/**
 * Jury review of closed classes: medals, issues and each judge's vote, with a manual medal correction
 * (PATCH /awards/:awardId). Used by the manager's Awards tab and by the jury president in Stats.
 */
export default function AwardReviewCard({ language, events }: { language: Language; events: { id: string; name: string }[] }) {
  const toast = useToast();
  const [eventId, setEventId] = useState("");
  const [categories, setCategories] = useState<ReviewCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [bracketsFailed, setBracketsFailed] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [openVotes, setOpenVotes] = useState<string[]>([]);
  const [target, setTarget] = useState<ReviewRow | null>(null);
  const [bracketId, setBracketId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function selectEvent(id: string) {
    setEventId(id);
    setCategoryId("");
    setRows([]);
    setCategories([]);
    setBrackets([]);
    setBracketsFailed(false);
    if (!id) return;
    try {
      const all = await api<ReviewCategory[]>("/public/categories");
      setCategories(all.filter((c) => c.eventId === id && c.status === "closed"));
    } catch {
      setCategories([]);
    }
  }

  async function loadRows(id: string) {
    if (!id) { setRows([]); return; }
    try {
      // The review carries the event brackets too: the jury president cannot read the manager-only /admin/award-brackets.
      const res = await api<ReviewResponse>(`/awards/categories/${encodeURIComponent(id)}/review`);
      const list = res?.brackets ?? [];
      setBrackets(list.map((b) => ({ id: `${b.medalRank}:${b.medalLabel}`, medalLabel: b.medalLabel, medalRank: b.medalRank })));
      setBracketsFailed(list.length === 0);
      setRows((res?.rows ?? []).map(({ name, modelName, ...row }) => ({ ...row, modelName: (modelName ?? name ?? "") as string })));
    } catch (err: any) {
      setRows([]);
      setBrackets([]);
      toast.error(err?.message ?? String(err));
    }
  }

  async function selectCategory(id: string) {
    setCategoryId(id);
    setOpenVotes([]);
    await loadRows(id);
  }

  function toggleVotes(modelId: string) {
    setOpenVotes((ids) => (ids.includes(modelId) ? ids.filter((id) => id !== modelId) : [...ids, modelId]));
  }

  function openCorrection(row: ReviewRow) {
    const current = brackets.find((b) => b.medalLabel === row.award?.medalLabel && b.medalRank === row.award?.medalRank);
    setTarget(row);
    setBracketId(current?.id ?? "");
    setNote("");
  }

  function correctionError(err: any) {
    if (err?.status === 422) return t(language, "reviewErrorInvalidMedal");
    if (err?.status === 409) return t(language, "reviewErrorNotClosed");
    return err?.message ?? String(err);
  }

  async function saveCorrection() {
    const bracket = brackets.find((b) => b.id === bracketId);
    if (!target?.award || !bracket) return;
    setSaving(true);
    try {
      await api(`/awards/${encodeURIComponent(target.award.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ medalLabel: bracket.medalLabel, medalRank: bracket.medalRank, note: note.trim() || undefined })
      });
      toast.success(t(language, "reviewSaved"));
      setTarget(null);
      await loadRows(categoryId);
    } catch (err: any) {
      toast.error(correctionError(err));
    } finally {
      setSaving(false);
    }
  }

  const pending = rows.filter((row) => knownIssues(row).length > 0).length;

  return (
    <Stack spacing={2}>
      {toast.node}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
          <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
          <Select value={eventId} label={t(language, "adminJudgeEventPlaceholder")} onChange={(e) => void selectEvent(e.target.value)}>
            {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200, flex: 1 }} disabled={!eventId}>
          <InputLabel>{t(language, "reviewClassPlaceholder")}</InputLabel>
          <Select value={categoryId} label={t(language, "reviewClassPlaceholder")} onChange={(e) => void selectCategory(e.target.value)}>
            {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        {categoryId && <Chip color={pending > 0 ? "warning" : "success"} label={`${pending} ${t(language, "reviewPending")}`} />}
      </Stack>

      {eventId && categories.length === 0 && (
        <Typography variant="body2" color="text.secondary">{t(language, "reviewNoClosedClasses")}</Typography>
      )}
      {bracketsFailed && <Alert severity="warning">{t(language, "reviewBracketsError")}</Alert>}

      {categoryId && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsModel")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsScore")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsAward")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsSource")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const issues = knownIssues(row);
                const open = openVotes.includes(row.modelId);
                return (
                  <React.Fragment key={row.modelId}>
                    <TableRow data-flagged={issues.length > 0 || undefined} sx={{ bgcolor: issues.length > 0 ? "warning.light" : undefined }}>
                      <TableCell>{row.displayNumber ?? "-"}</TableCell>
                      <TableCell>
                        <span>{row.modelName}</span>
                        {row.code && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{row.code}</Typography>}
                        {issues.map((issue) => (
                          <Tooltip key={issue} title={t(language, ISSUE_KEYS[issue].tip)}>
                            <Chip size="small" color="warning" variant="outlined" sx={{ ml: 1 }} label={t(language, ISSUE_KEYS[issue].label)} />
                          </Tooltip>
                        ))}
                      </TableCell>
                      <TableCell>{row.totalScore ?? "-"}</TableCell>
                      <TableCell>
                        {row.award?.medalLabel ? <Chip size="small" label={row.award.medalLabel} /> : <Chip size="small" variant="outlined" label="-" />}
                      </TableCell>
                      <TableCell>
                        {row.source === "override" && (
                          <Tooltip title={row.overrideNote || t(language, "tipReviewCorrected")}>
                            <Chip size="small" color="warning" label={t(language, "reviewCorrected")} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <TipIconButton
                            tip={t(language, "tipReviewVotes")}
                            aria-label={`${t(language, "reviewVotes")} ${row.modelName}`}
                            size="small"
                            onClick={() => toggleVotes(row.modelId)}
                          >
                            <KeyboardArrowDownIcon fontSize="small" sx={{ transform: open ? "rotate(180deg)" : undefined }} />
                          </TipIconButton>
                          <ActionButton
                            tip={t(language, "tipReviewCorrect")}
                            size="small"
                            variant="outlined"
                            color="warning"
                            disabled={!row.award}
                            onClick={() => openCorrection(row)}
                          >
                            {t(language, "reviewCorrect")}
                          </ActionButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>{t(language, "reviewVoteJudge")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{t(language, "reviewVoteRank")}</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(row.votes ?? []).map((vote) => (
                                <TableRow key={vote.judgeName}>
                                  <TableCell>{vote.judgeName}</TableCell>
                                  <TableCell align="right">{vote.rank}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">{t(language, "adminNoData")}</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t(language, "reviewDialogTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">{t(language, "reviewOverrideWarning")}</Alert>
            <FormControl size="small" fullWidth>
              <InputLabel>{t(language, "reviewBracket")}</InputLabel>
              <Select value={bracketId} label={t(language, "reviewBracket")} onChange={(e) => setBracketId(e.target.value)}>
                {brackets.map((b) => <MenuItem key={b.id} value={b.id}>{b.medalLabel}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label={t(language, "reviewNote")} value={note} onChange={(e) => setNote(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton tip={t(language, "tipReviewConfirm")} variant="contained" color="warning" disabled={!bracketId || saving} onClick={saveCorrection}>
            {t(language, "reviewConfirm")}
          </ActionButton>
          <ActionButton tip={t(language, "tipDialogCancel")} onClick={() => setTarget(null)}>{t(language, "profileCancelButton")}</ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
