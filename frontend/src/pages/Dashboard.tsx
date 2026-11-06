import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { getRole, roleAtLeast } from "../lib/auth";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import PageSkeleton from "../components/PageSkeleton";

interface DashboardProps {
  language: Language;
}

type EventRow = { id: string; name: string; status?: string };
type AdminEnrollment = { id: string; eventId: string; checkedIn: boolean };
type MonitoringRow = {
  categoryId: string;
  categoryName: string;
  totalModels: number;
  scoredModels: number;
  totalJudges: number;
  completedJudges: number;
};
type JudgeEvent = { eventId: string; eventName: string };
type JudgeModel = { id: string; categoryId: string; categoryName: string; currentRank: number | null };
type MyModel = { id: string; name: string; code?: string | null };
type MyEnrollment = { id: string; eventId: string; modelId?: string | null; checkedIn: boolean };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack spacing={0.5} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, minWidth: 140 }}>
      <Typography variant="h4" component="div" data-testid="dash-stat-value">{value}</Typography>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

/* ---------------- Manager / admin ---------------- */
function ManagerDashboard({ language }: DashboardProps) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<EventRow[]>("/public/events")
      .then((rows) => {
        setEvents(rows ?? []);
        if (rows?.length) setEventId(rows[0].id);
        else setLoading(false);
      })
      .catch(() => { setFailed(true); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      api<AdminEnrollment[]>(`/admin/enrollments?eventId=${encodeURIComponent(eventId)}`),
      api<MonitoringRow[]>(`/awards/monitoring/${encodeURIComponent(eventId)}`)
    ]).then(([enr, mon]) => {
      if (cancelled) return;
      setEnrollments(enr.status === "fulfilled" ? enr.value ?? [] : []);
      setMonitoring(mon.status === "fulfilled" ? mon.value ?? [] : []);
      setFailed(enr.status === "rejected" || mon.status === "rejected");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [eventId]);

  const checkedIn = enrollments.filter((e) => e.checkedIn).length;
  const totalModels = monitoring.reduce((n, c) => n + c.totalModels, 0);
  const scoredModels = monitoring.reduce((n, c) => n + c.scoredModels, 0);
  const pct = totalModels > 0 ? Math.round((scoredModels / totalModels) * 100) : 0;

  if (loading && events.length === 0) return <PageSkeleton variant="cards" rows={3} />;

  return (
    <Stack spacing={2}>
      {failed && <Alert severity="warning">{t(language, "dashLoadError")}</Alert>}
      {events.length === 0 ? (
        <Typography color="text.secondary">{t(language, "dashNoActiveEvent")}</Typography>
      ) : (
        <SectionCard title={t(language, "dashEventLabel")}>
          <Stack spacing={2}>
            <FormControl size="small" sx={{ maxWidth: 320 }}>
              <InputLabel>{t(language, "dashEventLabel")}</InputLabel>
              <Select value={eventId} label={t(language, "dashEventLabel")} onChange={(e) => setEventId(e.target.value)}>
                {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
              </Select>
            </FormControl>
            {loading ? (
              <LinearProgress />
            ) : (
              <>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Stat label={t(language, "dashEnrollments")} value={enrollments.length} />
                  <Stat label={t(language, "dashCheckedIn")} value={`${checkedIn}/${enrollments.length}`} />
                  <Stat label={t(language, "dashModelsScored")} value={`${scoredModels}/${totalModels}`} />
                </Stack>
                <LinearProgress variant="determinate" value={pct} aria-label={t(language, "dashModelsScored")} />
              </>
            )}
          </Stack>
        </SectionCard>
      )}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button component={RouterLink} to="/admin" variant="contained">{t(language, "dashOpenAdmin")}</Button>
        <Button component={RouterLink} to="/enrollments" variant="outlined">{t(language, "dashManageEnrollments")}</Button>
        <Button component={RouterLink} to="/staff-checkin" variant="outlined">{t(language, "dashOpenCheckin")}</Button>
      </Stack>
    </Stack>
  );
}

/* ---------------- Judge ---------------- */
function JudgeDashboard({ language }: DashboardProps) {
  const [eventName, setEventName] = useState("");
  const [models, setModels] = useState<JudgeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const evs = await api<JudgeEvent[]>("/judge/events");
        if (evs?.length) {
          setEventName(evs[0].eventName);
          setModels((await api<JudgeModel[]>(`/judge/models?eventId=${encodeURIComponent(evs[0].eventId)}`)) ?? []);
        }
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageSkeleton variant="cards" rows={3} />;

  const byCategory = new Map<string, { name: string; total: number; judged: number }>();
  for (const m of models) {
    const row = byCategory.get(m.categoryId) ?? { name: m.categoryName, total: 0, judged: 0 };
    row.total += 1;
    if (m.currentRank !== null) row.judged += 1;
    byCategory.set(m.categoryId, row);
  }
  const pending = Array.from(byCategory.values()).filter((c) => c.judged < c.total);

  return (
    <Stack spacing={2}>
      {failed && <Alert severity="warning">{t(language, "dashLoadError")}</Alert>}
      <SectionCard title={`${t(language, "dashCategoriesToVote")}${eventName ? ` - ${eventName}` : ""}`}>
        {byCategory.size === 0 ? (
          <Typography color="text.secondary">{t(language, "dashNoActiveEvent")}</Typography>
        ) : pending.length === 0 ? (
          <Typography color="text.secondary">{t(language, "dashAllVoted")}</Typography>
        ) : (
          <Stack spacing={1}>
            {pending.map((c) => (
              <Stack key={c.name} direction="row" spacing={1} alignItems="center">
                <Typography sx={{ flexGrow: 1 }}>{c.name}</Typography>
                <Chip size="small" label={`${c.judged}/${c.total} ${t(language, "dashVotedOf")}`} />
              </Stack>
            ))}
          </Stack>
        )}
      </SectionCard>
      <Button component={RouterLink} to="/judge" variant="contained" sx={{ alignSelf: "flex-start" }}>
        {t(language, "dashGoToJudge")}
      </Button>
    </Stack>
  );
}

/* ---------------- User / staff ---------------- */
function UserDashboard({ language, isStaff }: DashboardProps & { isStaff: boolean }) {
  const [models, setModels] = useState<MyModel[]>([]);
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api<MyModel[]>("/models"),
      api<MyEnrollment[]>("/enrollments"),
      api<EventRow[]>("/public/events?status=all")
    ]).then(([m, e, ev]) => {
      setModels(m.status === "fulfilled" ? m.value ?? [] : []);
      setEnrollments(e.status === "fulfilled" ? e.value ?? [] : []);
      setEvents(ev.status === "fulfilled" ? ev.value ?? [] : []);
      setFailed([m, e].some((r) => r.status === "rejected"));
      setLoading(false);
    });
  }, []);

  if (loading) return <PageSkeleton variant="cards" rows={3} />;

  const eventName = (id: string) => events.find((e) => e.id === id)?.name ?? id.slice(0, 8);

  return (
    <Stack spacing={2}>
      {failed && <Alert severity="warning">{t(language, "dashLoadError")}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionCard title={t(language, "dashMyModels")}>
            {models.length === 0 ? (
              <Typography color="text.secondary">{t(language, "dashNoModelsYet")}</Typography>
            ) : (
              <Stack spacing={0.5}>
                {models.slice(0, 6).map((m) => (
                  <Stack key={m.id} direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ flexGrow: 1 }}>{m.name}</Typography>
                    {m.code && <Chip size="small" variant="outlined" label={m.code} />}
                  </Stack>
                ))}
                {models.length > 6 && <Typography variant="caption" color="text.secondary">+{models.length - 6}</Typography>}
              </Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title={t(language, "dashMyEnrollments")}>
            {enrollments.length === 0 ? (
              <Typography color="text.secondary">{t(language, "dashNoEnrollmentsYet")}</Typography>
            ) : (
              <Stack spacing={0.5}>
                {enrollments.map((e) => (
                  <Stack key={e.id} direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ flexGrow: 1 }}>{eventName(e.eventId)}</Typography>
                    <Chip
                      size="small"
                      color={e.checkedIn ? "success" : "default"}
                      variant="outlined"
                      label={t(language, e.checkedIn ? "dashStatusCheckedIn" : "dashStatusEnrolled")}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button component={RouterLink} to="/models" variant="contained">{t(language, "dashManageModels")}</Button>
        <Button component={RouterLink} to="/enrollments" variant="outlined">{t(language, "dashManageEnrollments")}</Button>
        {isStaff && (
          <Button component={RouterLink} to="/staff-checkin" variant="outlined">{t(language, "dashOpenCheckin")}</Button>
        )}
      </Stack>
    </Stack>
  );
}

export default function Dashboard({ language }: DashboardProps) {
  const role = getRole();
  const isManager = role ? roleAtLeast(role, "manager") : false;
  const isJudge = role === "judge";
  const isStaff = role ? roleAtLeast(role, "staff") : false;

  return (
    <PageContainer maxWidth="lg">
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "dashboardTitle")}</Typography>
        {isManager ? (
          <ManagerDashboard language={language} />
        ) : isJudge ? (
          <JudgeDashboard language={language} />
        ) : (
          <UserDashboard language={language} isStaff={isStaff} />
        )}
      </Stack>
    </PageContainer>
  );
}
