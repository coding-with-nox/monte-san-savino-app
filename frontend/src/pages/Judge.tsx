import React, { useEffect, useRef, useState } from "react";
import {
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
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
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
  displayNumber: number | null;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
  currentRank: number | null;
  voteCount: number;
  userId: string;
  name: string | null;
  description: string | null;
  /** Public model notes (owner/judges/managers). internalNotes is never sent to judges. */
  notes?: string | null;
};

/** A display case (vetrina): the models of one participant sharing a displayNumber. */
type Exhibitor = {
  key: string;
  displayNum: string;
  models: JudgeModel[];
};

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

function rankColor(maxRank: number): string {
  return RANK_COLOR[maxRank] ?? "#616161";
}

function exhibitorDisplayNum(models: JudgeModel[]): string {
  const nums = models
    .map((m) => m.displayNumber ?? m.code)
    .filter((n): n is number => n !== null);
  if (nums.length === 0) return "-";
  return String(Math.min(...nums));
}

// A displayNumber is unique within an event. Without a selected event (or number) group per participant too.
function groupByDisplay(models: JudgeModel[], eventId: string): Exhibitor[] {
  const map = new Map<string, JudgeModel[]>();
  for (const m of models) {
    const key = m.displayNumber !== null && eventId ? `d:${m.displayNumber}` : `${m.userId}:${m.displayNumber ?? ""}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries())
    .map(([key, ms]) => ({ key, displayNum: exhibitorDisplayNum(ms), models: ms }))
    .sort((a, b) => a.displayNum.localeCompare(b.displayNum, undefined, { numeric: true }));
}

function errorMessage(err: any, language: Language, categoryScoped = false): string {
  const status = err?.status;
  if (categoryScoped && (status === 403 || status === 404)) return t(language, "judgeCategoryNotAssigned");
  return err?.message || t(language, "judgeError");
}

function exhibitorFullyJudged(ex: Exhibitor): boolean {
  return ex.models.every((m) => m.currentRank !== null);
}

function exhibitorMaxRank(ex: Exhibitor): number | null {
  const ranks = ex.models
    .map((m) => m.currentRank)
    .filter((r): r is number => r !== null);
  if (ranks.length === 0) return null;
  return Math.max(...ranks);
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
  const [models, setModels] = useState<JudgeModel[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (eventsLoaded && !modelsLoading) setReady(true);
  }, [eventsLoaded, modelsLoading]);

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
  const modelsReqRef = useRef(0);

  // -- score screen --
  const [screen, setScreen] = useState<Screen>("home");
  const [activeExhibitor, setActiveExhibitor] = useState<Exhibitor | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState(true); // true = all models, false = individual
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // ---- Data loading ----
  async function loadEvents() {
    try {
      const res = await api<JudgeEvent[]>("/judge/events");
      setEvents(res);
      if (res.length > 0) {
        setModelsLoading(true);
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

  async function loadModels() {
    const query = new URLSearchParams();
    if (eventId) query.set("eventId", eventId);
    if (categoryId) query.set("categoryId", categoryId);
    const reqId = ++modelsReqRef.current;
    setModelsLoading(true);
    try {
      const res = await api<JudgeModel[]>(`/judge/models?${query.toString()}`);
      if (reqId === modelsReqRef.current) setModels(res);
    } catch (err: any) {
      if (reqId === modelsReqRef.current) toast.error(errorMessage(err, language, !!categoryId));
    } finally {
      if (reqId === modelsReqRef.current) setModelsLoading(false);
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
    loadModels();
  }, [eventId]);

  useEffect(() => {
    setCompletionState(null);
    setPolling(false);
    setPollError(false);
    loadModels();
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
  // Defensive: keep only the selected category even if the backend ignores the filter.
  const visibleModels = categoryId ? models.filter((m) => m.categoryId === categoryId) : models;
  const allExhibitors = groupByDisplay(visibleModels, eventId);

  const displayedExhibitors = allExhibitors.filter((ex) => {
    if (!showAll && exhibitorFullyJudged(ex)) return false;
    if (filterText && !ex.displayNum.includes(filterText)) return false;
    return true;
  });

  const allFullyJudged = allExhibitors.length > 0 && allExhibitors.every(exhibitorFullyJudged);

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
  function openScoreScreen(ex: Exhibitor) {
    setActiveExhibitor(ex);
    // Pre-populate score: if all models in the group share the same rank, use it
    const ranks = ex.models.map((m) => m.currentRank);
    const allSame = ranks.every((r) => r !== null && r === ranks[0]);
    setSelectedScore(allSame && ranks[0] !== null ? ranks[0] : null);
    setDisplayMode(true);
    setSelectedModels(new Set());
    setScreen("score");
  }

  function goHome() {
    setScreen("home");
    setActiveExhibitor(null);
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
    if (!activeExhibitor || selectedScore === null) return;
    const targets = displayMode
      ? activeExhibitor.models.map((m) => m.id)
      : Array.from(selectedModels);
    if (targets.length === 0) return;

    setSubmitting(true);
    try {
      const displayNumber = activeExhibitor.models[0]?.displayNumber ?? null;
      let notRecorded = 0;
      if (displayMode && eventId && displayNumber !== null) {
        const res = await api<{ skippedClosedModelIds?: string[] }>("/judge/displays/vote", {
          method: "POST",
          body: JSON.stringify({ eventId, displayNumber, rank: selectedScore }),
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
      // Reload models and refresh active exhibitor in place (don't navigate home)
      const query = new URLSearchParams();
      if (eventId) query.set("eventId", eventId);
      if (categoryId) query.set("categoryId", categoryId);
      const freshAll = await api<JudgeModel[]>(`/judge/models?${query.toString()}`);
      const fresh = categoryId ? freshAll.filter((m) => m.categoryId === categoryId) : freshAll;
      setModels(freshAll);
      const grouped = groupByDisplay(fresh, eventId);
      const updated = grouped.find((ex) => ex.key === activeExhibitor.key);
      if (updated) {
        setActiveExhibitor(updated);
      }
      setSelectedModels(new Set());
      setSelectedScore(null);
      setDisplayMode(true);
    } catch (err: any) {
      toast.error(errorMessage(err, language));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Render ----
  const submitDisabled =
    selectedScore === null ||
    submitting ||
    (!displayMode && selectedModels.size === 0);

  return (
    <PageContainer maxWidth="lg">
      {toast.node}

      {/* ============================================================
          SCREEN 1: Home – Exhibitor grid
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

          {/* "All judged" message in subtractive mode */}
          {!showAll && allFullyJudged && displayedExhibitors.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              {t(language, "judgeAllJudged")}
            </Typography>
          )}
          {allExhibitors.length === 0 && (
            <EmptyState title={t(language, "judgeNoModelsTitle")} description={t(language, "judgeNoModelsDescription")} />
          )}

          {/* Exhibitor tile grid */}
          <Box
            data-tour="judge-grid"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            {displayedExhibitors.map((ex) => {
              const fullyJudged = exhibitorFullyJudged(ex);
              const maxRank = exhibitorMaxRank(ex);
              const bgColor = fullyJudged && maxRank !== null ? rankColor(maxRank) : undefined;
              const textColor = fullyJudged && maxRank !== null ? "#fff" : undefined;

              return (
                <Tooltip key={ex.key} title={t(language, "tipJudgeExhibitor")} describeChild>
                <Paper
                  role="button"
                  tabIndex={0}
                  aria-label={`${t(language, "judgeExhibitor")} ${ex.displayNum} (${ex.models.length})`}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openScoreScreen(ex);
                    }
                  }}
                  variant={bgColor ? "elevation" : "outlined"}
                  elevation={bgColor ? 2 : 0}
                  onClick={() => openScoreScreen(ex)}
                  sx={{
                    width: 80,
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    bgcolor: bgColor ?? "background.paper",
                    color: textColor ?? "text.primary",
                    borderRadius: 1,
                    userSelect: "none",
                    "&:hover": { opacity: 0.85 },
                    transition: "opacity 0.15s",
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} fontSize={13}>
                    {ex.displayNum}
                  </Typography>
                </Paper>
                </Tooltip>
              );
            })}
          </Box>

          {/* JUDGING COMPLETE button */}
          {allFullyJudged && categoryId && (
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
      {screen === "score" && activeExhibitor && (
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
                onChange={(e) => {
                  setDisplayMode(e.target.checked);
                  if (e.target.checked) setSelectedModels(new Set()); // clear only when going to display mode
                }}
                size="small"
              />
            </Stack>
          </Stack>

          {/* Exhibitor label */}
          <Typography variant="h6" fontWeight={700}>
            {t(language, "judgeExhibitor")}: {activeExhibitor.displayNum}
          </Typography>

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
                    onClick={() => setSelectedScore(score)}
                    sx={{
                      minWidth: 44,
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
          {!displayMode && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
              <ActionButton tip={t(language, selectedModels.size === activeExhibitor!.models.length ? "tipJudgeDeselectAll" : "tipJudgeSelectAll")} size="small" variant="text" onClick={() => {
                if (selectedModels.size === activeExhibitor!.models.length) {
                  setSelectedModels(new Set());
                } else {
                  setSelectedModels(new Set(activeExhibitor!.models.map(m => m.id)));
                }
              }}>
                {selectedModels.size === activeExhibitor!.models.length ? t(language, "judgeDeselectAll") : t(language, "judgeSelectAll")}
              </ActionButton>
            </Box>
          )}

          {/* Model list */}
          <Stack data-tour="score-models" spacing={1}>
            {activeExhibitor.models.map((model) => {
              const isSelected = selectedModels.has(model.id);
              const label = [
                model.code ?? model.displayNumber ?? "-",
                model.name ?? model.description ?? "",
              ]
                .filter(Boolean)
                .join("  ");

              return (
                <Paper
                  key={model.id}
                  variant="outlined"
                  onClick={() => {
                    if (displayMode) {
                      setDisplayMode(false);
                      setSelectedModels(new Set([model.id]));
                    } else {
                      toggleModel(model.id);
                    }
                  }}
                  sx={{
                    p: 1.5,
                    cursor: "pointer",
                    bgcolor: isSelected && !displayMode ? "action.selected" : undefined,
                    borderColor: isSelected && !displayMode ? "primary.main" : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Checkbox
                      checked={selectedModels.has(model.id) && !displayMode}
                      disabled={displayMode}
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
                    <Box>
                      <Typography variant="body2">{label}</Typography>
                      {model.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "pre-wrap" }}>
                          {t(language, "judgeModelNotes")}: {model.notes}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {model.currentRank !== null && (
                    <Chip
                      size="small"
                      label={model.currentRank}
                      sx={{
                        bgcolor: RANK_COLOR[model.currentRank] ?? "#616161",
                        color: "#fff",
                        fontWeight: 700,
                        ml: 1,
                      }}
                    />
                  )}
                </Paper>
              );
            })}
          </Stack>

          {/* Selection count hint */}
          {!displayMode && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>
              {selectedModels.size > 0
                ? t(language, selectedModels.size === 1 ? "judgeSelectedOne" : "judgeSelectedMany").replace("{n}", String(selectedModels.size))
                : t(language, "judgeNoneSelected")}
            </Typography>
          )}
          {displayMode && activeExhibitor && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>
              {t(language, "judgeAllModels").replace("{n}", String(activeExhibitor.models.length))}
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
              ? t(language, "judgeVoteDisplay").replace("{n}", String(activeExhibitor.models.length))
              : t(language, "judgeSubmitScore")}
          </ActionButton>
        </Stack>
      )}
    </PageContainer>
  );
}
