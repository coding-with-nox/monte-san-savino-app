import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Model = { id: string; name: string; categoryId: string; imageUrl?: string | null };

export default function Judge() {
  const [modelId, setModelId] = useState("");
  const [rank, setRank] = useState<number>(0);
  const [out, setOut] = useState("");
  const [eventId, setEventId] = useState("");
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<Model[]>([]);

  async function loadModels() {
    const query = new URLSearchParams();
    if (eventId) query.set("eventId", eventId);
    if (search) query.set("search", search);
    const res = await api<Model[]>(`/judge/models?${query.toString()}`);
    setModels(res);
  }

  async function vote() {
    const res = await api<any>("/judge/vote", { method: "POST", body: JSON.stringify({ modelId, rank }) });
    setOut(JSON.stringify(res, null, 2));
  }

  useEffect(() => {
    loadModels();
  }, []);

  return (
    <div>
      <h2>Judge</h2>
      <p>Rank: 0 = non meritevole. Assenza voto = nessun record.</p>
      <div className="card">
        <div className="grid">
          <input placeholder="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} />
          <input placeholder="Ricerca modello" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={loadModels}>Aggiorna lista</button>
        </div>
        <ul>
          {models.map((model) => (
            <li key={model.id}>
              <button className="link-button" onClick={() => setModelId(model.id)}>
                {model.name} <span className="muted">({model.categoryId})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>Vota modello</h3>
        <div className="grid">
          <input placeholder="modelId" value={modelId} onChange={e=>setModelId(e.target.value)} />
          <select value={rank} onChange={e=>setRank(Number(e.target.value))}>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <button onClick={vote}>Vota</button>
        </div>
        <pre className="code-block">{out}</pre>
      </div>
    </div>
  );
}
