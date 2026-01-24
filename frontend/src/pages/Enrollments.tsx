import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Enrollment = {
  id: string;
  eventId: string;
  modelId?: string | null;
  categoryId?: string | null;
  status: string;
  checkedIn: boolean;
};

export default function Enrollments() {
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
    setMessage("Iscrizione inviata.");
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <div>
      <h2>Iscrizioni</h2>
      <div className="card">
        <div className="grid">
          <input placeholder="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} />
          <input placeholder="Model ID (opzionale)" value={modelId} onChange={(e) => setModelId(e.target.value)} />
          <input placeholder="Category ID (opzionale)" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <button onClick={enroll}>Iscriviti</button>
        </div>
      </div>
      <div className="card">
        <h3>Le tue iscrizioni</h3>
        <ul>
          {enrollments.map((enrollment) => (
            <li key={enrollment.id}>
              <b>{enrollment.eventId}</b> - {enrollment.status} {enrollment.checkedIn ? "✓ check-in" : ""}
            </li>
          ))}
        </ul>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
