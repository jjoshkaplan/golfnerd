"use client";
import { useTransition } from "react";
import { toggleExcluded } from "@/app/actions/sessions";
import type { Shot } from "@/lib/schema";

const td = { padding: "4px 8px", textAlign: "right" as const };
const v = (x: number | null | undefined, d = 0) => (x == null ? "" : x.toFixed(d));

export default function ShotRow({ sessionId, shot, f2p }: { sessionId: string; shot: Shot & { id: string }; f2p: number | null }) {
  const [pending, start] = useTransition();
  return (
    <tr style={{ opacity: shot.excluded ? 0.4 : 1 }}>
      <td style={td}><input type="checkbox" checked={!shot.excluded} disabled={pending}
        onChange={(e) => start(async () => { await toggleExcluded(sessionId, shot.id, !e.target.checked); })}
        aria-label={`Include shot ${shot.shot_no}`} /></td>
      <td style={td}>{shot.shot_no}</td>
      <td style={td}>{v(shot.ball_speed_mph)}</td>
      <td style={td}>{v(shot.launch_deg)}</td>
      <td style={td}>{v(shot.back_rpm)}</td>
      <td style={td}>{v(shot.carry_yd)}</td>
      <td style={td}>{v(shot.total_yd)}</td>
      <td style={td}>{v(shot.offline_yd)}</td>
      <td style={td}>{v(shot.smash, 2)}</td>
      <td style={td}>{v(shot.path_deg, 1)}</td>
      <td style={td}>{v(shot.face_to_target_deg, 1)}</td>
      <td style={{ ...td, color: f2p == null ? undefined : Math.abs(f2p) <= 2 ? "#7fd18f" : "#e9a36b" }}>{f2p == null ? "" : (f2p > 0 ? "+" : "") + f2p.toFixed(1)}</td>
      <td style={td}>{v(shot.vert_strike_mm)}</td>
      <td style={td}>{v(shot.horiz_strike_mm)}</td>
    </tr>
  );
}
