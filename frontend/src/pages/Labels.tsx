import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import { api } from "../lib/api";
import { downloadAuthenticatedFile } from "../lib/download";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string };

interface LabelsProps {
  language: Language;
}

export default function Labels({ language }: LabelsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState("");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function loadEvents() {
    setEvents(await api<Event[]>("/events"));
  }

  async function exportExcel() {
    if (!eventId) {
      setMessage(t(language, "enrollmentsEventSelect"));
      return;
    }
    setExportingExcel(true);
    try {
      await downloadAuthenticatedFile(`/exports/labels/excel?eventId=${encodeURIComponent(eventId)}`, `labels-${eventId}.xlsx`);
    } catch (err: any) {
      setMessage(err.message || "Export failed");
    } finally {
      setExportingExcel(false);
    }
  }

  async function exportPdf() {
    if (!eventId) {
      setMessage(t(language, "enrollmentsEventSelect"));
      return;
    }
    setExportingPdf(true);
    try {
      const html = await api<string>(`/exports/labels/pdf?eventId=${encodeURIComponent(eventId)}`);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setMessage(err.message || "Export failed");
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    loadEvents().catch((err) => setMessage(err.message));
  }, []);

  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "labelsTitle")}</Typography>
        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <FormControl size="small" fullWidth>
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

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<TableChartIcon />}
                onClick={exportExcel}
                disabled={!eventId || exportingExcel}
              >
                {exportingExcel ? "..." : t(language, "labelsExportExcel")}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PictureAsPdfIcon />}
                onClick={exportPdf}
                disabled={!eventId || exportingPdf}
              >
                {exportingPdf ? "..." : t(language, "labelsExportPdf")}
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {t(language, "labelsHint")}
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
