import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import useToast from "../components/useToast";

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
};

type Exhibitor = {
  userId: string;
  displayNum: string;
  models: JudgeModel[];
};

type Screen = "home" | "score";

// ---- Rank colours (Emperor palette) ----
const RANK_COLOR: Record<number, string> = {
  4: "#C8860A",
  3: "#9E9E9E",
  2: "#8D5524",
  1: "#B0BEC5",
  0: "#616161",
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

function groupByExhibitor(models: JudgeModel[]): Exhibitor[] {
  const map = new Map<string, JudgeModel[]>();
  for (const m of models) {
    if (!map.has(m.userId)) map.set(m.userId, []);
    map.get(m.userId)!.push(m);
  }
  return Array.from(map.entries()).map(([userId, ms]) => ({
    userId,
    displayNum: exhibitorDisplayNum(ms),
    models: ms,
  }));
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
  const toast = useToast();

  // -- home screen --
  const [showAll, setShowAll] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completionState, setCompletionState] = useState<{
    allDone: boolean;
    totalJudges: number;
    completedJudges: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (res.length === 1) setEventId(res[0].eventId);
    } catch (err: any) {
      toast.error(err.message || "Error");
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
    try {
      setModels(await api<JudgeModel[]>(`/judge/models?${query.toString()}`));
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  }

  useEffect(() => {
    loadEvents();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    setCategoryId("");
    setCompletionState(null);
    loadCategories(eventId);
    loadModels();
  }, [eventId]);

  useEffect(() => {
    setCompletionState(null);
    loadModels();
  }, [categoryId]);

  // ---- Derived state ----
  const allExhibitors = groupByExhibitor(models);

  const displayedExhibitors = allExhibitors.filter((ex) => {
    if (!showAll && exhibitorFullyJudged(ex)) return false;
    if (filterText && !ex.displayNum.includes(filterText)) return false;
    return true;
  });

  const allFullyJudged = allExhibitors.length > 0 && allExhibitors.every(exhibitorFullyJudged);

  // ---- Complete ----
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
      await Promise.all(
        targets.map((modelId) =>
          api("/judge/vote", {
            method: "POST",
            body: JSON.stringify({ modelId, rank: selectedScore }),
          })
        )
      );
      toast.success(t(language, "judgeVoteSuccess"));
      await loadModels();
      goHome();
    } catch (err: any) {
      toast.error(err.message || "Error");
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
      {screen === "home" && (
        <Stack spacing={2}>
          {/* Top controls row */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
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
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label={t(language, "judgeFilterExhibit")}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              sx={{ maxWidth: 220 }}
            />
            {filterText && (
              <Button size="small" variant="outlined" onClick={() => setFilterText("")}>
                Clear
              </Button>
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

          {/* "All judged" message in subtractive mode */}
          {!showAll && allFullyJudged && displayedExhibitors.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              {t(language, "judgeAllJudged")}
            </Typography>
          )}

          {/* Exhibitor tile grid */}
          <Box
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
                <Paper
                  key={ex.userId}
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
              );
            })}
          </Box>

          {/* JUDGING COMPLETE button */}
          {allFullyJudged && categoryId && (
            <Box>
              <Button
                variant="contained"
                color="success"
                disabled={completing}
                onClick={handleComplete}
                sx={{ mt: 1 }}
              >
                {completing ? "..." : t(language, "judgeCompleteButton")}
              </Button>
            </Box>
          )}
        </Stack>
      )}

      {/* ============================================================
          SCREEN 2: Score screen
         ============================================================ */}
      {screen === "score" && activeExhibitor && (
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <IconButton onClick={goHome} size="small">
              <ArrowBackIcon />
            </IconButton>

            {/* Display toggle */}
            <Stack direction="row" alignItems="center" spacing={0.5}>
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
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              {t(language, "judgeCurrentVoteColumn")}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {[0, 1, 2, 3, 4].map((score) => (
                <Button
                  key={score}
                  variant={selectedScore === score ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setSelectedScore(score)}
                  sx={{
                    minWidth: 44,
                    fontWeight: 700,
                    ...(selectedScore === score && score in RANK_COLOR
                      ? { bgcolor: RANK_COLOR[score], "&:hover": { bgcolor: RANK_COLOR[score] } }
                      : {}),
                  }}
                >
                  {score}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Divider />

          {/* Select All / Deselect All */}
          {!displayMode && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
              <Button size="small" variant="text" onClick={() => {
                if (selectedModels.size === activeExhibitor!.models.length) {
                  setSelectedModels(new Set());
                } else {
                  setSelectedModels(new Set(activeExhibitor!.models.map(m => m.id)));
                }
              }}>
                {selectedModels.size === activeExhibitor!.models.length ? "Deseleziona tutti" : "Seleziona tutti"}
              </Button>
            </Box>
          )}

          {/* Model list */}
          <Stack spacing={1}>
            {activeExhibitor.models.map((model) => {
              const isSelected = selectedModels.has(model.id);
              const label = [
                model.displayNumber ?? model.code ?? "-",
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
                    <Typography variant="body2">{label}</Typography>
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
                ? `${selectedModels.size} modell${selectedModels.size === 1 ? "o" : "i"} selezionat${selectedModels.size === 1 ? "o" : "i"}`
                : "Nessun modello selezionato"}
            </Typography>
          )}
          {displayMode && activeExhibitor && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>
              {`Tutti i modelli (${activeExhibitor.models.length})`}
            </Typography>
          )}

          {/* Submit button */}
          <Button
            variant="contained"
            color="primary"
            disabled={submitDisabled}
            onClick={handleSubmitScore}
            fullWidth
          >
            {t(language, "judgeSubmitScore")}
          </Button>
        </Stack>
      )}
    </PageContainer>
  );
}
