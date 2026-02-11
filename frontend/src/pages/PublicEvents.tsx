import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  List,
  ListItem,
  ListItemText,
  Stack,
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

  async function load() {
    setEvents(await api<Event[]>("/public/events"));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "publicEventsTitle")}</Typography>
          <Button variant="outlined" onClick={load}>
            {t(language, "publicEventsRefreshButton")}
          </Button>
        </Stack>
        <Card>
          <CardContent>
            <List dense>
              {events.map((event) => (
                <ListItem key={event.id} disableGutters>
                  <ListItemText
                    primary={event.name}
                    secondary={[event.startDate, event.endDate].filter(Boolean).join(" — ") || undefined}
                  />
                  <Chip label={event.status} size="small" color="success" />
                </ListItem>
              ))}
              {events.length === 0 && (
                <Typography variant="body2" color="text.secondary">—</Typography>
              )}
            </List>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
