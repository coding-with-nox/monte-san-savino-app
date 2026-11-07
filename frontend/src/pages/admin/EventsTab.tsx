import React, { useState } from "react";
import { Button, FormControl, Grid, InputLabel, List, ListItem, ListItemText, MenuItem, Select, Stack, TextField } from "@mui/material";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import PrintActions from "../../components/PrintActions";
import CategoriesCard from "./CategoriesCard";
import CampaignsCard from "./CampaignsCard";
import BracketsCard from "./BracketsCard";
import type { AdminData } from "./useAdminData";

const eventStatuses = ["draft", "active", "closed"];

export default function EventsTab({ language, data }: { language: Language; data: AdminData }) {
  const { events, refresh } = data;
  const [eventForm, setEventForm] = useState({ name: "", status: "" });

  async function createEvent() {
    await api("/events", { method: "POST", body: JSON.stringify({ ...eventForm, status: eventForm.status || "draft" }) });
    setEventForm({ name: "", status: "" });
    await refresh();
  }

  async function updateEventStatus(eventId: string, status: string) {
    await api(`/events/${eventId}`, { method: "PUT", body: JSON.stringify({ status }) });
    await refresh();
  }

  return (
    <Stack spacing={2}>
      <SectionCard title={t(language, "adminEventsTitle")}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              label={t(language, "adminEventNamePlaceholder")}
              value={eventForm.name}
              onChange={(event) => setEventForm({ ...eventForm, name: event.target.value })}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>{t(language, "adminEventStatusPlaceholder")}</InputLabel>
              <Select
                value={eventForm.status}
                label={t(language, "adminEventStatusPlaceholder")}
                onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
              >
                {eventStatuses.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button variant="contained" onClick={createEvent} fullWidth>
              {t(language, "adminEventCreateButton")}
            </Button>
          </Grid>
        </Grid>
        <List dense sx={{ mt: 2 }}>
          {events.map((event) => (
            <ListItem key={event.id} disableGutters>
              <ListItemText primary={event.name} />
              <PrintActions language={language} params={{ eventId: event.id }} />
              <FormControl size="small" sx={{ minWidth: 110, ml: 1 }}>
                <Select
                  value={event.status || "draft"}
                  onChange={(e) => updateEventStatus(event.id, e.target.value)}
                  size="small"
                >
                  {eventStatuses.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </ListItem>
          ))}
        </List>
      </SectionCard>

      <CategoriesCard language={language} data={data} />
      <CampaignsCard language={language} data={data} />
      <BracketsCard language={language} data={data} />
    </Stack>
  );
}
