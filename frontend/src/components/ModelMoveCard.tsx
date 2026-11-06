import React, { useState } from "react";
import { Button, FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import SectionCard from "./SectionCard";
import ConfirmDialog from "./ConfirmDialog";
import useToast from "./useToast";

export type MovableModel = { id: string; name: string; categoryId?: string };
export type MoveTarget = { id: string; name: string };

interface ModelMoveCardProps {
  language: Language;
  models: MovableModel[];
  categories: MoveTarget[];
  onMoved?: () => void;
}

/** Moves a model to another class: PUT /admin/models/:id { categoryId }, after a confirmation dialog. */
export default function ModelMoveCard({ language, models, categories, onMoved }: ModelMoveCardProps) {
  const toast = useToast();
  const [modelId, setModelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const model = models.find((m) => m.id === modelId);
  const target = categories.find((c) => c.id === categoryId);
  const canMove = !!model && !!target && model.categoryId !== categoryId;

  async function move() {
    setConfirmOpen(false);
    setBusy(true);
    try {
      await api(`/admin/models/${encodeURIComponent(modelId)}`, { method: "PUT", body: JSON.stringify({ categoryId }) });
      toast.success(t(language, "moveModelDone"));
      setModelId("");
      setCategoryId("");
      onMoved?.();
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard icon={<DriveFileMoveIcon />} title={t(language, "moveModelTitle")}>
      {toast.node}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel id="move-model-label">{t(language, "moveModelModel")}</InputLabel>
          <Select labelId="move-model-label" value={modelId} label={t(language, "moveModelModel")} onChange={(e) => setModelId(e.target.value)}>
            {models.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel id="move-target-label">{t(language, "moveModelTarget")}</InputLabel>
          <Select labelId="move-target-label" value={categoryId} label={t(language, "moveModelTarget")} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" disabled={!canMove || busy} onClick={() => setConfirmOpen(true)} sx={{ minWidth: 120 }}>
          {t(language, "moveModelButton")}
        </Button>
      </Stack>
      <ConfirmDialog
        open={confirmOpen}
        destructive={false}
        title={t(language, "moveModelTitle")}
        message={`${t(language, "moveModelConfirm")} "${target?.name ?? ""}": ${model?.name ?? ""}?`}
        confirmLabel={t(language, "confirmDialogConfirm")}
        cancelLabel={t(language, "profileCancelButton")}
        onConfirm={move}
        onCancel={() => setConfirmOpen(false)}
      />
    </SectionCard>
  );
}
