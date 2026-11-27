import React, { useMemo, useState } from "react";
import {
  Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip
} from "@mui/material";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import useToast from "../../components/useToast";
import type { AdminCategory, AdminEvent, ModelRef } from "./types";

interface MissingModelsCardProps {
  language: Language;
  events: AdminEvent[];
  categories: AdminCategory[];
  models: ModelRef[];
  onChanged: () => void;
}

/** Manager: PATCH /admin/models/:id/missing { missing } for the models of one event (409 once its class is closed). */
export default function MissingModelsCard({ language, events, categories, models, onChanged }: MissingModelsCardProps) {
  const toast = useToast();
  const [eventId, setEventId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const classNames = useMemo(
    () => new Map(categories.filter((c) => c.eventId === eventId).map((c) => [c.id, c.name] as [string, string])),
    [categories, eventId]
  );
  const rows = useMemo(
    () => (eventId ? models.filter((m) => !!m.categoryId && classNames.has(m.categoryId)) : []),
    [eventId, models, classNames]
  );

  async function setMissing(model: ModelRef, missing: boolean) {
    setBusyId(model.id);
    try {
      await api(`/admin/models/${encodeURIComponent(model.id)}/missing`, {
        method: "PATCH",
        body: JSON.stringify({ missing })
      });
      toast.success(t(language, "missingUpdated"));
      onChanged();
    } catch (err: any) {
      toast.error(err?.status === 409 ? t(language, "missingErrorClosed") : (err?.message ?? String(err)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SectionCard title={t(language, "missingTitle")}>
      {toast.node}
      <Stack spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
          <Select value={eventId} label={t(language, "adminJudgeEventPlaceholder")} onChange={(e) => setEventId(e.target.value)}>
            {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
          </Select>
        </FormControl>
        {eventId && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsModel")}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminCorrectionsCategory")}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      {model.name}
                      {model.missing && <Chip size="small" color="warning" label={t(language, "missingChip")} sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>{classNames.get(model.categoryId ?? "") ?? "-"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t(language, "tipMissingModel")} describeChild>
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={!!model.missing}
                              disabled={busyId === model.id}
                              onChange={(e) => void setMissing(model, e.target.checked)}
                            />
                          }
                          label={t(language, "missingToggle")}
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={3}>{t(language, "missingNoModels")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </SectionCard>
  );
}
