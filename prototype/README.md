# Prototype

The standalone dashboard the app is ported from. One HTML file, no build step.

- `replay-template.html` — page source with a `/*DATA*/` placeholder
- `data.js` — the eight driver sessions as compact arrays (see the `r:` index comment in the template)
- `driver-flight-replay.html` — the built page (template + data), published as a Claude artifact

Build: `node build.mjs` (splices `data.js` into the template and syntax-checks the script).

Smoke tests (`test/`): Playwright click-throughs against a stub `three` (cdnjs is blocked in the
build container), checking every tab, mode, dropdown and toggle for page errors and overflow,
plus hover tooltips and the light theme. Run with `node test/run3.mjs` from `prototype/` after
building `test/page.html` with the stub script tag (see `build.mjs`).

Everything here is frozen; new work goes in `src/lib/viz` and `src/components/viz`.
