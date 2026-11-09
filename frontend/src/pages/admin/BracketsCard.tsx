import React, { useMemo, useState } from "react";
import {
  Button, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import { useConfirm } from "../../components/ConfirmDialog";
import type { AdminData } from "./useAdminData";

type AwardBracket = { id: string; eventId: string; medalLabel: string; medalRank: number; lowLimit: number; highLimit: number };

/** Loads brackets on demand: only when an event is picked, never at tab open. */
export default function BracketsCard({ language, data }: { language: Language; data: AdminData }) {
  const { events } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const [brackets, setBrackets] = useState<AwardBracket[]>([]);
  const [eventId, setEventId] = useState("");
  const [form, setForm] = useState({ medalLabel: "", medalRank: 0, lowLimit: 0, highLimit: 0 });
  const sorted = useMemo(() => [...brackets].sort((a, b) => a.medalRank - b.medalRank), [brackets]);

  async function loadBrackets(id: string) {
    if (!id) { setBrackets([]); return; }
    try { setBrackets(await api<AwardBracket[]>(`/admin/award-brackets?eventId=${encodeURIComponent(id)}`)); }
    catch { setBrackets([]); }
  }
  async function createBracket() {
    if (!eventId || !form.medalLabel.trim()) return;
    await api("/admin/award-brackets", { method: "POST", body: JSON.stringify({ eventId, ...form }) });
    setForm({ medalLabel: "", medalRank: 0, lowLimit: 0, highLimit: 0 });
    await loadBrackets(eventId);
  }
  async function deleteBracket(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/admin/award-brackets/${id}`, { method: "DELETE" });
    await loadBrackets(eventId);
  }

  return (
    <>
      <SectionCard title={t(language, "judgeAwardBracketsTitle")}>
        <Stack spacing={1} sx={{ mb: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
            <Select
              value={eventId}
              label={t(language, "adminJudgeEventPlaceholder")}
              onChange={(e) => { setEventId(e.target.value); void loadBrackets(e.target.value); }}
            >
              {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField size="small" label={t(language, "judgeAwardBracketMedal")} value={form.medalLabel}
              onChange={(e) => setForm({ ...form, medalLabel: e.target.value })} sx={{ minWidth: 160 }} />
            <TextField size="small" label={t(language, "judgeAwardBracketRank")} type="number" value={form.medalRank}
              onChange={(e) => setForm({ ...form, medalRank: Number(e.target.value) })} sx={{ width: 80 }} />
            <TextField size="small" label={t(language, "judgeAwardBracketLow")} type="number" value={form.lowLimit}
              onChange={(e) => setForm({ ...form, lowLimit: Number(e.target.value) })} sx={{ width: 90 }} />
            <TextField size="small" label={t(language, "judgeAwardBracketHigh")} type="number" value={form.highLimit}
              onChange={(e) => setForm({ ...form, highLimit: Number(e.target.value) })} sx={{ width: 90 }} />
            <Button variant="contained" size="small" onClick={createBracket}
              disabled={!eventId || !form.medalLabel.trim()}>
              {t(language, "judgeAwardBracketAdd")}
            </Button>
          </Stack>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketMedal")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketRank")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketLow")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "judgeAwardBracketHigh")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((br) => (
                <TableRow key={br.id}>
                  <TableCell>{br.medalLabel}</TableCell>
                  <TableCell>{br.medalRank}</TableCell>
                  <TableCell>{br.lowLimit}</TableCell>
                  <TableCell>{br.highLimit}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => deleteBracket(br.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {brackets.length === 0 && eventId && (
                <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">{t(language, "adminNoData")}</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
      {confirmNode}
    </>
  );
}
