import type { Shot } from "./schema";

/**
 * Ball flight model: drag plus spin-driven lift with spin decay, integrated
 * with a small fixed step. Coefficients are standard approximations, not any
 * device's own model, so the result is anchored to the measured carry, apex
 * and finish before it is drawn.
 *
 * Output points are in yards: x right, y up, z downrange (positive).
 */
export interface FlightPoint { x: number; y: number; z: number }

const RB = 0.02135;                       // ball radius, m
const MASS = 0.04593;                     // kg
const RHO = 1.225;                        // air density
const K = (RHO * Math.PI * RB * RB) / (2 * MASS);
const YD = 1 / 0.9144;
const D2R = Math.PI / 180;

export const FLIGHT_POINTS = 120;

export function simulateFlight(s: Shot, points = FLIGHT_POINTS): FlightPoint[] {
  const V = (s.ball_speed_mph ?? 140) * 0.44704;
  const la = (s.launch_deg ?? 12) * D2R;
  const dir = (s.side_deg ?? 0) * D2R;
  const back = s.back_rpm ?? 3000;
  const side = s.side_rpm ?? 0;
  const wm = Math.hypot(back, side) || 1;
  const axis = [-back / wm, side / wm, 0];
  const w0 = (wm * 2 * Math.PI) / 60;

  let p = [0, 0, 0];
  let v = [V * Math.cos(la) * Math.sin(dir), V * Math.sin(la), V * Math.cos(la) * Math.cos(dir)];
  let t = 0;
  const dt = 0.005;
  const raw: number[][] = [[0, 0, 0]];

  while (t < 14) {
    const speed = Math.hypot(v[0], v[1], v[2]);
    const w = w0 * Math.exp(-t / 22);
    const S = (RB * w) / speed;
    const Cd = 0.21 + 0.25 * S;
    const Cl = Math.max(0, Math.min(0.32, 1.99 * S - 3.25 * S * S));
    const c = [
      axis[1] * v[2] - axis[2] * v[1],
      axis[2] * v[0] - axis[0] * v[2],
      axis[0] * v[1] - axis[1] * v[0],
    ];
    v = [
      v[0] + (-K * Cd * speed * v[0] + K * Cl * speed * c[0]) * dt,
      v[1] + (-K * Cd * speed * v[1] + K * Cl * speed * c[1] - 9.81) * dt,
      v[2] + (-K * Cd * speed * v[2] + K * Cl * speed * c[2]) * dt,
    ];
    const q = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt];
    t += dt;
    if (q[1] < 0 && t > 0.05) {
      const f = p[1] / (p[1] - q[1]);
      raw.push([p[0] + (q[0] - p[0]) * f, 0, p[2] + (q[2] - p[2]) * f]);
      break;
    }
    p = q;
    raw.push(p);
  }

  const out: FlightPoint[] = [];
  for (let i = 0; i < points; i++) {
    const j = Math.round((i * (raw.length - 1)) / (points - 1));
    out.push({ x: raw[j][0] * YD, y: raw[j][1] * YD, z: raw[j][2] * YD });
  }
  return out;
}

/**
 * Scale a simulated flight so it lands at the measured carry and offline,
 * peaks at the measured apex, and starts on the measured side angle.
 * Offline at carry is interpolated from the finish (total) by distance.
 */
export function anchorFlight(s: Shot, flight: FlightPoint[]): FlightPoint[] {
  const end = flight[flight.length - 1];
  const carry = s.carry_yd;
  const total = s.total_yd ?? carry;
  const off = s.offline_yd ?? 0;
  const apex = s.apex_yd ?? Math.max(...flight.map((p) => p.y));
  const measuredApex = Math.max(...flight.map((p) => p.y), 0.5);
  const sz = carry / (end.z || carry);
  const sy = apex / measuredApex;
  const offAtCarry = (off * carry) / (total || carry);
  return flight.map((p) => {
    const u = p.z / (end.z || 1);
    return { x: p.x * sz + (offAtCarry - end.x * sz) * u * u, y: p.y * sy, z: p.z * sz };
  });
}
