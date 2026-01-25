import React from "react";
import { clearToken, getRole } from "../lib/auth";
import { Language, t } from "../lib/i18n";

interface DashboardProps {
  language: Language;
}

export default function Dashboard({ language }: DashboardProps) {
  return (
    <div>
      <h2>{t(language, "dashboardTitle")}</h2>
      <p>{t(language, "dashboardRoleLabel")}: <b>{getRole() ?? t(language, "dashboardRoleUnknown")}</b></p>
      <button onClick={() => { clearToken(); location.href = "/login"; }}>{t(language, "logoutButton")}</button>
      <p style={{ opacity: 0.75 }}>{t(language, "dashboardHint")}</p>
    </div>
  );
}
