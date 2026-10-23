import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { extractShotsFromImages, IMAGE_TYPES, MAX_IMAGES, MAX_IMAGE_BYTES, type VisionImage } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Screenshot reads per user per rolling 24 h. Each request counts once per image. */
const DAILY_LIMIT = Number(process.env.SCREENSHOT_DAILY_LIMIT ?? 40);

/**
 * POST multipart/form-data with one or more `images`.
 * Returns the rows in the common shot schema plus per-row confidence flags.
 * The images are not stored yet; an `imports` row records the call for rate limiting.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 }); }
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "No images attached" }, { status: 400 });
  if (files.length > MAX_IMAGES) return NextResponse.json({ error: `At most ${MAX_IMAGES} images per import` }, { status: 400 });

  const images: VisionImage[] = [];
  const hashes: string[] = [];
  for (const f of files) {
    if (!(IMAGE_TYPES as readonly string[]).includes(f.type)) {
      const hint = /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name) ? " iPhone HEIC photos need converting to JPEG first (Settings > Camera > Formats > Most Compatible, or share as JPEG)." : "";
      return NextResponse.json({ error: `${f.name}: unsupported type ${f.type || "unknown"}. Use JPEG, PNG or WebP.${hint}` }, { status: 400 });
    }
    if (f.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: `${f.name} is over ${MAX_IMAGE_BYTES / 1024 / 1024} MB` }, { status: 400 });
    const buf = Buffer.from(await f.arrayBuffer());
    hashes.push(createHash("sha256").update(buf).digest("hex").slice(0, 16));
    images.push({ media_type: f.type as VisionImage["media_type"], data: buf.toString("base64") });
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from("imports").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("kind", "image").gte("created_at", since);
  if ((count ?? 0) + files.length > DAILY_LIMIT) {
    return NextResponse.json({ error: `Daily screenshot limit reached (${DAILY_LIMIT} per 24 h). Try again later or upload a CSV.` }, { status: 429 });
  }

  let result;
  try {
    result = await extractShotsFromImages(images);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Screenshot read failed";
    await supabase.from("imports").insert(hashes.map((h) => ({
      user_id: user.id, kind: "image", storage_path: `inline/${h}`, status: "failed", parse_log: { error: message },
    })));
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await supabase.from("imports").insert(hashes.map((h, i) => ({
    user_id: user.id, kind: "image", storage_path: `inline/${h}`, status: "parsed",
    device: result.device_guess, parse_log: i === 0 ? {
      model: result.model, usage: result.usage, shots: result.shots.length, units: result.units, warnings: result.warnings,
    } : { part_of: hashes[0] },
  })));

  return NextResponse.json(result);
}
