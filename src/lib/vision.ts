import { ShotSchema, SHOT_FIELDS, type Shot } from "@/lib/schema";

/**
 * Screenshot import: a vision model reads photos of a launch monitor's shot
 * table and returns rows in the common shot schema.
 *
 * Several photos of one session are sent in one request so the model can
 * stitch them (overlapping rows are merged by shot number). Units are
 * normalised here, not by the model, so a wrong guess is a one-line fix.
 */

export const VISION_MODEL = process.env.VISION_MODEL ?? "claude-sonnet-5-5";
export const MAX_IMAGES = 6;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export interface VisionImage { media_type: ImageType; data: string }

export interface ExtractedShot extends Shot {
  /** Club as printed on the screen, if any ("Driver", "7i"). Kept in raw until shots carry a club. */
  club?: string | null;
  /** 0..1, the model's confidence in the whole row. */
  confidence: number;
  /** Fields the model was unsure about (glare, cut-off digits, ambiguous sign). */
  low_confidence_fields: string[];
}

export interface VisionResult {
  shots: ExtractedShot[];
  device_guess: string | null;
  units: { distance: "yd" | "m"; speed: "mph" | "kph" };
  warnings: string[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

const FIELD_DOCS = `
Fields (all numbers; use null when the column is absent or unreadable):
  shot_no            shot number as printed; if the screen has none, number top-to-bottom per image in the order given
  club               club label as printed, or null
  ball_speed_mph     ball speed
  launch_deg         launch angle (vertical)
  back_rpm           backspin
  side_rpm           sidespin or side axis in rpm (+ fade/slice spin, - draw/hook spin)
  side_deg           launch direction / side angle (+ right, - left)
  carry_yd           carry distance (REQUIRED; if missing, the row is skipped)
  total_yd           total distance
  offline_yd         offline / lateral landing distance (+ right, - left)
  apex_yd            apex / height / peak height
  flight_s           flight time in seconds
  descent_deg        descent / landing angle
  club_speed_mph     club head speed
  smash              smash factor
  path_deg           club path (+ in-to-out, - out-to-in)
  face_to_target_deg face angle to target (+ open, - closed)
  attack_deg         angle of attack (+ up, - down)
  dyn_loft_deg       dynamic loft
  vert_strike_mm     vertical face impact (+ above centre, - below)
  horiz_strike_mm    horizontal face impact as the device reports it`;

const SYSTEM = `You transcribe launch monitor shot tables from photos into structured rows. Be literal: copy the numbers that are printed. Never estimate a value that is not on the screen; use null instead.

Sign conventions (right-handed golfer's view): L / left = negative, R / right = positive. Values shown as "12 L" or "L 12" become -12. Draw / hook spin is negative sidespin, fade / slice spin is positive. "In-to-out" path is positive, "out-to-in" is negative. Open face is positive, closed negative. Up attack is positive, down negative. Some screens print signs; keep them as printed.

Units: report what the screen uses in "units" (yards or meters; mph or kph). Do NOT convert; copy the numbers as printed.

Several photos may be of the same session. Merge them: if two photos show the same shot number with the same values, include it once. If a photo is a different screen of the same shots (e.g. ball data and club data on separate tabs), join the fields by shot number. Keep rows in shot order.

Mark any row where glare, blur, cropping or an ambiguous sign makes you unsure: set confidence below 0.8 and list the doubtful fields in low_confidence_fields. Rows that are partly cut off at the image edge still count if carry is readable.

Rows for a different club than the rest should still be included, with the club label; the user will split them.
${FIELD_DOCS}`;

const numOrNull = { type: ["number", "null"] };
const shotProperties: Record<string, unknown> = {
  shot_no: { type: "integer" },
  club: { type: ["string", "null"] },
  confidence: { type: "number", minimum: 0, maximum: 1 },
  low_confidence_fields: { type: "array", items: { type: "string" } },
};
for (const f of SHOT_FIELDS) shotProperties[f] = numOrNull;

const TOOL = {
  name: "record_shots",
  description: "Record every shot row read from the images.",
  input_schema: {
    type: "object",
    properties: {
      device_guess: { type: ["string", "null"], description: "Launch monitor brand or software if identifiable from the UI, else null." },
      units: {
        type: "object",
        properties: { distance: { type: "string", enum: ["yd", "m"] }, speed: { type: "string", enum: ["mph", "kph"] } },
        required: ["distance", "speed"],
      },
      warnings: { type: "array", items: { type: "string" }, description: "Anything the user should check: cropped columns, duplicate photos, unknown columns." },
      shots: {
        type: "array",
        items: { type: "object", properties: shotProperties, required: ["shot_no", "carry_yd", "confidence", "low_confidence_fields"] },
      },
    },
    required: ["device_guess", "units", "warnings", "shots"],
  },
};

const YD_PER_M = 1.0936133;
const MPH_PER_KPH = 1 / 1.609344;
const DIST_FIELDS = ["carry_yd", "total_yd", "offline_yd", "apex_yd"] as const;
const SPEED_FIELDS = ["ball_speed_mph", "club_speed_mph"] as const;

function round(v: number, d: number) { const p = 10 ** d; return Math.round(v * p) / p; }

export async function extractShotsFromImages(images: VisionImage[]): Promise<VisionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  if (images.length === 0) throw new Error("No images");
  if (images.length > MAX_IMAGES) throw new Error(`At most ${MAX_IMAGES} images per import`);

  const content: unknown[] = images.map((img) => ({
    type: "image", source: { type: "base64", media_type: img.media_type, data: img.data },
  }));
  content.push({ type: "text", text: `Read every shot row from ${images.length === 1 ? "this photo" : `these ${images.length} photos`} and call record_shots.` });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_shots" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Vision request failed (${r.status}): ${body.slice(0, 300)}`);
  }
  const res = (await r.json()) as {
    content: { type: string; input?: unknown }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block) throw new Error("The model returned no rows");
  const out = block.input as {
    device_guess: string | null;
    units: VisionResult["units"];
    warnings: string[];
    shots: Record<string, unknown>[];
  };

  const toYd = out.units?.distance === "m";
  const toMph = out.units?.speed === "kph";
  const warnings = [...(out.warnings ?? [])];
  if (toYd) warnings.push("Distances were in meters and have been converted to yards.");
  if (toMph) warnings.push("Speeds were in km/h and have been converted to mph.");

  const shots: ExtractedShot[] = [];
  const seen = new Set<number>();
  for (const r of out.shots ?? []) {
    const row: Record<string, unknown> = { ...r };
    if (toYd) for (const f of DIST_FIELDS) if (typeof row[f] === "number") row[f] = round((row[f] as number) * YD_PER_M, 1);
    if (toMph) for (const f of SPEED_FIELDS) if (typeof row[f] === "number") row[f] = round((row[f] as number) * MPH_PER_KPH, 1);
    const club = typeof row.club === "string" && row.club.trim() ? row.club.trim() : null;
    const confidence = typeof row.confidence === "number" ? Math.max(0, Math.min(1, row.confidence)) : 0.5;
    const low = Array.isArray(row.low_confidence_fields) ? row.low_confidence_fields.filter((x): x is string => typeof x === "string") : [];
    delete row.club; delete row.confidence; delete row.low_confidence_fields;
    const parsed = ShotSchema.safeParse({ ...row, excluded: false, raw: { source: "screenshot", club, confidence, low_confidence_fields: low } });
    if (!parsed.success) { warnings.push(`Row ${String(row.shot_no)} skipped: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`); continue; }
    if (seen.has(parsed.data.shot_no)) { warnings.push(`Shot ${parsed.data.shot_no} appeared twice; kept the first.`); continue; }
    seen.add(parsed.data.shot_no);
    shots.push({ ...parsed.data, club, confidence, low_confidence_fields: low });
  }
  shots.sort((a, b) => a.shot_no - b.shot_no);

  return {
    shots,
    device_guess: out.device_guess ?? null,
    units: out.units ?? { distance: "yd", speed: "mph" },
    warnings,
    model: VISION_MODEL,
    usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens },
  };
}
