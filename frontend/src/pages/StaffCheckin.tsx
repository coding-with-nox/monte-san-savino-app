import React, { useState } from "react";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

interface StaffCheckinProps {
  language: Language;
}

export default function StaffCheckin({ language }: StaffCheckinProps) {
  const [enrollmentId, setEnrollmentId] = useState("");
  const [message, setMessage] = useState("");

  async function checkIn() {
    await api(`/staff/checkin/${enrollmentId}`, { method: "POST" });
    setMessage(t(language, "staffCheckinCompleted"));
    setEnrollmentId("");
  }

  async function printBadge() {
    const res = await api<{ message: string }>(`/staff/print/${enrollmentId}`);
    setMessage(res.message);
  }

  return (
    <div>
      <h2>{t(language, "staffCheckinTitle")}</h2>
      <div className="card">
        <div className="grid">
          <input placeholder={t(language, "staffCheckinEnrollmentPlaceholder")} value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} />
          <button onClick={checkIn}>{t(language, "staffCheckinButton")}</button>
          <button onClick={printBadge}>{t(language, "staffCheckinPrintButton")}</button>
        </div>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
