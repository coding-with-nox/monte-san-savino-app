import React, { useEffect, useState } from "react";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import TableChartIcon from "@mui/icons-material/TableChart";
import { api } from "../lib/api";
import { downloadAuthenticatedFile } from "../lib/download";
import { DymoSdkError, printDymoLabels } from "../lib/dymo";
import { openHtmlExport } from "../lib/exports";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import useToast from "../components/useToast";

type Event = { id: string; name: string; status: string };

interface LabelsProps {
  language: Language;
}

export default function Labels({ language }: LabelsProps) {
  const toast = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printingDymo, setPrintingDymo] = useState(false);

  async function loadEvents() {
    setEvents(await api<Event[]>("/events"));
  }

  async function exportExcel() {
    if (!eventId) {
      toast.info(t(language, "enrollmentsEventSelect"));
      return;
    }
    setExportingExcel(true);
    try {
      await downloadAuthenticatedFile(`/exports/labels/excel?eventId=${encodeURIComponent(eventId)}`, `labels-${eventId}.xlsx`);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setExportingExcel(false);
    }
  }

  async function printDymo() {
    if (!eventId) {
      toast.info(t(language, "enrollmentsEventSelect"));
      return;
    }
    setPrintingDymo(true);
    try {
      const result = await printDymoLabels({ eventId });
      if (result === "noPrinter") toast.error(t(language, "labelsDymoNoPrinter"));
      else if (result === "noData") toast.info(t(language, "printNoLabelData"));
      else toast.success(t(language, "labelsDymoPrinted"));
    } catch (err: any) {
      toast.error(err instanceof DymoSdkError ? t(language, "labelsDymoSdkError") : err?.message ?? String(err));
    } finally {
      setPrintingDymo(false);
    }
  }

  async function exportPdf() {
    if (!eventId) {
      toast.info(t(language, "enrollmentsEventSelect"));
      return;
    }
    setExportingPdf(true);
    try {
      await openHtmlExport("/exports/labels/pdf", { eventId });
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    loadEvents().catch((err) => toast.error(err?.message ?? String(err)));
  }, []);

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "labelsTitle")}</Typography>

        <SectionCard title={t(language, "labelsExportTitle")}>
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
                color="secondary"
                startIcon={<TableChartIcon />}
                onClick={exportExcel}
                disabled={!eventId || exportingExcel}
              >
                {exportingExcel ? "..." : t(language, "labelsExportExcel")}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={exportPdf}
                disabled={!eventId || exportingPdf}
              >
                {exportingPdf ? "..." : t(language, "labelsExportPdf")}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<PrintIcon />}
                onClick={printDymo}
                disabled={!eventId || printingDymo}
              >
                {printingDymo ? "..." : t(language, "labelsDymoPrint")}
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {t(language, "labelsHint")}
            </Typography>
          </Stack>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
