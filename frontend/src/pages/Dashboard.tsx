import React from "react";
import { clearToken, getRole } from "../lib/auth";
export default function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <p>Role: <b>{getRole() ?? "unknown"}</b></p>
      <button onClick={() => { clearToken(); location.href = "/login"; }}>Logout</button>
      <p style={{ opacity: 0.75 }}>Usa il menu in alto per profilo, team, modelli, iscrizioni e area admin.</p>
    </div>
  );
}
