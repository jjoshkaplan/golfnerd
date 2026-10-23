import Papa from "papaparse";
import { ShotSchema, type Shot, type Device } from "@/lib/schema";

/**
 * An adapter turns one device's export into the common shot schema.
 * Add a new device by writing a column map and (if needed) a row transform.
 */
export interface Adapter {
  device: Device;
  /** Lower-case header substrings that identify this format. */
  detect: (headers: string[]) => boolean;
  /** Map from common field to the device's column header (exact, after trim). */
  columns: Partial<Record<keyof Shot, string>>;
  /** Optional fix-ups: unit conversion, sign flips, derived fields. */
  transform?: (row: Partial<Shot>, raw: Record<string, string>) => Partial<Shot>;
}

export interface ParseResult {
  device: Device;
  shots: Shot[];
  /** Headers in the file that no adapter field consumed. Shown in the review step. */
  unmapped: string[];
  errors: { row: number; message: string }[];
}

const toNum = (v: string | undefined): number | null => {
  if (v == null) return null;
  const t = v.trim().replace(/,/g, "");
  if (t === "" || t === "--" || t === "-" || t.toLowerCase() === "n/a") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function parseCsv(text: string, adapters: Adapter[]): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const adapter = adapters.find((a) => a.detect(headers.map((h) => h.toLowerCase())));
  if (!adapter) {
    return { device: "other", shots: [], unmapped: headers, errors: [{ row: 0, message: "No adapter recognised these columns" }] };
  }

  const used = new Set(Object.values(adapter.columns));
  const unmapped = headers.filter((h) => !used.has(h));
  const shots: Shot[] = [];
  const errors: ParseResult["errors"] = [];

  parsed.data.forEach((raw, i) => {
    let row: Partial<Shot> = { raw };
    for (const [field, col] of Object.entries(adapter.columns) as [keyof Shot, string][]) {
      const v = toNum(raw[col]);
      if (v != null) (row as Record<string, unknown>)[field] = v;
    }
    if (adapter.transform) row = adapter.transform(row, raw);
    if (row.shot_no == null) row.shot_no = i + 1;
    const result = ShotSchema.safeParse(row);
    if (result.success) shots.push(result.data);
    else errors.push({ row: i + 1, message: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") });
  });

  return { device: adapter.device, shots, unmapped, errors };
}
