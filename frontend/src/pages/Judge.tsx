import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { api } from "../lib/api";
import { Language, t, TranslationKey } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import PageSkeleton from "../components/PageSkeleton";
import EmptyState from "../components/EmptyState";
import useToast from "../components/useToast";
import { ActionButton, TipIconButton } from "../components/ActionButton";

// ---- Types ----
type JudgeEvent = { eventId: string; eventName: string };

type JudgeModel = {
  id: string;
  code: number | null;
  categoryId?: string;
  categoryName?: string;
  name: string | null;
  description?: string | null;
  imageUrl: string | null;
  currentRank: number | null;
  /** Public model notes (owner/judges/managers). internalNotes is never sent to judges. */
  notes?: string | null;
};

/** A display (vetrina) from GET /judge/displays: anonymous, one tile per displayNumber. */
type JudgeDisplay = {
  displayNumber: number;
  categoryId: string;
  categoryName: string;
  categoryStatus?: string;
  /** Every model the judge must vote on has a vote. */
  judged: boolean;
  /** ["DISCORDANT_VOTES"] only during reconciliation. */
  issues: string[];
  models: JudgeModel[];
};

type Phase = "judging" | "reconciliation" | "closed";
type PhaseInfo = { phase: Phase; discordantModelIds: string[] };

type Screen = "home" | "score";

// ---- Rank colours (Emperor palette) ----
const RANK_COLOR: Record<number, string> = {
  4: "#C8860A",  // Gold
  3: "#7B7B7B",  // Silver
  2: "#7C4A1E",  // Bronze
  1: "#1565C0",  // Highly Commended (blue, distinct from 0)
  0: "#B71C1C",  // None (red — clearly "no award")
};

const RANK_KEY: Record<number, string> = {
  0: "rankName0",
  1: "rankName1",
  2: "rankName2",
  3: "rankName3",
  4: "rankName4",
};

const PHASE_KEY: Record<Phase, TranslationKey> = {
  judging: "judgePhaseJudging",
  reconciliation: "judgePhaseReconciliation",
  closed: "judgePhaseClosed",
};

const DISCORDANT_VOTES = "DISCORDANT_VOTES";

function rankColor(maxRank: number): string {
  return RANK_COLOR[maxRank] ?? "#616161";
}

function displayKey(d: JudgeDisplay): string {
  return `${d.categoryId}:${d.displayNumber}`;
}

function displayMaxRank(models: JudgeModel[]): number | null {
  const ranks = models
    .map((m) => m.currentRank)
    .filter((r): r is number => r !== null);
  if (ranks.length === 0) return null;
  return Math.max(...ranks);
}

function isDiscordant(d: JudgeDisplay): boolean {
  return d.issues.includes(DISCORDANT_VOTES);
}

// Judging: judged displays are hidden. Reconciliation: only displays with discordant votes. Closed: all (read-only).
function hiddenByDefault(d: JudgeDisplay, phase: Phase): boolean {
  if (phase === "closed") return false;
  if (phase === "reconciliation") return !isDiscordant(d);
  return d.judged;
}

function toPhaseInfo(res: any): PhaseInfo {
  const phase: Phase = res?.phase === "reconciliation" || res?.phase === "closed" ? res.phase : "judging";
  return { phase, discordantModelIds: Array.isArray(res?.discordantModelIds) ? res.discordantModelIds : [] };
}

function errorMessage(err: any, language: Language, categoryScoped = false): string {
  const status = err?.status;
  if (categoryScoped && (status === 403 || status === 404)) return t(language, "judgeCategoryNotAssigned");
  return err?.message || t(language, "judgeError");
}

// ---- Component ----
interface JudgeProps {
  language: Language;
}

export default function Judge({ language }: JudgeProps) {
  // -- global --
  const [events, setEvents] = useState<JudgeEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [displays, setDisplays] = useState<JudgeDisplay[]>([]);
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo | null>(null);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [displaysLoading, setDisplaysLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (eventsLoaded && !displaysLoading) setReady(true);
  }, [eventsLoaded, displaysLoading]);

  // -- home screen --
  const [showAll, setShowAll] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completionState, setCompletionState] = useState<{
    allDone: boolean;
    totalJudges: number;
    completedJudges: number;
  } | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState(false);
  // Latest selection, used to discard responses that arrive after a change of event/category.
  const selectionRef = useRef({ eventId: "", categoryId: "" });
  selectionRef.current = { eventId, categoryId };
  const displaysReqRef = useRef(0);

  // -- score screen --
  const [screen, setScreen] = useState<Screen>("home");
  const [activeDisplay, setActiveDisplay] = useState<JudgeDisplay | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState(true); // true = whole display, false = individual
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // ---- Data loading ----
  async function loadEvents() {
    try {
      const res = await api<JudgeEvent[]>("/judge/events");
      setEvents(res);
      if (res.length > 0) {
        setDisplaysLoading(true);
        setEventId(res[0].eventId);
      }
    } catch (err: any) {
      toast.error(errorMessage(err, language));
    } finally {
      setEventsLoaded(true);
    }
  }

  async function loadCategories(eid: string) {
    if (!eid) { setCategories([]); return; }
    try {
      setCategories(await api<{ id: string; name: string }[]>(`/public/categories?eventId=${encodeURIComponent(eid)}`));
    } catch {
      setCategories([]);
    }
  }

  async function loadDisplays(): Promise<JudgeDisplay[] | null> {
    const query = new URLSearchParams();
    if (eventId) query.set("eventId", eventId);
    if (categoryId) query.set("categoryId", categoryId);
    const reqId = ++displaysReqRef.current;
    setDisplaysLoading(true);
    try {
      const res = await api<JudgeDisplay[]>(`/judge/displays?${query.toString()}`);
      if (reqId !== displaysReqRef.current) return null;
      setDisplays(res);
      return res;
    } catch (err: any) {
      if (reqId === displaysReqRef.current) toast.error(errorMessage(err, language, !!categoryId));
      return null;
    } finally {
      if (reqId === displaysReqRef.current) setDisplaysLoading(false);
    }
  }

  async function loadPhase(cid: string) {
    try {
      const res = await api<any>(`/judge/categories/${cid}/completion`);
      if (selectionRef.current.categoryId !== cid) return;
      setPhaseInfo(toPhaseInfo(res));
    } catch {
      if (selectionRef.current.categoryId === cid) setPhaseInfo(null);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setCategoryId("");
    setCompletionState(null);
    setPolling(false);
    setPollError(false);
    loadCategories(eventId);
    loadDisplays();
  }, [eventId]);

  useEffect(() => {
    setCompletionState(null);
    setPolling(false);
    setPollError(false);
    setPhaseInfo(null);
    if (categoryId) void loadPhase(categoryId);
    loadDisplays();
  }, [categoryId]);

  // Completion polling: bound to the selected category, stopped on change/unmount,
  // late responses ignored, paused while the tab is hidden.
  useEffect(() => {
    if (!polling || !categoryId) return;
    let cancelled = false;
    const cid = categoryId;
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const poll = await api<any>(`/judge/categories/${cid}/completion`);
        if (cancelled || selectionRef.current.categoryId !== cid) return;
        setPollError(false);
        setCompletionState({ allDone: poll.allDone, totalJudges: poll.totalJudges, completedJudges: poll.completedJudges });
        if (poll.phase) setPhaseInfo(toPhaseInfo(poll));
        if (poll.allDone || poll.status === "closed") setPolling(false);
      } catch (err: any) {
        if (cancelled || selectionRef.current.categoryId !== cid) return;
        if (err?.status === 403 || err?.status === 404) {
          setPolling(false);
          toast.error(t(language, "judgeCategoryNotAssigned"));
        } else {
          setPollError(true);
        }
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [polling, categoryId]);

  // ---- Derived state ----
  const phase: Phase = phaseInfo?.phase ?? "judging";
  const readOnly = phase === "closed";
  const discordantIds = new Set(phaseInfo?.discordantModelIds ?? []);

  // Defensive: keep only the selected category even if the backend ignores the filter.
  const visibleDisplays = categoryId ? displays.filter((d) => d.categoryId === categoryId) : displays;
  const allJudged = visibleDisplays.length > 0 && visibleDisplays.every((d) => d.judged);
  // Nothing left to do in the current phase.
  const allSettled = visibleDisplays.length > 0 && (phase === "reconciliation"
    ? visibleDisplays.every((d) => !isDiscordant(d))
    : allJudged);

  const displayedDisplays = visibleDisplays.filter((d) => {
    if (!showAll && hiddenByDefault(d, phase)) return false;
    if (filterText && !String(d.displayNumber).includes(filterText)) return false;
    return true;
  });

  // ---- Complete ----
  async function handleComplete() {
    if (!categoryId) return;
    const cid = categoryId;
    setCompleting(true);
    try {
      const res = await api<{ completed: boolean; allDone: boolean; totalJudges: number; completedJudges: number }>(
        `/judge/categories/${cid}/complete`,
        { method: "POST" }
      );
      if (selectionRef.current.categoryId !== cid) return;
      setCompletionState({ allDone: res.allDone, totalJudges: res.totalJudges, completedJudges: res.completedJudges });
      setPollError(false);
      setPolling(!res.allDone);
    } catch (err: any) {
      if (selectionRef.current.categoryId !== cid) return;
      if (err?.status === 409) {
        // Backend explains which/how many models are still unvoted: show its message.
        toast.error(err.message || t(language, "judgeCompleteConflict"));
      } else {
        toast.error(errorMessage(err, language, true));
      }
    } finally {
      setCompleting(false);
    }
  }

  // ---- Navigate to score screen ----
  function openScoreScreen(d: JudgeDisplay) {
    setActiveDisplay(d);
    // Pre-populate score: if all models in the display share the same rank, use it
    const ranks = d.models.map((m) => m.currentRank);
    const allSame = ranks.every((r) => r !== null && r === ranks[0]);
    setSelectedScore(allSame && ranks[0] !== null ? ranks[0] : null);
    setDisplayMode(true);
    setSelectedModels(new Set());
    setScreen("score");
  }

  function goHome() {
    setScreen("home");
    setActiveDisplay(null);
  }

  // ---- Toggle individual model selection ----
  function toggleModel(modelId: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }

  // ---- Submit vote ----
  async function handleSubmitScore() {
    if (!activeDisplay || selectedScore === null || readOnly) return;
    const current = activeDisplay;
    const targets = displayMode
      ? current.models.map((m) => m.id)
      : Array.from(selectedModels);
    if (targets.length === 0) return;

    setSubmitting(true);
    try {
      let notRecorded = 0;
      if (displayMode && eventId) {
        const res = await api<{ skippedClosedModelIds?: string[] }>("/judge/displays/vote", {
          method: "POST",
          body: JSON.stringify({ eventId, displayNumber: current.displayNumber, rank: selectedScore }),
        });
        notRecorded = res?.skippedClosedModelIds?.length ?? 0;
      } else {
        const results = await Promise.allSettled(
          targets.map((modelId) =>
            api("/judge/vote", {
              method: "POST",
              body: JSON.stringify({ modelId, rank: selectedScore }),
            })
          )
        );
        const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        // Every vote failed: surface the backend message and keep the selection for a retry.
        if (failed.length === targets.length) throw failed[0].reason;
        notRecorded = failed.length;
      }
      if (notRecorded > 0) {
        toast.error(t(language, "judgeVotePartial").replace("{n}", String(notRecorded)));
      } else {
        toast.success(t(language, "judgeVoteSuccess"));
      }
      const fresh = await loadDisplays();
      const updated = fresh?.find((d) => displayKey(d) === displayKey(current));
      if (notRecorded === 0 || !updated) {
        // Back to the tiles: a fully voted display disappears from the list.
        goHome();
      } else {
        // Partial failure: stay on the display with the refreshed votes.
        setActiveDisplay(updated);
        setSelectedModels(new Set());
        setSelectedScore(null);
        setDisplayMode(true);
      }
    } catch (err: any) {
      toast.error(errorMessage(err, language));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Render ----
  const submitDisabled =
    readOnly ||
    selectedScore === null ||
    submitting ||
    (!displayMode && selectedModels.size === 0);

  return (
    <PageContainer maxWidth="lg">
      {toast.node}

      {/* ============================================================
          SCREEN 1: Home – Anonymous display tiles
         ============================================================ */}
      {screen === "home" && !ready && <PageSkeleton variant="cards" rows={8} />}
      {screen === "home" && ready && (
        <Stack spacing={2}>
          {/* Top controls row */}
          <Stack data-tour="judge-filters" direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            {/* Event selector */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
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

            {/* Category selector */}
            <FormControl size="small" sx={{ minWidth: 180 }} disabled={!eventId}>
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

            {/* Phase of the selected class */}
            {categoryId && phaseInfo && (
              <Chip
                size="small"
                label={t(language, PHASE_KEY[phase])}
                color={phase === "reconciliation" ? "warning" : phase === "closed" ? "default" : "primary"}
                sx={{ fontWeight: 700 }}
              />
            )}

            {/* SHOW ALL toggle */}
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="body2">{t(language, "judgeShowAll")}</Typography>
              <Switch
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                size="small"
              />
            </Stack>
          </Stack>

          {/* Filter row */}
          <Stack data-tour="judge-search" direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label={t(language, "judgeFilterExhibit")}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              sx={{ maxWidth: 220 }}
            />
            {filterText && (
              <ActionButton tip={t(language, "tipJudgeClearFilter")} size="small" variant="outlined" onClick={() => setFilterText("")}>
                {t(language, "judgeClearFilter")}
              </ActionButton>
            )}
          </Stack>

          {/* Completion banner */}
          {completionState && (
            <Paper
              variant="outlined"
              sx={{ p: 1.5, bgcolor: completionState.allDone ? "success.light" : "info.light" }}
            >
              <Typography variant="body2">
                {completionState.allDone
                  ? t(language, "judgeAllDone")
                  : `${t(language, "judgeWaitingOthers")} (${completionState.completedJudges}/${completionState.totalJudges} ${t(language, "judgeCompletedCount")})`}
              </Typography>
            </Paper>
          )}

          {pollError && (
            <Typography variant="body2" color="warning.main">
              {t(language, "judgePollError")}
            </Typography>
          )}

          {/* "Nothing left in this phase" message while the list is hidden by default */}
          {!showAll && allSettled && displayedDisplays.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              {t(language, phase === "reconciliation" ? "judgeNoIssues" : "judgeAllJudged")}
            </Typography>
          )}
          {visibleDisplays.length === 0 && (
            <EmptyState title={t(language, "judgeNoModelsTitle")} description={t(language, "judgeNoModelsDescription")} />
          )}

          {/* Display tile grid: large, anonymous (number only) */}
          <Box
            data-tour="judge-grid"
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: 1.5,
            }}
          >
            {displayedDisplays.map((d) => {
              const maxRank = displayMaxRank(d.models);
              const discordant = isDiscordant(d);
              const bgColor = d.judged && maxRank !== null ? rankColor(maxRank) : undefined;

              return (
                <Tooltip key={displayKey(d)} title={t(language, "tipJudgeExhibitor")} describeChild>
                  <Paper
                    role="button"
                    tabIndex={0}
                    aria-label={`${t(language, "judgeExhibitor")} ${d.displayNumber} (${d.models.length})`}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openScoreScreen(d);
                      }
                    }}
                    variant={bgColor ? "elevation" : "outlined"}
                    elevation={bgColor ? 2 : 0}
                    onClick={() => openScoreScreen(d)}
                    sx={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      minHeight: 96,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      bgcolor: bgColor ?? "background.paper",
                      color: bgColor ? "#fff" : "text.primary",
                      borderRadius: 2,
                      outline: discordant ? "3px solid #B71C1C" : undefined,
                      userSelect: "none",
                      "&:hover": { opacity: 0.85 },
                      transition: "opacity 0.15s",
                    }}
                  >
                    <Typography variant="h5" fontWeight={700}>
                      {d.displayNumber}
                    </Typography>
                    {discordant && (
                      <ErrorOutlineIcon
                        color="error"
                        titleAccess={t(language, "judgeDiscordantExplain")}
                        sx={{ position: "absolute", top: 4, right: 4, bgcolor: "background.paper", borderRadius: "50%" }}
                      />
                    )}
                  </Paper>
                </Tooltip>
              );
            })}
          </Box>

          {/* JUDGING COMPLETE button */}
          {allJudged && categoryId && !readOnly && (
            <Box>
              <ActionButton
                tip={t(language, "tipJudgeComplete")}
                data-tour="judge-complete"
                variant="contained"
                color="success"
                disabled={completing}
                onClick={handleComplete}
                sx={{ mt: 1 }}
              >
                {completing ? "..." : t(language, "judgeCompleteButton")}
              </ActionButton>
            </Box>
          )}
        </Stack>
      )}

      {/* ============================================================
          SCREEN 2: Score screen
         ============================================================ */}
      {screen === "score" && activeDisplay && (
        <Stack spacing={2} data-tour-scope="judge-score">
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <TipIconButton tip={t(language, "tipJudgeBack")} data-tour="score-back" onClick={goHome} size="small" aria-label={t(language, "judgeBack")}>
              <ArrowBackIcon />
            </TipIconButton>

            {/* Display toggle */}
            <Stack data-tour="score-mode" direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="body2">{t(language, "judgeDisplayToggle")}</Typography>
              <Switch
                checked={displayMode}
                disabled={readOnly}
                onChange={(e) => {
                  setDisplayMode(e.target.checked);
                  if (e.target.checked) setSelectedModels(new Set()); // clear only when going to display mode
                }}
                size="small"
              />
            </Stack>
          </Stack>

          {/* Display label */}
          <Typography variant="h6" fontWeight={700}>
            {t(language, "judgeExhibitor")}: {activeDisplay.displayNumber}
          </Typography>

          {readOnly && <Alert severity="info">{t(language, "judgeReadOnly")}</Alert>}
          {isDiscordant(activeDisplay) && (
            <Alert severity="error" icon={<ErrorOutlineIcon />}>
              {t(language, "judgeDiscordantExplain")}
            </Alert>
          )}

          {/* Score buttons */}
          <Stack data-tour="score-values" spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              {t(language, "judgeCurrentVoteColumn")}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {[0, 1, 2, 3, 4].map((score) => {
                const isSelected = selectedScore === score;
                const color = RANK_COLOR[score];
                const name = t(language, RANK_KEY[score] as any);
                return (
                  <ActionButton
                    key={score}
                    tip={t(language, "tipJudgeScore").replace("{score}", String(score)).replace("{name}", name)}
                    variant={isSelected ? "contained" : "outlined"}
                    size="small"
                    disabled={readOnly}
                    onClick={() => setSelectedScore(score)}
                    sx={{
                      minWidth: 44,
                      minHeight: 44,
                      fontWeight: 700,
                      overflow: "hidden",
                      transition: "background-color 0.15s, border-color 0.15s, color 0.15s",
                      ...(isSelected
                        ? { bgcolor: color, "&:hover": { bgcolor: color }, color: "#fff" }
                        : { borderColor: color, color: color }),
                    }}
                  >
                    <Box component="span">{score}</Box>
                    <Box
                      component="span"
                      sx={{
                        maxWidth: isSelected ? "120px" : "0px",
                        overflow: "hidden",
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        verticalAlign: "middle",
                        transition: "max-width 0.2s ease, margin-left 0.2s ease",
                        ml: isSelected ? 0.5 : 0,
                      }}
                    >
                      {name}
                    </Box>
                  </ActionButton>
                );
              })}
            </Stack>
          </Stack>

          <Divider />

          {/* Select All / Deselect All */}
          {!displayMode && !readOnly && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
              <ActionButton tip={t(language, selectedModels.size === activeDisplay.models.length ? "tipJudgeDeselectAll" : "tipJudgeSelectAll")} size="small" variant="text" onClick={() => {
                if (selectedModels.size === activeDisplay.models.length) {
                  setSelectedModels(new Set());
                } else {
                  setSelectedModels(new Set(activeDisplay.models.map(m => m.id)));
                }
              }}>
                {selectedModels.size === activeDisplay.models.length ? t(language, "judgeDeselectAll") : t(language, "judgeSelectAll")}
              </ActionButton>
            </Box>
          )}

          {/* Model list */}
          <Stack data-tour="score-models" spacing={1}>
            {activeDisplay.models.map((model) => {
              const isSelected = selectedModels.has(model.id);
              const label = [
                model.code ?? "-",
                model.name ?? model.description ?? "",
              ]
                .filter(Boolean)
                .join("  ");

              return (
                <Paper
                  key={model.id}
                  variant="outlined"
                  onClick={() => {
                    if (readOnly) return;
                    if (displayMode) {
                      setDisplayMode(false);
                      setSelectedModels(new Set([model.id]));
                    } else {
                      toggleModel(model.id);
                    }
                  }}
                  sx={{
                    p: 1.5,
                    minHeight: 64,
                    cursor: readOnly ? "default" : "pointer",
                    bgcolor: isSelected && !displayMode ? "action.selected" : undefined,
                    borderColor: isSelected && !displayMode ? "primary.main" : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                    <Checkbox
                      checked={selectedModels.has(model.id) && !displayMode}
                      disabled={displayMode || readOnly}
                      size="small"
                      sx={{ p: 0, mr: 1 }}
                      onChange={() => {
                        if (displayMode) {
                          setDisplayMode(false);
                          setSelectedModels(new Set([model.id]));
                        } else {
                          toggleModel(model.id);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {model.imageUrl && (
                      <Avatar variant="rounded" src={model.imageUrl} alt="" sx={{ width: 56, height: 56, mr: 1.5 }} />
                    )}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2">{label}</Typography>
                      {model.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "pre-wrap" }}>
                          {t(language, "judgeModelNotes")}: {model.notes}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: 1, flexShrink: 0 }}>
                    {discordantIds.has(model.id) && (
                      <ErrorOutlineIcon color="error" fontSize="small" titleAccess={t(language, "judgeDiscordantExplain")} />
                    )}
                    {model.currentRank !== null && (
                      <Chip
                        size="small"
                        label={model.currentRank}
                        sx={{
                          bgcolor: RANK_COLOR[model.currentRank] ?? "#616161",
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      />
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          {/* Selection count hint */}
          {!displayMode && !readOnly && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>
              {selectedModels.size > 0
                ? t(language, selectedModels.size === 1 ? "judgeSelectedOne" : "judgeSelectedMany").replace("{n}", String(selectedModels.size))
                : t(language, "judgeNoneSelected")}
            </Typography>
          )}
          {displayMode && !readOnly && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>
              {t(language, "judgeAllModels").replace("{n}", String(activeDisplay.models.length))}
            </Typography>
          )}

          {/* Submit button */}
          <ActionButton
            tip={t(language, displayMode ? "tipJudgeVoteDisplay" : "tipJudgeSubmit")}
            data-tour="score-submit"
            variant="contained"
            color="primary"
            disabled={submitDisabled}
            onClick={handleSubmitScore}
            fullWidth
          >
            {displayMode
              ? t(language, "judgeVoteDisplay").replace("{n}", String(activeDisplay.models.length))
              : t(language, "judgeSubmitScore")}
          </ActionButton>
        </Stack>
      )}
    </PageContainer>
  );
}
