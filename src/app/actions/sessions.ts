"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ShotSchema, StretchSchema, DEVICES } from "@/lib/schema";

const SaveSessionInput = z.object({
  played_at: z.string().min(1),
  device: z.enum(DEVICES),
  source: z.enum(["csv", "screenshot", "manual"]).default("csv"),
  club_id: z.string().uuid().nullable().optional(),
  club_name: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  shots: z.array(ShotSchema).min(1),
});

export type SaveSessionResult = { ok: true; id: string } | { ok: false; error: string };

/** Create a session with its shots. Creates the club if `club_name` is given and no `club_id`. */
export async function saveSession(input: unknown): Promise<SaveSessionResult> {
  const parsed = SaveSessionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  let clubId = d.club_id ?? null;
  if (!clubId && d.club_name) {
    const { data: club, error } = await supabase
      .from("clubs").insert({ user_id: user.id, type: "driver", name: d.club_name }).select("id").single();
    if (error) return { ok: false, error: error.message };
    clubId = club.id;
  }

  const { data: session, error: sErr } = await supabase.from("sessions").insert({
    user_id: user.id, club_id: clubId, played_at: d.played_at, device: d.device, source: d.source,
    notes: d.notes || null, shot_count: d.shots.length,
  }).select("id").single();
  if (sErr) return { ok: false, error: sErr.message };

  const rows = d.shots.map((s) => ({ ...s, session_id: session.id, user_id: user.id }));
  const { error: shErr } = await supabase.from("shots").insert(rows);
  if (shErr) {
    await supabase.from("sessions").delete().eq("id", session.id);
    return { ok: false, error: shErr.message };
  }
  revalidatePath("/sessions");
  return { ok: true, id: session.id };
}

export async function addStretch(sessionId: string, input: unknown) {
  const parsed = StretchSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (parsed.data.is_best) {
    await supabase.from("stretches").update({ is_best: false }).eq("session_id", sessionId);
  }
  const { error } = await supabase.from("stretches").insert({ ...parsed.data, session_id: sessionId, user_id: user.id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true as const };
}

export async function deleteStretch(sessionId: string, stretchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stretches").delete().eq("id", stretchId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true as const };
}

export async function toggleExcluded(sessionId: string, shotId: string, excluded: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("shots").update({ excluded }).eq("id", shotId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true as const };
}
