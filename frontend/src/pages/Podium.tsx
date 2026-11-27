import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import { buildCeremony, CeremonyData } from "../lib/podium";
import { ActionButton, TipIconButton } from "../components/ActionButton";

type Event = { id: string; name: string };

interface PodiumProps {
  language: Language;
}

const reduceMotion = { "@media (prefers-reduced-motion: reduce)": { transition: "none", transform: "none" } };

/**
 * Full-screen awards ceremony: each class (title, then its prizes one by one, in the server order),
 * then the special awards, Best of Show last.
 */
/** Second line under the winner: display number and what was awarded (the model or the whole display). */
function useWinnerDetail(language: Language) {
  return (w: { displayNumber?: number | null; wholeDisplay?: boolean; modelName?: string | null; modelCode?: string | null }) =>
    [
      w.displayNumber != null ? t(language, "podiumDisplayNumber").replace("{n}", String(w.displayNumber)) : null,
      w.wholeDisplay ? t(language, "wholeDisplayLabel") : (w.modelName ?? w.modelCode ?? null)
    ].filter(Boolean).join(" · ");
}

/** Standard MSS medal names are shown in the UI language; custom labels are shown as typed. */
const STANDARD_MEDALS: Record<string, number> = { none: 0, "highly commended": 1, commended: 1, bronze: 2, silver: 3, gold: 4 };

export default function Podium({ language }: PodiumProps) {
  const navigate = useNavigate();
  const winnerDetail = useWinnerDetail(language);
  const medalName = (label: string, rank: number | null | undefined) =>
    rank != null && STANDARD_MEDALS[label.trim().toLowerCase()] === rank ? t(language, `rankName${rank}` as any) : label;
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ceremonyData, setCeremonyData] = useState<CeremonyData | null>(null);

  useEffect(() => {
    api<Event[]>("/events").then(setEvents).catch((e) => setError(e?.message ?? t(language, "awardsLoadError")));
  }, [language]);

  async function start() {
    if (!eventId) return;
    try {
      setCeremonyData(await api<CeremonyData>(`/awards/events/${encodeURIComponent(eventId)}/ceremony`));
      setError(null);
      setStep(0);
      setStarted(true);
    } catch (e: any) {
      setError(e?.message ?? t(language, "awardsLoadError"));
    }
  }

  const ceremony = useMemo(() => buildCeremony(ceremonyData ?? { classes: [], honors: [] }), [ceremonyData]);
  const total = ceremony.screens.length;
  const last = Math.max(total - 1, 0);
  const screen = ceremony.screens[step];

  const next = useCallback(() => setStep((s) => Math.min(s + 1, last)), [last]);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const exit = useCallback(() => navigate("/"), [navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
      if (!started) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "Enter" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, next, prev, exit]);

  return (
    <Box
      data-testid="podium-root"
      onClick={started && total > 0 ? next : undefined}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: (th) => th.zIndex.modal + 1,
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 4,
        overflow: "auto"
      }}
    >
      <TipIconButton
        tip={t(language, "tipPodiumExit")}
        data-tour="podium-exit"
        aria-label={t(language, "awardsExit")}
        onClick={(e) => { e.stopPropagation(); exit(); }}
        sx={{ position: "absolute", top: 16, right: 16 }}
      >
        <CloseIcon />
      </TipIconButton>

      {!started && (
        <Stack spacing={3} alignItems="center" onClick={(e) => e.stopPropagation()} sx={{ width: "100%", maxWidth: 420 }}>
          <Typography variant="h3">{t(language, "awardsTitle")}</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl data-tour="podium-event" fullWidth>
            <InputLabel id="podium-event">{t(language, "awardsSelectEvent")}</InputLabel>
            <Select labelId="podium-event" value={eventId} label={t(language, "awardsSelectEvent")} onChange={(e) => setEventId(e.target.value)}>
              {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
            </Select>
          </FormControl>
          <ActionButton tip={t(language, "tipPodiumStart")} data-tour="podium-start" variant="contained" size="large" disabled={!eventId} onClick={start}>
            {t(language, "awardsStart")}
          </ActionButton>
        </Stack>
      )}

      {started && total === 0 && (
        <Typography variant="h4" onClick={(e) => e.stopPropagation()}>{t(language, "awardsNoResults")}</Typography>
      )}

      {started && screen?.kind === "class" && (() => {
        const cls = ceremony.classes[screen.classIndex];
        return (
          <Stack spacing={4} alignItems="center" sx={{ width: "100%", maxWidth: 900 }}>
            <Typography variant="overline" color="text.secondary">
              {t(language, "awardsClass")} {screen.classIndex + 1} / {ceremony.classes.length}
            </Typography>
            <Typography variant="h2" align="center" data-testid="podium-class">{cls.name}</Typography>
            <Stack spacing={2} sx={{ width: "100%" }}>
              {cls.prizes.map((p, i) => {
                const shown = i < screen.revealed;
                return (
                  <Box
                    key={`${p.medalLabel}-${p.medalRank ?? ""}-${i}`}
                    data-testid="podium-winner"
                    data-revealed={shown ? "true" : "false"}
                    aria-hidden={!shown}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: 2,
                      borderColor: shown ? "primary.main" : "divider",
                      textAlign: "center",
                      opacity: shown ? 1 : 0.15,
                      transform: shown ? "scale(1)" : "scale(0.92)",
                      transition: "opacity 600ms ease, transform 600ms ease",
                      ...reduceMotion
                    }}
                  >
                    {shown ? (
                      <>
                        <Typography variant="h5" color="primary">{medalName(p.medalLabel, p.medalRank)}</Typography>
                        <Typography variant="h3" fontWeight={700}>
                          {p.exhibitor || (p.wholeDisplay ? t(language, "wholeDisplayLabel") : (p.modelName ?? p.modelCode ?? ""))}
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                          {winnerDetail(p)}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="h5" color="text.secondary">{t(language, "awardsPlaceholder")}</Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        );
      })()}

      {started && screen?.kind === "honor" && (
        <Stack spacing={4} alignItems="center" sx={{ width: "100%", maxWidth: 900 }}>
          <Typography variant="overline" color="text.secondary">{t(language, "awardsHonor")}</Typography>
          <Typography variant="h2" align="center" data-testid="podium-honor">{screen.honor.name}</Typography>
          <Box sx={{ p: 3, borderRadius: 3, border: 2, borderColor: "primary.main", textAlign: "center", width: "100%" }}>
            {screen.honor.categoryName && <Typography variant="h5" color="text.secondary">{screen.honor.categoryName}</Typography>}
            <Typography variant="h3" fontWeight={700}>
              {screen.honor.exhibitor || (screen.honor.wholeDisplay ? t(language, "wholeDisplayLabel") : (screen.honor.modelName ?? ""))}
            </Typography>
            <Typography variant="h6" color="text.secondary">{winnerDetail(screen.honor)}</Typography>
          </Box>
        </Stack>
      )}

      {started && total > 0 && (
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          onClick={(e) => e.stopPropagation()}
          sx={{ position: "absolute", bottom: 16, left: 0, right: 0, justifyContent: "center" }}
        >
          <ActionButton tip={t(language, "tipPodiumPrev")} startIcon={<NavigateBeforeIcon />} onClick={prev} disabled={step === 0}>{t(language, "awardsPrev")}</ActionButton>
          <Typography variant="body2" color="text.secondary">{t(language, "awardsStep")} {step + 1} / {total}</Typography>
          <ActionButton tip={t(language, "tipPodiumNext")} endIcon={<NavigateNextIcon />} onClick={next} disabled={step >= last} variant="contained">{t(language, "awardsNext")}</ActionButton>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
            {t(language, "awardsHint")}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
