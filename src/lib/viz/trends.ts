import type { Shot } from "../schema";
import { faceToPath } from "../schema";
import { type Theme, txt, seriesColor, labelColor } from "./theme";
import { type VizGroup, live, avgOf } from "./groups";

export interface TrendMetric { title: string; get: (s: Shot) => number | null | undefined; dec: number; zero?: boolean; floorZero?: boolean }

export const TREND_METRICS: TrendMetric[] = [
  { title: "Carry (yd)", get: (s) => s.carry_yd, dec: 0 },
  { title: "Smash factor", get: (s) => s.smash, dec: 2 },
  { title: "Avg miss (yd)", get: (s) => (s.offline_yd == null ? null : Math.abs(s.offline_yd)), dec: 0, floorZero: true },
  { title: "Vertical strike (mm, + high)", get: (s) => s.vert_strike_mm, dec: 0, zero: true },
  { title: "Horizontal strike spread (mm from center)", get: (s) => (s.horiz_strike_mm == null ? null : Math.abs(s.horiz_strike_mm)), dec: 0, floorZero: true },
];

interface Axes { X: (j: number) => number; Y: (v: number) => number; step: number }

function frame(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, title: string, legend: string) {
  x.clearRect(0, 0, w, h);
  txt(x, title, 12, 18, T.fg, 12);
  txt(x, legend, 12, 33, T.muted, 10);
}

function axes(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, groups: VizGroup[], lo: number, hi: number, dec: number, zero: boolean, sel: VizGroup | null): Axes {
  const L = 48, R = 14, Tp = 46, B = 44, n = groups.length;
  const X = (j: number) => L + (w - L - R) * ((j + 0.5) / n), Y = (v: number) => Tp + (h - Tp - B) * (1 - (v - lo) / (hi - lo));
  const step = (w - L - R) / n;
  if (sel) { const j = groups.indexOf(sel); if (j >= 0) { x.fillStyle = T.band; x.fillRect(X(j) - step / 2, Tp - 6, step, h - Tp - B + 12); } }
  x.strokeStyle = T.grid; x.lineWidth = 1;
  [0, 0.5, 1].forEach((f) => { const v = lo + (hi - lo) * f, yy = Y(v); x.beginPath(); x.moveTo(L, yy); x.lineTo(w - R, yy); x.stroke(); txt(x, v.toFixed(dec), L - 6, yy + 4, T.faint, 10, "right"); });
  if (zero && lo < 0 && hi > 0) { x.strokeStyle = T.cross; x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(w - R, Y(0)); x.stroke(); }
  const stag = step < 44;
  groups.forEach((G, j) => {
    txt(x, G.tag, X(j), h - (stag && j % 2 ? 6 : 18), G === sel ? T.fg : T.axis, 9.5, "center");
    x.fillStyle = seriesColor(G.color).hex; x.fillRect(X(j) - 5, h - (stag ? 32 : 13), 10, 3);
  });
  return { X, Y, step };
}

function line(x: CanvasRenderingContext2D, A: Axes, T: Theme, vals: (number | null)[], dash: number[]) {
  x.setLineDash(dash); x.strokeStyle = T.neutral; x.lineWidth = 1.5; x.beginPath(); let st = false;
  vals.forEach((v, j) => { if (v == null) { st = false; return; } if (!st) { x.moveTo(A.X(j), A.Y(v)); st = true; } else x.lineTo(A.X(j), A.Y(v)); });
  x.stroke(); x.setLineDash([]);
}

function dot(x: CanvasRenderingContext2D, T: Theme, px: number, py: number, hex: string, filled: boolean) {
  x.beginPath(); x.arc(px, py, filled ? 5 : 4.5, 0, 7);
  if (filled) { x.fillStyle = hex; x.fill(); } else { x.fillStyle = T.bg; x.fill(); x.strokeStyle = hex; x.lineWidth = 2; x.stroke(); }
}

/** One metric across groups: hollow = whole group, filled = best stretch. */
export function drawTrend(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, groups: VizGroup[], m: TrendMetric, sel: VizGroup | null = null) {
  frame(x, w, h, T, m.title, "filled = best stretch · hollow = whole session");
  const pts = groups.map((G) => {
    const all = live(G).filter((s) => m.get(s) != null), best = live(G, true).filter((s) => m.get(s) != null);
    return { G, a: all.length ? avgOf(all, m.get) : null, b: best.length ? avgOf(best, m.get) : null };
  });
  const vals = pts.flatMap((p) => [p.a, p.b]).filter((v): v is number => v != null);
  if (!vals.length) return;
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.3 || 1; lo -= pad; hi += pad;
  if (m.zero) { lo = Math.min(lo, -20); hi = Math.max(hi, 6); }
  if (m.floorZero) lo = Math.max(lo, 0);
  const A = axes(x, w, h, T, groups, lo, hi, m.dec, !!m.zero, sel);
  line(x, A, T, pts.map((p) => p.a), [3, 3]); line(x, A, T, pts.map((p) => p.b), []);
  pts.forEach((p, j) => {
    const hex = seriesColor(p.G.color).hex;
    if (p.a != null) dot(x, T, A.X(j), A.Y(p.a), hex, false);
    if (p.b != null) {
      dot(x, T, A.X(j), A.Y(p.b), hex, true);
      if (A.step >= 34 || p.G === sel) { const above = p.a == null || p.b >= p.a; txt(x, p.b.toFixed(m.dec), A.X(j), A.Y(p.b) + (above ? -9 : 15), labelColor(p.G.color, T), 9.5, "center"); }
    }
  });
}

/** Club path (solid, filled) and face to target (dotted, hollow) per group, labeled with face-to-path. */
export function drawPathFace(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, groups: VizGroup[], sel: VizGroup | null = null) {
  frame(x, w, h, T, "Club path and face to target (°)", "solid = path · dotted = face · label = face-to-path");
  const pf = groups.map((G) => {
    const rows = live(G).filter((s) => faceToPath(s) != null);
    return { G, path: rows.length ? avgOf(rows, (s) => s.path_deg) : null, face: rows.length ? avgOf(rows, (s) => s.face_to_target_deg) : null };
  });
  const vals = pf.flatMap((p) => [p.path, p.face]).filter((v): v is number => v != null);
  if (!vals.length) return;
  const lo = Math.min(0, ...vals) - 1, hi = Math.max(...vals) + 2;
  const A = axes(x, w, h, T, groups, lo, hi, 1, true, sel);
  line(x, A, T, pf.map((p) => p.path), []); line(x, A, T, pf.map((p) => p.face), [3, 3]);
  pf.forEach((p, j) => {
    const hex = seriesColor(p.G.color).hex;
    if (p.path != null) dot(x, T, A.X(j), A.Y(p.path), hex, true);
    if (p.face != null) {
      dot(x, T, A.X(j), A.Y(p.face), hex, false);
      if ((A.step >= 34 || p.G === sel) && p.path != null) {
        const d = p.face - p.path, top = Math.min(A.Y(p.face), A.Y(p.path));
        txt(x, (d > 0 ? "+" : "") + d.toFixed(1), A.X(j), top - 9, Math.abs(d) <= 2 ? T.good : T.warn, 9.5, "center");
      }
    }
  });
}
