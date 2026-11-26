import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import { AwardRow, buildPodiums, DEFAULT_PRIZE_ORDER, locateStep, totalSteps } from "../lib/podium";
import { ActionButton, TipIconButton } from "../components/ActionButton";

type Event = { id: string; name: string };
type Category = { id: string; name: string };

interface PodiumProps {
  language: Language;
}

const reduceMotion = { "@media (prefers-reduced-motion: reduce)": { transition: "none", transform: "none" } };

/** Full-screen awards ceremony: winners of each class revealed one at a time, in the configured order. */
export default function Podium({ language }: PodiumProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [eventId, setEventId] = useState("");
  const [rows, setRows] = useState<AwardRow[]>([]);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [prizeOrder, setPrizeOrder] = useState<string[]>(DEFAULT_PRIZE_ORDER);

  useEffect(() => {
    api<Event[]>("/events").then(setEvents).catch((e) => setError(e?.message ?? t(language, "awardsLoadError")));
    api<Category[]>("/categories").then(setCategories).catch(() => undefined);
    api<{ order?: string[] }>("/settings/prize-order")
      .then((res) => { if (res?.order?.length) setPrizeOrder(res.order); })
      .catch(() => undefined);
  }, [language]);

  async function start() {
    if (!eventId) return;
    try {
      setRows(await api<AwardRow[]>(`/awards/events/${encodeURIComponent(eventId)}`));
      setError(null);
      setStep(0);
      setStarted(true);
    } catch (e: any) {
      setError(e?.message ?? t(language, "awardsLoadError"));
    }
  }

  const podiums = useMemo(() => buildPodiums(rows, prizeOrder), [rows, prizeOrder]);
  const total = totalSteps(podiums);
  const { classIndex, revealed } = locateStep(podiums, step);
  const current = podiums[classIndex];

  const next = useCallback(() => setStep((s) => Math.min(s + 1, total)), [total]);
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

  const className = (id: string) => categories.find((c) => c.id === id)?.name ?? id.slice(0, 8);

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

      {started && current && (
        <Stack spacing={4} alignItems="center" sx={{ width: "100%", maxWidth: 900 }}>
          <Typography variant="overline" color="text.secondary">
            {t(language, "awardsClass")} {classIndex + 1} / {podiums.length}
          </Typography>
          <Typography variant="h2" align="center" data-testid="podium-class">{className(current.categoryId)}</Typography>
          <Stack spacing={2} sx={{ width: "100%" }}>
            {current.winners.map((w, i) => {
              const shown = i < revealed;
              return (
                <Box
                  key={w.modelId}
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
                      <Typography variant="h5" color="primary">{w.medalLabel}</Typography>
                      <Typography variant="h3" fontWeight={700}>{w.modelName ?? w.modelId.slice(0, 8)}</Typography>
                    </>
                  ) : (
                    <Typography variant="h5" color="text.secondary">{t(language, "awardsPlaceholder")}</Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
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
          <Typography variant="body2" color="text.secondary">{t(language, "awardsStep")} {step} / {total}</Typography>
          <ActionButton tip={t(language, "tipPodiumNext")} endIcon={<NavigateNextIcon />} onClick={next} disabled={step >= total} variant="contained">{t(language, "awardsNext")}</ActionButton>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
            {t(language, "awardsHint")}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
