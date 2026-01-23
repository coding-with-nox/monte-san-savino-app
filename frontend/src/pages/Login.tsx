import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setToken } from "../lib/auth";
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
    errorTitle: t(language, "errorTitle")
  }), [language]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await api<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(res.accessToken);
      nav("/");
    } catch (e: any) {
      setErr(e.message);
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
      setErr(e.message);
    }
  }

  return (
    <div className="login-page">
      <section className="login-card">
        <div className="login-title-group">
          <div className="login-eyebrow">{labels.eyebrow}</div>
          <h2>{labels.title}</h2>
          <p>{labels.subtitle}</p>
        </div>

        <form onSubmit={onLogin} className="login-form">
          <label className="login-field">
            {labels.emailLabel}
            <input
              placeholder={labels.emailPlaceholder}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          <label className="login-field">
            {labels.passwordLabel}
            <input
              placeholder={labels.passwordPlaceholder}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <div className="login-actions">
            <button type="submit" className="login-primary">{labels.loginButton}</button>
            <button type="button" className="login-secondary" onClick={onRegister}>{labels.signupButton}</button>
          </div>
          {err && (
            <div className="login-error">
              <strong>{labels.errorTitle}</strong>
              <div>{err}</div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
