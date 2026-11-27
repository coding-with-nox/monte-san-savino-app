import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, Grid, InputLabel, MenuItem,
  Radio, RadioGroup, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { api } from "../../lib/api";
import { openHtmlExport } from "../../lib/exports";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import { useConfirm } from "../../components/ConfirmDialog";
import useToast from "../../components/useToast";
import { ActionButton, TipIconButton } from "../../components/ActionButton";
import type { AdminCategory, AdminEvent, ModelRef } from "./types";

export type HonorAssignment = {
  categoryId: string;
  categoryName: string;
  displayNumber: number;
  modelId: string | null;
  modelName: string | null;
  modelCode: string | null;
  wholeDisplay: boolean;
  exhibitor: string | null;
};

export type Honor = {
  id: string;
  eventId: string;
  code: string;
  name: string;
  sortOrder?: number | null;
  assignment: HonorAssignment | null;
};

type HonorForm = { code: string; name: string; sortOrder: string };

/** Radio value of "whole display"; any other value is a model id. */
const WHOLE_DISPLAY = "whole";

/** Text of a failed honors request: 409 (already assigned) and 422/404 (invalid display or model) are explained. */
export function honorErrorMessage(language: Language, err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 409) return t(language, "honorsErrorConflict");
  if (status === 422 || status === 404) return t(language, "honorsErrorInvalid");
  return (err as Error | null)?.message || t(language, "honorsErrorGeneric");
}

function assignmentSummary(language: Language, honor: Honor): string {
  const a = honor.assignment;
  if (!a) return t(language, "honorsUnassigned");
  const target = a.wholeDisplay ? t(language, "wholeDisplayLabel") : (a.modelName ?? a.modelCode ?? "");
  return `${a.categoryName} · ${t(language, "honorsDisplay")} ${a.displayNumber} · ${target}`;
}

interface HonorsCardProps {
  language: Language;
  events: AdminEvent[];
  categories: AdminCategory[];
  models: ModelRef[];
}

/** Special awards of one event: catalogue, preset, add/edit/delete, assignment to a display or a model, prints. */
export default function HonorsCard({ language, events, categories, models }: HonorsCardProps) {
  const toast = useToast();
  const { confirm, node: confirmNode } = useConfirm(language);
  const [eventId, setEventId] = useState("");
  const [honors, setHonors] = useState<Honor[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [editor, setEditor] = useState<{ honor: Honor | null; values: HonorForm } | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<Honor | null>(null);
  const [draft, setDraft] = useState({ categoryId: "", displayNumber: null as number | null, target: WHOLE_DISPLAY });
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId && events.length > 0) setEventId(events[0].id);
  }, [events, eventId]);

  const reload = useCallback(async () => {
    if (!eventId) {
      setHonors([]);
      return;
    }
    try {
      setHonors(await api<Honor[]>(`/admin/honors?eventId=${encodeURIComponent(eventId)}`));
    } catch (err) {
      toast.error(honorErrorMessage(language, err));
    }
  }, [eventId, language, toast.error]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Runs a mutation, reports its outcome and refreshes the catalogue. */
  async function run(key: string, action: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await action();
      toast.success(done);
      await reload();
    } catch (err) {
      toast.error(honorErrorMessage(language, err));
    } finally {
      setBusy(null);
    }
  }

  async function loadPreset() {
    if (!(await confirm(t(language, "honorsPresetConfirm")))) return;
    await run("preset", () => api("/admin/honors/preset", { method: "POST", body: JSON.stringify({ eventId }) }), t(language, "honorsPresetDone"));
  }

  async function printExport(kind: "presentation-medals" | "presentation-honors") {
    setBusy("print");
    try {
      await openHtmlExport(`/exports/events/${encodeURIComponent(eventId)}/${kind}`);
    } catch (err) {
      toast.error(honorErrorMessage(language, err));
    } finally {
      setBusy(null);
    }
  }

  function openEditor(honor: Honor | null) {
    setEditorError(null);
    setEditor({
      honor,
      values: { code: honor?.code ?? "", name: honor?.name ?? "", sortOrder: honor?.sortOrder != null ? String(honor.sortOrder) : "" }
    });
  }

  async function saveEditor() {
    if (!editor) return;
    const body = {
      code: editor.values.code.trim(),
      name: editor.values.name.trim(),
      sortOrder: editor.values.sortOrder.trim() === "" ? undefined : Number(editor.values.sortOrder)
    };
    setBusy("save");
    setEditorError(null);
    try {
      if (editor.honor) await api(`/admin/honors/${editor.honor.id}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/admin/honors", { method: "POST", body: JSON.stringify({ eventId, ...body }) });
      setEditor(null);
      toast.success(t(language, "honorsSaved"));
      await reload();
    } catch (err) {
      setEditorError(honorErrorMessage(language, err));
    } finally {
      setBusy(null);
    }
  }

  async function removeHonor(honor: Honor) {
    if (!(await confirm(t(language, "honorsDeleteConfirm")))) return;
    await run("delete", () => api(`/admin/honors/${honor.id}`, { method: "DELETE" }), t(language, "honorsDeleted"));
  }

  async function unassign(honor: Honor) {
    if (!(await confirm(t(language, "honorsUnassignConfirm")))) return;
    await run("unassign", () => api(`/admin/honors/${honor.id}/assignment`, { method: "DELETE" }), t(language, "honorsUnassignDone"));
  }

  // Assignment: class (of this event) -> display number (of its models) -> whole display or one model of it.
  const eventClasses = useMemo(() => categories.filter((c) => c.eventId === eventId), [categories, eventId]);
  const displayNumbers = useMemo(() => {
    const numbers = models
      .filter((m) => m.categoryId === draft.categoryId && m.displayNumber != null && !m.missing)
      .map((m) => m.displayNumber as number);
    return [...new Set(numbers)].sort((a, b) => a - b);
  }, [models, draft.categoryId]);
  const modelsOnDisplay = useMemo(
    () => models.filter((m) => m.categoryId === draft.categoryId && m.displayNumber === draft.displayNumber && !m.missing),
    [models, draft.categoryId, draft.displayNumber]
  );

  function openAssign(honor: Honor) {
    setAssignError(null);
    setDraft({ categoryId: "", displayNumber: null, target: WHOLE_DISPLAY });
    setAssigning(honor);
  }

  async function submitAssign() {
    if (!assigning || !draft.categoryId || draft.displayNumber === null) return;
    const body = {
      categoryId: draft.categoryId,
      displayNumber: draft.displayNumber,
      ...(draft.target !== WHOLE_DISPLAY ? { modelId: draft.target } : {})
    };
    setBusy("assign");
    setAssignError(null);
    try {
      await api(`/admin/honors/${assigning.id}/assign`, { method: "POST", body: JSON.stringify(body) });
      setAssigning(null);
      toast.success(t(language, "honorsAssigned"));
      await reload();
    } catch (err) {
      setAssignError(honorErrorMessage(language, err));
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard tourId="admin-honors" title={t(language, "honorsTitle")}>
      {toast.node}
      {confirmNode}
      <Stack spacing={2}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="honors-event">{t(language, "honorsEvent")}</InputLabel>
              <Select labelId="honors-event" value={eventId} label={t(language, "honorsEvent")} onChange={(e) => setEventId(e.target.value)}>
                {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end" className="no-print">
              <ActionButton tip={t(language, "tipHonorsPrintMedals")} size="small" variant="outlined" disabled={!eventId || busy !== null} onClick={() => printExport("presentation-medals")}>
                {t(language, "honorsPrintMedals")}
              </ActionButton>
              <ActionButton tip={t(language, "tipHonorsPrintHonors")} size="small" variant="outlined" disabled={!eventId || busy !== null} onClick={() => printExport("presentation-honors")}>
                {t(language, "honorsPrintHonors")}
              </ActionButton>
              <ActionButton tip={t(language, "tipHonorsPreset")} size="small" variant="outlined" disabled={!eventId || busy !== null} onClick={loadPreset}>
                {t(language, "honorsPreset")}
              </ActionButton>
              <ActionButton tip={t(language, "tipHonorsAdd")} size="small" variant="contained" disabled={!eventId || busy !== null} onClick={() => openEditor(null)}>
                {t(language, "honorsAdd")}
              </ActionButton>
            </Stack>
          </Grid>
        </Grid>

        {eventId && honors.length === 0 && <Typography variant="body2" color="text.secondary">{t(language, "honorsEmpty")}</Typography>}
        {honors.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t(language, "honorsColCode")}</TableCell>
                  <TableCell>{t(language, "honorsColName")}</TableCell>
                  <TableCell>{t(language, "honorsColAssignment")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {honors.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.code}</TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>{assignmentSummary(language, h)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        {h.assignment ? (
                          <ActionButton tip={t(language, "tipHonorsUnassign")} size="small" variant="outlined" color="warning" disabled={busy !== null} onClick={() => unassign(h)}>
                            {t(language, "honorsUnassign")}
                          </ActionButton>
                        ) : (
                          <ActionButton tip={t(language, "tipHonorsAssign")} size="small" variant="contained" disabled={busy !== null} onClick={() => openAssign(h)}>
                            {t(language, "honorsAssign")}
                          </ActionButton>
                        )}
                        <TipIconButton
                          tip={h.assignment ? t(language, "tipHonorsLocked") : t(language, "tipHonorsEdit")}
                          aria-label={`${t(language, "honorsEdit")} ${h.name}`}
                          size="small"
                          disabled={h.assignment !== null || busy !== null}
                          onClick={() => openEditor(h)}
                        >
                          <EditIcon fontSize="small" />
                        </TipIconButton>
                        <TipIconButton
                          tip={h.assignment ? t(language, "tipHonorsLocked") : t(language, "tipHonorsDelete")}
                          aria-label={`${t(language, "actionDelete")} ${h.name}`}
                          size="small"
                          color="error"
                          disabled={h.assignment !== null || busy !== null}
                          onClick={() => removeHonor(h)}
                        >
                          <DeleteIcon fontSize="small" />
                        </TipIconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>

      <Dialog open={editor !== null} onClose={() => setEditor(null)} maxWidth="sm" fullWidth aria-labelledby="honors-editor-title">
        <DialogTitle id="honors-editor-title">
          {editor?.honor ? t(language, "honorsDialogEditTitle") : t(language, "honorsDialogAddTitle")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editorError && <Alert severity="error">{editorError}</Alert>}
            <TextField
              label={t(language, "honorsColCode")}
              value={editor?.values.code ?? ""}
              onChange={(e) => editor && setEditor({ ...editor, values: { ...editor.values, code: e.target.value } })}
              fullWidth
              required
            />
            <TextField
              label={t(language, "honorsColName")}
              value={editor?.values.name ?? ""}
              onChange={(e) => editor && setEditor({ ...editor, values: { ...editor.values, name: e.target.value } })}
              fullWidth
              required
            />
            <TextField
              label={t(language, "honorsSortOrder")}
              type="number"
              value={editor?.values.sortOrder ?? ""}
              onChange={(e) => editor && setEditor({ ...editor, values: { ...editor.values, sortOrder: e.target.value } })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton tip={t(language, "tipHonorsCancel")} onClick={() => setEditor(null)}>{t(language, "profileCancelButton")}</ActionButton>
          <ActionButton
            tip={t(language, "tipHonorsSave")}
            variant="contained"
            disabled={!editor || !editor.values.code.trim() || !editor.values.name.trim() || busy !== null}
            onClick={saveEditor}
          >
            {t(language, "honorsSave")}
          </ActionButton>
        </DialogActions>
      </Dialog>

      <Dialog open={assigning !== null} onClose={() => setAssigning(null)} maxWidth="sm" fullWidth aria-labelledby="honors-assign-title">
        <DialogTitle id="honors-assign-title">{`${t(language, "honorsAssignTitle")}: ${assigning?.name ?? ""}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {assignError && <Alert severity="error">{assignError}</Alert>}
            <FormControl fullWidth>
              <InputLabel id="honors-assign-class">{t(language, "honorsClass")}</InputLabel>
              <Select
                labelId="honors-assign-class"
                label={t(language, "honorsClass")}
                value={draft.categoryId}
                onChange={(e) => setDraft({ categoryId: String(e.target.value), displayNumber: null, target: WHOLE_DISPLAY })}
              >
                {eventClasses.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth disabled={!draft.categoryId}>
              <InputLabel id="honors-assign-display">{t(language, "honorsDisplay")}</InputLabel>
              <Select
                labelId="honors-assign-display"
                label={t(language, "honorsDisplay")}
                value={draft.displayNumber ?? ""}
                onChange={(e) => setDraft({ ...draft, displayNumber: Number(e.target.value), target: WHOLE_DISPLAY })}
              >
                {displayNumbers.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </FormControl>
            {draft.categoryId && displayNumbers.length === 0 && (
              <Typography variant="body2" color="text.secondary">{t(language, "honorsNoDisplay")}</Typography>
            )}
            {draft.displayNumber !== null && (
              <FormControl>
                <RadioGroup value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })}>
                  <FormControlLabel value={WHOLE_DISPLAY} control={<Radio />} label={t(language, "wholeDisplayLabel")} />
                  {modelsOnDisplay.map((m) => (
                    <FormControlLabel
                      key={m.id}
                      value={m.id}
                      control={<Radio />}
                      label={m.code ? `${m.name} (${m.code})` : m.name}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton tip={t(language, "tipHonorsCancel")} onClick={() => setAssigning(null)}>{t(language, "profileCancelButton")}</ActionButton>
          <ActionButton
            tip={t(language, "tipHonorsAssignConfirm")}
            variant="contained"
            disabled={!draft.categoryId || draft.displayNumber === null || busy !== null}
            onClick={submitAssign}
          >
            {t(language, "honorsAssign")}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
}
