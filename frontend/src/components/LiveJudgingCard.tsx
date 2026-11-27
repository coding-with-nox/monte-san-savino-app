import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, FormControlLabel, Grid, LinearProgress, Stack, Switch, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import { STANDARD_MEDALS } from "../lib/podium";
import PageSkeleton from "./PageSkeleton";
import { ActionButton } from "./ActionButton";

/** GET /awards/events/:eventId/live. Medals are projected from current votes for open classes, final for closed ones. */
export type LivePhase = "judging" | "reconciliation" | "closed";

export type LiveTotals = {
  classes: number;
  closed: number;
  models: number;
  votesCast: number;
  votesExpected: number;
  percent: number;
  medals: Record<string, number>;
};

export type LiveClass = {
  categoryId: string;
  name: string;
  classNumber: number | null;
  presentationOrder: number | null;
  phase: LivePhase;
  models: number;
  votesCast: number;
  votesExpected: number;
  percent: number;
  judgesTotal: number;
  judgesCompleted: number;
  discordant: number;
  medals: Record<string, number>;
};

export type LiveJudging = { updatedAt?: string; totals: LiveTotals; classes: LiveClass[] };

export const LIVE_POLL_MS = 15_000;

const PHASE_COLOR: Record<LivePhase, "warning" | "info" | "success"> = { judging: "warning", reconciliation: "info", closed: "success" };
const PHASE_KEY = { judging: "livePhaseJudging", reconciliation: "livePhaseReconciliation", closed: "livePhaseClosed" } as const;

/** Replaces each `{name}` placeholder of a translated text. */
function fill(text: string, values: Record<string, number | string>) {
  return Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text);
}

const clampPercent = (p: number) => Math.min(100, Math.max(0, p));
const percentLabel = (p: number) => `${Math.round(p)}%`;

function MedalChips({ medals, language, large }: { medals: Record<string, number>; language: Language; large: boolean }) {
  const entries = Object.entries(medals);
  if (entries.length === 0) return <Typography variant="body2" color="text.secondary">{t(language, "statsNoData")}</Typography>;
  return (
    <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
      {entries.map(([label, count]) => {
        // Standard medal labels are shown in the UI language; custom labels are shown as typed.
        const rank = STANDARD_MEDALS[label.trim().toLowerCase()];
        const name = rank !== undefined ? t(language, `rankName${rank}` as any) : label;
        return (
          <Chip key={label} color="primary" variant="outlined" size={large ? "medium" : "small"} label={`${name}: ${count}`} />
        );
      })}
    </Stack>
  );
}

function LiveClassTile({ cls, language, large }: { cls: LiveClass; language: Language; large: boolean }) {
  return (
    <Card variant="outlined" data-testid={`live-class-${cls.categoryId}`} sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} flexWrap="wrap">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant={large ? "h5" : "subtitle1"} fontWeight={700}>{cls.name}</Typography>
            {cls.classNumber != null && <Typography variant="caption" color="text.secondary">#{cls.classNumber}</Typography>}
          </Box>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
            {cls.discordant > 0 && (
              <Chip
                size="small"
                color="error"
                data-testid={`live-discordant-${cls.categoryId}`}
                label={fill(t(language, "liveDiscordant"), { n: cls.discordant })}
              />
            )}
            <Chip size="small" color={PHASE_COLOR[cls.phase]} data-testid={`live-phase-${cls.categoryId}`} label={t(language, PHASE_KEY[cls.phase])} />
          </Stack>
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1} sx={{ mt: 2 }}>
          <Typography variant="body2">{fill(t(language, "liveVotes"), { cast: cls.votesCast, expected: cls.votesExpected })}</Typography>
          <Typography variant="body2" fontWeight={700}>{percentLabel(cls.percent)}</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={clampPercent(cls.percent)} sx={{ height: large ? 12 : 8, borderRadius: 1, mt: 0.5 }} />

        <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">{fill(t(language, "liveJudges"), { done: cls.judgesCompleted, total: cls.judgesTotal })}</Typography>
          <Typography variant="body2" color="text.secondary">{t(language, "statsModels")}: {cls.models}</Typography>
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <MedalChips medals={cls.medals} language={language} large={large} />
          {cls.phase !== "closed" && (
            <Typography variant="caption" color="text.secondary">{t(language, "statsMedals")} ({t(language, "liveMedalsProjected")})</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

interface LiveJudgingCardProps {
  language: Language;
  /** Event followed live; empty = none selected, nothing is fetched. */
  eventId: string;
  projection?: boolean;
}

/** Head judge's near real-time view of the judging: totals and one tile per class, refreshed every 15 s while visible. */
export default function LiveJudgingCard({ language, eventId, projection = false }: LiveJudgingCardProps) {
  const [data, setData] = useState<LiveJudging | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setData(await api<LiveJudging>(`/awards/events/${encodeURIComponent(eventId)}/live`));
      setUpdatedAt(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? t(language, "liveLoadError"));
    }
  }, [eventId, language]);

  useEffect(() => {
    setData(null);
    setUpdatedAt(null);
    if (!eventId) return;
    load();
    let timer: number | undefined;
    const start = () => {
      if (timer === undefined) timer = window.setInterval(load, LIVE_POLL_MS);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    // Paused while the page is hidden; on return it refreshes at once and resumes the interval.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        load();
        start();
      }
    };
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [eventId, load]);

  if (!eventId) return <Typography color="text.secondary">{t(language, "liveSelectEvent")}</Typography>;
  if (!data && !error) return <PageSkeleton variant="cards" rows={3} />;

  const allClasses = [...(data?.classes ?? [])].sort((a, b) => (a.presentationOrder ?? 0) - (b.presentationOrder ?? 0));
  // Classes without models only add noise during the show: hidden unless asked for.
  const emptyCount = allClasses.filter((c) => !c.models).length;
  const classes = showEmpty ? allClasses : allClasses.filter((c) => c.models > 0);
  const totals = data?.totals;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        {updatedAt ? (
          <Typography variant="caption" color="text.secondary">
            {t(language, "statsUpdatedAt")} {updatedAt.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </Typography>
        ) : <span />}
        <ActionButton tip={t(language, "tipLiveRefresh")} size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load}>
          {t(language, "liveRefresh")}
        </ActionButton>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {totals && (
        <Box data-testid="live-totals">
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={1}>
            <Typography variant={projection ? "h5" : "body1"} fontWeight={700}>
              {fill(t(language, "liveVotes"), { cast: totals.votesCast, expected: totals.votesExpected })} · {percentLabel(totals.percent)}
            </Typography>
            <Typography variant={projection ? "h5" : "body2"}>
              {fill(t(language, "liveClosedClasses"), { closed: totals.closed, total: totals.classes })}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={clampPercent(totals.percent)}
            aria-label={t(language, "liveTitle")}
            sx={{ height: projection ? 16 : 10, borderRadius: 1, my: 1 }}
          />
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <MedalChips medals={totals.medals} language={language} large={projection} />
            {totals.closed < totals.classes && (
              <Typography variant="caption" color="text.secondary">{t(language, "statsMedals")} ({t(language, "liveMedalsProjected")})</Typography>
            )}
          </Stack>
        </Box>
      )}

      {emptyCount > 0 && (
        <Tooltip title={t(language, "tipLiveShowEmpty")} describeChild>
          <FormControlLabel
            control={<Switch size="small" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />}
            label={t(language, "liveShowEmpty").replace("{n}", String(emptyCount))}
          />
        </Tooltip>
      )}

      {data && classes.length === 0 && <Typography color="text.secondary">{t(language, "liveNoClasses")}</Typography>}

      <Grid container spacing={2}>
        {classes.map((cls) => (
          <Grid item xs={12} sm={6} lg={4} key={cls.categoryId}>
            <LiveClassTile cls={cls} language={language} large={projection} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
