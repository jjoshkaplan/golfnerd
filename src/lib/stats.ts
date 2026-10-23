import { faceToPath, type Shot } from "./schema";

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const pick = (shots: Shot[], f: (s: Shot) => number | null | undefined) =>
  shots.map(f).filter((v): v is number => v != null && Number.isFinite(v));

export interface GroupStats {
  n: number;
  club_speed_mph: number | null;
  ball_speed_mph: number | null;
  smash: number | null;
  launch_deg: number | null;
  back_rpm: number | null;
  apex_yd: number | null;
  carry_yd: number | null;
  total_yd: number | null;
  offline_yd: number | null;
  miss_yd: number | null;
  path_deg: number | null;
  face_to_target_deg: number | null;
  face_to_path_abs_deg: number | null;
  attack_deg: number | null;
  vert_strike_mm: number | null;
  fairway_pct: number | null;
  draw_pct: number | null;
}

export function groupStats(shots: Shot[], fairwayWidthYd = 30): GroupStats {
  const live = shots.filter((s) => !s.excluded);
  const off = pick(live, (s) => s.offline_yd);
  const spin = pick(live, (s) => s.side_rpm);
  return {
    n: live.length,
    club_speed_mph: mean(pick(live, (s) => s.club_speed_mph)),
    ball_speed_mph: mean(pick(live, (s) => s.ball_speed_mph)),
    smash: mean(pick(live, (s) => s.smash)),
    launch_deg: mean(pick(live, (s) => s.launch_deg)),
    back_rpm: mean(pick(live, (s) => s.back_rpm)),
    apex_yd: mean(pick(live, (s) => s.apex_yd)),
    carry_yd: mean(pick(live, (s) => s.carry_yd)),
    total_yd: mean(pick(live, (s) => s.total_yd)),
    offline_yd: mean(off),
    miss_yd: mean(off.map(Math.abs)),
    path_deg: mean(pick(live, (s) => s.path_deg)),
    face_to_target_deg: mean(pick(live, (s) => s.face_to_target_deg)),
    face_to_path_abs_deg: mean(pick(live, (s) => { const v = faceToPath(s); return v == null ? null : Math.abs(v); })),
    attack_deg: mean(pick(live, (s) => s.attack_deg)),
    vert_strike_mm: mean(pick(live, (s) => s.vert_strike_mm)),
    fairway_pct: off.length ? (100 * off.filter((o) => Math.abs(o) <= fairwayWidthYd / 2).length) / off.length : null,
    draw_pct: spin.length ? (100 * spin.filter((r) => r < -150).length) / spin.length : null,
  };
}

/** One-standard-deviation dispersion ellipse of finishing positions (offline vs total). */
export interface Ellipse { cx: number; cz: number; a: number; b: number; angle: number; n: number }

export function dispersionEllipse(shots: Shot[]): Ellipse | null {
  const e = ellipse2(shots
    .filter((s) => !s.excluded && s.offline_yd != null && s.total_yd != null)
    .map((s) => [s.offline_yd as number, s.total_yd as number]));
  return e && { cx: e.cx, cz: e.cy, a: e.a, b: e.b, angle: e.angle, n: e.n };
}

/** 1σ ellipse of any 2D point cloud: center, semi-axes and rotation of the major axis from +x. */
export interface Ellipse2 { cx: number; cy: number; a: number; b: number; angle: number; n: number }
export function ellipse2(pts: number[][]): Ellipse2 | null {
  const n = pts.length;
  if (n < 3) return null;
  const cx = pts.reduce((a, p) => a + p[0], 0) / n;
  const cy = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  sxx /= n - 1; sxy /= n - 1; syy /= n - 1;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(tr / 2 - disc, 0.25);
  const angle = Math.abs(sxy) < 1e-6 ? (sxx >= syy ? 0 : Math.PI / 2) : Math.atan2(l1 - sxx, sxy);
  return { cx, cy, a: Math.sqrt(l1), b: Math.sqrt(l2), angle, n };
}

/** Shots in a tagged range, inclusive. */
export function shotsInRange(shots: Shot[], from: number, to: number) {
  return shots.filter((s) => s.shot_no >= from && s.shot_no <= to);
}
