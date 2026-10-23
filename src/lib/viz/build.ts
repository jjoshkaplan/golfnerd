import { ShotSchema, type Shot } from "../schema";
import type { VizGroup } from "./groups";

/** The shapes pages hand to groupsFrom(): seed JSON entries and Supabase rows both fit. */
export interface SessionLike {
  id?: string;
  played_at: string;
  club?: string | null;
  notes?: string | null;
  shots: Shot[] | Record<string, unknown>[];
  stretches?: Array<{ label?: string; cue?: string | null; from_shot: number; to_shot: number; is_best?: boolean | null }> | null;
  findings?: Array<{ title: string; body: string }> | null;
}

const timeOf = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
const fmtDate = (iso: string, withTime: boolean) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return withTime ? `${day} ${timeOf(d)}` : day;
};

/** Turn sessions into VizGroups: chronological, colored in order, with the best stretch and its cue. */
export function groupsFrom(sessions: SessionLike[]): VizGroup[] {
  const sorted = [...sessions].sort((a, b) => +new Date(a.played_at) - +new Date(b.played_at));
  const days = new Map<string, number>();
  sorted.forEach((s) => { const k = new Date(s.played_at).toDateString(); days.set(k, (days.get(k) ?? 0) + 1); });
  return sorted.map((s, i) => {
    const sameDay = (days.get(new Date(s.played_at).toDateString()) ?? 0) > 1;
    const shots = (s.shots as Record<string, unknown>[]).map((r) => ShotSchema.parse(r)).sort((a, b) => a.shot_no - b.shot_no);
    const best = (s.stretches ?? []).find((st) => st.is_best) ?? (s.stretches ?? [])[0];
    const club = s.club ?? "Driver";
    const clubShort = club.split(" ")[0];
    const date = fmtDate(s.played_at, sameDay);
    const d = new Date(s.played_at);
    const tag = `${d.getMonth() + 1}/${d.getDate()}${sameDay ? " " + timeOf(d) : ""}`;
    return {
      key: s.id ?? `s${i}`,
      name: `${club} · ${date}`,
      short: `${clubShort} ${tag}`,
      tag,
      cue: best?.cue ?? s.notes ?? undefined,
      color: i,
      shots,
      best: best ? [best.from_shot, best.to_shot] : undefined,
      notes: s.notes ?? undefined,
      findings: s.findings ?? undefined,
      stretches: (s.stretches ?? []).map((st) => ({ label: st.label ?? "Stretch", cue: st.cue ?? undefined, from: st.from_shot, to: st.to_shot, best: !!st.is_best })),
    };
  });
}
