import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { ApiError, api } from "../lib/api";
import { createCodeChallenge, generateCodeVerifier, setSession } from "../lib/auth";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import useToast from "../components/useToast";

interface LoginProps {
  language: Language;
}

export default function Login({ language }: LoginProps) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const toast = useToast();

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

  function validateEmail(value: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!value) return true;
    if (value.length > 254) {
      setEmailError(t(language, "emailValidationTooLong"));
      return false;
    }
    if (!emailRegex.test(value)) {
      setEmailError(t(language, "emailValidationInvalid"));
      return false;
    }
    setEmailError("");
    return true;
  }

  function handleError(error: unknown) {
    console.error(error);
    if (error instanceof Error && error.message) {
      toast.error(error.message);
      return;
    }
    toast.error(labels.errorGeneric);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
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
    if (!validateEmail(email)) return;
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
    <PageContainer maxWidth="sm">
      {toast.node}
      <SectionCard title="Miniatures Contest">
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
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) validateEmail(event.target.value);
              }}
              onBlur={() => validateEmail(email)}
              error={!!emailError}
              helperText={emailError}
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
          </Stack>
        </Stack>
      </SectionCard>
    </PageContainer>
  );
}
