# music.bran.name

A single-page web app that plays algorithmically generated ambient / drone
"focus music" indefinitely, entirely client-side. No backend, no network calls
at runtime, no AI-generated audio — pure algorithmic composition driven by a
browser synthesis engine.

**Live:** https://music.bran.name  
**Aesthetic target:** rhythmless / near-rhythmless ambient-drone — sustained,
slowly-detuning layered tones; long reverberant tails; slow-moving harmony; a
quiet noisy/textural atmosphere bed; sparse melodic/percussive events emerging
from the texture. High production quality, not generic new-age.

## What's decided (read this before changing anything)

These are settled decisions, not options. Rationale lives in
[`docs/architecture.md`](docs/architecture.md). Don't relitigate them inside a
feature branch.

- **Engine:** Strudel's core packages — `@strudel/core` (pattern language) +
  `@strudel/webaudio` + `superdough` (Web Audio synth/sampler/FX). Use the
  `@strudel/*` namespace, **not** the deprecated `@strudel.cycles/*` one. Not the
  `@strudel/embed` iframe. Not TidalCycles-via-WASM.
- **Synthesis only, no samples in v1.** Sources are superdough's oscillators and
  noise generators. This means **zero external audio assets** and a trivially
  offline site.
- **Build:** Vite. Output to `dist/`. `docs/` is documentation and is never
  served.
- **Hosting:** GitHub Pages serving the `gh-pages` branch, published from a local
  one-command deploy. No GitHub Actions, no CI/CD.
- **License:** AGPL-3.0 (Strudel is AGPL; this app is a derivative). Repo is
  public; source stays available.

## Stack

- [Strudel](https://strudel.cc) core packages — TidalCycles' pattern language
  ported to JS, plus the `superdough` Web Audio engine.
- [Vite](https://vitejs.dev) — bundling and dev server.
- Vanilla JS + a single HTML page. No framework.

## Quick start

Requires Node 18+ and npm. Commands assume macOS / bash.

```bash
npm install          # install deps
npm run dev          # local dev server with HMR
npm run build        # production build -> dist/
npm run preview      # serve the built dist/ locally to sanity-check
npm run deploy       # build + publish dist/ to the gh-pages branch
```

## Repository layout

```
.
├── index.html               # single page: one play/pause button + mount point
├── styles.css
├── package.json
├── vite.config.js           # base:'/', build.outDir:'dist'
├── public/
│   └── CNAME                # "music.bran.name"; Vite copies it into dist/
├── src/
│   ├── main.js              # app entry: wires UI <-> engine
│   ├── engine.js            # audio lifecycle (the ONLY superdough import site)
│   ├── generator.js         # buildPattern(params, rng) -> Strudel pattern (pure)
│   ├── params.js            # parameter schema + defaults (single source of truth)
│   ├── rng.js               # seeded PRNG + cycle/time modulation helpers
│   └── ui/
│       └── transport.js     # play/pause button (future controls panel lands here)
├── docs/
│   ├── architecture.md      # decisions, layers, data flow, invariants
│   └── backlog.md           # numbered, handoff-ready work items
└── readme.md
```

## Hard constraints (must always hold)

- **Offline.** Once loaded, the page makes no network requests. Verify in the
  DevTools Network tab with the network throttled to "Offline".
- **Runs forever.** A listener should not perceive repetition across 12+ hours of
  continuous playback. See the non-repetition strategy in
  [`docs/architecture.md`](docs/architecture.md).
- **One UI affordance in v1:** a single play/pause button. The architecture must
  let parameter controls be added later without touching engine or generator
  internals.

## Where to start

- Picking up a task? Read [`docs/architecture.md`](docs/architecture.md) for the
  layer boundaries and invariants you must respect, then find your work item in
  [`docs/backlog.md`](docs/backlog.md).
- The dependency order is in the backlog: items 1–3 are foundational and come
  first; 4–8 are the parallelizable musical core; 9 can start any time; 10–12 are
  later/finishing.

## License

AGPL-3.0. Because this app links Strudel (AGPL-3.0), the whole app is a derivative
work and must be distributed under AGPL-3.0 with source available. Keep the repo
public and include the full `LICENSE` file.
