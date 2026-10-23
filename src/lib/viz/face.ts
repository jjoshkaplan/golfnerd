import type { Shot } from "../schema";
import { type Theme, txt, fmtSigned, seriesColor, labelColor } from "./theme";
import { type VizGroup, isHot, live, avgOf } from "./groups";

export interface Hit { x: number; y: number; g: VizGroup; s: Shot }

export interface FaceGeom { cx: number; cy: number; sc: number; rx: number; ry: number }

/** Draws the clubface outline, scaled to the canvas; returns the geometry so callers can place mm offsets. */
export function faceBase(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, top = 0): FaceGeom {
  const cx = w / 2, cy = (h + top) / 2;
  const sc = Math.max(0.05, Math.min((w * 0.42) / 60, ((h - top) * 0.38) / 29));
  const rx = 60 * sc, ry = 29 * sc;
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  x.fillStyle = T.face; x.fill(); x.strokeStyle = T.faceEdge; x.lineWidth = 1.5; x.stroke();
  x.strokeStyle = T.groove; x.lineWidth = 1;
  for (let k = -3; k <= 3; k++) {
    const yy = cy + k * 7 * sc, half = rx * Math.sqrt(Math.max(0, 1 - ((yy - cy) / ry) ** 2)) * 0.8;
    x.beginPath(); x.moveTo(cx - half, yy); x.lineTo(cx + half, yy); x.stroke();
  }
  const ch = Math.max(8, 2.5 * sc);
  x.strokeStyle = T.cross; x.beginPath(); x.moveTo(cx - ch, cy); x.lineTo(cx + ch, cy); x.moveTo(cx, cy - ch); x.lineTo(cx, cy + ch); x.stroke();
  if (sc > 3) {
    x.strokeStyle = T.ring; x.setLineDash([2, 4]);
    [10, 20].forEach((mm) => { x.beginPath(); x.ellipse(cx, cy, mm * sc, mm * sc, 0, 0, Math.PI * 2); x.stroke(); });
    x.setLineDash([]);
    txt(x, "10 mm", cx + 10 * sc + 3, cy - 3, T.ghost, 10); txt(x, "20 mm", cx + 20 * sc + 3, cy - 3, T.ghost, 10);
  }
  txt(x, "high", cx, cy - ry - 6, T.faint, 11, "center"); txt(x, "low", cx, cy + ry + 14, T.faint, 11, "center");
  return { cx, cy, sc, rx, ry };
}

export interface StrikeMapOpts { bestOnly?: boolean; dots?: boolean; rings?: boolean }

/** All recorded impacts for the given groups on one face. Returns hover hits. */
export function drawStrikeMap(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, groups: VizGroup[], o: StrikeMapOpts = {}): Hit[] {
  const { bestOnly = false, dots = true, rings = true } = o;
  x.clearRect(0, 0, w, h);
  const g = faceBase(x, w, h, T, 0);
  const hits: Hit[] = [];
  const big = w > 700;
  let y = 14;
  txt(x, "Strike on face", w - 10, 19, T.fg, 12, "right");
  const list = groups.filter((G) => G.shots.some((s) => s.vert_strike_mm != null));
  list.forEach((G) => {
    const col = seriesColor(G.color).hex;
    const rows = live(G, bestOnly).filter((s) => s.vert_strike_mm != null);
    if (dots) rows.forEach((s) => {
      const hot = isHot(G, s), px = g.cx + (s.horiz_strike_mm ?? 0) * g.sc, py = g.cy - (s.vert_strike_mm as number) * g.sc;
      hits.push({ x: px, y: py, g: G, s });
      x.beginPath(); x.arc(px, py, Math.max(hot ? 4 : 3, g.sc * (hot ? 0.9 : 0.7)), 0, 7);
      x.globalAlpha = hot ? 0.9 : 0.55; x.fillStyle = col; x.fill(); x.globalAlpha = 1;
    });
    if (!rows.length) return;
    const mv = avgOf(rows, (s) => s.vert_strike_mm) ?? 0, mh = avgOf(rows, (s) => s.horiz_strike_mm) ?? 0;
    const px = g.cx + mh * g.sc, py = g.cy - mv * g.sc;
    if (rings) {
      x.beginPath(); x.arc(px, py, Math.max(9, g.sc * 1.8), 0, 7); x.strokeStyle = col; x.lineWidth = 3; x.stroke();
      x.beginPath(); x.moveTo(px - 13, py); x.lineTo(px + 13, py); x.moveTo(px, py - 13); x.lineTo(px, py + 13); x.lineWidth = 1.5; x.stroke();
    }
    txt(x, `${G.name}: avg V ${fmtSigned(+mv.toFixed(0))} · H ${fmtSigned(+mh.toFixed(0))} mm · ${rows.length}`, 10, (y += big ? 18 : 15), labelColor(G.color, T), big ? 12 : 10.5);
  });
  if (!list.length) txt(x, "No selected session recorded strike location", g.cx, g.cy, T.empty, 12, "center");
  txt(x, "+H / −H as reported by the device · rings mark 10 and 20 mm", w - 10, h - 10, T.faint, 10, "right");
  return hits;
}

/**
 * The strike panel for one shot: the group's other strikes as small dots, the
 * selected strike large. `phase` is seconds since impact (negative before it).
 */
export function drawFace(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, G: VizGroup | null, s: Shot | null, phase: number, peers?: Shot[], isAvg = false) {
  x.clearRect(0, 0, w, h);
  txt(x, "Strike on face", 10, 19, T.fg, 12);
  const g = faceBase(x, w, h, T, 8);
  if (!G || !s) { txt(x, "No shot selected", g.cx, g.cy, T.empty, 11, "center"); return; }
  if (s.vert_strike_mm == null) {
    txt(x, "Strike not captured", g.cx, g.cy - 4, T.empty, 11, "center");
    txt(x, "on this session's screen", g.cx, g.cy + 11, T.empty, 11, "center");
    return;
  }
  const col = seriesColor(G.color).hex, hot = isAvg || isHot(G, s);
  const dr = Math.max(2.6, g.sc * 1.1);
  (peers ?? G.shots).forEach((q) => {
    if (q === s || q.vert_strike_mm == null || q.excluded) return;
    const qh = isHot(G, q);
    x.beginPath(); x.arc(g.cx + (q.horiz_strike_mm ?? 0) * g.sc, g.cy - q.vert_strike_mm * g.sc, dr, 0, 7);
    x.globalAlpha = qh ? 0.75 : 0.45; x.fillStyle = qh ? col : T.neutral; x.fill(); x.globalAlpha = 1;
  });
  const px = g.cx + (s.horiz_strike_mm ?? 0) * g.sc, py = g.cy - s.vert_strike_mm * g.sc, R = Math.max(6, g.sc * 2.4);
  if (isAvg || phase >= 0) {
    if (!isAvg && phase < 0.7) {
      x.beginPath(); x.arc(px, py, R + phase * 40, 0, 7); x.strokeStyle = T.flashRGB + (1 - phase / 0.7) + ")"; x.lineWidth = 2; x.stroke();
    }
    x.beginPath(); x.arc(px, py, isAvg ? R * 1.3 : R, 0, 7); x.fillStyle = hot ? col : T.fg; x.fill(); x.strokeStyle = T.bg; x.lineWidth = 2; x.stroke();
  } else {
    x.beginPath(); x.arc(px, py, R, 0, 7); x.setLineDash([3, 3]); x.strokeStyle = T.halo; x.lineWidth = 1.5; x.stroke(); x.setLineDash([]);
  }
  txt(x, `${isAvg ? "Avg " : ""}V ${fmtSigned(s.vert_strike_mm)} mm · H ${fmtSigned(s.horiz_strike_mm ?? 0)} mm`, 10, h - 12, Math.abs(s.vert_strike_mm) <= 5 ? T.good : T.warn, 12);
}
