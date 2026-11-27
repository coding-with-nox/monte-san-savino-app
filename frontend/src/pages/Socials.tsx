import React, { useEffect, useState } from "react";
import { Alert, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import { countryName } from "../lib/countries";
import { SocialFields } from "../lib/social";
import PageContainer from "../components/PageContainer";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import SectionCard from "../components/SectionCard";
import SocialLinks from "../components/SocialLinks";
import useToast from "../components/useToast";
import { ActionButton } from "../components/ActionButton";

type PublicEvent = { id: string; name: string; status: string };

type ModelEntry = string | { name?: string | null };

type DisplaySocials = {
  displayNumber: string;
  categoryName?: string | null;
  models?: ModelEntry[] | null;
  optedIn: boolean;
  exhibitor?: ({ name?: string | null; country?: string | null; socials?: SocialFields | null }) | null;
};

type SearchResult =
  | { kind: "data"; display: DisplaySocials }
  | { kind: "notAvailable" }
  | { kind: "notFound" };

interface SocialsProps {
  language: Language;
}

export default function Socials({ language }: SocialsProps) {
  const tr = (key: string) => t(language, key as any);
  const toast = useToast();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [eventId, setEventId] = useState("");
  // null = not checked yet; false = the judging results are not published yet.
  const [available, setAvailable] = useState<boolean | null>(null);
  const [displayNumber, setDisplayNumber] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<PublicEvent[]>("/public/events")
      .then(setEvents)
      .catch((err: any) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chooseEvent(id: string) {
    setEventId(id);
    setAvailable(null);
    setDisplayNumber("");
    setResult(null);
    if (!id) return;
    try {
      const res = await api<{ available: boolean }>(`/public/socials/${encodeURIComponent(id)}`);
      setAvailable(res?.available === true);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const number = displayNumber.trim();
    if (!eventId || !number) return;
    setBusy(true);
    setResult(null);
    try {
      const display = await api<DisplaySocials>(
        `/public/socials/${encodeURIComponent(eventId)}/displays/${encodeURIComponent(number)}`
      );
      setResult({ kind: "data", display });
    } catch (err: any) {
      // 403 NOT_AVAILABLE_YET: the event is still being judged. 404: no such display.
      if (err?.status === 403) setResult({ kind: "notAvailable" });
      else if (err?.status === 404) setResult({ kind: "notFound" });
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const exhibitor = result?.kind === "data" ? result.display.exhibitor : null;

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={3}>
        <Typography variant="h4">{tr("socialsTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">{tr("socialsIntro")}</Typography>

        {events.length === 0 ? (
          <EmptyState title={tr("emptyEventsTitle")} description={tr("emptyEventsDescription")} />
        ) : (
          <TextField
            select
            label={tr("socialsEventLabel")}
            value={eventId}
            onChange={(e) => chooseEvent(e.target.value)}
            fullWidth
          >
            <MenuItem value="">-</MenuItem>
            {events.map((event) => (
              <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
            ))}
          </TextField>
        )}

        {eventId && available === false && <Alert severity="info">{tr("socialsNotAvailable")}</Alert>}

        {eventId && available === true && (
          <Stack component="form" direction={{ xs: "column", sm: "row" }} spacing={2} onSubmit={search} noValidate>
            <TextField
              label={tr("socialsDisplayLabel")}
              value={displayNumber}
              onChange={(e) => { setDisplayNumber(e.target.value); setResult(null); }}
              inputProps={{ inputMode: "numeric" }}
              fullWidth
            />
            <ActionButton
              tip={tr("tipSocialsSearch")}
              type="submit"
              variant="contained"
              disabled={busy || !displayNumber.trim()}
              sx={{ minWidth: 140 }}
            >
              {tr("socialsSearch")}
            </ActionButton>
          </Stack>
        )}

        {result?.kind === "notAvailable" && <Alert severity="info">{tr("socialsNotAvailable")}</Alert>}
        {result?.kind === "notFound" && <Alert severity="warning">{tr("socialsNotFound")}</Alert>}

        {result?.kind === "data" && (
          <SectionCard icon={<ShareIcon />} title={`#${result.display.displayNumber}`}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Field label={tr("socialsClass")} value={result.display.categoryName} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  label={tr("socialsModels")}
                  value={(result.display.models ?? [])
                    .map((m) => (typeof m === "string" ? m : m.name ?? ""))
                    .filter(Boolean)
                    .join(", ") || undefined}
                />
              </Grid>
            </Grid>

            {result.display.optedIn ? (
              <Stack spacing={2} sx={{ mt: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Field label={tr("socialsExhibitor")} value={exhibitor?.name} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field label={tr("profileCountry")} value={countryName(exhibitor?.country, language) || undefined} />
                  </Grid>
                </Grid>
                <SocialLinks language={language} {...(exhibitor?.socials ?? {})} />
              </Stack>
            ) : (
              <Alert severity="info" variant="outlined" sx={{ mt: 3 }}>{tr("socialsNotPublic")}</Alert>
            )}
          </SectionCard>
        )}
      </Stack>
    </PageContainer>
  );
}
