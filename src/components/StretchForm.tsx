"use client";
import { useState, useTransition } from "react";
import { addStretch } from "@/app/actions/sessions";

export default function StretchForm({ sessionId, maxShot }: { sessionId: string; maxShot: number }) {
  const [label, setLabel] = useState("Best stretch");
  const [cue, setCue] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(5, maxShot));
  const [best, setBest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (to < from) { setError("End shot must be at or after the start shot"); return; }
    start(async () => {
      const r = await addStretch(sessionId, { label, cue, from_shot: from, to_shot: to, is_best: best });
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
      <label>Label <input value={label} onChange={(e) => setLabel(e.target.value)} required /></label>
      <label>Cue <input value={cue} onChange={(e) => setCue(e.target.value)} placeholder="low takeaway, higher tee" /></label>
      <label>From <input type="number" min={1} max={maxShot} value={from} onChange={(e) => setFrom(+e.target.value)} style={{ width: 64 }} /></label>
      <label>To <input type="number" min={1} max={maxShot} value={to} onChange={(e) => setTo(+e.target.value)} style={{ width: 64 }} /></label>
      <label><input type="checkbox" checked={best} onChange={(e) => setBest(e.target.checked)} /> Best stretch</label>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Add stretch"}</button>
      {error && <span style={{ color: "#e9a36b", width: "100%" }}>{error}</span>}
    </form>
  );
}
