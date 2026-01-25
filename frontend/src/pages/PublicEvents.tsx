import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string; startDate?: string | null; endDate?: string | null };

interface PublicEventsProps {
  language: Language;
}

export default function PublicEvents({ language }: PublicEventsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    setEvents(await api<Event[]>(`/public/events${query}`));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "publicEventsTitle")}</Typography>
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <TextField
                  label={t(language, "publicEventsStatusPlaceholder")}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button variant="contained" onClick={load} fullWidth>
                  {t(language, "publicEventsRefreshButton")}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <List dense>
              {events.map((event) => (
                <ListItem key={event.id} disableGutters>
                  <ListItemText primary={event.name} secondary={event.status} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
