import { z } from "zod";

/**
 * The common shot schema. Every launch monitor adapter produces these rows.
 * Units: yards, mph, degrees, rpm, mm, seconds.
 *
 * Sign conventions (from the golfer's view, right-handed):
 *   offline_yd          + right, - left
 *   side_rpm            + fade spin, - draw spin
 *   path_deg            + in-to-out, - out-to-in
 *   face_to_target_deg  + open, - closed
 *   attack_deg          + up, - down
 *   vert_strike_mm      + above center, - below
 *   horiz_strike_mm     as reported by the device; toe/heel convention varies
 */
const num = z.number().finite();
const opt = num.nullable().optional();

export const ShotSchema = z.object({
  shot_no: z.number().int().positive(),
  // ball
  ball_speed_mph: opt,
  launch_deg: opt,
  back_rpm: opt,
  side_rpm: opt,
  side_deg: opt,
  // flight
  carry_yd: num,
  total_yd: opt,
  offline_yd: opt,
  apex_yd: opt,
  flight_s: opt,
  descent_deg: opt,
  // club
  club_speed_mph: opt,
  smash: opt,
  path_deg: opt,
  face_to_target_deg: opt,
  attack_deg: opt,
  dyn_loft_deg: opt,
  vert_strike_mm: opt,
  horiz_strike_mm: opt,
  // bookkeeping
  excluded: z.boolean().default(false),
  raw: z.record(z.unknown()).nullable().optional(),
});

export type Shot = z.infer<typeof ShotSchema>;

export const SHOT_FIELDS = [
  "ball_speed_mph",
  "launch_deg",
  "back_rpm",
  "side_rpm",
  "side_deg",
  "carry_yd",
  "total_yd",
  "offline_yd",
  "apex_yd",
  "flight_s",
  "descent_deg",
  "club_speed_mph",
  "smash",
  "path_deg",
  "face_to_target_deg",
  "attack_deg",
  "dyn_loft_deg",
  "vert_strike_mm",
  "horiz_strike_mm",
] as const;

export type ShotField = (typeof SHOT_FIELDS)[number];

export const DEVICES = [
  "uneekor",
  "trackman",
  "gcquad",
  "skytrak",
  "rapsodo",
  "garmin",
  "bushnell",
  "other",
] as const;
export type Device = (typeof DEVICES)[number];

/** Face to path in degrees: + open to the path (fade bias), - closed (draw bias). */
export function faceToPath(s: Pick<Shot, "face_to_target_deg" | "path_deg">): number | null {
  if (s.face_to_target_deg == null || s.path_deg == null) return null;
  return +(s.face_to_target_deg - s.path_deg).toFixed(1);
}

export const StretchSchema = z.object({
  label: z.string().min(1),
  cue: z.string().optional(),
  from_shot: z.number().int().positive(),
  to_shot: z.number().int().positive(),
  is_best: z.boolean().default(false),
}).refine((s) => s.to_shot >= s.from_shot, { message: "to_shot must be >= from_shot" });

export type Stretch = z.infer<typeof StretchSchema>;
