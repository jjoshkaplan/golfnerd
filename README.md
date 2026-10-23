# golfnerds

Upload your launch monitor sessions and see what actually changed between them.

Working name. See `docs/roadmap.md` for the plan.

## Stack

- Next.js 15 (App Router, TypeScript) on Vercel
- Supabase: Postgres, auth (magic link), storage for uploads
- three.js for the 3D replay (ported from the prototype in a later step)
- Flight physics and stats run in the browser (`src/lib/physics.ts`, `src/lib/stats.ts`)

## Layout

```
supabase/migrations/0001_init.sql   schema, views, row-level security
src/lib/schema.ts                   the common 18-field shot schema (zod)
src/lib/adapters/                   one adapter per launch monitor (CSV -> schema)
src/lib/physics.ts                  ball flight simulation and anchoring
src/lib/stats.ts                    group stats, dispersion ellipse
src/lib/viz/                        the dashboard, framework-free: theme palettes, group model,
                                    face/strike, delivery, landing map, trends (canvas) and the
                                    three.js replay scene
src/components/viz/                 React wrappers: Dashboard (tabs + controls), ReplayStage,
                                    Canvas2D (resize, theme, hover tooltips), SessionPicker
src/components/theme.tsx            theme hook and the sun/moon switch
src/lib/supabase/                   browser and server clients
src/app/                            pages: /, /demo, /login, /sessions, /sessions/[id], /upload, /compare
data/seed/sessions.json             the eight prototype sessions (221 drives); also powers /demo
scripts/seed.ts                     loads the seed into Supabase for one user
prototype/                          the frozen single-file dashboard the app was ported from
```

## Dashboard

`/demo` renders the seed sessions with no sign-in; `/compare` renders the signed-in user's sessions;
`/sessions/[id]` embeds the same dashboard for one session. Three tabs:

- **Replay**: path & face through impact, strike on the face, then the 3D flight. Modes: best
  stretches, every shot, ghost race (one typical drive per session), head-to-head (average flights
  of two groups, with a metric table), and landing-area spray (1σ ellipses only). Camera presets,
  free orbit, fairway width, dispersion and dispersion-only switches, checklist session picker.
- **Dispersion**: landing map (offline vs carry or total, dashed whole-session and solid
  best-stretch ellipses) beside the strike map, with hover tooltips for every shot.
- **Trends**: scrollable, clickable session cards with a detail table against the previous
  session, and six per-session charts.

Dark and light themes; the switch in the header persists in localStorage. Canvases and the 3D
scene take a `Theme` object from `src/lib/viz/theme.ts` because they cannot read CSS variables.

## Setup

1. **Install**
   ```
   npm install
   ```
2. **Supabase**: create a project at supabase.com, then open the SQL editor and run
   `supabase/migrations/0001_init.sql`. In Authentication settings, enable Email with magic links.
3. **Env**: copy `.env.example` to `.env.local` and fill in the URL, anon key and service role key
   from Project settings -> API.
4. **Run**
   ```
   npm run dev
   ```
   Sign in once at http://localhost:3000/login so your profile row exists.
5. **Seed the prototype sessions** (optional)
   ```
   npm run seed -- you@example.com
   ```
6. **Deploy**: import the GitHub repo in Vercel and add the two `NEXT_PUBLIC_*` env vars.

## Data model

- `clubs`: the bag. A session is hit with one club.
- `sessions`: one upload, one club, one date, free-text notes ("after 9 sim holes").
- `shots`: the 18 common fields plus the raw imported row. `excluded` drops a shot from averages.
- `stretches`: a tagged shot range inside a session with the swing cue that produced it.
  This is the unit of comparison.
- `imports`: the uploaded file behind a session, so it can be re-parsed.
- `session_summary` view: the numbers the cards and trend charts read.

Sign conventions are documented at the top of `src/lib/schema.ts`.

## Adding a launch monitor

Copy `src/lib/adapters/uneekor.ts`, fill in `columns` with the device's CSV headers, add a
`detect` test, and register it in `src/lib/adapters/registry.ts`. The `transform` hook handles
unit conversions and sign flips.

## Next

- Replace the guessed Uneekor column names with headers from a real CSV export.
- Run `npm run typecheck` and `npm run build` after `npm install` (the port was written without
  node_modules; the pure modules under `src/lib` typecheck against a three.js shim).
- Notes: per-session findings and a status panel, written by the user, stored with the session.
- Screenshot import via a vision model with a review step.
- Deploy `/demo` publicly on Vercel; gate everything else behind sign-in.
