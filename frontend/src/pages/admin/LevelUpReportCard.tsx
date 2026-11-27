import React, { useEffect, useState } from "react";
import { Alert, FormControl, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { api } from "../../lib/api";
import { downloadAuthenticatedFile } from "../../lib/download";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import useToast from "../../components/useToast";
import { ActionButton } from "../../components/ActionButton";

export type LevelUpRow = {
  participantNumber: number | string | null;
  name: string;
  email: string;
  models: { name: string; code?: string | null; categoryName: string }[];
};

/** Users who won a Gold in Standard in an earlier edition and must enter Masters, for one event. */
export default function LevelUpReportCard({ language, events }: { language: Language; events: { id: string; name: string }[] }) {
  const toast = useToast();
  const [eventId, setEventId] = useState("");
  const [rows, setRows] = useState<LevelUpRow[] | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!eventId) { setRows(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api<LevelUpRow[]>(`/admin/reports/level-up?eventId=${encodeURIComponent(eventId)}`);
        if (!cancelled) setRows(Array.isArray(res) ? res : []);
      } catch (err: any) {
        if (!cancelled) {
          setRows([]);
          toast.error(err?.message ?? String(err));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadAuthenticatedFile(`/admin/reports/level-up/excel?eventId=${encodeURIComponent(eventId)}`, `level-up-${eventId}.xlsx`);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <SectionCard icon={<EmojiEventsIcon />} title={t(language, "levelUpReportTitle")}>
      {toast.node}
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{t(language, "levelUpReportHelp")}</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="level-up-report-event">{t(language, "awardsSelectEvent")}</InputLabel>
            <Select labelId="level-up-report-event" label={t(language, "awardsSelectEvent")} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
            </Select>
          </FormControl>
          <ActionButton tip={t(language, "tipLevelUpExcel")} variant="outlined" startIcon={<DownloadIcon />} disabled={!eventId || exporting} onClick={exportExcel}>
            {t(language, "levelUpReportExcel")}
          </ActionButton>
        </Stack>

        {rows && rows.length === 0 && <Alert severity="info">{t(language, "levelUpReportEmpty")}</Alert>}
        {rows && rows.length > 0 && (
          <TableContainer>
            <Table size="small" aria-label={t(language, "levelUpReportTitle")}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "levelUpColParticipant")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "levelUpColName")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "levelUpColEmail")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "levelUpColModels")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={`${row.email}-${i}`}>
                    <TableCell>{row.participantNumber ?? "-"}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.models.map((m) => `${m.name} (${m.code ?? "-"}, ${m.categoryName})`).join("; ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </SectionCard>
  );
}
