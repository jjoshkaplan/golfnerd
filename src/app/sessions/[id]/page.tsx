import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupStats, shotsInRange } from "@/lib/stats";
import { faceToPath, type Shot } from "@/lib/schema";
import StretchForm from "@/components/StretchForm";
import ShotRow from "@/components/ShotRow";
import SessionsDashboard from "@/components/viz/SessionsDashboard";
import type { SessionLike } from "@/lib/viz/build";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: session }, { data: shots }, { data: stretches }] = await Promise.all([
    supabase.from("sessions").select("*, clubs(name)").eq("id", id).single(),
    supabase.from("shots").select("*").eq("session_id", id).order("shot_no"),
    supabase.from("stretches").select("*").eq("session_id", id).order("from_shot"),
  ]);
  if (!session || !shots) notFound();

  const all = groupStats(shots as Shot[]);
  const fmt = (v: number | null, d = 0) => (v == null ? "n/a" : v.toFixed(d));

  return (
    <>
      <h1>{new Date(session.played_at).toLocaleString()} · {session.clubs?.name ?? "unknown club"}</h1>
      {session.notes && <p className="muted">{session.notes}</p>}

      <div className="card" style={{ marginBottom: 12 }}>
        <strong>Session</strong> · {all.n} shots · carry {fmt(all.carry_yd)} · total {fmt(all.total_yd)} · miss {fmt(all.miss_yd)} yd ·
        smash {fmt(all.smash, 2)} · spin {fmt(all.back_rpm)} · path {fmt(all.path_deg, 1)}° · face-to-path {fmt(all.face_to_path_abs_deg, 1)}° abs
      </div>

      <SessionsDashboard sessions={[{ id, played_at: session.played_at, notes: session.notes, club: session.clubs?.name ?? null, shots: shots as SessionLike["shots"], stretches: stretches ?? [] }]} />

      <h2 style={{ marginTop: 20 }}>Stretches</h2>
      {stretches?.map((st) => {
        const g = groupStats(shotsInRange(shots as Shot[], st.from_shot, st.to_shot));
        return (
          <div className="card" key={st.id} style={{ marginBottom: 8 }}>
            <strong>{st.label}</strong> · shots {st.from_shot}-{st.to_shot}{st.is_best ? " · best" : ""}
            {st.cue && <div className="muted">Cue: {st.cue}</div>}
            <div className="muted">{g.n} shots · carry {fmt(g.carry_yd)} · total {fmt(g.total_yd)} · miss {fmt(g.miss_yd)} yd · smash {fmt(g.smash, 2)}</div>
          </div>
        );
      })}
      <StretchForm sessionId={id} maxShot={shots.length} />

      <h2 style={{ marginTop: 20 }}>Shots</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
          <thead><tr>
            {["Use", "#", "Ball", "Launch", "Spin", "Carry", "Total", "Offline", "Smash", "Path", "Face", "F2P", "V mm", "H mm"].map((h) => <th key={h} style={{ padding: "4px 8px", textAlign: "right" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(shots as (Shot & { id: string })[]).map((s) => (
              <ShotRow key={s.id} sessionId={id} shot={s} f2p={faceToPath(s)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
