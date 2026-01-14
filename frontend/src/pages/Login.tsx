import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setToken } from "../lib/auth";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

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
    <div style={{ maxWidth: 420 }}>
      <h2>Login</h2>
      <form onSubmit={onLogin} style={{ display: "grid", gap: 8 }}>
        <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Login</button>
        <button type="button" onClick={onRegister}>Sign up</button>
        {err && <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>}
      </form>
    </div>
  );
}
