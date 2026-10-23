import * as THREE from "three";
import type { Shot } from "../schema";
import { simulateFlight, anchorFlight, FLIGHT_POINTS as NP } from "../physics";
import { ellipse2 } from "../stats";
import type { Theme } from "./theme";
import { seriesColor } from "./theme";
import { type VizGroup, isHot, live } from "./groups";

/**
 * The 3D replay scene, ported from the prototype. Framework-free: a React
 * component owns one instance, feeds it groups and state, and calls tick().
 *
 * Coordinates: x right (yards), y up (height drawn at HEIGHT_X), z negative downrange.
 */
const HEIGHT_X = 1.5;
export const IMPACT = 0.9, ROLL = 1.1, HOLD = 1.4;

export interface Flight {
  g: VizGroup; s: Shot; hot: boolean; isAvg: boolean; label: string;
  pts: THREE.Vector3[]; len: number[]; land: THREE.Vector3; rest: THREE.Vector3; fd: number; dir: THREE.Vector3;
  thin: THREE.Line; tube: THREE.Mesh; roll: THREE.Line; ring: THREE.Mesh;
}

export type CameraPreset = "broadcast" | "downrange" | "landing" | "spray" | "top" | "side" | "chase";
export const PRESETS: Record<CameraPreset, { pos?: number[]; look?: number[]; up?: number[]; hint: string }> = {
  broadcast: { pos: [2, 9, 24], look: [0, 12, -160], hint: "Fixed broadcast view behind the tee" },
  chase: { hint: "Following the ball" },
  downrange: { pos: [0, 11, -318], look: [0, 9, -110], hint: "Looking back toward the tee, so right misses appear on the left" },
  landing: { pos: [-72, 48, -192], look: [0, 0, -243], hint: "Above the landing area, 200 to 270 yards" },
  spray: { pos: [0, 250, -228], look: [0, 0, -228], up: [0, 0, -1], hint: "Top down over the landing areas, 150 to 300 yards" },
  top: { pos: [0, 330, -150], look: [0, 0, -150], up: [0, 0, -1], hint: "Top down" },
  side: { pos: [-250, 45, -135], look: [0, 18, -135], hint: "Side on" },
};

interface EllipseMeshes { fill: THREE.Mesh; line: THREE.Line; mark: THREE.Mesh; cross: THREE.LineSegments; a: number; b: number; best: boolean }

function label(t: string, color: string) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 96;
  const x = c.getContext("2d")!; x.font = "bold 52px system-ui,sans-serif"; x.fillStyle = color; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(t, 128, 48);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(16, 6, 1); return s;
}

export class ReplayScene {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, 0.3, 2000);
  theme: Theme;
  private ground: THREE.Mesh; private fw: THREE.Mesh; private fwEdges: THREE.Line[]; private center: THREE.Line; private gridLines: THREE.Line[] = []; private labels: THREE.Sprite[] = [];
  private balls: THREE.Mesh[] = [];
  flights = new Map<string, Flight[]>();   // by group key
  private avgCache = new Map<string, Flight>();
  private ellCache = new Map<string, EllipseMeshes | null>();
  runners: Flight[] = []; tau = 0;
  showTrails = true; dispOnly = false;
  private trailPred: (f: Flight) => boolean = () => false;
  // camera
  camMode: CameraPreset = "broadcast"; orbit = false; private drag: { x: number; y: number } | null = null;
  private sph = { r: 200, th: 0, ph: 1.3 };
  private cam = { pos: new THREE.Vector3(2, 9, 24), look: new THREE.Vector3(0, 12, -160), up: new THREE.Vector3(0, 1, 0) };
  private tgt = { pos: new THREE.Vector3(2, 9, 24), look: new THREE.Vector3(0, 12, -160), up: new THREE.Vector3(0, 1, 0) };

  constructor(public el: HTMLElement, theme: Theme) {
    this.theme = theme;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.insertBefore(this.renderer.domElement, el.firstChild);
    this.scene.fog = new THREE.Fog(theme.bg3, 380, 760);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 420), new THREE.MeshBasicMaterial({ color: theme.turf3 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(0, 0, -160); this.scene.add(this.ground);
    this.fw = new THREE.Mesh(new THREE.PlaneGeometry(1, 330), new THREE.MeshBasicMaterial({ color: theme.fw3 }));
    this.fw.rotation.x = -Math.PI / 2; this.fw.position.set(0, 0.05, -165); this.fw.scale.x = 30; this.scene.add(this.fw);
    this.fwEdges = [-1, 1].map((s) => {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s, 0.08, 0), new THREE.Vector3(s, 0.08, -330)]), new THREE.LineBasicMaterial({ color: theme.edge3 }));
      l.scale.x = 15; this.scene.add(l); return l;
    });
    this.center = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0, 0.1, -330)]), new THREE.LineDashedMaterial({ color: theme.center3, dashSize: 4, gapSize: 4 }));
    this.center.computeLineDistances(); this.scene.add(this.center);
    [50, 100, 150, 200, 250, 300].forEach((d) => {
      const gl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-80, 0.1, -d), new THREE.Vector3(80, 0.1, -d)]), new THREE.LineBasicMaterial({ color: theme.grid3 }));
      this.gridLines.push(gl); this.scene.add(gl);
      [-90, 90].forEach((xx) => { const l = label(`${d}`, theme.label3); l.position.set(xx, 3, -d); this.labels.push(l); this.scene.add(l); });
    });
    const lL = label("LEFT", theme.label3); lL.position.set(-45, 3, -20); const lR = label("RIGHT", theme.label3); lR.position.set(45, 3, -20);
    this.labels.push(lL, lR); this.scene.add(lL, lR);
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: theme.ball3 }));
      const g = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      b.add(g); b.visible = false; this.scene.add(b); this.balls.push(b);
    }
    this.setTheme(theme);
    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", (e) => { if (!this.orbit) return; this.drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => { if (!this.drag) return; this.sph.th -= (e.clientX - this.drag.x) * 0.006; this.sph.ph = Math.min(1.55, Math.max(0.05, this.sph.ph - (e.clientY - this.drag.y) * 0.006)); this.drag = { x: e.clientX, y: e.clientY }; });
    c.addEventListener("pointerup", () => (this.drag = null)); c.addEventListener("pointercancel", () => (this.drag = null));
    c.addEventListener("wheel", (e) => { if (!this.orbit) return; e.preventDefault(); this.sph.r = Math.min(600, Math.max(40, this.sph.r * (1 + e.deltaY * 0.001))); }, { passive: false });
  }

  setTheme(t: Theme) {
    this.theme = t;
    this.scene.background = new THREE.Color(t.bg3); (this.scene.fog as THREE.Fog).color.setHex(t.bg3);
    (this.ground.material as THREE.MeshBasicMaterial).color.setHex(t.turf3); (this.fw.material as THREE.MeshBasicMaterial).color.setHex(t.fw3);
    this.fwEdges.forEach((l) => (l.material as THREE.LineBasicMaterial).color.setHex(t.edge3));
    (this.center.material as THREE.LineBasicMaterial).color.setHex(t.center3);
    this.gridLines.forEach((l) => (l.material as THREE.LineBasicMaterial).color.setHex(t.grid3));
    this.balls.forEach((b) => (b.material as THREE.MeshBasicMaterial).color.setHex(t.ball3));
    this.flights.forEach((fl) => fl.forEach((f) => { if (!f.hot) (f.tube.material as THREE.MeshBasicMaterial).color.setHex(t.ink3); }));
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  setFairway(yd: number, visible = true) {
    this.fw.scale.x = yd; this.fw.visible = visible; this.fwEdges.forEach((l) => { l.scale.x = yd / 2; l.visible = visible; });
  }

  private meshes(pts: THREE.Vector3[], land: THREE.Vector3, rest: THREE.Vector3, off: number, total: number, col: number, lineCol: number, hot: boolean, radius: number) {
    const len = [0]; for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + pts[k].distanceTo(pts[k - 1]));
    const thin = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: hot ? col : lineCol, transparent: true, opacity: hot ? 0.75 : 0.3 }));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 100, radius, 8, false), new THREE.MeshBasicMaterial({ color: hot ? col : this.theme.ink3 }));
    tube.visible = false;
    const roll = new THREE.Line(new THREE.BufferGeometry().setFromPoints([land, rest]), new THREE.LineDashedMaterial({ color: hot ? col : lineCol, dashSize: 2, gapSize: 2 }));
    roll.computeLineDistances();
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.3, 28), new THREE.MeshBasicMaterial({ color: hot ? col : lineCol, side: THREE.DoubleSide, transparent: true, opacity: hot ? 0.9 : 0.4 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(off, 0.2, -total);
    [thin, tube, roll, ring].forEach((o) => this.scene.add(o));
    return { len, thin, tube, roll, ring };
  }

  private build(g: VizGroup, s: Shot): Flight {
    const hot = isHot(g, s), c = seriesColor(g.color);
    const raw = anchorFlight(s, simulateFlight(s));
    const pts = raw.map((p) => new THREE.Vector3(p.x, 0.6 + HEIGHT_X * p.y, -p.z));
    const land = pts[NP - 1].clone(); land.y = 0.6;
    const total = s.total_yd ?? s.carry_yd, off = s.offline_yd ?? 0;
    const rest = new THREE.Vector3(off, 0.6, -total);
    const m = this.meshes(pts, land, rest, off, total, parseInt(c.hex.slice(1), 16), c.line, hot, 0.7);
    return { g, s, hot, isAvg: false, label: `${g.short} #${s.shot_no}`, pts, land, rest, fd: (s.flight_s ?? 6) * 0.6, dir: new THREE.Vector3(0, 0, -1), ...m };
  }

  /** Build or reuse flights for these groups; groups not in the list are hidden. */
  setGroups(groups: VizGroup[]) {
    const keep = new Set(groups.map((g) => g.key));
    groups.forEach((g) => { if (!this.flights.has(g.key)) this.flights.set(g.key, live(g).map((s) => this.build(g, s))); });
    this.flights.forEach((fl, k) => { if (!keep.has(k)) fl.forEach((f) => { f.thin.visible = f.tube.visible = f.roll.visible = f.ring.visible = false; }); });
  }

  flightsOf(g: VizGroup) { return this.flights.get(g.key) ?? []; }
  all() { return [...this.flights.values()].flat(); }

  /** Point-by-point mean flight of a group (whole or best stretch), cached. */
  avgFlight(g: VizGroup, best: boolean, filter: (s: Shot) => boolean = () => true): Flight | null {
    const key = `${g.key}:${best}:${filter.toString()}`;
    const c = this.avgCache.get(key); if (c) return c;
    const fl = this.flightsOf(g).filter((f) => (!best || f.hot) && filter(f.s)); if (!fl.length) return null;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < NP; k++) { const p = new THREE.Vector3(); fl.forEach((f) => p.add(f.pts[k])); p.multiplyScalar(1 / fl.length); pts.push(p); }
    const n = fl.length, avg = (f: (q: Flight) => number) => fl.reduce((a, q) => a + f(q), 0) / n;
    const off = avg((q) => q.s.offline_yd ?? 0), total = avg((q) => q.s.total_yd ?? q.s.carry_yd);
    const land = pts[NP - 1].clone(); land.y = 0.6; const rest = new THREE.Vector3(off, 0.6, -total);
    const col = seriesColor(g.color);
    const m = this.meshes(pts, land, rest, off, total, parseInt(col.hex.slice(1), 16), col.line, true, 1.1);
    m.thin.visible = m.roll.visible = m.ring.visible = false;
    const s: Shot = { ...fl[0].s, shot_no: 0, carry_yd: avg((q) => q.s.carry_yd), total_yd: total, offline_yd: off,
      ball_speed_mph: avg((q) => q.s.ball_speed_mph ?? 0), launch_deg: avg((q) => q.s.launch_deg ?? 0), back_rpm: avg((q) => q.s.back_rpm ?? 0), side_rpm: avg((q) => q.s.side_rpm ?? 0),
      smash: +avg((q) => q.s.smash ?? 0).toFixed(2), path_deg: avg((q) => q.s.path_deg ?? 0), face_to_target_deg: avg((q) => q.s.face_to_target_deg ?? 0),
      vert_strike_mm: fl.some((q) => q.s.vert_strike_mm != null) ? avg((q) => q.s.vert_strike_mm ?? 0) : null, horiz_strike_mm: avg((q) => q.s.horiz_strike_mm ?? 0) };
    const f: Flight = { g, s, hot: true, isAvg: true, label: `${g.short} ${best ? "best" : "all"} avg (${n})`, pts, land, rest, fd: avg((q) => q.fd), dir: new THREE.Vector3(0, 0, -1), ...m };
    this.avgCache.set(key, f); return f;
  }

  /** 1σ landing ellipse meshes for a group scope, cached. */
  ellipse(g: VizGroup, best: boolean, filter: (s: Shot) => boolean = () => true): EllipseMeshes | null {
    const key = `${g.key}:${best}:${filter.toString()}`;
    if (this.ellCache.has(key)) return this.ellCache.get(key)!;
    const rows = live(g, best).filter((s) => filter(s) && s.offline_yd != null);
    const e = ellipse2(rows.map((s) => [s.offline_yd as number, s.total_yd ?? s.carry_yd]));
    if (!e) { this.ellCache.set(key, null); return null; }
    const col = parseInt(seriesColor(g.color).hex.slice(1), 16);
    const shape = new THREE.Shape().absellipse(e.cx, e.cy, e.a, e.b, 0, Math.PI * 2, false, e.angle);
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: best ? 0.22 : 0.1, depthWrite: false, side: THREE.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = best ? 0.13 : 0.12;
    const pts = new THREE.EllipseCurve(e.cx, e.cy, e.a, e.b, 0, Math.PI * 2, false, e.angle).getPoints(72).map((p) => new THREE.Vector3(p.x, 0.14, -p.y));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), best ? new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }) : new THREE.LineDashedMaterial({ color: col, transparent: true, opacity: 0.7, dashSize: 3, gapSize: 3 }));
    if (!best) line.computeLineDistances();
    const mark = new THREE.Mesh(new THREE.RingGeometry(best ? 1.6 : 1.2, best ? 2.8 : 1.9, 24), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: best ? 1 : 0.7 }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(e.cx, 0.18, -e.cy);
    const cross = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.cx - 4, 0.18, -e.cy), new THREE.Vector3(e.cx + 4, 0.18, -e.cy), new THREE.Vector3(e.cx, 0.18, -e.cy - 4), new THREE.Vector3(e.cx, 0.18, -e.cy + 4)]), new THREE.LineBasicMaterial({ color: col }));
    const o = { fill, line, mark, cross, a: e.a, b: e.b, best };
    [fill, line, mark, cross].forEach((m) => { m.visible = false; this.scene.add(m); });
    this.ellCache.set(key, o); return o;
  }

  /** Show exactly these ellipses. */
  showEllipses(list: Array<{ g: VizGroup; best: boolean; filter?: (s: Shot) => boolean }>) {
    this.ellCache.forEach((e) => { if (e) [e.fill, e.line, e.mark, e.cross].forEach((m) => (m.visible = false)); });
    list.forEach(({ g, best, filter }) => { const e = this.ellipse(g, best, filter); if (e) [e.fill, e.line, e.mark, e.cross].forEach((m) => (m.visible = true)); });
  }

  /** Which non-running flights draw their thin trail and landing ring. */
  setTrailPredicate(p: (f: Flight) => boolean) { this.trailPred = p; }

  play(list: Flight[]) {
    this.all().forEach((f) => (f.tube.visible = false));
    this.avgCache.forEach((a) => { a.tube.visible = a.roll.visible = a.ring.visible = false; });
    this.runners = list; this.tau = 0;
    list.forEach((R) => R.tube.geometry.setDrawRange(0, 0));
  }

  /** Advance the animation; returns true when every runner has finished its hold. */
  tick(dt: number): boolean {
    this.tau += dt; let done = true;
    this.all().forEach((f) => {
      const v = !this.runners.includes(f) && this.trailPred(f) && !this.dispOnly;
      f.thin.visible = v && this.showTrails; f.roll.visible = v && this.showTrails; f.ring.visible = v;
    });
    this.balls.forEach((b, i) => (b.visible = i < this.runners.length));
    this.runners.forEach((R, i) => {
      const b = this.balls[i]; if (!b) return;
      (b.children[0] as THREE.Mesh & { material: THREE.MeshBasicMaterial }).material.color.setHex(parseInt(seriesColor(R.g.color).hex.slice(1), 16));
      b.children[0].visible = R.hot; R.tube.visible = true; R.ring.visible = true;
      const ft = this.tau - IMPACT;
      if (ft < 0) { b.position.set(0, 0.6, 0); R.tube.geometry.setDrawRange(0, 0); R.roll.visible = false; R.dir.set(0, 0, -1); done = false; }
      else if (ft < R.fd) {
        const f = (ft / R.fd) * (NP - 1), k = Math.floor(f), k2 = Math.min(k + 1, NP - 1);
        b.position.lerpVectors(R.pts[k], R.pts[k2], f - k); R.dir.subVectors(R.pts[k2], R.pts[k]).setY(0).normalize();
        const L = R.len[k] + (R.len[k2] - R.len[k]) * (f - k);
        R.tube.geometry.setDrawRange(0, Math.floor((L / R.len[NP - 1]) * 100) * 48); R.roll.visible = false; done = false;
      } else {
        R.tube.geometry.setDrawRange(0, 4800);
        const q = Math.min((ft - R.fd) / ROLL, 1), e = 1 - Math.pow(1 - q, 3);
        b.position.lerpVectors(R.land, R.rest, e); R.dir.subVectors(R.rest, R.land).setY(0).normalize(); R.roll.visible = true;
        if (ft < R.fd + ROLL + HOLD) done = false;
      }
    });
    this.cameraStep(dt);
    this.renderer.render(this.scene, this.camera);
    return done && this.runners.length > 0;
  }

  setCamera(v: CameraPreset) { this.camMode = v; this.orbit = false; this.el.classList.remove("orbit"); }
  setOrbit(on: boolean) {
    this.orbit = on; this.el.classList.toggle("orbit", on);
    if (on) {
      const v = new THREE.Vector3().subVectors(this.cam.pos, this.cam.look);
      this.sph.r = v.length(); this.sph.ph = Math.acos(Math.min(1, Math.max(-1, v.y / this.sph.r))); this.sph.th = Math.atan2(v.x, v.z);
      this.tgt.look.copy(this.cam.look); this.tgt.up.set(0, 1, 0);
    } else if (this.camMode === "chase") this.camMode = "broadcast";
  }

  private cameraStep(dt: number) {
    const { tgt, cam, sph } = this; let k: number;
    if (this.orbit) {
      tgt.pos.set(tgt.look.x + sph.r * Math.sin(sph.ph) * Math.sin(sph.th), tgt.look.y + sph.r * Math.cos(sph.ph), tgt.look.z + sph.r * Math.sin(sph.ph) * Math.cos(sph.th));
      k = this.drag ? 1 : 1 - Math.exp(-dt * 8);
    } else if (this.camMode === "chase") {
      const b = this.balls[0].position, d = this.runners[0]?.dir ?? new THREE.Vector3(0, 0, -1);
      tgt.pos.set(b.x - d.x * 32, b.y * 0.7 + 9, b.z - d.z * 32); tgt.look.set(b.x + d.x * 40, Math.max(b.y * 0.5, 2), b.z + d.z * 40); tgt.up.set(0, 1, 0);
      k = 1 - Math.exp(-dt * 3.5);
    } else {
      const P = PRESETS[this.camMode];
      tgt.pos.set(P.pos![0], P.pos![1], P.pos![2]); tgt.look.set(P.look![0], P.look![1], P.look![2]); const u = P.up ?? [0, 1, 0]; tgt.up.set(u[0], u[1], u[2]);
      k = 1 - Math.exp(-dt * 4);
    }
    cam.pos.lerp(tgt.pos, k); cam.look.lerp(tgt.look, k); cam.up.lerp(tgt.up, k).normalize();
    this.camera.position.copy(cam.pos); this.camera.up.copy(cam.up); this.camera.lookAt(cam.look);
  }

  dispose() { this.renderer.dispose(); this.renderer.domElement.remove(); }
}
