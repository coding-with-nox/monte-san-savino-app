import React, { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Alert, Box, Paper, Stack, TextField, Typography } from "@mui/material";
import { api, errorCode } from "../lib/api";
import { Language, t } from "../lib/i18n";
import useToast from "../components/useToast";
import { ActionButton } from "../components/ActionButton";

const MIN_PASSWORD = 8;

interface ResetPasswordProps {
  language: Language;
}

/** Public page reached from the email link: /reset-password?token=... (no session needed). */
export default function ResetPassword({ language }: ResetPasswordProps) {
  const tr = (key: string) => t(language, key as any);
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const toast = useToast();
  const [status, setStatus] = useState<"form" | "done" | "invalid">(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD) next.password = tr("signupPasswordShort");
    if (confirm !== password) next.confirm = tr("signupPasswordMismatch");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setStatus("done");
    } catch (err) {
      if (errorCode(err) === "INVALID_OR_EXPIRED_TOKEN") setStatus("invalid");
      else {
        console.error(err);
        toast.error(err instanceof Error && err.message ? err.message : tr("errorGeneric"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", justifyContent: "center", px: 2, py: { xs: 3, sm: 6 } }}>
      {toast.node}
      <Paper variant="outlined" sx={{ width: "100%", maxWidth: 420, p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={3}>
          <Box textAlign="center">
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
              Monte San Savino Show
            </Typography>
            <Typography variant="h5" fontWeight={700}>{tr("resetPasswordTitle")}</Typography>
            {status === "form" && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{tr("resetPasswordSubtitle")}</Typography>
            )}
          </Box>

          {status === "invalid" && (
            <>
              <Alert severity="error">{tr("resetPasswordInvalid")}</Alert>
              <ActionButton tip={tr("tipResetPasswordLogin")} component={RouterLink} to="/login" variant="outlined" size="large" fullWidth>
                {tr("resetPasswordGoLogin")}
              </ActionButton>
            </>
          )}

          {status === "done" && (
            <>
              <Alert severity="success">{tr("resetPasswordDone")}</Alert>
              <ActionButton tip={tr("tipResetPasswordLogin")} component={RouterLink} to="/login" variant="contained" size="large" fullWidth>
                {tr("resetPasswordGoLogin")}
              </ActionButton>
            </>
          )}

          {status === "form" && (
            <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
              <TextField
                label={`${tr("resetPasswordNew")} *`}
                type="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: undefined })); }}
                error={!!errors.password}
                helperText={errors.password ?? tr("signupPasswordHint")}
                fullWidth
              />
              <TextField
                label={`${tr("signupPasswordConfirm")} *`}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setErrors((x) => ({ ...x, confirm: undefined })); }}
                error={!!errors.confirm}
                helperText={errors.confirm ?? " "}
                fullWidth
              />
              <ActionButton tip={tr("tipResetPasswordSubmit")} type="submit" variant="contained" size="large" disabled={busy} fullWidth>
                {tr("resetPasswordSubmit")}
              </ActionButton>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
