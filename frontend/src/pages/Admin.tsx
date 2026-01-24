import React, { useEffect, useState } from "react";
import { api, API_BASE } from "../lib/api";

type Event = { id: string; name: string; status: string };
type Category = { id: string; eventId: string; name: string };
type Enrollment = { id: string; eventId: string; status: string; userId: string };
type User = { id: string; email: string; role: string; isActive: boolean };

export default function Admin() {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [eventForm, setEventForm] = useState({ name: "", status: "" });
  const [categoryForm, setCategoryForm] = useState({ eventId: "", name: "" });
  const [judgeAssignment, setJudgeAssignment] = useState({ eventId: "", judgeId: "" });
  const [message, setMessage] = useState("");

  async function load() {
    setEvents(await api<Event[]>("/events"));
    setCategories(await api<Category[]>("/categories"));
    setEnrollments(await api<Enrollment[]>("/admin/enrollments"));
    setUsers(await api<User[]>("/admin/users"));
  }

  async function createEvent() {
    await api("/events", { method: "POST", body: JSON.stringify(eventForm) });
    setEventForm({ name: "", status: "" });
    await load();
  }

  async function createCategory() {
    await api("/categories", { method: "POST", body: JSON.stringify(categoryForm) });
    setCategoryForm({ eventId: "", name: "" });
    await load();
  }

  async function updateEnrollment(id: string, status: string) {
    await api(`/admin/enrollments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  }

  async function assignJudge() {
    await api("/admin/judges/assignments", { method: "POST", body: JSON.stringify(judgeAssignment) });
    setJudgeAssignment({ eventId: "", judgeId: "" });
    setMessage("Giudice assegnato.");
  }

  async function resetPassword(userId: string) {
    const res = await api<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`, { method: "POST" });
    setMessage(`Password temporanea: ${res.temporaryPassword}`);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <div>
      <h2>Admin</h2>
      {message && <p className="hint">{message}</p>}
      <div className="grid-two">
        <div className="card">
          <h3>Eventi</h3>
          <div className="grid">
            <input placeholder="Nome" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} />
            <input placeholder="Status" value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })} />
            <button onClick={createEvent}>Crea evento</button>
          </div>
          <ul>
            {events.map((event) => (
              <li key={event.id}>{event.name} <span className="muted">({event.status})</span></li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Categorie</h3>
          <div className="grid">
            <input placeholder="Event ID" value={categoryForm.eventId} onChange={(e) => setCategoryForm({ ...categoryForm, eventId: e.target.value })} />
            <input placeholder="Nome categoria" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            <button onClick={createCategory}>Crea categoria</button>
          </div>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>{category.name} <span className="muted">({category.eventId})</span></li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Iscrizioni</h3>
          <ul>
            {enrollments.map((enrollment) => (
              <li key={enrollment.id}>
                <b>{enrollment.eventId}</b> - {enrollment.status}
                <div className="chip-row">
                  {["pending", "approved", "rejected", "paid"].map((status) => (
                    <button key={status} className="chip" onClick={() => updateEnrollment(enrollment.id, status)}>{status}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Assegna giudici</h3>
          <div className="grid">
            <input placeholder="Event ID" value={judgeAssignment.eventId} onChange={(e) => setJudgeAssignment({ ...judgeAssignment, eventId: e.target.value })} />
            <input placeholder="Judge ID" value={judgeAssignment.judgeId} onChange={(e) => setJudgeAssignment({ ...judgeAssignment, judgeId: e.target.value })} />
            <button onClick={assignJudge}>Assegna</button>
          </div>
        </div>
        <div className="card">
          <h3>Utenti</h3>
          <ul>
            {users.map((user) => (
              <li key={user.id}>
                {user.email} <span className="muted">({user.role})</span>
                <button className="chip" onClick={() => resetPassword(user.id)}>Reset password</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Export</h3>
          <ul>
            <li><a href={`${API_BASE}/exports/enrollments`} target="_blank" rel="noreferrer">Export iscrizioni CSV</a></li>
            <li><a href={`${API_BASE}/exports/models`} target="_blank" rel="noreferrer">Export modelli CSV</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
