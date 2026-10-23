import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Sessions() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("session_summary")
    .select("*")
    .order("played_at", { ascending: false });
  return (
    <>
      <h1>Sessions</h1>
      {!sessions?.length && <p className="muted">No sessions yet. Upload one to get started.</p>}
      {sessions?.map((s) => (
        <div className="card" key={s.session_id} style={{ marginBottom: 10 }}>
          <Link href={`/sessions/${s.session_id}`}><strong>{new Date(s.played_at).toLocaleDateString()}</strong></Link> · {s.club_name ?? "unknown club"} · {s.shots} shots
          <div className="muted">{s.carry_yd} carry · {s.total_yd} total · {s.miss_yd} yd miss · smash {s.smash}</div>
        </div>
      ))}
    </>
  );
}
