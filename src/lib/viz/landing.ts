import type { Shot } from "../schema";
import { ellipse2 } from "../stats";
import { type Theme, txt, seriesColor, sideText } from "./theme";
import { type VizGroup, isHot, live, avgOf } from "./groups";
import type { Hit } from "./face";

export interface LandingOpts {
  bestOnly?: boolean;
  dots?: boolean;
  ellipses?: boolean;
  metric?: "total_yd" | "carry_yd";
  fairwayYd?: number;
}

export interface LandingLegend { g: VizGroup; dist: number; offline: number; miss: number; n: number }

/**
 * Top-down map of finishing positions: offline on x (right positive), distance on y.
 * Dashed 1σ ellipse for the whole group, solid for its best stretch.
 */
export function drawLanding(x: CanvasRenderingContext2D, w: number, h: number, T: Theme, groups: VizGroup[], o: LandingOpts = {}): { hits: Hit[]; legend: LandingLegend[] } {
  const { bestOnly = false, dots = true, ellipses = true, metric = "total_yd", fairwayYd = 30 } = o;
  x.clearRect(0, 0, w, h);
  const hits: Hit[] = [], legend: LandingLegend[] = [];
  const L = 40, R = 14, Tp = 40, B = 30;
  const dist = (s: Shot) => (metric === "total_yd" ? s.total_yd ?? s.carry_yd : s.carry_yd);
  const rowsOf = (G: VizGroup) => live(G, bestOnly).filter((s) => s.offline_yd != null);
  const allRows = groups.flatMap(rowsOf);
  const ds = allRows.map(dist), os = allRows.map((s) => s.offline_yd as number);
  let d0 = allRows.length ? Math.min(...ds) - 15 : 150, d1 = allRows.length ? Math.max(...ds) + 15 : 300;
  d0 = Math.floor(d0 / 10) * 10; d1 = Math.ceil(d1 / 10) * 10;
  const om = allRows.length ? Math.max(40, Math.ceil(Math.max(...os.map(Math.abs)) / 10) * 10 + 10) : 60;
  const X = (ov: number) => L + (w - L - R) * (ov + om) / (2 * om), Y = (d: number) => Tp + (h - Tp - B) * (1 - (d - d0) / (d1 - d0));
  x.fillStyle = T.turf; x.fillRect(L, Tp, w - L - R, h - Tp - B);
  x.fillStyle = T.fw; x.fillRect(X(-fairwayYd / 2), Tp, X(fairwayYd / 2) - X(-fairwayYd / 2), h - Tp - B);
  x.strokeStyle = T.turfGrid; x.lineWidth = 1;
  for (let d = d0; d <= d1; d += 10) {
    if (d % 50 && d1 - d0 > 120) continue;
    x.beginPath(); x.moveTo(L, Y(d)); x.lineTo(w - R, Y(d)); x.stroke(); txt(x, `${d}`, L - 5, Y(d) + 4, T.faint, 10, "right");
  }
  for (let ov = -om; ov <= om; ov += 20) {
    x.beginPath(); x.moveTo(X(ov), Tp); x.lineTo(X(ov), h - B); x.stroke();
    txt(x, ov === 0 ? "0" : Math.abs(ov) + (ov < 0 ? " L" : " R"), X(ov), h - B + 14, T.faint, 10, "center");
  }
  x.strokeStyle = T.center; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(X(0), Tp); x.lineTo(X(0), h - B); x.stroke(); x.setLineDash([]);
  txt(x, `${metric === "total_yd" ? "Total" : "Carry"} distance (yd) · fairway ${fairwayYd} yd`, 10, 19, T.fg, 12);
  groups.forEach((G) => {
    const rows = rowsOf(G); if (!rows.length) return;
    const col = seriesColor(G.color).hex;
    if (dots) rows.forEach((s) => {
      const hot = isHot(G, s), px = X(s.offline_yd as number), py = Y(dist(s));
      hits.push({ x: px, y: py, g: G, s });
      x.beginPath(); x.arc(px, py, hot ? 4 : 3, 0, 7); x.globalAlpha = hot ? 0.9 : 0.5; x.fillStyle = col; x.fill(); x.globalAlpha = 1;
    });
    if (ellipses) {
      const sets: Array<[boolean, Shot[]]> = [[false, live(G).filter((s) => s.offline_yd != null)], [true, live(G, true).filter((s) => s.offline_yd != null)]];
      sets.forEach(([best, rs]) => {
        if (bestOnly && !best) return;
        const e = ellipse2(rs.map((s) => [s.offline_yd as number, dist(s)])); if (!e) return;
        const kx = (w - L - R) / (2 * om), ky = (h - Tp - B) / (d1 - d0);
        x.save(); x.translate(X(e.cx), Y(e.cy)); x.scale(kx, -ky); x.rotate(e.angle);
        x.beginPath(); x.ellipse(0, 0, e.a, e.b, 0, 0, Math.PI * 2); x.restore();
        x.fillStyle = col; x.globalAlpha = best ? 0.18 : 0.08; x.fill(); x.globalAlpha = 1;
        x.strokeStyle = col; x.lineWidth = best ? 2 : 1.2; x.setLineDash(best ? [] : [4, 4]); x.stroke(); x.setLineDash([]);
        const px = X(e.cx), py = Y(e.cy);
        x.beginPath(); x.moveTo(px - 6, py); x.lineTo(px + 6, py); x.moveTo(px, py - 6); x.lineTo(px, py + 6); x.lineWidth = best ? 2 : 1; x.stroke();
      });
    }
    legend.push({ g: G, dist: avgOf(rows, dist) ?? 0, offline: avgOf(rows, (s) => s.offline_yd) ?? 0, miss: avgOf(rows, (s) => Math.abs(s.offline_yd ?? 0)) ?? 0, n: rows.length });
  });
  if (!allRows.length) txt(x, "No sessions selected", w / 2, h / 2, T.empty, 12, "center");
  return { hits, legend };
}

export const legendText = (l: LandingLegend) => `${Math.round(l.dist)} yd · ${sideText(Math.round(l.offline))} · ${Math.round(l.miss)} yd miss · ${l.n} shots`;
