import React, { useState } from "react";
import { api } from "../lib/api";

export default function Judge() {
  const [modelId, setModelId] = useState("");
  const [rank, setRank] = useState<number>(0);
  const [out, setOut] = useState("");

  async function vote() {
    const res = await api<any>("/judge/vote", { method: "POST", body: JSON.stringify({ modelId, rank }) });
    setOut(JSON.stringify(res, null, 2));
  }

  return (
    <div>
      <h2>Judge</h2>
      <p>Rank: 0 = non meritevole. Assenza voto = nessun record.</p>
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <input placeholder="modelId" value={modelId} onChange={e=>setModelId(e.target.value)} />
        <select value={rank} onChange={e=>setRank(Number(e.target.value))}>
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        <button onClick={vote}>Vote</button>
      </div>
      <pre style={{ background: "#111", color: "#ddd", padding: 12, marginTop: 12, overflow: "auto" }}>{out}</pre>
    </div>
  );
}
