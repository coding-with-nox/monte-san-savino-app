import React, { useCallback, useRef, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { Language, t } from "../lib/i18n";

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  message,
  title,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth aria-labelledby="confirm-dialog-title">
      {title && <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>}
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel ?? "Cancel"}</Button>
        <Button onClick={onConfirm} variant="contained" color={destructive ? "error" : "primary"} autoFocus>
          {confirmLabel ?? "OK"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type ConfirmOptions = { title?: string; destructive?: boolean };

/**
 * Promise-based replacement for window.confirm.
 * Usage: const { confirm, node } = useConfirm(language); ... if (!(await confirm(msg))) return; ... render {node}
 */
export function useConfirm(language: Language) {
  const [state, setState] = useState<({ message: string } & ConfirmOptions) | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ message, ...options });
    });
  }, []);

  const node = (
    <ConfirmDialog
      open={state !== null}
      message={state?.message ?? ""}
      title={state?.title}
      destructive={state?.destructive ?? true}
      confirmLabel={t(language, "confirmDialogConfirm")}
      cancelLabel={t(language, "profileCancelButton")}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, node };
}
