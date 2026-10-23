import type { Shot } from "../schema";
import { faceToPath } from "../schema";
import { type Theme, txt, fmtSigned, seriesColor } from "./theme";
import { type VizGroup, isHot } from "./groups";

const D2R = Math.PI / 180;

function arrow(x: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, c: string, wd: number, dash: number[] = []) {
  x.strokeStyle = c; x.lineWidth = wd; x.setLineDash(dash);
  x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.setLineDash([]);
  const a = Math.atan2(by - ay, bx - ax);
  x.fillStyle = c; x.beginPath(); x.moveTo(bx, by);
  x.lineTo(bx - 9 * Math.cos(a - 0.4), by - 9 * Math.sin(a - 0.4)); x.lineTo(bx - 9 * Math.cos(a + 0.4), by - 9 * Math.sin(a + 0.4)); x.fill();
}

/**
 * Top-down club path and face angle through impact, angles exaggerated 3x.
 * `tau` is seconds since the swing started; impact is at IMPACT.
 */
export const IMPACT = 0.9;

export function drawDelivery(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, G: VizGroup | null, s: Shot | null, tau: number, isAvg = false) {
  const A = 3, u = Math.min(w, h) / 220;
  x.clearRect(0, 0, w, h);
  txt(x, "Path & face (top view)", 10, 19, T.fg, 12);
  if (!G || !s) { txt(x, "No shot selected", w / 2, h / 2, T.empty, 11, "center"); return; }
  if (s.path_deg == null || s.face_to_target_deg == null) { txt(x, "Club data not captured", w / 2, h / 2, T.empty, 11, "center"); return; }
  const col = seriesColor(G.color).hex, hot = isAvg || isHot(G, s);
  const bx = w / 2, by = h * 0.62;
  x.strokeStyle = T.dash; x.setLineDash([4, 4]); x.lineWidth = 1; x.beginPath(); x.moveTo(bx, 30); x.lineTo(bx, h - 40); x.stroke(); x.setLineDash([]);
  txt(x, "target line", bx + 6, 42, T.ghost, 10);
  const p = s.path_deg * A * D2R, f = s.face_to_target_deg * A * D2R, dv = [Math.sin(p), -Math.cos(p)];
  arrow(x, bx - dv[0] * 62 * u, by - dv[1] * 62 * u, bx + dv[0] * 50 * u, by + dv[1] * 50 * u, T.neutral, 1.5, [5, 4]);
  txt(x, "path", bx + dv[0] * 54 * u + 8, by + dv[1] * 54 * u, T.neutral, 10);
  const uu = Math.min(tau / IMPACT, 1), post = Math.max(0, tau - IMPACT), travel = (-60 + 60 * uu * uu + Math.min(post, 0.4) * 90) * u;
  const hx = bx + dv[0] * (travel - 7 * u), hy = by + dv[1] * (travel - 7 * u), fl = [Math.cos(f), Math.sin(f)], hl = 27 * u;
  x.globalAlpha = post > 0.4 ? Math.max(0, 1 - (post - 0.4) * 2) : 1;
  x.strokeStyle = hot ? col : T.fg; x.lineWidth = 5 * Math.max(1, u * 0.8); x.lineCap = "round";
  x.beginPath(); x.moveTo(hx - fl[0] * hl, hy - fl[1] * hl); x.lineTo(hx + fl[0] * hl, hy + fl[1] * hl); x.stroke();
  x.lineCap = "butt"; x.globalAlpha = 1;
  const sd = (s.side_deg ?? 0) * A * D2R, bt = Math.min(post * 160 * u, by - 34);
  x.beginPath(); x.arc(bx + Math.sin(sd) * bt, by - Math.cos(sd) * bt, 4.5 * Math.max(1, u * 0.8), 0, 7); x.fillStyle = T.ball; x.fill();
  const f2p = faceToPath(s) ?? 0, sp = s.side_rpm ?? 0, shape = sp < -150 ? "draw spin" : sp > 150 ? "fade spin" : "neutral spin";
  txt(x, `${isAvg ? "Avg · " : ""}Path ${fmtSigned(s.path_deg)}° · Face ${fmtSigned(s.face_to_target_deg)}°`, 10, h - 28, T.text, 12);
  txt(x, `Face-to-path ${fmtSigned(f2p)}° · ${shape}`, 10, h - 12, Math.abs(f2p) <= 2 ? T.good : T.warn, 12);
  txt(x, "angles 3x", w - 10, 19, T.faint, 10, "right");
}
