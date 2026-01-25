import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Model = { id: string; name: string; categoryId: string; teamId?: string | null; imageUrl?: string | null };
type ModelDetail = { model: Model; images: { id: string; url: string }[] };

interface ModelsProps {
  language: Language;
}

export default function Models({ language }: ModelsProps) {
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
      <h2>{t(language, "modelsTitle")}</h2>
      <div className="card">
        <div className="grid">
          <input placeholder={t(language, "modelsNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder={t(language, "modelsCategoryPlaceholder")} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <input placeholder={t(language, "modelsTeamPlaceholder")} value={teamId} onChange={(e) => setTeamId(e.target.value)} />
          <input placeholder={t(language, "modelsImagePlaceholder")} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <button onClick={create}>{t(language, "modelsCreateButton")}</button>
        </div>
      </div>
      <div className="grid-two">
        <div className="card">
          <h3>{t(language, "modelsListTitle")}</h3>
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
          <h3>{t(language, "modelsDetailTitle")}</h3>
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
                <input placeholder={t(language, "modelsAddImagePlaceholder")} value={image} onChange={(e) => setImage(e.target.value)} />
                <button onClick={addImage}>{t(language, "modelsAddImageButton")}</button>
              </div>
            </>
          ) : (
            <p className="muted">{t(language, "modelsSelectHint")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
