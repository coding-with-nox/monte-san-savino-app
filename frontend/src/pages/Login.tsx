import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { ApiError, api } from "../lib/api";
import { createCodeChallenge, generateCodeVerifier, setSession } from "../lib/auth";
import { Language, t } from "../lib/i18n";

interface LoginProps {
  language: Language;
}

export default function Login({ language }: LoginProps) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const labels = useMemo(() => ({
    eyebrow: t(language, "loginEyebrow"),
    title: t(language, "loginTitle"),
    subtitle: t(language, "loginSubtitle"),
    emailLabel: t(language, "emailLabel"),
    emailPlaceholder: t(language, "emailPlaceholder"),
    passwordLabel: t(language, "passwordLabel"),
    passwordPlaceholder: t(language, "passwordPlaceholder"),
    loginButton: t(language, "loginButton"),
    signupButton: t(language, "signupButton"),
    errorTitle: t(language, "errorTitle"),
    errorGeneric: t(language, "errorGeneric")
  }), [language]);

  function handleError(error: unknown) {
    console.error(error);
    if (error instanceof Error && error.message) {
      setErr(error.message);
      return;
    }
    setErr(labels.errorGeneric);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      try {
        const tokenRes = await api<{ accessToken: string; refreshToken: string; expiresIn: number; expires_in?: number }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        const expiresIn = tokenRes.expiresIn ?? tokenRes.expires_in ?? 0;
        setSession(tokenRes.accessToken, tokenRes.refreshToken, expiresIn);
        nav("/");
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
          throw error;
        }
      }

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await createCodeChallenge(codeVerifier);
      const authRes = await api<{ code: string }>("/auth/authorize", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          code_challenge: codeChallenge,
          code_challenge_method: "S256"
        })
      });
      const tokenRes = await api<{ accessToken: string; refreshToken: string; expiresIn: number; expires_in?: number }>("/auth/token", {
        method: "POST",
        body: JSON.stringify({ code: authRes.code, code_verifier: codeVerifier })
      });
      const expiresIn = tokenRes.expiresIn ?? tokenRes.expires_in ?? 0;
      setSession(tokenRes.accessToken, tokenRes.refreshToken, expiresIn);
      nav("/");
    } catch (e: any) {
      handleError(e);
    }
  }

  async function onRegister() {
    setErr(null);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      await onLogin({ preventDefault() {} } as any);
    } catch (e: any) {
      handleError(e);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Card elevation={6}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="overline" color="primary">
                {labels.eyebrow}
              </Typography>
              <Typography variant="h4">{labels.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {labels.subtitle}
              </Typography>
            </Box>

            <Stack component="form" spacing={2} onSubmit={onLogin}>
              <TextField
                label={labels.emailLabel}
                placeholder={labels.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                fullWidth
              />
              <TextField
                label={labels.passwordLabel}
                placeholder={labels.passwordPlaceholder}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button type="submit" variant="contained" color="primary" fullWidth>
                  {labels.loginButton}
                </Button>
                <Button type="button" variant="outlined" onClick={onRegister} fullWidth>
                  {labels.signupButton}
                </Button>
              </Stack>
              {err && (
                <Alert severity="error">
                  <strong>{labels.errorTitle}</strong> — {err}
                </Alert>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
