import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Judge from "./pages/Judge";
import { getToken, getRole, roleAtLeast } from "./lib/auth";

function Protected({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}
function RequireRole({ min, children }: { min: any; children: React.ReactNode }) {
  const r = getRole(); if (!r) return <Navigate to="/login" replace />;
  return roleAtLeast(r, min) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <b>Miniatures Contest</b>
        <Link to="/">Home</Link>
        <Link to="/judge">Judge</Link>
      </header>
      <hr />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/judge" element={<Protected><RequireRole min="judge"><Judge /></RequireRole></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
