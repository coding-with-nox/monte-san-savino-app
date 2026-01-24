import React, { useState } from "react";
import { api } from "../lib/api";

export default function StaffCheckin() {
  const [enrollmentId, setEnrollmentId] = useState("");
  const [message, setMessage] = useState("");

  async function checkIn() {
    await api(`/staff/checkin/${enrollmentId}`, { method: "POST" });
    setMessage("Check-in completato.");
    setEnrollmentId("");
  }

  async function printBadge() {
    const res = await api<{ message: string }>(`/staff/print/${enrollmentId}`);
    setMessage(res.message);
  }

  return (
    <div>
      <h2>Check-in staff</h2>
      <div className="card">
        <div className="grid">
          <input placeholder="Enrollment ID" value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} />
          <button onClick={checkIn}>Check-in</button>
          <button onClick={printBadge}>Stampa badge</button>
        </div>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
