import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Popover,
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
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import EditNoteIcon from "@mui/icons-material/EditNote";
import HistoryIcon from "@mui/icons-material/History";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import EmptyState from "../components/EmptyState";
import useToast from "../components/useToast";

type JudgeEvent = { eventId: string; eventName: string };
type Model = {
  id: string;
  code: number | null;
  displayNumber: number | null;
  categoryId: string;
  categoryName: string;
  imageUrl?: string | null;
  currentRank?: number | null;
  voteCount?: number;
};
type VoteHistoryEntry = { id: string; rank: number; createdAt: string };

interface JudgeProps {
  language: Language;
}

export default function Judge({ language }: JudgeProps) {
  const [events, setEvents] = useState<JudgeEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [showAll, setShowAll] = useState(false);
  const toast = useToast();

  // Completion state
  const [completing, setCompleting] = useState(false);
  const [completionState, setCompletionState] = useState<{
    allDone: boolean; totalJudges: number; completedJudges: number
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Vote popover
  const [voteAnchor, setVoteAnchor] = useState<HTMLElement | null>(null);
  const [voteModelId, setVoteModelId] = useState("");
  const [voteRank, setVoteRank] = useState<number>(0);

  // Vote history popover
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const [historyModelId, setHistoryModelId] = useState("");
  const [historyVotes, setHistoryVotes] = useState<VoteHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modification request popover (Task 03: renamed to category-change request)
  const [modAnchor, setModAnchor] = useState<HTMLElement | null>(null);
  const [modModelId, setModModelId] = useState("");
  const [modReason, setModReason] = useState("");
  const [modSuggestedCategoryId, setModSuggestedCategoryId] = useState("");
  const [modCategories, setModCategories] = useState<{ id: string; name: string }[]>([]);

  async function loadEvents() {
    const res = await api<JudgeEvent[]>("/judge/events");
    setEvents(res);
    if (res.length === 1) {
      setEventId(res[0].eventId);
    }
  }

  async function loadCategories(eid: string) {
    if (!eid) { setCategories([]); return; }
    try { setCategories(await api<any[]>(`/public/categories?eventId=${encodeURIComponent(eid)}`)); }
    catch { setCategories([]); }
  }

  async function loadModels() {
    const query = new URLSearchParams();
    if (eventId) query.set("eventId", eventId);
    if (categoryId) query.set("categoryId", categoryId);
    if (search) query.set("search", search);
    setModels(await api<Model[]>(`/judge/models?${query.toString()}`));
  }

  useEffect(() => {
    loadEvents().catch((err) => toast.error(err.message));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    setCategoryId("");
    setCompletionState(null);
    loadCategories(eventId);
    loadModels().catch((err) => toast.error(err.message));
  }, [eventId]);

  useEffect(() => {
    setCompletionState(null);
    loadModels().catch((err) => toast.error(err.message));
  }, [categoryId]);

  // --- Complete ---
  async function handleComplete() {
    if (!categoryId) return;
    setCompleting(true);
    try {
      const res = await api<{ completed: boolean; allDone: boolean; totalJudges: number; completedJudges: number }>(
        `/judge/categories/${categoryId}/complete`,
        { method: "POST" }
      );
      setCompletionState({ allDone: res.allDone, totalJudges: res.totalJudges, completedJudges: res.completedJudges });
      if (!res.allDone) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const poll = await api<any>(`/judge/categories/${categoryId}/completion`);
            setCompletionState({ allDone: poll.allDone, totalJudges: poll.totalJudges, completedJudges: poll.completedJudges });
            if (poll.allDone || poll.status === "closed") {
              if (pollRef.current) clearInterval(pollRef.current);
            }
          } catch {}
        }, 5000);
      }
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setCompleting(false);
    }
  }

  // --- Vote ---
  function openVotePopover(el: HTMLElement, modelId: string) {
    const currentModel = models.find((model) => model.id === modelId);
    setVoteModelId(modelId);
    setVoteRank(currentModel?.currentRank ?? 0);
    setVoteAnchor(el);
  }

  async function submitVote() {
    try {
      await api("/judge/vote", { method: "POST", body: JSON.stringify({ modelId: voteModelId, rank: voteRank }) });
      await loadModels();
      if (historyModelId === voteModelId && historyAnchor) {
        await loadHistory(voteModelId);
      }
      toast.success(t(language, "judgeVoteSuccess"));
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
    setVoteAnchor(null);
  }

  async function loadHistory(modelId: string) {
    setHistoryLoading(true);
    try {
      const rows = await api<VoteHistoryEntry[]>(`/judge/models/${modelId}/votes`);
      setHistoryVotes(rows);
    } catch (err: any) {
      toast.error(err.message || "Error");
      setHistoryVotes([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistoryPopover(el: HTMLElement, modelId: string) {
    setHistoryModelId(modelId);
    setHistoryAnchor(el);
    await loadHistory(modelId);
  }

  // --- Category-change request (Task 03) ---
  async function openModPopover(el: HTMLElement, modelId: string) {
    setModModelId(modelId);
    setModReason("");
    setModSuggestedCategoryId("");
    setModAnchor(el);
    if (eventId) {
      try {
        const cats = await api<{ id: string; name: string }[]>(`/judge/categories?eventId=${encodeURIComponent(eventId)}`);
        setModCategories(cats);
      } catch {
        setModCategories([]);
      }
    }
  }

  async function submitModRequest() {
    try {
      await api("/judge/modification-requests", {
        method: "POST",
        body: JSON.stringify({
          modelId: modModelId,
          reason: modReason,
          suggestedCategoryId: modSuggestedCategoryId || undefined
        })
      });
      toast.success(t(language, "judgeModRequestSent"));
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
    setModAnchor(null);
  }

  const displayedModels = showAll ? models : models.filter(m => m.currentRank === null || m.currentRank === undefined);

  return (
    <PageContainer maxWidth="lg">
      {toast.node}
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "judgeTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">{t(language, "judgeRankHint")}</Typography>

        {/* Filters */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{t(language, "judgeSelectEvent")}</InputLabel>
            <Select
              value={eventId}
              label={t(language, "judgeSelectEvent")}
              onChange={(e) => setEventId(e.target.value)}
            >
              <MenuItem value="">{t(language, "judgeSelectEvent")}</MenuItem>
              {events.map((ev) => (
                <MenuItem key={ev.eventId} value={ev.eventId}>{ev.eventName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }} disabled={!eventId}>
            <InputLabel>{t(language, "modelsCategoryPlaceholder")}</InputLabel>
            <Select
              value={categoryId}
              label={t(language, "modelsCategoryPlaceholder")}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <MenuItem value="">{t(language, "adminJudgeAllCategories")}</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t(language, "judgeSearchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Button variant="contained" onClick={loadModels}>{t(language, "judgeRefreshButton")}</Button>
          <Button
            variant={showAll ? "contained" : "outlined"}
            size="small"
            onClick={() => setShowAll(v => !v)}
          >
            {showAll ? t(language, "judgeHideJudged") : t(language, "judgeShowAll")}
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={completing || !categoryId || models.length === 0}
            onClick={handleComplete}
          >
            {completing ? "..." : t(language, "judgeCompleteButton")}
          </Button>
        </Stack>

        {/* Completion status banner */}
        {completionState && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: completionState.allDone ? "success.light" : "info.light" }}>
            <Typography variant="body2">
              {completionState.allDone
                ? t(language, "judgeAllDone")
                : `${t(language, "judgeWaitingOthers")} (${completionState.completedJudges}/${completionState.totalJudges} ${t(language, "judgeCompletedCount")})`
              }
            </Typography>
          </Paper>
        )}

        {displayedModels.length === 0 && (
          <EmptyState title="Nessun modello da giudicare" />
        )}

        {/* Models table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCodeColumn")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCategoryPlaceholder")}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 160 }}>{t(language, "judgeCurrentVoteColumn")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, width: 170 }}>{t(language, "judgeActionsColumn")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedModels.map((model) => (
                <TableRow key={model.id} hover>
                  <TableCell><Typography fontWeight={600}>{model.displayNumber ?? model.code ?? "-"}</Typography></TableCell>
                  <TableCell><Chip size="small" label={model.categoryName} /></TableCell>
                  <TableCell>
                    {model.currentRank === null || model.currentRank === undefined ? (
                      <Chip size="small" label={t(language, "judgeNoVote")} color="error" variant="outlined" />
                    ) : (
                      <Chip
                        size="small"
                        label={`${model.currentRank} (${model.voteCount ?? 1})`}
                        color="success"
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        color="inherit"
                        title={t(language, "judgeVoteHistoryTitle")}
                        onClick={(e) => openHistoryPopover(e.currentTarget, model.id)}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        title={t(language, "judgeVoteTitle")}
                        onClick={(e) => openVotePopover(e.currentTarget, model.id)}
                      >
                        <HowToVoteIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="warning"
                        title={t(language, "judgeCategoryChangeTitle")}
                        onClick={(e) => openModPopover(e.currentTarget, model.id)}
                      >
                        <EditNoteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {/* Vote Popover */}
      <Popover
        open={Boolean(voteAnchor)}
        anchorEl={voteAnchor}
        onClose={() => setVoteAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1.5} sx={{ p: 2, minWidth: 220 }}>
          <Typography variant="subtitle2">{t(language, "judgeVoteTitle")}</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Rank</InputLabel>
            <Select value={voteRank} label="Rank" onChange={(e) => setVoteRank(Number(e.target.value))}>
              {[0, 1, 2, 3].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" size="small" onClick={submitVote}>{t(language, "judgeVoteButton")}</Button>
        </Stack>
      </Popover>

      {/* Vote History Popover */}
      <Popover
        open={Boolean(historyAnchor)}
        anchorEl={historyAnchor}
        onClose={() => setHistoryAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1} sx={{ p: 2, minWidth: 300, maxWidth: 420 }}>
          <Typography variant="subtitle2">{t(language, "judgeVoteHistoryTitle")}</Typography>
          {historyLoading && (
            <Typography variant="body2" color="text.secondary">
              {t(language, "judgeHistoryLoading")}
            </Typography>
          )}
          {!historyLoading && historyVotes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {t(language, "judgeNoVote")}
            </Typography>
          )}
          {!historyLoading && historyVotes.length > 0 && (
            <Stack spacing={0.5}>
              {historyVotes.map((vote) => (
                <Stack key={vote.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Chip size="small" color="primary" label={`Rank ${vote.rank}`} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(vote.createdAt).toLocaleString()}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Popover>

      {/* Category-Change Request Popover (Task 03) */}
      <Popover
        open={Boolean(modAnchor)}
        anchorEl={modAnchor}
        onClose={() => setModAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1.5} sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="subtitle2">{t(language, "judgeCategoryChangeTitle")}</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>{t(language, "judgeSuggestedCategory")}</InputLabel>
            <Select
              value={modSuggestedCategoryId}
              label={t(language, "judgeSuggestedCategory")}
              onChange={(e) => setModSuggestedCategoryId(e.target.value)}
            >
              <MenuItem value="">{t(language, "judgeNoCategory")}</MenuItem>
              {modCategories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t(language, "judgeModRequestReason")}
            value={modReason}
            onChange={(e) => setModReason(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
          <Button variant="contained" size="small" onClick={submitModRequest} disabled={!modReason.trim()}>
            {t(language, "judgeModRequestSubmit")}
          </Button>
        </Stack>
      </Popover>
    </PageContainer>
  );
}
