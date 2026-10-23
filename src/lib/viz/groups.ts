import type { Shot } from "../schema";
import { faceToPath } from "../schema";
import { fmtSigned, sideText } from "./theme";

/**
 * A VizGroup is what every chart and the replay draw: one session (or any
 * named set of shots) with an optional best stretch. Pages build these from
 * Supabase rows or from the seed JSON; the viz code never touches the database.
 */
export interface VizGroup {
  key: string;
  name: string;
  short: string;
  tag: string;
  cue?: string;
  color: number;       // series index into SERIES
  shots: Shot[];
  best?: [number, number];
}

export const isHot = (g: VizGroup, s: Shot) => !!g.best && s.shot_no >= g.best[0] && s.shot_no <= g.best[1];
export const live = (g: VizGroup, bestOnly = false) => g.shots.filter((s) => !s.excluded && (!bestOnly || isHot(g, s)));

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const pick = <T>(rows: T[], f: (r: T) => number | null | undefined) =>
  rows.map(f).filter((v): v is number => v != null && Number.isFinite(v));
export const avgOf = (rows: Shot[], f: (s: Shot) => number | null | undefined) => mean(pick(rows, f));

/** One-line summary used by hover tooltips. HTML, safe because it only interpolates numbers and group names we own. */
export function shotTip(g: VizGroup, s: Shot, labelColor: string): string {
  const r = s;
  const hot = isHot(g, s);
  const f2p = faceToPath(s);
  let h = `<b style="color:${labelColor}">${g.name} · #${s.shot_no}${hot ? " · best stretch" : ""}</b>`;
  h += `<br>${r.carry_yd} carry · ${r.total_yd ?? "n/a"} total · ${r.offline_yd == null ? "n/a" : sideText(r.offline_yd)}`;
  h += `<br>${r.ball_speed_mph ?? "n/a"} mph ball · ${r.launch_deg ?? "n/a"}° launch · ${r.back_rpm == null ? "n/a" : Math.round(r.back_rpm)} rpm · smash ${r.smash ?? "n/a"}`;
  if (r.vert_strike_mm != null) h += `<br>strike V ${fmtSigned(r.vert_strike_mm)} / H ${fmtSigned(r.horiz_strike_mm ?? 0)} mm`;
  if (r.path_deg != null && r.face_to_target_deg != null)
    h += `<br>path ${fmtSigned(r.path_deg)}° · face ${fmtSigned(r.face_to_target_deg)}° · f2p ${fmtSigned(f2p ?? 0)}°${r.attack_deg != null ? ` · AoA ${fmtSigned(r.attack_deg)}°` : ""}`;
  return h;
}

/** Filters shared by the replay, maps and tables. */
export const FILTERS: Record<string, { label: string; f: (s: Shot) => boolean }> = {
  all: { label: "All shots", f: () => true },
  center: { label: "Centered strikes (±5 mm)", f: (s) => s.vert_strike_mm != null && Math.abs(s.vert_strike_mm) <= 5 },
  draw: { label: "Draw spin", f: (s) => (s.side_rpm ?? 0) < -150 },
  fade: { label: "Fade spin", f: (s) => (s.side_rpm ?? 0) > 150 },
  up: { label: "Attack angle ≥ 5°", f: (s) => s.attack_deg != null && s.attack_deg >= 5 },
  thin: { label: "Thin (launch ≤ 6°)", f: (s) => (s.launch_deg ?? 99) <= 6 },
};

/** Metric table rows shared by head-to-head and the trends detail. [label, getter, decimals, betterSign] */
export const METRICS: Array<[string, (s: Shot) => number | null | undefined, number, number]> = [
  ["Club speed (mph)", (s) => s.club_speed_mph, 0, 0],
  ["Ball speed (mph)", (s) => s.ball_speed_mph, 0, 1],
  ["Smash", (s) => s.smash, 2, 1],
  ["Launch (°)", (s) => s.launch_deg, 0, 0],
  ["Backspin (rpm)", (s) => s.back_rpm, -1, 0],
  ["Apex (yd)", (s) => s.apex_yd, 0, 0],
  ["Carry (yd)", (s) => s.carry_yd, 0, 1],
  ["Total (yd)", (s) => s.total_yd, 0, 1],
  ["Avg offline (yd, + right)", (s) => s.offline_yd, 0, 0],
  ["Avg miss, either side (yd)", (s) => (s.offline_yd == null ? null : Math.abs(s.offline_yd)), 0, -1],
  ["Path (°)", (s) => s.path_deg, 1, 0],
  ["Face to target (°)", (s) => s.face_to_target_deg, 1, 0],
  ["Face-to-path, abs (°)", (s) => { const v = faceToPath(s); return v == null ? null : Math.abs(v); }, 1, -1],
  ["Attack angle (°)", (s) => s.attack_deg, 1, 0],
  ["Vertical strike (mm)", (s) => s.vert_strike_mm, 0, 0],
];

export const fmtV = (v: number | null, d: number) =>
  v == null ? "n/a" : d === -1 ? (Math.round(v / 10) * 10).toLocaleString() : v.toFixed(d);
