/**
 * Seed the four prototype sessions into Supabase for a given user.
 *   SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local
 *   npm run seed -- <user-email>
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { ShotSchema } from "../src/lib/schema";

const email = process.argv[2];
if (!email) { console.error("usage: npm run seed -- <user-email>"); process.exit(1); }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user with email ${email}. Sign in once first.`);

  const seed = JSON.parse(readFileSync("data/seed/sessions.json", "utf8")) as Array<{
    played_at: string; club: string; device: string; source: string; notes: string;
    stretches: { label: string; cue: string; from_shot: number; to_shot: number; is_best: boolean }[];
    shots: Record<string, unknown>[];
  }>;

  const clubs = new Map<string, string>();
  for (const name of new Set(seed.map((s) => s.club))) {
    const { data, error } = await supabase.from("clubs")
      .upsert({ user_id: user.id, type: "driver", name }, { onConflict: "id" }).select("id").single();
    if (error) throw error;
    clubs.set(name, data.id);
  }

  for (const s of seed) {
    const { data: session, error } = await supabase.from("sessions").insert({
      user_id: user.id, club_id: clubs.get(s.club), played_at: s.played_at, device: s.device,
      source: s.source, notes: s.notes, shot_count: s.shots.length,
    }).select("id").single();
    if (error) throw error;
    const shots = s.shots.map((r) => ({ ...ShotSchema.parse(r), session_id: session.id, user_id: user.id }));
    const { error: e2 } = await supabase.from("shots").insert(shots);
    if (e2) throw e2;
    const { error: e3 } = await supabase.from("stretches").insert(
      s.stretches.map((st) => ({ ...st, session_id: session.id, user_id: user.id })));
    if (e3) throw e3;
    console.log(`seeded ${s.played_at.slice(0, 10)} ${s.club}: ${shots.length} shots`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
