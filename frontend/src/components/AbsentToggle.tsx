import React, { useState } from "react";
import { FormControlLabel, Switch } from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import useToast from "./useToast";

interface AbsentToggleProps {
  language: Language;
  enrollmentId: string;
  absent: boolean;
  onChanged?: (absent: boolean) => void;
}

/** Manager toggle: PATCH /admin/enrollments/:id/absent { absent } with toast feedback. */
export default function AbsentToggle({ language, enrollmentId, absent, onChanged }: AbsentToggleProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    setBusy(true);
    try {
      await api(`/admin/enrollments/${encodeURIComponent(enrollmentId)}/absent`, {
        method: "PATCH",
        body: JSON.stringify({ absent: next })
      });
      onChanged?.(next);
      toast.success(t(language, next ? "enrollmentsMarkedAbsent" : "enrollmentsMarkedPresent"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {toast.node}
      <FormControlLabel
        control={<Switch size="small" checked={absent} disabled={busy} onChange={(e) => change(e.target.checked)} />}
        label={t(language, "enrollmentsMarkAbsent")}
      />
    </>
  );
}
