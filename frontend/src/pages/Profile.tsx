import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

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

interface ProfileProps {
  language: Language;
}

export default function Profile({ language }: ProfileProps) {
  const [profile, setProfile] = useState<Profile>({});
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<Profile>("/users/profile");
    setProfile(res ?? {});
  }

  async function save() {
    await api("/users/profile", { method: "PUT", body: JSON.stringify(profile) });
    setMessage(t(language, "profileSaved"));
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <div>
      <h2>{t(language, "profileTitle")}</h2>
      <div className="card">
        <div className="grid">
          <input placeholder={t(language, "profileFirstName")} value={profile.firstName ?? ""} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
          <input placeholder={t(language, "profileLastName")} value={profile.lastName ?? ""} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
          <input placeholder={t(language, "profilePhone")} value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          <input placeholder={t(language, "profileCity")} value={profile.city ?? ""} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
          <input placeholder={t(language, "profileAddress")} value={profile.address ?? ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          <input placeholder={t(language, "profileEmergencyContact")} value={profile.emergencyContact ?? ""} onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })} />
          <input placeholder={t(language, "profileAvatarUrl")} value={profile.avatarUrl ?? ""} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} />
        </div>
        <button onClick={save}>{t(language, "profileSaveButton")}</button>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
