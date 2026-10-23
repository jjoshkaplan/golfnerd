"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, type ParseResult } from "@/lib/adapters";
import { ADAPTERS } from "@/lib/adapters/registry";
import { DEVICES, SHOT_FIELDS, type Shot } from "@/lib/schema";
import type { VisionResult } from "@/lib/vision";
import { groupStats } from "@/lib/stats";
import { saveSession } from "@/app/actions/sessions";

const COLS: { key: keyof Shot; label: string; step?: number }[] = [
  { key: "shot_no", label: "#" }, { key: "ball_speed_mph", label: "Ball", step: 0.1 }, { key: "launch_deg", label: "Launch", step: 0.1 },
  { key: "back_rpm", label: "Back", step: 1 }, { key: "side_rpm", label: "Side", step: 1 }, { key: "carry_yd", label: "Carry", step: 0.1 },
  { key: "total_yd", label: "Total", step: 0.1 }, { key: "offline_yd", label: "Offline", step: 0.1 }, { key: "apex_yd", label: "Apex", step: 0.1 },
  { key: "club_speed_mph", label: "Club", step: 0.1 }, { key: "smash", label: "Smash", step: 0.01 }, { key: "path_deg", label: "Path", step: 0.1 },
  { key: "face_to_target_deg", label: "Face", step: 0.1 }, { key: "attack_deg", label: "AoA", step: 0.1 },
  { key: "vert_strike_mm", label: "V mm", step: 1 }, { key: "horiz_strike_mm", label: "H mm", step: 1 },
];

type Source = "csv" | "screenshot";
type Flags = Record<number, { confidence: number; fields: Set<string>; club: string | null }>;

const DEVICE_GUESS: Record<string, (typeof DEVICES)[number]> = {
  uneekor: "uneekor", trackman: "trackman", foresight: "gcquad", gcquad: "gcquad", gc3: "gcquad",
  skytrak: "skytrak", rapsodo: "rapsodo", garmin: "garmin", bushnell: "bushnell",
};

export default function Upload() {
  const router = useRouter();
  const [source, setSource] = useState<Source>("screenshot");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [flags, setFlags] = useState<Flags>({});
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [device, setDevice] = useState<(typeof DEVICES)[number]>("uneekor");
  const [club, setClub] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = parseCsv(await f.text(), ADAPTERS);
    setResult(r); setVision(null); setFlags({});
    setShots(r.shots);
    if (r.device !== "other") setDevice(r.device);
  }

  function onImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImages((prev) => [...prev, ...files].slice(0, 6));
    e.target.value = "";
  }

  async function readImages() {
    setError(null); setReading(true);
    try {
      const fd = new FormData();
      images.forEach((f) => fd.append("images", f));
      const r = await fetch("/api/import/screenshot", { method: "POST", body: fd });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`);
      const v = body as VisionResult;
      setVision(v); setResult(null);
      setShots(v.shots.map(({ club: _c, confidence: _f, low_confidence_fields: _l, ...s }) => s));
      const fl: Flags = {};
      for (const s of v.shots) fl[s.shot_no] = { confidence: s.confidence, fields: new Set(s.low_confidence_fields), club: s.club ?? null };
      setFlags(fl);
      const guess = v.device_guess?.toLowerCase() ?? "";
      const match = Object.keys(DEVICE_GUESS).find((k) => guess.includes(k));
      if (match) setDevice(DEVICE_GUESS[match]);
      const clubs = new Set(v.shots.map((s) => s.club).filter(Boolean));
      if (clubs.size === 1 && !club) setClub([...clubs][0] as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screenshot read failed");
    } finally {
      setReading(false);
    }
  }

  function toggle(i: number) {
    setShots((s) => s.map((x, j) => (j === i ? { ...x, excluded: !x.excluded } : x)));
  }

  function edit(i: number, key: keyof Shot, value: string) {
    setShots((s) => s.map((x, j) => {
      if (j !== i) return x;
      const n = value.trim() === "" ? null : Number(value);
      if (n != null && !Number.isFinite(n)) return x;
      return { ...x, [key]: key === "shot_no" ? (n ?? x.shot_no) : n };
    }));
    setFlags((f) => {
      const row = f[shots[i].shot_no];
      if (!row || !row.fields.has(key)) return f;
      const fields = new Set(row.fields); fields.delete(key);
      return { ...f, [shots[i].shot_no]: { ...row, fields } };
    });
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveSession({
        played_at: new Date(playedAt).toISOString(), device, source, club_name: club || undefined, notes, shots,
      });
      if (res.ok) router.push(`/sessions/${res.id}`);
      else setError(res.error);
    });
  }

  const stats = shots.length ? groupStats(shots) : null;
  const flagged = Object.values(flags).filter((f) => f.confidence < 0.8 || f.fields.size > 0).length;
  const clubs = new Set(Object.values(flags).map((f) => f.club).filter(Boolean));

  return (
    <>
      <h1>Upload a session</h1>
      <div style={{ display: "flex", gap: 6, margin: "8px 0 12px" }}>
        <button onClick={() => setSource("screenshot")} aria-pressed={source === "screenshot"} style={{ opacity: source === "screenshot" ? 1 : 0.6 }}>Photos of the screen</button>
        <button onClick={() => setSource("csv")} aria-pressed={source === "csv"} style={{ opacity: source === "csv" ? 1 : 0.6 }}>CSV export</button>
      </div>

      {source === "csv" ? (
        <>
          <p className="muted">CSV export from your launch monitor. Review the rows, exclude any mishits or misreads, then save.</p>
          <input type="file" accept=".csv,text/csv" onChange={onCsv} />
        </>
      ) : (
        <>
          <p className="muted">Take photos of the shot table on the sim screen. Up to 6 per session; if the table scrolls, photograph each page and they will be stitched by shot number. JPEG, PNG or WebP.</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onImages} disabled={reading} />
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {previews.map((u, i) => (
                <div key={u} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={images[i].name} style={{ height: 110, borderRadius: 6, border: "1px solid var(--border, #333)" }} />
                  <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))} disabled={reading}
                    aria-label={`Remove ${images[i].name}`} style={{ position: "absolute", top: 2, right: 2, padding: "0 6px", fontSize: 12 }}>×</button>
                </div>
              ))}
            </div>
          )}
          {images.length > 0 && (
            <button onClick={readImages} disabled={reading} style={{ marginTop: 10 }}>
              {reading ? "Reading…" : `Read ${images.length} photo${images.length === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      )}

      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <div>Device: {result.device} · {result.shots.length} shots parsed · {result.errors.length} errors</div>
          {result.unmapped.length > 0 && <div className="muted">Unmapped columns: {result.unmapped.join(", ")}</div>}
          {result.errors.slice(0, 5).map((e) => <div key={e.row} className="muted">Row {e.row}: {e.message}</div>)}
        </div>
      )}

      {vision && (
        <div className="card" style={{ marginTop: 12 }}>
          <div>{vision.shots.length} shots read{vision.device_guess ? ` · looks like ${vision.device_guess}` : ""}{flagged ? ` · ${flagged} row${flagged === 1 ? "" : "s"} to check (highlighted)` : ""}</div>
          {clubs.size > 1 && <div className="muted">Several clubs on screen: {[...clubs].join(", ")}. Per-shot clubs are coming; for now save one club per session and exclude the rest.</div>}
          {vision.warnings.map((w, i) => <div key={i} className="muted">{w}</div>)}
          <div className="muted">Click any cell to correct it.</div>
        </div>
      )}

      {shots.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <label>Date <input type="datetime-local" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} /></label>
            <label>Device <select value={device} onChange={(e) => setDevice(e.target.value as typeof device)}>
              {DEVICES.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
            <label>Club <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="R9, Qi4D Max 10.5" /></label>
            <label>Notes <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="after 9 sim holes, higher tee" /></label>
          </div>

          {stats && (
            <p className="muted" style={{ marginTop: 10 }}>
              {stats.n} included · carry {stats.carry_yd?.toFixed(0)} · total {stats.total_yd?.toFixed(0)} · miss {stats.miss_yd?.toFixed(0)} yd · smash {stats.smash?.toFixed(2)}
            </p>
          )}

          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
              <thead><tr><th>Use</th>{COLS.map((c) => <th key={c.key} style={{ padding: "4px 8px", textAlign: "right" }}>{c.label}</th>)}{clubs.size > 0 && <th>Club</th>}</tr></thead>
              <tbody>
                {shots.map((s, i) => {
                  const f = flags[s.shot_no];
                  const rowLow = f && f.confidence < 0.8;
                  return (
                    <tr key={i} style={{ opacity: s.excluded ? 0.4 : 1, background: rowLow ? "rgba(233,163,107,0.10)" : undefined }}>
                      <td><input type="checkbox" checked={!s.excluded} onChange={() => toggle(i)} aria-label={`Include shot ${s.shot_no}`} /></td>
                      {COLS.map((c) => {
                        const cellLow = f?.fields.has(c.key);
                        const val = s[c.key];
                        return (
                          <td key={c.key} style={{ padding: "2px 4px", textAlign: "right", background: cellLow ? "rgba(233,163,107,0.35)" : undefined }}>
                            <input type="number" step={c.step ?? 1} value={val == null ? "" : String(val)}
                              onChange={(e) => edit(i, c.key, e.target.value)} aria-label={`${c.label} shot ${s.shot_no}`}
                              title={cellLow ? "Low confidence: check against the photo" : undefined}
                              style={{ width: c.key === "shot_no" ? 44 : 64, textAlign: "right", background: "transparent", border: "1px solid transparent", color: "inherit", font: "inherit", padding: "2px 4px" }} />
                          </td>
                        );
                      })}
                      {clubs.size > 0 && <td style={{ padding: "2px 8px" }}>{f?.club ?? ""}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && <p style={{ color: "#e9a36b" }}>{error}</p>}
          <button onClick={save} disabled={pending} style={{ marginTop: 12 }}>{pending ? "Saving…" : "Save session"}</button>
        </>
      )}
      {error && shots.length === 0 && <p style={{ color: "#e9a36b" }}>{error}</p>}
    </>
  );
}
