import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Enrollment = {
  id: string;
  eventId: string;
  modelId?: string | null;
  categoryId?: string | null;
  status: string;
  checkedIn: boolean;
};

interface EnrollmentsProps {
  language: Language;
}

export default function Enrollments({ language }: EnrollmentsProps) {
  const [eventId, setEventId] = useState("");
  const [modelId, setModelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    setEnrollments(await api<Enrollment[]>("/enrollments"));
  }

  async function enroll() {
    await api(`/events/${eventId}/enroll`, { method: "POST", body: JSON.stringify({ modelId: modelId || undefined, categoryId: categoryId || undefined }) });
    setEventId("");
    setModelId("");
    setCategoryId("");
    await load();
    setMessage(t(language, "enrollmentsSubmitted"));
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <div>
      <h2>{t(language, "enrollmentsTitle")}</h2>
      <div className="card">
        <div className="grid">
          <input placeholder={t(language, "enrollmentsEventPlaceholder")} value={eventId} onChange={(e) => setEventId(e.target.value)} />
          <input placeholder={t(language, "enrollmentsModelPlaceholder")} value={modelId} onChange={(e) => setModelId(e.target.value)} />
          <input placeholder={t(language, "enrollmentsCategoryPlaceholder")} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <button onClick={enroll}>{t(language, "enrollmentsButton")}</button>
        </div>
      </div>
      <div className="card">
        <h3>{t(language, "enrollmentsListTitle")}</h3>
        <ul>
          {enrollments.map((enrollment) => (
            <li key={enrollment.id}>
              <b>{enrollment.eventId}</b> - {enrollment.status} {enrollment.checkedIn ? t(language, "enrollmentsCheckedIn") : ""}
            </li>
          ))}
        </ul>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
