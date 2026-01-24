import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Event = { id: string; name: string; status: string; startDate?: string | null; endDate?: string | null };

export default function PublicEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    setEvents(await api<Event[]>(`/public/events${query}`));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2>Eventi pubblici</h2>
      <div className="card">
        <div className="grid">
          <input placeholder="Filtro status" value={status} onChange={(e) => setStatus(e.target.value)} />
          <button onClick={load}>Aggiorna</button>
        </div>
      </div>
      <div className="card">
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <b>{event.name}</b> <span className="muted">({event.status})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
