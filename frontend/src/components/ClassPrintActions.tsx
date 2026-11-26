import React, { useState } from "react";
import { Stack } from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { Language, t } from "../lib/i18n";
import { openHtmlExport } from "../lib/exports";
import useToast from "./useToast";
import { ActionButton } from "./ActionButton";

interface ClassPrintActionsProps {
  language: Language;
  categoryId: string;
}

const ACTIONS = [
  { kind: "exhibitors", labelKey: "classExhibitors", tipKey: "tipClassExhibitors", icon: <GroupIcon fontSize="small" /> },
  { kind: "jury-qr", labelKey: "classJuryQr", tipKey: "tipClassJuryQr", icon: <QrCode2Icon fontSize="small" /> },
  { kind: "jury-list", labelKey: "classJuryList", tipKey: "tipClassJuryList", icon: <ListAltIcon fontSize="small" /> }
] as const;

/** Per-class manager prints: GET /exports/classes/:categoryId/{exhibitors|jury-qr|jury-list}. */
export default function ClassPrintActions({ language, categoryId }: ClassPrintActionsProps) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: string) {
    setBusy(kind);
    try {
      await openHtmlExport(`/exports/classes/${encodeURIComponent(categoryId)}/${kind}`);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {toast.node}
      <Stack direction="row" spacing={0.5} className="no-print" sx={{ mr: 1 }}>
        {ACTIONS.map((a) => (
          <ActionButton
            key={a.kind}
            tip={t(language, a.tipKey)}
            size="small"
            variant="outlined"
            startIcon={a.icon}
            disabled={busy !== null}
            onClick={() => run(a.kind)}
          >
            {t(language, a.labelKey)}
          </ActionButton>
        ))}
      </Stack>
    </>
  );
}
