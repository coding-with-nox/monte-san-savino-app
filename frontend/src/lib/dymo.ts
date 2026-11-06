import { api } from "./api";

export type LabelRow = { utente: string; categoria: string; nomeModello: string; codice: string };

declare const dymo: any;

/** Default SDK URL (HTTPS only). Override with VITE_DYMO_SDK_URL. */
const DEFAULT_DYMO_SDK_URL = "https://labelwriter.com/software/dls/sdk/js/DYMO.Label.Framework.latest.js";

export class DymoSdkError extends Error {
  constructor(message = "Failed to load DYMO SDK over HTTPS") {
    super(message);
    this.name = "DymoSdkError";
  }
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getDymoSdkUrl(): string {
  const configured = import.meta.env.VITE_DYMO_SDK_URL?.trim();
  return configured || DEFAULT_DYMO_SDK_URL;
}

/** Loads the DYMO SDK over HTTPS only. Never falls back to http (mixed content). */
export function loadDymoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof dymo !== "undefined") { resolve(); return; }
    const url = getDymoSdkUrl();
    if (!/^https:\/\//i.test(url)) { reject(new DymoSdkError()); return; }
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new DymoSdkError()); };
    document.head.appendChild(script);
  });
}

export function buildDymoLabelXml(row: LabelRow): string {
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
        <Element><String>${esc(row.utente)}</String><Attributes><Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
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
        <Element><String>${esc(row.categoria)}</String><Attributes><Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
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
        <Element><String>${esc(row.nomeModello)}</String><Attributes><Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
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
        <Element><String>${esc(row.codice)}</String><Attributes><Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False"/></Attributes></Element>
      </StyledText>
    </TextObject>
    <Bounds X="336" Y="1100" Width="4600" Height="360"/>
  </ObjectInfo>
</DieCutLabel>`;
}

export type DymoPrintResult = "printed" | "noPrinter" | "noData";

/** Fetches label rows from the backend (optionally filtered) and prints them on the first DYMO LabelWriter. */
export async function printDymoLabels(params: Record<string, string | undefined>): Promise<DymoPrintResult> {
  await loadDymoSdk();
  const printers: any[] = dymo.label.framework.getPrinters();
  const printer = printers.find((p: any) => p.printerType === "LabelWriterPrinter");
  if (!printer) return "noPrinter";
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) query.set(k, v);
  const rows = await api<LabelRow[]>(`/exports/labels/data?${query.toString()}`);
  if (!rows || rows.length === 0) return "noData";
  for (const row of rows) {
    const label = dymo.label.framework.openLabelXml(buildDymoLabelXml(row));
    label.print(printer.name);
  }
  return "printed";
}
