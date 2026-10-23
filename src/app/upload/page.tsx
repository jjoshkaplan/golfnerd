"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, type ParseResult } from "@/lib/adapters";
import { ADAPTERS } from "@/lib/adapters/registry";
import { DEVICES, type Shot } from "@/lib/schema";
import { groupStats } from "@/lib/stats";
import { saveSession } from "@/app/actions/sessions";

const COLS: { key: keyof Shot; label: string }[] = [
  { key: "shot_no", label: "#" }, { key: "ball_speed_mph", label: "Ball" }, { key: "launch_deg", label: "Launch" },
  { key: "back_rpm", label: "Back" }, { key: "side_rpm", label: "Side" }, { key: "carry_yd", label: "Carry" },
  { key: "total_yd", label: "Total" }, { key: "offline_yd", label: "Offline" }, { key: "club_speed_mph", label: "Club" },
  { key: "smash", label: "Smash" }, { key: "path_deg", label: "Path" }, { key: "face_to_target_deg", label: "Face" },
  { key: "attack_deg", label: "AoA" }, { key: "vert_strike_mm", label: "V mm" }, { key: "horiz_strike_mm", label: "H mm" },
];

export default function Upload() {
  const router = useRouter();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [device, setDevice] = useState<(typeof DEVICES)[number]>("uneekor");
  const [club, setClub] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = parseCsv(await f.text(), ADAPTERS);
    setResult(r);
    setShots(r.shots);
    if (r.device !== "other") setDevice(r.device);
  }

  function toggle(i: number) {
    setShots((s) => s.map((x, j) => (j === i ? { ...x, excluded: !x.excluded } : x)));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveSession({
        played_at: new Date(playedAt).toISOString(), device, source: "csv", club_name: club || undefined, notes, shots,
      });
      if (res.ok) router.push(`/sessions/${res.id}`);
      else setError(res.error);
    });
  }

  const stats = shots.length ? groupStats(shots) : null;

  return (
    <>
      <h1>Upload a session</h1>
      <p className="muted">CSV export from your launch monitor. Review the rows, exclude any mishits or misreads, then save.</p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} />

      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <div>Device: {result.device} · {result.shots.length} shots parsed · {result.errors.length} errors</div>
          {result.unmapped.length > 0 && <div className="muted">Unmapped columns: {result.unmapped.join(", ")}</div>}
          {result.errors.slice(0, 5).map((e) => <div key={e.row} className="muted">Row {e.row}: {e.message}</div>)}
        </div>
      )}

      {shots.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <label>Date <input type="datetime-local" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} /></label>
            <label>Device <select value={device} onChange={(e) => setDevice(e.target.value as typeof device)}>
              {DEVICES.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
            <label>Club <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="R9, Qi4D Max 10.5" /></label>
            <label>Notes <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="after 9 sim holes, higher tee" /></label>
          </div>

          {stats && (
            <p className="muted" style={{ marginTop: 10 }}>
              {stats.n} included · carry {stats.carry_yd?.toFixed(0)} · total {stats.total_yd?.toFixed(0)} · miss {stats.miss_yd?.toFixed(0)} yd · smash {stats.smash?.toFixed(2)}
            </p>
          )}

          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
              <thead><tr><th>Use</th>{COLS.map((c) => <th key={c.key} style={{ padding: "4px 8px", textAlign: "right" }}>{c.label}</th>)}</tr></thead>
              <tbody>
                {shots.map((s, i) => (
                  <tr key={s.shot_no} style={{ opacity: s.excluded ? 0.4 : 1 }}>
                    <td><input type="checkbox" checked={!s.excluded} onChange={() => toggle(i)} aria-label={`Include shot ${s.shot_no}`} /></td>
                    {COLS.map((c) => <td key={c.key} style={{ padding: "4px 8px", textAlign: "right" }}>{s[c.key] == null ? "" : String(s[c.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p style={{ color: "#e9a36b" }}>{error}</p>}
          <button onClick={save} disabled={pending} style={{ marginTop: 12 }}>{pending ? "Saving…" : "Save session"}</button>
        </>
      )}
    </>
  );
}
