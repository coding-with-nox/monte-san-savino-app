import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Model = { id: string; name: string; categoryId: string; imageUrl?: string | null };

interface JudgeProps {
  language: Language;
}

export default function Judge({ language }: JudgeProps) {
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
      <h2>{t(language, "judgeTitle")}</h2>
      <p>{t(language, "judgeRankHint")}</p>
      <div className="card">
        <div className="grid">
          <input placeholder={t(language, "judgeEventPlaceholder")} value={eventId} onChange={(e) => setEventId(e.target.value)} />
          <input placeholder={t(language, "judgeSearchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={loadModels}>{t(language, "judgeRefreshButton")}</button>
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
        <h3>{t(language, "judgeVoteTitle")}</h3>
        <div className="grid">
          <input placeholder={t(language, "judgeModelIdPlaceholder")} value={modelId} onChange={e=>setModelId(e.target.value)} />
          <select value={rank} onChange={e=>setRank(Number(e.target.value))}>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <button onClick={vote}>{t(language, "judgeVoteButton")}</button>
        </div>
        <pre className="code-block">{out}</pre>
      </div>
    </div>
  );
}
