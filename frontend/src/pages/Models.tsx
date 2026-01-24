import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Model = { id: string; name: string; categoryId: string; teamId?: string | null; imageUrl?: string | null };
type ModelDetail = { model: Model; images: { id: string; url: string }[] };

export default function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selected, setSelected] = useState<ModelDetail | null>(null);
  const [image, setImage] = useState("");

  async function load() {
    setModels(await api<Model[]>("/models"));
  }

  async function create() {
    await api("/models", { method: "POST", body: JSON.stringify({ name, categoryId, teamId: teamId || undefined, imageUrl: imageUrl || undefined }) });
    setName("");
    setCategoryId("");
    setTeamId("");
    setImageUrl("");
    await load();
  }

  async function openModel(modelId: string) {
    const detail = await api<ModelDetail>(`/models/${modelId}`);
    setSelected(detail);
  }

  async function addImage() {
    if (!selected?.model) return;
    await api(`/models/${selected.model.id}/images`, { method: "POST", body: JSON.stringify({ url: image }) });
    setImage("");
    await openModel(selected.model.id);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2>Modelli</h2>
      <div className="card">
        <div className="grid">
          <input placeholder="Nome modello" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Category ID" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <input placeholder="Team ID (opzionale)" value={teamId} onChange={(e) => setTeamId(e.target.value)} />
          <input placeholder="Immagine principale URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <button onClick={create}>Crea modello</button>
        </div>
      </div>
      <div className="grid-two">
        <div className="card">
          <h3>Lista modelli</h3>
          <ul>
            {models.map((model) => (
              <li key={model.id}>
                <button className="link-button" onClick={() => openModel(model.id)}>
                  {model.name} <span className="muted">({model.categoryId})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Dettaglio</h3>
          {selected?.model ? (
            <>
              <p><b>{selected.model.name}</b></p>
              <p className="muted">{selected.model.id}</p>
              <ul>
                {selected.images.map((img) => (
                  <li key={img.id}>{img.url}</li>
                ))}
              </ul>
              <div className="grid">
                <input placeholder="URL immagine" value={image} onChange={(e) => setImage(e.target.value)} />
                <button onClick={addImage}>Aggiungi immagine</button>
              </div>
            </>
          ) : (
            <p className="muted">Seleziona un modello.</p>
          )}
        </div>
      </div>
    </div>
  );
}
