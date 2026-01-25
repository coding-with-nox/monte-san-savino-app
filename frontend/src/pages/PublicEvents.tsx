import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Event = { id: string; name: string; status: string; startDate?: string | null; endDate?: string | null };

interface PublicEventsProps {
  language: Language;
}

export default function PublicEvents({ language }: PublicEventsProps) {
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
      <h2>{t(language, "publicEventsTitle")}</h2>
      <div className="card">
        <div className="grid">
          <input placeholder={t(language, "publicEventsStatusPlaceholder")} value={status} onChange={(e) => setStatus(e.target.value)} />
          <button onClick={load}>{t(language, "publicEventsRefreshButton")}</button>
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
