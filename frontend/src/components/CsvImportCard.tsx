import React, { useRef, useState } from "react";
import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import SectionCard from "./SectionCard";
import useToast from "./useToast";
import { ActionButton } from "./ActionButton";

/** Classes/levels/previous results answer `created`; the step 10 imports (medals, honors, jury) answer `imported`. */
export type ImportResult = { created?: number; imported?: number; errors: { line: number; message: string }[] };

export const PREVIEW_LINES = 5;
export const MAX_CSV_BYTES = 256 * 1024;
export const MAX_CSV_LINES = 2000;

/** First non-empty lines of a CSV text, for the preview. */
export function previewLines(text: string, max = PREVIEW_LINES): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, max);
}

interface CsvImportCardProps {
  language: Language;
  title: string;
  help: string;
  /** e.g. /admin/import/levels */
  endpoint: string;
  onImported?: () => void;
  /** When provided, the card shows its own event selector and sends the choice as ?eventId= (classes import). */
  events?: { id: string; name: string }[];
  /** Event chosen by the parent (shared selector): sent as ?eventId=, the card shows no selector. */
  eventId?: string;
}

/** Choose a CSV, preview the first rows, POST it as text/csv and list per-line errors. */
export default function CsvImportCard({ language, title, help, endpoint, onImported, events, eventId: sharedEventId }: CsvImportCardProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [ownEventId, setOwnEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const scoped = events !== undefined || sharedEventId !== undefined;
  const eventId = sharedEventId ?? ownEventId;
  const resultCount = result?.imported ?? result?.created ?? 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    if (!file) return;
    const content = await file.text();
    if (!content.trim()) {
      toast.error(t(language, "importEmptyFile"));
      setText("");
      setFileName("");
      return;
    }
    if (new Blob([content]).size > MAX_CSV_BYTES || content.split(/\r?\n/).length > MAX_CSV_LINES + 1) {
      toast.error(t(language, "importTooLarge"));
      setText("");
      setFileName("");
      return;
    }
    setFileName(file.name);
    setText(content);
  }

  async function send() {
    setBusy(true);
    try {
      const res = await api<ImportResult>(scoped ? `${endpoint}?eventId=${encodeURIComponent(eventId)}` : endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text
      });
      setResult(res);
      if ((res.imported ?? res.created ?? 0) > 0) onImported?.();
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  const lines = previewLines(text);

  return (
    <SectionCard icon={<UploadFileIcon />} title={title}>
      {toast.node}
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{help}</Typography>
        {events && (
          <FormControl size="small" sx={{ maxWidth: 360 }}>
            <InputLabel id={`${endpoint}-event`}>{t(language, "awardsSelectEvent")}</InputLabel>
            <Select labelId={`${endpoint}-event`} value={ownEventId} label={t(language, "awardsSelectEvent")} onChange={(e) => setOwnEventId(e.target.value)}>
              {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ActionButton tip={t(language, "tipImportChoose")} variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            {t(language, "importChooseFile")}
            <input ref={inputRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-input" aria-label={`${title} - ${t(language, "importChooseFile")}`} onChange={onFile} />
          </ActionButton>
          {fileName && <Typography variant="body2">{fileName}</Typography>}
          <ActionButton tip={t(language, "tipImportSend")} variant="contained" onClick={send} disabled={!text || busy || (scoped && !eventId)}>
            {busy ? "..." : t(language, "importSend")}
          </ActionButton>
        </Stack>

        {lines.length > 0 && (
          <Box>
            <Typography variant="subtitle2">{t(language, "importPreview")}</Typography>
            <Box component="pre" data-testid="csv-preview" sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "auto", fontSize: 13 }}>
              {lines.join("\n")}
            </Box>
          </Box>
        )}

        {result && (
          <Stack spacing={1} data-testid="csv-result">
            <Alert severity={result.errors.length > 0 ? "warning" : "success"}>
              {result.imported !== undefined ? t(language, "importImported") : t(language, "importCreated")}: {resultCount} - {t(language, "importErrors")}: {result.errors.length}
            </Alert>
            {result.errors.length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "importLine")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "importErrors")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.errors.map((er, i) => (
                    <TableRow key={`${er.line}-${i}`}>
                      <TableCell>{er.line === 0 ? "-" : er.line}</TableCell>
                      <TableCell>{er.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}
