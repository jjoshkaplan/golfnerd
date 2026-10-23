import { createClient } from "@/lib/supabase/server";
import SessionsDashboard from "@/components/viz/SessionsDashboard";
import type { SessionLike } from "@/lib/viz/build";

/** All of the signed-in user's sessions in one dashboard. */
export default async function Compare() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, played_at, notes, clubs(name), shots(*), stretches(*)")
    .order("played_at");
  type Row = { id: string; played_at: string; notes: string | null; clubs: unknown; shots: unknown; stretches: unknown };
  const list: SessionLike[] = ((sessions ?? []) as Row[]).map((s) => ({
    id: s.id, played_at: s.played_at, notes: s.notes, club: (s.clubs as unknown as { name: string } | null)?.name ?? null,
    shots: s.shots as SessionLike["shots"], stretches: s.stretches as SessionLike["stretches"],
  }));
  return (
    <>
      <h1>Compare</h1>
      <p className="sub" style={{ marginBottom: 16 }}>Replay, dispersion and trends across every session. Pick which sessions to show from the Session menu.</p>
      {list.length ? <SessionsDashboard sessions={list} initialTab="trends" /> : <p className="muted">No sessions yet. Upload one, or look at the <a href="/demo">demo</a>.</p>}
    </>
  );
}
