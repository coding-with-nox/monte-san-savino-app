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
import PrintIcon from "@mui/icons-material/Print";
import TableChartIcon from "@mui/icons-material/TableChart";
import { api } from "../lib/api";
import { downloadAuthenticatedFile } from "../lib/download";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string };
type LabelRow = { utente: string; categoria: string; nomeModello: string; codice: string };

declare const dymo: any;

function loadDymoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof dymo !== "undefined") { resolve(); return; }
    const script = document.createElement("script");
    script.src = "http://labelwriter.com/software/dls/sdk/js/DYMO.Label.Framework.latest.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load DYMO SDK"));
    document.head.appendChild(script);
  });
}

function buildDymoLabelXml(row: LabelRow): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>LargeAddress</Id>
  <PaperName>30321 Large Address</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="1638" Height="5040" Rx="270" Ry="270"/>
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>TEXT_USER</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element><String>${row.utente}</String><Attributes><Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
      </StyledText>
    </TextObject>
    <Bounds X="336" Y="100" Width="4600" Height="360"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>TEXT_CAT</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element><String>${row.categoria}</String><Attributes><Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
      </StyledText>
    </TextObject>
    <Bounds X="336" Y="460" Width="4600" Height="320"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>TEXT_MODEL</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element><String>${row.nomeModello}</String><Attributes><Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
      </StyledText>
    </TextObject>
    <Bounds X="336" Y="780" Width="4600" Height="320"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>TEXT_CODE</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element><String>${row.codice}</String><Attributes><Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
      </StyledText>
    </TextObject>
    <Bounds X="336" Y="1100" Width="4600" Height="360"/>
  </ObjectInfo>
</DieCutLabel>`;
}

interface LabelsProps {
  language: Language;
}

export default function Labels({ language }: LabelsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState("");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printingDymo, setPrintingDymo] = useState(false);

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

  async function printDymo() {
    if (!eventId) {
      setMessage(t(language, "enrollmentsEventSelect"));
      return;
    }
    setPrintingDymo(true);
    try {
      await loadDymoSdk();
      const printers: any[] = dymo.label.framework.getPrinters();
      const dymoprinter = printers.find((p: any) => p.printerType === "LabelWriterPrinter");
      if (!dymoprinter) {
        setMessage(t(language, "labelsDymoNoPrinter"));
        return;
      }
      const rows = await api<LabelRow[]>(`/exports/labels/data?eventId=${encodeURIComponent(eventId)}`);
      for (const row of rows) {
        const labelXml = buildDymoLabelXml(row);
        const label = dymo.label.framework.openLabelXml(labelXml);
        label.print(dymoprinter.name);
      }
      setMessage(t(language, "labelsDymoPrinted"));
    } catch (err: any) {
      setMessage(err.message || "DYMO print failed");
    } finally {
      setPrintingDymo(false);
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
              <Button
                variant="outlined"
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
        </Paper>
      </Stack>
    </Container>
  );
}
