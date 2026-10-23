"use client";
import { useEffect, useRef, useState } from "react";
import type { Shot } from "@/lib/schema";
import { ReplayScene, PRESETS, IMPACT, type CameraPreset, type Flight } from "@/lib/viz/replay";
import { type VizGroup, isHot, live } from "@/lib/viz/groups";
import { drawFace } from "@/lib/viz/face";
import { drawDelivery } from "@/lib/viz/delivery";
import { seriesColor, labelColor, sideText } from "@/lib/viz/theme";
import { useTheme } from "@/components/theme";
import { fit } from "./Canvas2D";

export type ReplayMode = "best" | "all" | "race" | "h2h" | "spray";
export interface ShotPick { key: string; shot_no: number; token: number }
export interface GroupScope { key: string; best: boolean }

export interface ReplayStageProps {
  groups: VizGroup[];
  selected: Set<string>;
  mode: ReplayMode;
  filter: (s: Shot) => boolean;
  bestOnly: boolean;
  autoAdvance: boolean;
  camera: CameraPreset;
  orbit: boolean;
  showDisp: boolean;
  dispOnly: boolean;
  trails: boolean;
  fairway: number;
  fairwayOn: boolean;
  showDelivery: boolean;
  showFace: boolean;
  pick: ShotPick | null;
  h2h: [GroupScope, GroupScope];
  onFocus?: (f: { key: string; shot_no: number } | null) => void;
  height?: number | string;
}

interface CardRow { color: string; label: string; text: string }

/**
 * The three replay panes: path & face, strike on face, and the 3D flight,
 * driven by one animation loop. All playlist logic lives here; the parent
 * owns the control state and passes it down.
 */
export default function ReplayStage(p: ReplayStageProps) {
  const T = useTheme();
  const stageRef = useRef<HTMLDivElement>(null), cdRef = useRef<HTMLCanvasElement>(null), cfRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReplayScene | null>(null);
  const props = useRef(p); props.current = p;
  const playlist = useRef<Flight[]>([]);
  const [card, setCard] = useState<{ title: string; rows: CardRow[]; multi: boolean }>({ title: "", rows: [], multi: false });
  const [info, setInfo] = useState("");
  const [hint, setHint] = useState("");
  const [chips, setChips] = useState<{ color: string; soft: string; label: string; text: string }[]>([]);

  const byKey = (k: string) => p.groups.find((g) => g.key === k);
  const visible = (g: VizGroup) => (p.mode === "h2h" ? p.h2h.some((h) => h.key === g.key) : p.selected.has(g.key));

  // ---- scene lifecycle
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const sc = new ReplayScene(el, T); scene.current = sc; sc.resize();
    const ro = new ResizeObserver(() => { sc.resize(); }); ro.observe(el);
    let last = performance.now(), raf = 0;
    const slow = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.5 : 1;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1) * slow; last = now;
      if (sc.tick(dt)) advance();
      const f = sc.runners[0] ?? null, cur = props.current;
      const cd = cdRef.current, cf = cfRef.current;
      if (cd && cur.showDelivery) { const [w, h] = fit(cd); drawDelivery(cd.getContext("2d")!, w, h, sc.theme, f?.g ?? null, f?.s ?? null, sc.tau, f?.isAvg); }
      if (cf && cur.showFace) {
        const [w, h] = fit(cf);
        const peers = f ? (f.isAvg ? live(f.g, cur.mode === "race") : live(f.g)).filter((s) => cur.filter(s) && (!cur.bestOnly || isHot(f.g, s) || f.isAvg)) : undefined;
        drawFace(cf.getContext("2d")!, w, h, sc.theme, f?.g ?? null, f?.s ?? null, sc.tau - IMPACT, peers, f?.isAvg);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); sc.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scene.current?.setTheme(T); }, [T]);
  useEffect(() => { scene.current?.setGroups(p.groups); refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [p.groups]);
  useEffect(() => { scene.current?.setFairway(p.fairway, p.fairwayOn); refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [p.fairway, p.fairwayOn]);
  useEffect(() => { const s = scene.current; if (s) { s.showTrails = p.trails; s.dispOnly = p.dispOnly; } }, [p.trails, p.dispOnly]);
  useEffect(() => {
    const s = scene.current; if (!s) return;
    if (p.orbit) { s.setOrbit(true); setHint("Drag to orbit, scroll to zoom"); }
    else { s.setCamera(p.camera); s.setOrbit(false); setHint(PRESETS[p.camera].hint + (p.camera === "chase" ? "" : " · Free orbit lets you drag")); }
  }, [p.camera, p.orbit]);
  useEffect(() => { start(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [p.mode, p.selected, p.filter, p.bestOnly, p.h2h, p.groups]);
  useEffect(() => { if (p.pick) { const g = byKey(p.pick.key), f = g && scene.current?.flightsOf(g).find((x) => x.s.shot_no === p.pick!.shot_no); if (f) playOne(f, true); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [p.pick]);
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [p.showDisp, p.dispOnly, p.mode, p.selected, p.bestOnly, p.filter, p.h2h]);

  // ---- trails, ellipses, chips
  function refresh() {
    const s = scene.current; if (!s) return; const cur = props.current;
    const groups = cur.groups.filter(visible);
    s.setTrailPredicate((f) => {
      if (!cur.filter(f.s)) return false;
      if (cur.mode === "spray") return false;
      if (cur.mode === "race") return f.hot;
      if (cur.mode === "h2h") return cur.h2h.some((h) => h.key === f.g.key && (!h.best || f.hot));
      return visible(f.g) && (!cur.bestOnly || f.hot);
    });
    const scopes: { g: VizGroup; best: boolean }[] = [];
    if (cur.mode === "h2h") cur.h2h.forEach((h) => { const g = byKey(h.key); if (g) scopes.push({ g, best: h.best }); });
    else if (cur.mode === "spray") groups.forEach((g) => { if (!cur.bestOnly) scopes.push({ g, best: false }); scopes.push({ g, best: true }); });
    else groups.forEach((g) => scopes.push({ g, best: cur.mode === "race" || cur.bestOnly }));
    s.showEllipses(cur.showDisp || cur.dispOnly || cur.mode === "spray" ? scopes.map((x) => ({ ...x, filter: cur.filter })) : []);
    setChips(scopes.map(({ g, best }) => {
      const rows = live(g, best).filter(cur.filter), n = rows.length, h = rows.filter((q) => Math.abs(q.offline_yd ?? 0) <= cur.fairway / 2).length;
      return { color: seriesColor(g.color).hex, soft: labelColor(g.color, T), label: `${g.short} · ${best ? `best ${g.best?.[0]}-${g.best?.[1]}` : "all"}`, text: n ? `${Math.round((h / n) * 100)}% in a ${cur.fairway} yd fairway (${h}/${n})` : "no shots match this filter" };
    }));
    if (cur.mode === "spray") {
      setCard({ title: `Landing areas · 1σ ellipses · ${cur.bestOnly ? "best stretches" : "dashed whole session, solid best stretch"}`, multi: true,
        rows: groups.map((g) => { const eb = s.ellipse(g, true, cur.filter), ea = cur.bestOnly ? null : s.ellipse(g, false, cur.filter); const sz = (e: typeof eb) => (e ? `${Math.round(2 * e.b)}×${Math.round(2 * e.a)} yd` : "n/a");
          return { color: seriesColor(g.color).hex, label: g.short, text: `${ea ? `all ${sz(ea)} · ` : ""}best ${sz(eb)}` }; }) });
      setInfo("Spray view: ellipses are one standard deviation of finishing positions, so about 40% of each group lands inside. Compare the shapes, not the dots.");
    }
  }

  // ---- playlists
  function start() {
    const s = scene.current; if (!s) return; const cur = props.current;
    const groups = cur.groups.filter(visible);
    if (cur.mode === "best" || cur.mode === "all") {
      const lists = groups.map((g) => s.flightsOf(g).filter((f) => (cur.mode === "all" || f.hot) && cur.filter(f.s)));
      const pl: Flight[] = []; const m = Math.max(0, ...lists.map((l) => l.length));
      for (let i = 0; i < m; i++) lists.forEach((l) => { if (l[i]) pl.push(l[i]); });
      playlist.current = pl; if (pl.length) playOne(pl[0], false); else play([]);
    } else if (cur.mode === "race") {
      playlist.current = [];
      play(groups.map((g) => {
        const fl = s.flightsOf(g).filter((f) => f.hot && cur.filter(f.s)); if (!fl.length) return null;
        const mc = fl.reduce((a, f) => a + f.s.carry_yd, 0) / fl.length, mo = fl.reduce((a, f) => a + (f.s.offline_yd ?? 0), 0) / fl.length;
        return fl.slice().sort((a, b) => (Math.abs(a.s.carry_yd - mc) + Math.abs((a.s.offline_yd ?? 0) - mo)) - (Math.abs(b.s.carry_yd - mc) + Math.abs((b.s.offline_yd ?? 0) - mo)))[0];
      }).filter((f): f is Flight => !!f));
    } else if (cur.mode === "h2h") {
      playlist.current = [];
      play(cur.h2h.map((h) => { const g = byKey(h.key); return g ? s.avgFlight(g, h.best, cur.filter) : null; }).filter((f): f is Flight => !!f));
    } else { playlist.current = []; play([]); }
    refresh();
  }
  function playOne(f: Flight, clearList: boolean) { if (clearList) playlist.current = []; play([f]); }
  function play(list: Flight[]) {
    const s = scene.current; if (!s) return; const cur = props.current;
    s.play(list);
    const f = list[0] ?? null;
    if (cur.mode === "best" || cur.mode === "all") {
      if (f) { const sd = f.s.offline_yd ?? 0; setCard({ title: `${f.g.name} · Shot ${f.s.shot_no}${f.hot ? " · best stretch" : ""}`, multi: false, rows: [{ color: "", label: "", text: `${f.s.carry_yd} carry · ${f.s.total_yd} total · ${sideText(sd)}` }] }); }
      else setCard({ title: "No shots match this filter", rows: [], multi: false });
    } else if (cur.mode === "race") setCard({ title: "Ghost race · typical best-stretch drive", multi: true, rows: list.map((R) => ({ color: seriesColor(R.g.color).hex, label: R.g.short, text: `${Math.round(R.s.carry_yd)}/${Math.round(R.s.total_yd ?? 0)} · ${sideText(R.s.offline_yd ?? 0, true)}` })) });
    else if (cur.mode === "h2h") setCard({ title: "Head-to-head · average flights", multi: false, rows: list.map((R) => ({ color: seriesColor(R.g.color).hex, label: R.label, text: `${Math.round(R.s.carry_yd)} / ${Math.round(R.s.total_yd ?? 0)} · ${sideText(R.s.offline_yd ?? 0, true)}` })) });
    if (f && cur.mode !== "spray") {
      const r = f.s;
      setInfo(`${f.isAvg ? "Group average" : `${f.g.name} #${r.shot_no}`} · ${r.club_speed_mph ?? "n/a"} mph club · ${r.ball_speed_mph ?? "n/a"} mph ball · ${r.launch_deg ?? "n/a"}° launch · ${Math.round(r.back_rpm ?? 0)} rpm back · ${Math.round(r.side_rpm ?? 0)} rpm side · smash ${r.smash ?? "n/a"}${r.attack_deg != null ? ` · AoA ${r.attack_deg}°` : ""}${r.dyn_loft_deg != null ? ` · dyn loft ${r.dyn_loft_deg}°` : ""}`);
      cur.onFocus?.(f.isAvg ? null : { key: f.g.key, shot_no: r.shot_no });
    } else if (!f && cur.mode !== "spray") setInfo("");
  }
  function advance() {
    const s = scene.current; if (!s) return; const cur = props.current, pl = playlist.current;
    if ((cur.mode === "best" || cur.mode === "all") && cur.autoAdvance && pl.length) { const k = pl.indexOf(s.runners[0]); playOne(pl[(k + 1) % pl.length], false); }
    else { s.tau = 0; s.runners.forEach((R) => R.tube.geometry.setDrawRange(0, 0)); }
  }

  const twoUp = p.showDelivery && p.showFace, spray = p.mode === "spray";
  return (
    <div className="replay">
      {!spray && (p.showDelivery || p.showFace) && (
        <div className={"view " + (twoUp ? "" : "c1")}>
          {p.showDelivery && <div className="pane"><canvas ref={cdRef} role="img" aria-label="Top-down club path and face angle for the selected shot" /><span className="step">1</span></div>}
          {p.showFace && <div className="pane"><canvas ref={cfRef} role="img" aria-label="Strike location on the clubface for the selected shot" /><span className="step">2</span></div>}
        </div>
      )}
      <div className="pane stage" ref={stageRef} style={{ height: p.height }}>
        <div className={"card " + (card.multi ? "multi" : "")}>
          {card.title && <div className="ttl">{card.title}</div>}
          {card.rows.map((r, i) => (
            <div className="row" key={i}>{r.color && <span className="sw" style={{ background: r.color }} />}{r.label && <span style={{ color: r.color }}>{r.label}</span>}<span>{r.text}</span></div>
          ))}
        </div>
        <div className="hint">{hint}</div>
        <span className="step">3</span>
      </div>
      <div className="chips">
        {chips.map((c, i) => <span className="chip" key={i} style={{ borderLeftColor: c.color }}><b style={{ color: c.soft }}>{c.label}</b> · {c.text}</span>)}
      </div>
      <div className="info">{info}</div>
    </div>
  );
}
