import type { Adapter } from "./index";

/**
 * Adapter for the sim used in the first sessions (Uneekor-style "Shot history" table).
 *
 * The column names below are a best guess from the on-screen table:
 *   SHOT # | SCORE | SPEED MPH | LAUNCH DEG | BACK RPM | SIDE RPM | SIDE DEG |
 *   OFFLINE YD | CARRY YD | ROLL YD | TOTAL YD | FLIGHT SEC | DSCNT DEG | HEIGHT YD |
 *   SPEED MPH (club) | SMASH FACTOR | PATH DEG | FTT DEG | AOA FACTOR | SL DEG |
 *   DLo DEG | DLi DEG | VFI MM | HFI MM
 *
 * TODO: replace `columns` with the exact headers from a real CSV export.
 * Note the two "SPEED MPH" columns (ball and club); the export will have to
 * disambiguate them, probably as "Ball Speed" and "Club Speed".
 */
export const uneekor: Adapter = {
  device: "uneekor",
  detect: (h) => h.some((x) => x.includes("smash")) && h.some((x) => x.includes("ftt") || x.includes("face to target")),
  columns: {
    shot_no: "Shot",
    ball_speed_mph: "Ball Speed",
    launch_deg: "Launch",
    back_rpm: "Back Spin",
    side_rpm: "Side Spin",
    side_deg: "Side Angle",
    offline_yd: "Offline",
    carry_yd: "Carry",
    total_yd: "Total",
    flight_s: "Flight Time",
    descent_deg: "Descent",
    apex_yd: "Height",
    club_speed_mph: "Club Speed",
    smash: "Smash Factor",
    path_deg: "Path",
    face_to_target_deg: "FTT",
    attack_deg: "AOA",
    dyn_loft_deg: "DLo",
    vert_strike_mm: "VFI",
    horiz_strike_mm: "HFI",
  },
  transform: (row) => {
    // If total is missing but roll is present in raw, derive it.
    if (row.total_yd == null && row.carry_yd != null && row.raw) {
      const roll = Number((row.raw as Record<string, string>)["Roll"]);
      if (Number.isFinite(roll)) row.total_yd = row.carry_yd + roll;
    }
    return row;
  },
};
