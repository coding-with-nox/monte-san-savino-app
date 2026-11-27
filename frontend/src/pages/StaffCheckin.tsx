import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import useToast from "../components/useToast";
import { ActionButton } from "../components/ActionButton";

type Event = { id: string; name: string; status: string };
type Model = { id: string; name: string; code: string; categoryName: string; displayNumber: string | number };
type Participant = {
  userId: string;
  participantNumber: number;
  name: string;
  country: string;
  present: boolean;
  models: Model[];
};
type Attendance = { registeredParticipants: number; presentParticipants: number };

interface StaffCheckinProps {
  language: Language;
}

/** Front desk: looks up a participant by number and marks them present at the chosen event. */
export default function StaffCheckin({ language }: StaffCheckinProps) {
  const toast = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Event[]>("/public/events?status=all")
      .then(setEvents)
      .catch((err) => toast.error(err?.message ?? String(err)));
  }, []);

  async function loadAttendance(id: string) {
    setAttendance(await api<Attendance>(`/staff/events/${encodeURIComponent(id)}/attendance`));
  }

  function changeEvent(id: string) {
    setEventId(id);
    setParticipant(null);
    setNotFound(false);
    setAttendance(null);
    if (id) loadAttendance(id).catch((err) => toast.error(err?.message ?? String(err)));
  }

  async function search() {
    const value = numberInput.trim();
    if (!eventId) {
      toast.info(t(language, "staffCheckinNoEvent"));
      return;
    }
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      toast.error(t(language, "staffCheckinNumberRequired"));
      return;
    }
    setBusy(true);
    setNotFound(false);
    try {
      setParticipant(await api<Participant>(`/staff/events/${encodeURIComponent(eventId)}/participants/${Number(value)}`));
    } catch (err: any) {
      setParticipant(null);
      if (err?.status === 404) setNotFound(true);
      else toast.error(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function togglePresence() {
    if (!participant) return;
    const present = !participant.present;
    setBusy(true);
    try {
      await api(`/staff/events/${encodeURIComponent(eventId)}/participants/${participant.participantNumber}/presence`, {
        method: "POST",
        body: JSON.stringify({ present })
      });
      setParticipant({ ...participant, present });
      await loadAttendance(eventId);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  const counter = attendance
    ? t(language, "staffCheckinCounter")
        .replace("{present}", String(attendance.presentParticipants))
        .replace("{total}", String(attendance.registeredParticipants))
    : "";

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={3} sx={{ maxWidth: 640, mx: "auto", width: "100%" }}>
        <Typography variant="h4">{t(language, "staffCheckinTitle")}</Typography>

        <FormControl size="small" fullWidth>
          <InputLabel>{t(language, "enrollmentsEventSelect")}</InputLabel>
          <Select
            value={eventId}
            label={t(language, "enrollmentsEventSelect")}
            onChange={(event) => changeEvent(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            {events.map((event) => (
              <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {attendance && (
          <Box data-tour="checkin-counter">
            <Chip label={counter} color="primary" sx={{ fontSize: 18, fontWeight: 700, height: 40, px: 1 }} />
          </Box>
        )}

        <Stack spacing={2} data-tour="checkin-number">
          <TextField
            label={t(language, "staffCheckinNumberLabel")}
            helperText={t(language, "staffCheckinSearchHint")}
            type="number"
            value={numberInput}
            onChange={(event) => setNumberInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
            fullWidth
            inputProps={{ inputMode: "numeric", min: 1, style: { fontSize: 32, textAlign: "center" } }}
          />
          <ActionButton tip={t(language, "tipDeskSearch")} variant="contained" size="large" onClick={search} disabled={busy} fullWidth>
            {t(language, "staffCheckinSearch")}
          </ActionButton>
        </Stack>

        {notFound && <Alert severity="warning">{t(language, "staffCheckinNotFound")}</Alert>}

        {participant && (
          <SectionCard
            title={`#${participant.participantNumber} ${participant.name}`}
            action={
              <Chip
                label={participant.present ? t(language, "staffCheckinStatusPresent") : t(language, "staffCheckinStatusAbsent")}
                color={participant.present ? "success" : "default"}
              />
            }
          >
            <Stack spacing={2}>
              <Typography variant="body1" color="text.secondary">{participant.country}</Typography>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t(language, "staffCheckinModels")}</Typography>
                {participant.models.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">{t(language, "staffCheckinNoModels")}</Typography>
                ) : (
                  <List dense disablePadding>
                    {participant.models.map((model) => (
                      <ListItem key={model.id} disableGutters>
                        <ListItemText
                          primary={`${model.displayNumber} · ${model.name}`}
                          secondary={`${model.categoryName} · ${model.code}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
              <ActionButton
                tip={t(language, participant.present ? "tipDeskUndoPresent" : "tipDeskMarkPresent")}
                variant={participant.present ? "outlined" : "contained"}
                color={participant.present ? "warning" : "success"}
                size="large"
                onClick={togglePresence}
                disabled={busy}
                fullWidth
                sx={{ minHeight: 64, fontSize: 20 }}
              >
                {t(language, participant.present ? "staffCheckinUndoPresent" : "staffCheckinMarkPresent")}
              </ActionButton>
            </Stack>
          </SectionCard>
        )}
      </Stack>
    </PageContainer>
  );
}
