"use client";
import { useCallback, useMemo, useState } from "react";
import type { Shot } from "@/lib/schema";
import { type VizGroup, type Status, FILTERS, METRICS, fmtV, live, shotTip, avgOf, isHot } from "@/lib/viz/groups";
import { labelColor, seriesColor } from "@/lib/viz/theme";
import { drawStrikeMap, type Hit } from "@/lib/viz/face";
import { drawLanding, legendText, type LandingLegend } from "@/lib/viz/landing";
import { drawTrend, drawPathFace, TREND_METRICS } from "@/lib/viz/trends";
import type { CameraPreset } from "@/lib/viz/replay";
import { useTheme, Toggle } from "@/components/theme";
import Canvas2D from "./Canvas2D";
import SessionPicker from "./SessionPicker";
import ReplayStage, { type ReplayMode, type ShotPick, type GroupScope } from "./ReplayStage";

type Tab = "replay" | "compare" | "dispersion" | "trends" | "notes";

/**
 * The full analysis view for a set of groups: Replay, Dispersion and Trends
 * tabs with shared session selection, filter and theme.
 */
export default function Dashboard({ groups, initialTab = "replay", status }: { groups: VizGroup[]; initialTab?: Tab; status?: Status | null }) {
  const T = useTheme();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(groups.map((g) => g.key)));
  const [mode, setMode] = useState<ReplayMode>("best");
  const [filterKey, setFilterKey] = useState("all");
  const [bestOnly, setBestOnly] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [camera, setCamera] = useState<CameraPreset>("broadcast");
  const [orbit, setOrbit] = useState(false);
  const [showDisp, setShowDisp] = useState(true);
  const [dispOnly, setDispOnly] = useState(false);
  const [trails, setTrails] = useState(true);
  const [fairway, setFairway] = useState(30);
  const [fairwayOn, setFairwayOn] = useState(true);
  const [showDelivery, setShowDelivery] = useState(true);
  const [showFace, setShowFace] = useState(true);
  const [pick, setPick] = useState<ShotPick | null>(null);
  const [focus, setFocus] = useState<{ key: string; shot_no: number } | null>(null);
  const last = groups[groups.length - 1]?.key ?? "", prev = groups[groups.length - 2]?.key ?? last;
  const [h2h, setH2h] = useState<[GroupScope, GroupScope]>([{ key: prev, best: false }, { key: last, best: false }]);
  // dispersion tab
  const [dMetric, setDMetric] = useState<"total_yd" | "carry_yd">("total_yd");
  const [dDots, setDDots] = useState(true);
  const [dEll, setDEll] = useState(true);
  const [legend, setLegend] = useState<LandingLegend[]>([]);
  // trends tab
  const [selTrend, setSelTrend] = useState<VizGroup | null>(null);

  const filter = useMemo(() => FILTERS[filterKey].f, [filterKey]);
  const vis = useMemo(() => groups.filter((g) => selected.has(g.key)), [groups, selected]);
  const byKey = (k: string) => groups.find((g) => g.key === k);
  const tipFor = useCallback((h: Hit) => shotTip(h.g, h.s, labelColor(h.g.color, T)), [T]);

  // shot dropdown and prev/next
  const shotList = useMemo(() => vis.flatMap((g) => live(g).map((s) => ({ g, s }))), [vis]);
  const focusIdx = shotList.findIndex((x) => focus && x.g.key === focus.key && x.s.shot_no === focus.shot_no);
  const pickAt = (i: number) => { if (!shotList.length) return; const x = shotList[(i + shotList.length) % shotList.length]; setPick({ key: x.g.key, shot_no: x.s.shot_no, token: Date.now() }); };
  const openIn = (g: VizGroup) => { setSelected(new Set([g.key])); setMode("best"); setTab("replay"); scrollTo({ top: 0, behavior: "smooth" }); };

  const scopeOpts = [...groups].reverse().flatMap((g) => [{ v: `${g.key}:best`, l: `${g.name} · best ${g.best?.[0] ?? ""}-${g.best?.[1] ?? ""}` }, { v: `${g.key}:all`, l: `${g.name} · all` }]);
  const scopeVal = (s: GroupScope) => `${s.key}:${s.best ? "best" : "all"}`;
  const parseScope = (v: string): GroupScope => { const [key, sc] = v.split(":"); return { key, best: sc === "best" }; };

  const drawLandingCb = useCallback((x: CanvasRenderingContext2D, w: number, h: number) => {
    const r = drawLanding(x, w, h, T, vis, { bestOnly, dots: dDots, ellipses: dEll, metric: dMetric, fairwayYd: fairway });
    setLegend(r.legend); return r.hits;
  }, [T, vis, bestOnly, dDots, dEll, dMetric, fairway]);
  const drawStrikeCb = useCallback((x: CanvasRenderingContext2D, w: number, h: number) => drawStrikeMap(x, w, h, T, vis, { bestOnly, dots: dDots, rings: dEll }), [T, vis, bestOnly, dDots, dEll]);

  const cell = (rows: Shot[], m: (typeof METRICS)[number]) => avgOf(rows, m[1]);
  const diffCell = (a: number | null, b: number | null, m: (typeof METRICS)[number]) => {
    if (a == null || b == null) return <td />;
    const d = b - a, t = fmtV(Math.abs(d), m[2]), zero = parseFloat(t.replace(/,/g, "")) === 0;
    const cls = m[3] !== 0 && !zero ? (Math.sign(d) * m[3] > 0 ? "up" : "down") : "";
    return <td className={cls}>{zero ? "0" : (d > 0 ? "+" : "-") + t}</td>;
  };

  const pct = (rows: Shot[], f: (s: Shot) => boolean) => (rows.length ? Math.round((rows.filter(f).length / rows.length) * 100) : null);
  const scopeName = (g: VizGroup, best: boolean) => `${g.name} · ${best ? `best ${g.best?.[0]}-${g.best?.[1]}` : "all"}`;
  function h2hTable() {
    const A = byKey(h2h[0].key), B = byKey(h2h[1].key); if (!A || !B) return null;
    const ra = live(A, h2h[0].best).filter(filter), rb = live(B, h2h[1].best).filter(filter);
    return (
      <div className="tablewrap"><table>
        <thead><tr><th /><th style={{ color: labelColor(A.color, T) }}>{scopeName(A, h2h[0].best)}<br />{ra.length} shots</th><th style={{ color: labelColor(B.color, T) }}>{scopeName(B, h2h[1].best)}<br />{rb.length} shots</th><th>B − A</th></tr></thead>
        <tbody>
          {METRICS.map((m) => { const a = cell(ra, m), b = cell(rb, m); return <tr key={m[0]}><td>{m[0]}</td><td>{fmtV(a, m[2])}</td><td>{fmtV(b, m[2])}</td>{diffCell(a, b, m)}</tr>; })}
          <tr><td>In a {fairway} yd fairway</td><td>{pct(ra, (s) => Math.abs(s.offline_yd ?? 99) <= fairway / 2) ?? "n/a"}%</td><td>{pct(rb, (s) => Math.abs(s.offline_yd ?? 99) <= fairway / 2) ?? "n/a"}%</td><td /></tr>
          <tr><td>Shots with draw spin</td><td>{pct(ra, (s) => (s.side_rpm ?? 0) < -150) ?? "n/a"}%</td><td>{pct(rb, (s) => (s.side_rpm ?? 0) < -150) ?? "n/a"}%</td><td /></tr>
        </tbody></table></div>
    );
  }
  const groupPickers = (
    <div className="h2h">
      <label>Group A<select aria-label="Group A" value={scopeVal(h2h[0])} onChange={(e) => setH2h([parseScope(e.target.value), h2h[1]])}>{scopeOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
      <label>Group B<select aria-label="Group B" value={scopeVal(h2h[1])} onChange={(e) => setH2h([h2h[0], parseScope(e.target.value)])}>{scopeOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
    </div>
  );

  return (
    <div className="dash">
      <nav className="tabs" role="tablist">
        {(["replay", "compare", "trends", "dispersion", "notes"] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}
      </nav>

      {tab === "replay" && (
        <section>
          <div className="ctrl">
            <div className="opt"><span className="lab">Mode</span><div className="mid">
              <select value={mode} onChange={(e) => setMode(e.target.value as ReplayMode)} aria-label="Mode">
                <option value="best">Replay · best stretches</option><option value="all">Replay · every shot</option><option value="race">Ghost race · all sessions</option><option value="h2h">Head-to-head · two groups</option><option value="spray">Landing areas · spray</option>
              </select></div>
              <div className="end"><Toggle label="Auto-advance" checked={autoAdvance} onChange={setAutoAdvance} disabled={mode !== "best" && mode !== "all"} /></div></div>
            <div className="opt"><span className="lab">Session</span><div className="mid"><SessionPicker groups={groups} selected={selected} onChange={(k) => setSelected(new Set(k))} /></div>
              <div className="end"><Toggle label="Best stretches only" checked={bestOnly} onChange={setBestOnly} /></div></div>
            <div className="opt"><span className="lab">Shot</span><div className="mid">
              <button type="button" className="ico" aria-label="Previous shot" disabled={mode !== "best" && mode !== "all"} onClick={() => pickAt(focusIdx - 1)}>◀</button>
              <select aria-label="Shot" disabled={mode !== "best" && mode !== "all"} value={focusIdx >= 0 ? focusIdx : ""} onChange={(e) => pickAt(+e.target.value)}>
                {focusIdx < 0 && <option value="">—</option>}
                {vis.length > 1
                  ? [...vis].reverse().map((g) => <optgroup key={g.key} label={g.name}>{live(g).map((s) => { const i = shotList.findIndex((x) => x.g === g && x.s === s); return <option key={s.shot_no} value={i}>{g.short} #{s.shot_no}{isHot(g, s) ? " ★" : ""}</option>; })}</optgroup>)
                  : shotList.map((x, i) => <option key={i} value={i}>#{x.s.shot_no}{isHot(x.g, x.s) ? " ★" : ""}</option>)}
              </select>
              <button type="button" className="ico" aria-label="Next shot" disabled={mode !== "best" && mode !== "all"} onClick={() => pickAt(focusIdx + 1)}>▶</button></div><div className="end" /></div>
            <div className="opt"><span className="lab">Filter</span><div className="mid"><select value={filterKey} onChange={(e) => setFilterKey(e.target.value)} aria-label="Shot filter">{Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div className="end"><Toggle label="Path & face" checked={showDelivery} onChange={setShowDelivery} /><Toggle label="Strike on face" checked={showFace} onChange={setShowFace} /></div></div>
          </div>

          <ReplayStage groups={groups} selected={selected} mode={mode} filter={filter} bestOnly={bestOnly} autoAdvance={autoAdvance} camera={camera} orbit={orbit}
            showDisp={showDisp} dispOnly={dispOnly} trails={trails} fairway={fairway} fairwayOn={fairwayOn} showDelivery={showDelivery} showFace={showFace} pick={pick} h2h={h2h} onFocus={setFocus} />

          <div className="ctrl" aria-label="Flight view options">
            <div className="opt"><span className="lab">Camera</span><div className="mid">
              <select value={camera} onChange={(e) => { setCamera(e.target.value as CameraPreset); setOrbit(false); }} aria-label="Camera">
                <option value="broadcast">Broadcast</option><option value="chase">Chase ball</option><option value="downrange">Down range</option><option value="landing">Landing area</option><option value="spray">Landing areas, top down</option><option value="top">Top</option><option value="side">Side</option>
              </select></div><div className="end"><Toggle label="Free orbit" checked={orbit} onChange={setOrbit} /></div></div>
            <div className="opt"><span className="lab">Ground</span><div className="mid">
              <select value={fairway} onChange={(e) => setFairway(+e.target.value)} aria-label="Fairway width">{[20, 25, 30, 35, 40, 50].map((v) => <option key={v} value={v}>{v} yd fairway</option>)}</select></div>
              <div className="end"><Toggle label="Show fairway" checked={fairwayOn} onChange={setFairwayOn} /></div></div>
            {mode === "h2h" && (
              <div className="opt"><span className="lab">Groups</span><div className="mid">
                <select aria-label="Group A" value={scopeVal(h2h[0])} onChange={(e) => setH2h([parseScope(e.target.value), h2h[1]])}>{scopeOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                <select aria-label="Group B" value={scopeVal(h2h[1])} onChange={(e) => setH2h([h2h[0], parseScope(e.target.value)])}>{scopeOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
              </div><div className="end"><span className="small">A vs B</span></div></div>
            )}
            <div className="opt"><span className="lab">Show</span><div className="mid end" style={{ justifyContent: "flex-start" }}>
              <Toggle label="Dispersion 1σ" checked={showDisp} onChange={setShowDisp} />
              <Toggle label="Dispersion only (hide other shots)" checked={dispOnly} onChange={(v) => { setDispOnly(v); if (v) setShowDisp(true); }} />
              <Toggle label="Other shots" checked={trails} onChange={setTrails} /></div><div className="end" /></div>
          </div>

          {mode === "h2h" && h2hTable()}
        </section>
      )}

      {tab === "compare" && (
        <section>
          <h2>Head to head</h2>
          <p className="sub">Pick any two groups. Head-to-head mode on the Replay tab plays their average flights side by side. The Replay tab&apos;s shot filter applies here too.</p>
          {groupPickers}
          {h2hTable()}
          <h2 style={{ marginTop: 12 }}>All sessions</h2>
          <p className="sub">Newest first. Bold columns are each session&apos;s best stretch.</p>
          <div className="tablewrap"><table className="wide">
            <thead><tr><th />{[...groups].reverse().flatMap((g) => [
              <th key={g.key + "b"} style={{ color: labelColor(g.color, T) }}>{g.name}<br />{g.best ? `best ${g.best[0]}-${g.best[1]}` : "best"}</th>,
              <th key={g.key + "a"} style={{ color: labelColor(g.color, T) }}>{g.name}<br />all {live(g).length}</th>])}</tr></thead>
            <tbody>{METRICS.map((m) => <tr key={m[0]}><td>{m[0]}</td>{[...groups].reverse().flatMap((g) => {
              const vb = cell(live(g, true), m), va = cell(live(g), m);
              const show = (v: number | null) => { let t = fmtV(v, m[2]); if (m[0].startsWith("Avg offline") && v != null && v > 0) t = "+" + t; return t; };
              return [<td key={g.key + "b"} className="best">{show(vb)}</td>, <td key={g.key + "a"}>{show(va)}</td>]; })}</tr>)}</tbody>
          </table></div>
        </section>
      )}

      {tab === "notes" && (
        <section>
          {status && status.cards.length > 0 && (<>
            <h2>Where things stand</h2>
            {(status.as_of || status.summary) && <p className="sub">{status.as_of ? `As of ${status.as_of}. ` : ""}{status.summary ?? ""}</p>}
            <div className="status">{status.cards.map((c) => <div className="st" key={c.k}><span className="k">{c.k}</span><div className="v">{c.v}</div><p>{c.p}</p></div>)}</div>
          </>)}
          <h2>Session by session</h2>
          <p className="sub">Newest first. Each session&apos;s highlighted stretch, swing cue, notes and findings.</p>
          <div className="tl">
            {[...groups].reverse().map((g) => {
              const a = live(g), b = live(g, true);
              const cards = g.findings ?? [];
              return (
                <div className="ev" key={g.key}>
                  <div className="when">
                    <b style={{ color: labelColor(g.color, T) }}>{g.name}</b>
                    <span className="n">{a.length} drives{g.best ? ` · best ${g.best[0]}-${g.best[1]}` : ""}{b.length ? ` · ${Math.round(avgOf(b, (s) => s.carry_yd) ?? 0)} carry best` : ""}</span>
                    {g.cue && <span className="cue">{g.cue}</span>}
                    {g.stretches && g.stretches.length > 1 && <span className="n">{g.stretches.map((st) => `${st.label} ${st.from}-${st.to}${st.cue ? ` (${st.cue})` : ""}`).join(" · ")}</span>}
                    <button type="button" onClick={() => openIn(g)}>Open in replay</button>
                  </div>
                  <div className="cards">
                    {cards.map((f, i) => <div className="note" key={i}><h3>{f.title}</h3><p>{f.body}</p></div>)}
                    {!cards.length && g.notes && <div className="note"><h3>Session notes</h3><p>{g.notes}</p></div>}
                    {!cards.length && !g.notes && <div className="note"><p>No notes yet for this session.</p></div>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="method">Flights are simulated from ball speed, launch, spin and spin axis using drag and spin-driven lift, then anchored to each shot&apos;s measured carry, apex and finish. Coefficients are standard approximations, not the simulator&apos;s own model. Average flights in Head-to-head mode are the point-by-point mean of the group&apos;s simulated flights. Dispersion ellipses are one standard deviation of the finishing positions, so about 40% of shots land inside them; dashed outlines are whole sessions, solid outlines are best stretches. Horizontal strike is shown as + / − because the device&apos;s toe and heel convention wasn&apos;t confirmed.</p>
        </section>
      )}

      {tab === "dispersion" && (
        <section>
          <p className="sub">Where the ball finished and where it met the face. Dashed ellipses are whole sessions, solid are best stretches, one standard deviation each. Hover any shot for its numbers.</p>
          <div className="ctrl">
            <div className="opt"><span className="lab">Sessions</span><div className="mid"><SessionPicker groups={groups} selected={selected} onChange={(k) => setSelected(new Set(k))} /></div>
              <div className="end"><Toggle label="Best stretches only" checked={bestOnly} onChange={setBestOnly} /></div></div>
            <div className="opt"><span className="lab">Landing</span><div className="mid"><select value={dMetric} onChange={(e) => setDMetric(e.target.value as "total_yd" | "carry_yd")} aria-label="Landing distance"><option value="total_yd">Total distance</option><option value="carry_yd">Carry distance</option></select></div>
              <div className="end"><Toggle label="Show shots" checked={dDots} onChange={setDDots} /><Toggle label="Ellipses & averages" checked={dEll} onChange={setDEll} /></div></div>
          </div>
          <div className="dgrid">
            <div>
              <Canvas2D draw={drawLandingCb} height={560} label="Landing dispersion map" tipFor={tipFor} />
              <div className="chips" style={{ marginTop: 8 }}>{legend.map((l) => <span className="chip" key={l.g.key} style={{ borderLeftColor: seriesColor(l.g.color).hex }}><b style={{ color: labelColor(l.g.color, T) }}>{l.g.short}</b> · {legendText(l)}</span>)}</div>
            </div>
            <Canvas2D draw={drawStrikeCb} height={560} label="Clubface impact locations" tipFor={tipFor} />
          </div>
        </section>
      )}

      {tab === "trends" && (
        <section>
          <p className="sub">Oldest on the left. Scroll sideways and click a session to highlight it in the charts and see its numbers against the session before.</p>
          <div className="prog">
            {groups.map((g, j) => {
              const a = live(g), b = live(g, true), P = j > 0 ? groups[j - 1] : null;
              const c = Math.round(avgOf(a, (s) => s.carry_yd) ?? 0), dc = P ? c - Math.round(avgOf(live(P), (s) => s.carry_yd) ?? 0) : null;
              return (
                <button type="button" key={g.key} className={"ses " + (selTrend === g ? "on" : "")} aria-pressed={selTrend === g} onClick={() => setSelTrend(selTrend === g ? null : g)}>
                  <span className="k" style={{ color: labelColor(g.color, T) }}>{g.name} · {a.length} balls</span>
                  <span className="big">{Math.round(avgOf(b, (s) => s.carry_yd) ?? 0)}<small>carry{g.best ? `, best ${g.best[0]}-${g.best[1]}` : ""}</small></span>
                  <span className="sub">Session avg {c} carry · {Math.round(avgOf(a, (s) => Math.abs(s.offline_yd ?? 0)) ?? 0)} yd miss · {(avgOf(a, (s) => s.smash) ?? 0).toFixed(2)} smash</span>
                  <span className="sub">Best {Math.round(avgOf(b, (s) => s.total_yd) ?? 0)} total · {Math.round(avgOf(b, (s) => Math.abs(s.offline_yd ?? 0)) ?? 0)} yd miss · {(avgOf(b, (s) => s.ball_speed_mph) ?? 0).toFixed(0)} mph ball</span>
                  {dc != null && <span className={"d " + (dc > 0 ? "up" : dc < 0 ? "down" : "")}>{dc > 0 ? "+" : ""}{dc} yd session carry vs {P?.tag}</span>}
                  {g.cue && <span className="cue">{g.cue}</span>}
                </button>
              );
            })}
          </div>
          {selTrend && (() => {
            const g = selTrend, j = groups.indexOf(g), P = j > 0 ? groups[j - 1] : null, a = live(g), b = live(g, true), pa = P ? live(P) : [];
            return (
              <div className="detail">
                <div className="head"><h3 style={{ color: labelColor(g.color, T) }}>{g.name}</h3><span className="small">{a.length} drives{g.best ? ` · best stretch ${g.best[0]}-${g.best[1]}` : ""}{g.cue ? ` · ${g.cue}` : ""}</span><span className="grow" /><button type="button" onClick={() => openIn(g)}>Open in replay</button></div>
                <div className="tablewrap"><table>
                  <thead><tr><th /><th style={{ color: labelColor(g.color, T) }}>Best {g.best?.[0]}-{g.best?.[1]}</th><th style={{ color: labelColor(g.color, T) }}>Whole session</th>{P && <><th style={{ color: labelColor(P.color, T) }}>{P.name}<br />whole session</th><th>vs previous</th></>}</tr></thead>
                  <tbody>{METRICS.map((m) => { const vb = cell(b, m), va = cell(a, m), vp = P ? cell(pa, m) : null; return <tr key={m[0]}><td>{m[0]}</td><td className="best">{fmtV(vb, m[2])}</td><td>{fmtV(va, m[2])}</td>{P && <><td>{fmtV(vp, m[2])}</td>{diffCell(vp, va, m)}</>}</tr>; })}</tbody>
                </table></div>
              </div>
            );
          })()}
          <div className="strip">
            {TREND_METRICS.map((m) => <Canvas2D key={m.title} draw={(x, w, h, Th) => drawTrend(x, w, h, Th, groups, m, selTrend)} height={230} label={m.title} deps={[groups, selTrend]} />)}
            <Canvas2D draw={(x, w, h, Th) => drawPathFace(x, w, h, Th, groups, selTrend)} height={230} label="Club path and face to target by session" deps={[groups, selTrend]} />
          </div>
        </section>
      )}
    </div>
  );
}
