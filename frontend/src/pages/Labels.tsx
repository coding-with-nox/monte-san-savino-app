import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string };
type Category = { id: string; eventId: string; name: string; status: string };
type Model = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  categoryId: string;
};

interface LabelsProps {
  language: Language;
}

export default function Labels({ language }: LabelsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [eventId, setEventId] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadEvents() {
    setEvents(await api<Event[]>("/events"));
  }

  async function loadCategories() {
    setCategories(await api<Category[]>("/categories"));
  }

  async function loadModels(selectedEventId: string) {
    if (!selectedEventId) {
      setModels([]);
      return;
    }
    setLoading(true);
    try {
      setModels(await api<Model[]>(`/admin/models?eventId=${encodeURIComponent(selectedEventId)}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents().catch((err) => setMessage(err.message));
    loadCategories().catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    loadModels(eventId).catch((err) => setMessage(err.message));
  }, [eventId]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categories]);

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="h4">{t(language, "labelsTitle")}</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => loadModels(eventId)} disabled={!eventId || loading}>
              {t(language, "judgeRefreshButton")}
            </Button>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={models.length === 0}>
              {t(language, "labelsPrintButton")}
            </Button>
          </Stack>
        </Stack>

        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel>{t(language, "enrollmentsEventSelect")}</InputLabel>
            <Select
              value={eventId}
              label={t(language, "enrollmentsEventSelect")}
              onChange={(event) => setEventId(event.target.value)}
            >
              <MenuItem value="">-</MenuItem>
              {events.map((event) => (
                <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        <Grid container spacing={2}>
          {models.map((model) => (
            <Grid key={model.id} item xs={12} sm={6} md={4} lg={3}>
              <Paper variant="outlined" sx={{ p: 2, minHeight: 150, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <Stack spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
                    {model.code || "-"}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{model.name}</Typography>
                  <Chip size="small" label={categoryMap.get(model.categoryId) || model.categoryId} sx={{ maxWidth: "100%" }} />
                  {model.description && (
                    <Typography variant="body2" color="text.secondary">{model.description}</Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          ))}
          {!loading && models.length === 0 && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">{t(language, "labelsEmpty")}</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Stack>
    </Container>
  );
}
