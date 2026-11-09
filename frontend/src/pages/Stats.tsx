import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, FormControl, Grid, InputLabel, Link, MenuItem, Select, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import { countryName } from "../lib/countries";
import PageContainer from "../components/PageContainer";
import PageSkeleton from "../components/PageSkeleton";
import SectionCard from "../components/SectionCard";
import BarList, { BarItem } from "../components/BarList";

export type StatsOverview = {
  usersTotal: number;
  usersByCountry: { country: string | null; count: number }[];
  modelsPerUser: { userId: string; name: string; count: number }[];
  modelsPerCategory: { categoryId: string; name: string; count: number }[];
  medals: { name: string; count: number }[];
  zeroModelUsers: { userId: string; name: string; email: string }[];
  honorsSummary?: unknown[];
};

export const STATS_POLL_MS = 30_000;

interface StatsProps {
  language: Language;
}

export default function Stats({ language }: StatsProps) {
  const [data, setData] = useState<StatsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventId, setEventId] = useState("");
  const [projection, setProjection] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<StatsOverview>(eventId ? `/admin/stats/overview?eventId=${encodeURIComponent(eventId)}` : "/admin/stats/overview"));
      setUpdatedAt(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? t(language, "statsLoadError"));
    }
  }, [language, eventId]);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/events").then(setEvents).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, STATS_POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Projection = fixed full-viewport overlay (+ browser fullscreen when available).
  function enterProjection() {
    setProjection(true);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
  const exitProjection = useCallback(() => {
    setProjection(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!projection) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitProjection(); };
    const onFs = () => { if (!document.fullscreenElement) setProjection(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [projection, exitProjection]);

  if (!data && !error) return <PageContainer maxWidth="lg"><PageSkeleton variant="cards" rows={4} /></PageContainer>;

  const countryItems: BarItem[] = (data?.usersByCountry ?? []).map((c, i) => ({
    key: `${c.country ?? "?"}-${i}`,
    label: c.country ? countryName(c.country, language) : t(language, "statsUnknownCountry"),
    value: c.count
  }));
  const classItems: BarItem[] = (data?.modelsPerCategory ?? []).map((c) => ({ key: c.categoryId, label: c.name, value: c.count }));
  const topUsers: BarItem[] = [...(data?.modelsPerUser ?? [])].sort((a, b) => b.count - a.count).slice(0, 10).map((u) => ({ key: u.userId, label: u.name, value: u.count }));
  const modelsTotal = (data?.modelsPerCategory ?? []).reduce((s, c) => s + c.count, 0);
  const medalsTotal = (data?.medals ?? []).reduce((s, m) => s + m.count, 0);
  const zeroUsers = data?.zeroModelUsers ?? [];

  const kpis = [
    { key: "users", label: t(language, "statsUsers"), value: data?.usersTotal ?? 0 },
    { key: "models", label: t(language, "statsModels"), value: modelsTotal },
    { key: "medals", label: t(language, "statsMedalsTotal"), value: medalsTotal },
    { key: "zero", label: t(language, "statsZeroUsersKpi"), value: zeroUsers.length }
  ];

  const body = (
    <Stack spacing={projection ? 4 : 2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant={projection ? "h2" : "h4"}>{t(language, "statsTitle")}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {updatedAt && (
            <Typography variant="caption" color="text.secondary">
              {t(language, "statsUpdatedAt")} {updatedAt.toLocaleTimeString(language)}
            </Typography>
          )}
          {!projection && events.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="stats-event">{t(language, "statsEvent")}</InputLabel>
              <Select labelId="stats-event" value={eventId} label={t(language, "statsEvent")} onChange={(e) => setEventId(e.target.value)}>
                <MenuItem value="">{t(language, "statsAllEvents")}</MenuItem>
                {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          {projection ? (
            <Button variant="outlined" startIcon={<FullscreenExitIcon />} onClick={exitProjection}>
              {t(language, "statsExitProjection")}
            </Button>
          ) : (
            <Button variant="contained" startIcon={<SlideshowIcon />} onClick={enterProjection}>
              {t(language, "statsProjection")}
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {kpis.map((k) => (
          <Grid item xs={6} md={3} key={k.key}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant={projection ? "h6" : "body2"}>{k.label}</Typography>
                <Typography variant={projection ? "h2" : "h4"} fontWeight={700} data-testid={`kpi-${k.key}`}>{k.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionCard title={t(language, "statsByCountry")}>
            <BarList items={countryItems} emptyLabel={t(language, "statsNoData")} large={projection} />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title={t(language, "statsModelsPerClass")}>
            <BarList items={classItems} emptyLabel={t(language, "statsNoData")} large={projection} />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title={t(language, "statsMedals")}>
            {(data?.medals ?? []).length === 0 ? (
              <Typography color="text.secondary">{t(language, "statsNoData")}</Typography>
            ) : (
              <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
                {data!.medals.map((m) => (
                  <Chip key={m.name} color="primary" variant="outlined" label={`${m.name}: ${m.count}`} sx={projection ? { fontSize: 22, height: 44 } : undefined} />
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title={t(language, "statsTopUsers")}>
            <BarList items={topUsers} emptyLabel={t(language, "statsNoData")} large={projection} />
          </SectionCard>
        </Grid>
      </Grid>

      {!projection && (
        <SectionCard title={`${t(language, "statsZeroUsers")} (${zeroUsers.length})`}>
          {zeroUsers.length === 0 ? (
            <Typography color="text.secondary">{t(language, "statsNoData")}</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "profileFirstName")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {zeroUsers.map((u) => (
                    <TableRow key={u.userId} hover>
                      <TableCell>{u.name || "-"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell align="right">
                        <Link component={RouterLink} to={`/users?open=${encodeURIComponent(u.userId)}`}>
                          {t(language, "statsOpenProfile")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>
      )}
    </Stack>
  );

  if (projection) {
    return (
      <Box
        data-testid="stats-projection"
        sx={{ position: "fixed", inset: 0, zIndex: (th) => th.zIndex.modal + 1, bgcolor: "background.default", overflow: "auto", p: 4 }}
      >
        {body}
      </Box>
    );
  }
  return <PageContainer maxWidth="lg">{body}</PageContainer>;
}
