import React, { useState, useCallback } from "react";
import { Alert, AlertColor, Snackbar } from "@mui/material";

interface ToastState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface UseToastReturn {
  show: (message: string, severity?: AlertColor) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  node: React.ReactNode;
}

export default function useToast(): UseToastReturn {
  const [state, setState] = useState<ToastState>({ open: false, message: "", severity: "success" });

  const show = useCallback((message: string, severity: AlertColor = "success") => {
    setState({ open: true, message, severity });
  }, []);

  const error   = useCallback((message: string) => show(message, "error"),   [show]);
  const success = useCallback((message: string) => show(message, "success"), [show]);
  const info    = useCallback((message: string) => show(message, "info"),    [show]);

  const handleClose = () => setState((prev) => ({ ...prev, open: false }));

  const node = (
    <Snackbar
      open={state.open}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        onClose={handleClose}
        severity={state.severity}
        variant="filled"
        sx={{ width: "100%", borderRadius: 3 }}
      >
        {state.message}
      </Alert>
    </Snackbar>
  );

  return { show, error, success, info, node };
}
