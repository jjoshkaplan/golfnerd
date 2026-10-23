# golfnerds build log, Sep 24 to Oct 23, 2026

What was built, how, and why, from the first photo of a sim screen to a deployed app with a public demo. Companion to `roadmap.md` (the plan) and `driver-progress-oct-2026.md` (the swing and equipment findings).

## 1. Timeline

| Date | What happened |
|---|---|
| Sep 24 | First session screens (Qi4D Max 10.5, 60 g stiff shaft). Transcribed 20 drives, first charts, offline axis flipped so right is right. Coach summary written. |
| Oct 6 | R9 session, 34 drives. Found the 23-27 stretch (low pendulum takeaway). First 3D flight plot, then the physics-based replay with impact panels. |
| Oct 9 | R9 session, 42 drives (trail-shoulder drop). Dashboard published as a shareable artifact. Fitting and driver-family discussion (Qi4D Max chosen as the head to test). |
| Oct 13 | R9 session, 21 drives. Split inferred at shot 13 (7 irons in the middle, higher tee after). Camera rig, head-to-head, landing-area view added. Roadmap written and exported to the project; repo and schema scaffolded. |
| Oct 15 | Two Qi4D sessions with a shorter shaft (17 and 32 drives). Horizontal-spread chart and path/face chart added. Shaft discussion (Ventus Blue 6-S class; skip Ventus Black and Cypher 50). |
| Oct 21 | Two R9 sessions (24 cold warm-up drives, then 31 after 9 sim holes). Best full session yet. Decision: regrip standard size first, leave length. |
| Oct 22 | Tabbed layout with mobile breakpoints. Comprehensive progress review saved to the project. Upload/review/save flow and session detail page added to the repo. |
| Oct 23 | Dashboard revisions (sections 4 and 5). Full port into the Next.js app. GitHub repo, Vercel deployment, Supabase connected, schema migrated, magic-link sign-in working, `/demo` public. |

## 2. Data

### Source
Every drive came from photos of the simulator's "Shot history" screens (Uneekor-style layout). Each session was transcribed by a small Python script (`oct9.py`, `oct13.py`, `oct15.py`, `oct15pm.py`, `oct21.py`) into compact arrays, cross-checked against the screen totals, then appended to `data.js`.

Shots are 18-field rows, index order: carry, total, offline (+ right), apex, side angle, flight seconds, ball speed, launch, backspin, sidespin (+ fade), smash, vertical face impact (mm, + high), horizontal face impact (mm, sign as the sim reports it), club path (+ in-to-out), face to target (+ open), attack angle (+ up), dynamic loft, club speed. Null where the screen did not capture a value: Sep 24 and Oct 9 have no strike location, attack angle or dynamic loft; Oct 15 am shot 6 and Oct 15 pm shots 6 and 20 are club-data misreads and are excluded from club averages.

### The eight sessions (221 drives)

| Key | Session | Drives | Best stretch | Cue |
|---|---|---|---|---|
| Q | Qi4D · Sep 24 | 20 | 15-20 | Push draw from GolfTec setup changes |
| R | R9 · Oct 6 | 34 | 23-27 | Low takeaway, after 9 sim holes |
| B | R9 · Oct 9 | 42 | 33-40 | Dropped the trail shoulder for a push draw |
| D | R9 · Oct 13 | 21 | 14-21 | 85-90% swing; higher tee locked in after a 7 iron break |
| E | Qi4D · Oct 15 am | 17 | 14-17 | Trail-shoulder dip, shorter shaft, compact swing |
| F | Qi4D · Oct 15 pm | 32 | 10-14 | Same move and shaft, after 18 sim holes |
| G | R9 · Oct 21 warm-up | 24 | 10-13 | Cold warm-up before 9 sim holes |
| H | R9 · Oct 21 | 31 | 14-20 | After 9 sim holes: centered strike, spin in the window |

"Best stretch" is a user-tagged shot range with the swing cue that produced it. It is the unit of comparison throughout and the one idea no competing product has.

### Corrections made along the way
- An early claim that the Sep 24 club columns looked row-shifted was wrong; the data was valid.
- A 23-27 carry figure was misstated as 231; the actual average is 226.
- Oct 13: the 7 irons came mid-session (split after shot 13), not at the end.
- Oct 21: both batches were the R9, relabeled from "Driver (TBC)".
- Session order was rebuilt chronologically after Oct 15 am was inserted out of order.

## 3. Analysis findings (cross-session)

Computed in `insights.js` over the 218 drives with club data.

- **Direction is the face, not the path.** Offline distance correlates 0.81 with face angle and 0.23 with path. Path varies about 1° swing to swing; the face varies 2-3.5°. Each degree of face-to-path moves the finish about 8 yards. 68 of the 81 drives that missed by more than 30 yards went right.
- **Spin follows delivered loft.** Backspin tracks spin loft (dynamic loft minus attack angle) at about 190 rpm per degree. Strike height adds about 36 rpm per mm. The R9 sessions delivered 18-20° of dynamic loft; the Qi4D short-shaft sessions delivered 10-16°, which produced the sub-2,000 rpm drives that cost carry.
- **Strike and smash.** Smash falls about 0.0027 per mm of horizontal miss. Oct 15 am: six drives 32-51 mm off center averaged 1.30 smash and 174 carry; the ten within 25 mm averaged 1.43 and 207.
- **Warm-up effect.** Oct 21 cold: 12 mm low, 3,500 rpm, 22 yards right, 21% in a 30-yard fairway. Same club and swing after 9 holes: strike within 1 mm of center, 2,530 rpm, 1 yard right, 226/246.
- **Fatigue effect.** Oct 15 pm shots 1-13 averaged 222 carry; shots 20-32 averaged 179, after 18 sim holes.
- **The R9 is not the limiter.** Its best stretches (Oct 9 33-40: 149 mph ball, 1.47 smash, 241/259; Oct 21 14-20: 235/251) match or beat the Qi4D's.

Equipment conclusions (details in `driver-progress-oct-2026.md`): regrip the R9 to a standard size first and leave the length; at the fitting test the Qi4D Max against the standard head at 12°, about 44.5", with a 60 g stiff mid-launch shaft in the Ventus Blue 6-S class; avoid Ventus Black and the Cypher 50; the Max is preferred over the standard, LS and Max Lite for this pattern.

## 4. The prototype dashboard (claude.ai artifact, 21 versions)

A single HTML file: `replay-template.html` with a `/*DATA*/` placeholder plus `data.js`, built into `driver-flight-replay.html`. three.js r128 from cdnjs, Google fonts (Barlow Condensed, IBM Plex Sans and Mono), no other dependencies.

### Physics
Flights are simulated from ball speed, launch, side angle, backspin and sidespin: drag plus Magnus lift with spin decay (Cd = 0.21 + 0.25 S, Cl clamped at 0.32, spin decays with a 22 s time constant), semi-implicit Euler at 5 ms, resampled to 120 points. Each flight is then anchored to the shot's measured carry, apex and finish, so the shape is physical and the endpoints are the sim's. Height is drawn at 1.5x. Average flights are the point-by-point mean of a group's simulated flights.

### Features, in the order they were added
1. 3D flights with landing rings and roll lines, ball animation with impact delay, roll and hold.
2. Strike-on-face panel (ellipse face, grooves, 10 and 20 mm rings, group dots, flash at impact) and path & face delivery panel (top view, angles at 3x, clubhead swings through impact, ball starts on the side angle).
3. Camera rig: broadcast, chase, down range, landing area, top, side, free orbit with lerped transitions.
4. Modes: replay (best stretches or every shot, auto-advance), ghost race (the most typical best-stretch drive from each session, chosen by |carry − mean| + |offline − mean|), head-to-head (two groups' average flights with both dispersion ellipses and a metric table), landing-area spray (ellipses only).
5. Dispersion ellipses: one standard deviation of finishing positions from the 2x2 covariance eigen-decomposition; dashed for whole sessions, solid for best stretches.
6. Filters: all, centered strikes (±5 mm), draw spin, fade spin, attack angle ≥ 5°, thin (launch ≤ 6°). Fairway width 20-50 yards with hit-rate chips.
7. Trends: six per-session charts (carry, smash, average miss, vertical strike, horizontal strike spread, path and face with face-to-path labels), filled points for best stretches and hollow for whole sessions, staggered labels when crowded.
8. Compare: head-to-head table with zero-aware diffs, and the all-sessions table with a sticky first column.
9. Tabs (Replay, Compare, Trends, Dispersion, Notes) with hash deep-links, sticky tab bar, mobile breakpoints at 900, 700 and 560 px.

### Oct 23 revisions (user feedback, all implemented)
- Horizontal scrolling button rows replaced by dropdown + switch rows: Mode (+ Auto-advance), Session (+ Best stretches only), Shot (◀ dropdown ▶), Filter (+ panel switches); flight-only options (Camera + Free orbit, Ground + Show fairway, Groups for head-to-head, Show: Dispersion 1σ, Dispersion only, Other shots) moved below the 3D view.
- Panes in swing order: path & face and strike on face side by side above the flight view, which is full width and about half the viewport tall. Face and delivery drawings scale with the pane.
- Ghost race legend compacted to a two-column grid.
- Session picker became a checklist dropdown (any combination, with All / None / R9 only / Qi4D only), shared by the Replay and Dispersion tabs.
- Dispersion-only switch hides other shots' trails and rings but keeps the live flight.
- Strike map replaced by a Dispersion tab: landing map (offline vs total or carry, fairway band, dashed and solid ellipses, mean crosses) beside the strike map, hover tooltip on every dot with the shot's full line, per-session chips below the landing map.
- Trends: horizontally scrolling, clickable session cards with carry change versus the previous session; clicking highlights the session in every chart and opens a best / whole / previous / diff table with "Open in replay".
- Notes: a "Where things stand" status row (best session, direction, strike, spin, equipment, next session) and a session-by-session timeline with "Open in replay" buttons.
- Dark and light themes with a sun/moon slider switch, persisted in localStorage; canvases and the three.js scene take a palette object because they cannot read CSS variables.

### Testing
cdnjs and npm are unreachable from the build container, so the page was tested with Playwright against a hand-written three.js stub (`test/three-stub.js`): click-throughs of every tab, mode, dropdown and switch at 1200 and 390 px, checks for page errors and horizontal overflow, hover-tooltip hits, light-theme screenshots and theme persistence. Bugs caught this way: ball pool too small when sessions grew (raised to 8), negative face radius on hidden canvases (scale clamped), a legend overlapping the landing map (moved to chips), the shot dropdown not matching the first shot (fill order).

## 5. The app (github.com/jjoshkaplan/golfnerd, live at golfnerd.vercel.app)

### Stack
Next.js 15 App Router with TypeScript, React 19, three.js, zod, papaparse; Supabase for Postgres, magic-link auth, row-level security and upload storage; Vercel for hosting with the Supabase integration.

### Schema (`supabase/migrations/0001_init.sql`)
`profiles` (one per auth user, created by trigger), `clubs` (the bag), `sessions` (one upload: club, date, device, source, notes, shot count), `shots` (the 18 fields plus the raw import row and an `excluded` flag), `stretches` (tagged shot ranges with cue and `is_best`), `imports` (the uploaded file), a `session_summary` view for cards, a `face_to_path` SQL function, RLS policies so users only see their own rows, and an `imports` storage bucket.

### Code layout
- `src/lib/schema.ts`: the zod ShotSchema (18 fields, sign conventions documented), StretchSchema, device list.
- `src/lib/adapters/`: Adapter interface, CSV parsing, a Uneekor adapter with guessed column names (to be replaced from a real export), registry.
- `src/lib/physics.ts`: `simulateFlight` and `anchorFlight`, the same model as the prototype.
- `src/lib/stats.ts`: group stats, `ellipse2` (generic 1σ ellipse), `dispersionEllipse`, `shotsInRange`.
- `src/lib/viz/`: framework-free port of the dashboard. `theme.ts` (palettes, series colors, text helpers), `groups.ts` (VizGroup model, filters, metrics, tooltip text), `face.ts` (face base, strike map, strike panel), `delivery.ts`, `landing.ts`, `trends.ts`, `replay.ts` (the three.js ReplayScene class: flights, average flights, ellipses, runners, camera rig), `build.ts` (sessions → VizGroups), `themeBoot.ts`.
- `src/components/viz/`: `Dashboard` (tabs and all control state), `ReplayStage` (the three panes on one animation loop), `Canvas2D` (resize, DPR, theme, hover tooltips), `SessionPicker`, `SessionsDashboard` (client-side group building so dates format in the viewer's zone).
- `src/components/theme.tsx`: `useTheme` hook (MutationObserver on `html[data-theme]`), `ThemeToggle`, `Toggle`.
- `src/app/`: `/` landing, `/demo` (seed sessions, no sign-in), `/login` (magic link with visible errors), `/auth/callback` (exchanges the code for a session cookie), `/sessions` and `/sessions/[id]` (summary, embedded dashboard, stretches with stats, stretch form, shot table with exclusion), `/upload` (parse CSV, review table with include checkboxes, metadata, live stats, save), `/compare` (all sessions in the dashboard), server actions for save/stretch/exclude.
- `src/middleware.ts`: refreshes the Supabase session and gates `/sessions`, `/upload`, `/compare`; skips when Supabase isn't configured so the demo works with no env.
- `data/seed/sessions.json` + `scripts/seed.ts`: the eight sessions, loadable into Supabase for one user.
- `prototype/`: the frozen single-file dashboard, data, build script and smoke tests.

### Deployment issues hit and fixed
- GitHub could not be linked from the build session, so the repo was delivered as a zip and pushed from the laptop; the dotfiles (`.gitignore`, `.env.example`) were recreated by hand.
- `@supabase/ssr` cookie callbacks needed explicit types on the installed version.
- The middleware crashed every route when no env existed, then looped on `/demo` because Next ignores a non-literal `config.matcher` (the Vercel log said so: "Unsupported node type CallExpression"). Fixed with a literal matcher and a demo bail-out.
- Next 15.3.3 was flagged for CVE-2025-66478; Vercel's bot PR bumped it to a patched version.
- Magic links landed on `/sessions` without exchanging the auth code; added `/auth/callback` and the Supabase URL configuration (Site URL and Redirect URLs for the Vercel domain and localhost).
- The migration was pasted as a path instead of its contents the first time.

## 6. Decisions worth remembering
- v1 is "upload your launch monitor sessions and see what actually changed between them." The AI caddy is a separate product and parked.
- Best-stretch tagging with a cue is the unit of comparison and the differentiator.
- Web app first; a phone app can wrap it later.
- Physics runs in the browser; the simulation is a standard approximation anchored to measured endpoints, never presented as the sim's own model.
- Horizontal strike is shown as + / − because the sim's toe/heel convention was not confirmed.
- Dashed = whole session, solid = best stretch, everywhere an ellipse appears.
- Notes in the app will be user-written per session rather than hard-coded, which is why the prototype's Notes tab was not ported.

## 7. Open items
1. Seed the live database with the eight sessions.
2. Real CSV export from the sim; rewrite the Uneekor adapter headers; confirm strike location is in the export.
3. Notes per session and a status panel in the app.
4. Coach summary export (shareable link or PDF).
5. Screenshot import with a vision model and a review step.
6. Name and domain (Looper / Loopr candidates), then a landing page.
7. Beta: the GolfTec coach first, then 5-10 golfers; measure second uploads.
