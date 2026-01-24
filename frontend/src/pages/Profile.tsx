import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Profile = {
  email?: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  avatarUrl?: string | null;
};

export default function Profile() {
  const [profile, setProfile] = useState<Profile>({});
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<Profile>("/users/profile");
    setProfile(res ?? {});
  }

  async function save() {
    await api("/users/profile", { method: "PUT", body: JSON.stringify(profile) });
    setMessage("Profilo aggiornato.");
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <div>
      <h2>Profilo</h2>
      <div className="card">
        <div className="grid">
          <input placeholder="Nome" value={profile.firstName ?? ""} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
          <input placeholder="Cognome" value={profile.lastName ?? ""} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
          <input placeholder="Telefono" value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          <input placeholder="Città" value={profile.city ?? ""} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
          <input placeholder="Indirizzo" value={profile.address ?? ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          <input placeholder="Contatto emergenza" value={profile.emergencyContact ?? ""} onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })} />
          <input placeholder="Avatar URL" value={profile.avatarUrl ?? ""} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} />
        </div>
        <button onClick={save}>Salva profilo</button>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
