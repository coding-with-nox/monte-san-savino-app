import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Team = { id: string; name: string; ownerId: string; role: string };
type TeamDetail = { team?: Team; members?: { teamId: string; userId: string; role: string }[] };

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<TeamDetail | null>(null);
  const [memberId, setMemberId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setTeams(await api<Team[]>("/teams"));
  }

  async function createTeam() {
    await api("/teams", { method: "POST", body: JSON.stringify({ name }) });
    setName("");
    await load();
  }

  async function openTeam(teamId: string) {
    const detail = await api<TeamDetail>(`/teams/${teamId}`);
    setSelected(detail);
  }

  async function addMember() {
    if (!selected?.team) return;
    await api(`/teams/${selected.team.id}/members`, { method: "POST", body: JSON.stringify({ userId: memberId }) });
    setMemberId("");
    await openTeam(selected.team.id);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <div>
      <h2>Team</h2>
      <div className="card">
        <div className="grid">
          <input placeholder="Nome team" value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={createTeam}>Crea team</button>
        </div>
      </div>
      <div className="grid-two">
        <div className="card">
          <h3>I tuoi team</h3>
          <ul>
            {teams.map((team) => (
              <li key={team.id}>
                <button className="link-button" onClick={() => openTeam(team.id)}>
                  {team.name} <span className="muted">({team.role})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Dettaglio</h3>
          {selected?.team ? (
            <>
              <p><b>{selected.team.name}</b></p>
              <ul>
                {selected.members?.map((member) => (
                  <li key={member.userId}>{member.userId} - {member.role}</li>
                ))}
              </ul>
              <div className="grid">
                <input placeholder="User ID" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
                <button onClick={addMember}>Aggiungi membro</button>
              </div>
            </>
          ) : (
            <p className="muted">Seleziona un team.</p>
          )}
        </div>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
