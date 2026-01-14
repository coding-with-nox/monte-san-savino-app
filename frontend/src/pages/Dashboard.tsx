import React from "react";
import { clearToken, getRole } from "../lib/auth";
export default function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <p>Role: <b>{getRole() ?? "unknown"}</b></p>
      <button onClick={() => { clearToken(); location.href = "/login"; }}>Logout</button>
      <p style={{ opacity: 0.75 }}>UI starter: aggiungi le pagine per user/staff/manager quando vuoi.</p>
    </div>
  );
}
