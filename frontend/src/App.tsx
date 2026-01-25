import React, { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Judge from "./pages/Judge";
import Profile from "./pages/Profile";
import Teams from "./pages/Teams";
import Models from "./pages/Models";
import Enrollments from "./pages/Enrollments";
import PublicEvents from "./pages/PublicEvents";
import Admin from "./pages/Admin";
import StaffCheckin from "./pages/StaffCheckin";
import { getToken, getRole, roleAtLeast } from "./lib/auth";
import { Language, t } from "./lib/i18n";

function Protected({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}
function RequireRole({ min, children }: { min: any; children: React.ReactNode }) {
  const r = getRole(); if (!r) return <Navigate to="/login" replace />;
  return roleAtLeast(r, min) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (window.localStorage.getItem("theme") as "light" | "dark") || "light";
  });
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "it";
    return (window.localStorage.getItem("language") as Language) || "it";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("language", language);
  }, [language]);

  const labels = {
    themeToggle: t(language, "themeToggle"),
    themeLight: t(language, "themeLight"),
    themeDark: t(language, "themeDark"),
    languageToggle: t(language, "languageToggle"),
    languageIt: t(language, "languageIt"),
    languageEn: t(language, "languageEn")
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <b>Miniatures Contest</b>
        <Link to="/">{t(language, "navHome")}</Link>
        <Link to="/profile">{t(language, "navProfile")}</Link>
        <Link to="/teams">{t(language, "navTeams")}</Link>
        <Link to="/models">{t(language, "navModels")}</Link>
        <Link to="/enrollments">{t(language, "navEnrollments")}</Link>
        <Link to="/public-events">{t(language, "navPublicEvents")}</Link>
        <Link to="/judge">{t(language, "navJudge")}</Link>
        <Link to="/staff">{t(language, "navStaff")}</Link>
        <Link to="/admin">{t(language, "navAdmin")}</Link>
        <div className="header-spacer" />
        <div className="header-controls">
          <div className="language-select">
            <span className="material-symbols-outlined">language</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              aria-label={labels.languageToggle}
            >
              <option value="it">{labels.languageIt}</option>
              <option value="en">{labels.languageEn}</option>
            </select>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`${labels.themeToggle}: ${theme === "light" ? labels.themeDark : labels.themeLight}`}
            title={`${labels.themeToggle}: ${theme === "light" ? labels.themeDark : labels.themeLight}`}
          >
            <span className="material-symbols-outlined">
              {theme === "light" ? "dark_mode" : "light_mode"}
            </span>
          </button>
        </div>
      </header>
      <hr className="divider" />
      <Routes>
        <Route
          path="/login"
          element={(
            <Login
              language={language}
            />
          )}
        />
        <Route path="/" element={<Protected><Dashboard language={language} /></Protected>} />
        <Route path="/profile" element={<Protected><Profile language={language} /></Protected>} />
        <Route path="/teams" element={<Protected><Teams language={language} /></Protected>} />
        <Route path="/models" element={<Protected><Models language={language} /></Protected>} />
        <Route path="/enrollments" element={<Protected><Enrollments language={language} /></Protected>} />
        <Route path="/public-events" element={<PublicEvents language={language} />} />
        <Route path="/judge" element={<Protected><RequireRole min="judge"><Judge language={language} /></RequireRole></Protected>} />
        <Route path="/staff" element={<Protected><RequireRole min="staff"><StaffCheckin language={language} /></RequireRole></Protected>} />
        <Route path="/admin" element={<Protected><RequireRole min="manager"><Admin language={language} /></RequireRole></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
