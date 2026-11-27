import React, { useEffect, useState } from "react";
import {
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import TableChartIcon from "@mui/icons-material/TableChart";
import { api } from "../lib/api";
import { downloadAuthenticatedFile } from "../lib/download";
import { DymoSdkError, printDymoLabels } from "../lib/dymo";
import { buildQuery, openHtmlExport } from "../lib/exports";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import useToast from "../components/useToast";
import { ActionButton } from "../components/ActionButton";

type Event = { id: string; name: string; status: string };
type DeskStats = { participants: number; models: number; labels: number; listPages: number; envelopes: number };

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
  const [deskFrom, setDeskFrom] = useState("");
  const [deskTo, setDeskTo] = useState("");
  const [deskStats, setDeskStats] = useState<DeskStats | null>(null);
  const [deskBusy, setDeskBusy] = useState<string | null>(null);

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

  /** Runs one front desk action on the selected event; `kind` tells which button is busy. */
  async function runDeskAction(kind: string, action: () => Promise<void>) {
    if (!eventId) {
      toast.info(t(language, "enrollmentsEventSelect"));
      return;
    }
    setDeskBusy(kind);
    try {
      await action();
    } catch (err: any) {
      toast.error(err instanceof DymoSdkError ? t(language, "labelsDymoSdkError") : err?.message ?? String(err));
    } finally {
      setDeskBusy(null);
    }
  }

  const deskBase = () => `/exports/events/${encodeURIComponent(eventId)}`;
  const deskRange = () => ({ from: deskFrom.trim() || undefined, to: deskTo.trim() || undefined });

  function calculateMaterial() {
    return runDeskAction("stats", async () => {
      setDeskStats(await api<DeskStats>(`${deskBase()}/desk/stats${buildQuery(deskRange())}`));
    });
  }

  function printDeskDymo() {
    return runDeskAction("dymo", async () => {
      const result = await printDymoLabels(deskRange(), `${deskBase()}/desk/labels/data`);
      if (result === "noPrinter") toast.error(t(language, "labelsDymoNoPrinter"));
      else if (result === "noData") toast.info(t(language, "printNoLabelData"));
      else toast.success(t(language, "labelsDymoPrinted"));
    });
  }

  useEffect(() => {
    loadEvents().catch((err) => toast.error(err?.message ?? String(err)));
  }, []);

  const statChips: [string, number][] = deskStats
    ? [
        [t(language, "labelsDeskStatParticipants"), deskStats.participants],
        [t(language, "labelsDeskStatModels"), deskStats.models],
        [t(language, "labelsDeskStatLabels"), deskStats.labels],
        [t(language, "labelsDeskStatListPages"), deskStats.listPages],
        [t(language, "labelsDeskStatEnvelopes"), deskStats.envelopes]
      ]
    : [];

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "labelsTitle")}</Typography>

        <FormControl data-tour="labels-event" size="small" fullWidth>
          <InputLabel>{t(language, "enrollmentsEventSelect")}</InputLabel>
          <Select
            value={eventId}
            label={t(language, "enrollmentsEventSelect")}
            onChange={(event) => {
              setEventId(event.target.value);
              setDeskStats(null);
            }}
          >
            <MenuItem value="">-</MenuItem>
            {events.map((event) => (
              <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <SectionCard title={t(language, "labelsExportTitle")}>
          <Stack spacing={2}>
            <Stack data-tour="labels-actions" direction="row" spacing={1}>
              <ActionButton
                tip={t(language, "tipLabelsExcel")}
                variant="contained"
                color="secondary"
                startIcon={<TableChartIcon />}
                onClick={exportExcel}
                disabled={!eventId || exportingExcel}
              >
                {exportingExcel ? "..." : t(language, "labelsExportExcel")}
              </ActionButton>
              <ActionButton
                tip={t(language, "tipLabelsPdf")}
                variant="contained"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={exportPdf}
                disabled={!eventId || exportingPdf}
              >
                {exportingPdf ? "..." : t(language, "labelsExportPdf")}
              </ActionButton>
              <ActionButton
                tip={t(language, "tipLabelsDymo")}
                variant="contained"
                color="secondary"
                startIcon={<PrintIcon />}
                onClick={printDymo}
                disabled={!eventId || printingDymo}
              >
                {printingDymo ? "..." : t(language, "labelsDymoPrint")}
              </ActionButton>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {t(language, "labelsHint")}
            </Typography>
          </Stack>
        </SectionCard>

        <SectionCard title={t(language, "labelsDeskTitle")}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="number"
                size="small"
                label={t(language, "labelsDeskFrom")}
                value={deskFrom}
                onChange={(event) => {
                  setDeskFrom(event.target.value);
                  setDeskStats(null);
                }}
                inputProps={{ min: 1 }}
                sx={{ width: { xs: "100%", sm: 220 } }}
              />
              <TextField
                type="number"
                size="small"
                label={t(language, "labelsDeskTo")}
                value={deskTo}
                onChange={(event) => {
                  setDeskTo(event.target.value);
                  setDeskStats(null);
                }}
                inputProps={{ min: 1 }}
                sx={{ width: { xs: "100%", sm: 220 } }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">{t(language, "labelsDeskHint")}</Typography>

            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
              <ActionButton
                tip={t(language, "tipDeskStats")}
                variant="outlined"
                onClick={calculateMaterial}
                disabled={!eventId || deskBusy !== null}
              >
                {t(language, "labelsDeskCalc")}
              </ActionButton>
            </Stack>

            {deskStats && (
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} data-testid="desk-stats">
                {statChips.map(([label, value]) => (
                  <Chip key={label} label={`${label}: ${value}`} variant="outlined" />
                ))}
              </Stack>
            )}

            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
              <ActionButton
                tip={t(language, "tipDeskLabels")}
                variant="contained"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => runDeskAction("labels", () => openHtmlExport(`${deskBase()}/desk/labels`, deskRange()))}
                disabled={!eventId || deskBusy !== null}
              >
                {t(language, "labelsDeskPrintLabels")}
              </ActionButton>
              <ActionButton
                tip={t(language, "tipDeskDymo")}
                variant="contained"
                color="secondary"
                startIcon={<PrintIcon />}
                onClick={printDeskDymo}
                disabled={!eventId || deskBusy !== null}
              >
                {t(language, "labelsDeskDymo")}
              </ActionButton>
              <ActionButton
                tip={t(language, "tipDeskLists")}
                variant="contained"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => runDeskAction("lists", () => openHtmlExport(`${deskBase()}/desk/lists`, deskRange()))}
                disabled={!eventId || deskBusy !== null}
              >
                {t(language, "labelsDeskPrintLists")}
              </ActionButton>
              <ActionButton
                tip={t(language, "tipDeskEnvelopes")}
                variant="contained"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => runDeskAction("envelopes", () => openHtmlExport(`${deskBase()}/desk/envelopes`, deskRange()))}
                disabled={!eventId || deskBusy !== null}
              >
                {t(language, "labelsDeskPrintEnvelopes")}
              </ActionButton>
            </Stack>
          </Stack>
        </SectionCard>

        <SectionCard title={t(language, "labelsPhotoTitle")}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">{t(language, "labelsPhotoHint")}</Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
              <ActionButton
                tip={t(language, "tipPhotoHtml")}
                variant="contained"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => runDeskAction("photoHtml", () => openHtmlExport(`${deskBase()}/photography`))}
                disabled={!eventId || deskBusy !== null}
              >
                {t(language, "labelsPhotoHtml")}
              </ActionButton>
              <ActionButton
                tip={t(language, "tipPhotoExcel")}
                variant="contained"
                color="secondary"
                startIcon={<TableChartIcon />}
                onClick={() =>
                  runDeskAction("photoExcel", () =>
                    downloadAuthenticatedFile(`${deskBase()}/photography/excel`, `fotografi-${eventId}.xlsx`)
                  )
                }
                disabled={!eventId || deskBusy !== null}
              >
                {t(language, "labelsPhotoExcel")}
              </ActionButton>
            </Stack>
          </Stack>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
