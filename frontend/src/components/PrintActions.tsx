import React, { useState } from "react";
import { IconButton, Stack, Tooltip } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import LabelIcon from "@mui/icons-material/Label";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";
import { Language, t } from "../lib/i18n";
import { DymoSdkError, printDymoLabels } from "../lib/dymo";
import { openHtmlExport } from "../lib/exports";
import useToast from "./useToast";

export type PrintParams = Record<string, string | null | undefined>;

interface PrintActionsProps {
  language: Language;
  /** Filters forwarded to the export endpoints (eventId, categoryId, userId, modelId). */
  params: PrintParams;
  showList?: boolean;
  showLabel?: boolean;
}

/**
 * Shortcuts: print list (GET /exports/models/print), label sheet (GET /exports/labels/pdf)
 * and DYMO label printing (GET /exports/labels/data + DYMO SDK).
 */
export default function PrintActions({ language, params, showList = true, showLabel = true }: PrintActionsProps) {
  const toast = useToast();
  const [busy, setBusy] = useState<null | "list" | "label" | "dymo">(null);

  async function run(kind: "list" | "label" | "dymo", fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (err: any) {
      toast.error(err instanceof DymoSdkError ? t(language, "labelsDymoSdkError") : err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
    {toast.node}
    <Stack direction="row" spacing={0.5} className="no-print" onClick={stop}>
      {showList && (
        <Tooltip title={t(language, "printListButton")}>
          <span>
            <IconButton
              size="small"
              aria-label={t(language, "printListButton")}
              disabled={busy !== null}
              onClick={() => run("list", () => openHtmlExport("/exports/models/print", params))}
            >
              <PrintIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
      {showLabel && (
        <>
          <Tooltip title={t(language, "printLabelButton")}>
            <span>
              <IconButton
                size="small"
                aria-label={t(language, "printLabelButton")}
                disabled={busy !== null}
                onClick={() => run("label", () => openHtmlExport("/exports/labels/pdf", params))}
              >
                <LabelIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t(language, "printLabelDymoButton")}>
            <span>
              <IconButton
                size="small"
                aria-label={t(language, "printLabelDymoButton")}
                disabled={busy !== null}
                onClick={() =>
                  run("dymo", async () => {
                    const result = await printDymoLabels(params as Record<string, string | undefined>);
                    if (result === "noPrinter") toast.error(t(language, "labelsDymoNoPrinter"));
                    else if (result === "noData") toast.info(t(language, "printNoLabelData"));
                    else toast.success(t(language, "labelsDymoPrinted"));
                  })
                }
              >
                <LocalPrintshopIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </Stack>
    </>
  );
}
