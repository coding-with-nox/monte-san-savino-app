import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import EmptyState from "../components/EmptyState";
import useToast from "../components/useToast";

type Event = { id: string; name: string; status: string; startDate?: string | null; endDate?: string | null };

interface PublicEventsProps {
  language: Language;
}

export default function PublicEvents({ language }: PublicEventsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const toast = useToast();

  async function load() {
    try {
      setEvents(await api<Event[]>("/public/events"));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "publicEventsTitle")}</Typography>
          <Button variant="contained" color="secondary" onClick={load}>
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
            </List>
            {events.length === 0 && (
              <EmptyState title="Nessun evento" description="Non ci sono eventi pubblici al momento." />
            )}
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}
