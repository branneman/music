# Architecture

This document is the source of truth for how the app is built and why. It is
written for future agents picking up isolated work items. Respect the decisions
and invariants here; if you believe one is wrong, raise it explicitly rather than
quietly diverging inside a feature branch.

The app generates ambient/drone focus music in the browser, forever, with no
network at runtime. The whole design exists to serve three hard constraints:
**100% client-side and offline**, **perceptually non-repeating over 12+ hours**,
and **extensible to "more/less of X" controls later without a rewrite**.

---

## 1. Decisions

These were open questions during evaluation. They are now closed.

### D1 — Engine: Strudel core packages

Use `@strudel/core` (the TidalCycles pattern language ported to JS) together with
`@strudel/webaudio` and its underlying `superdough` engine (the Web Audio
synth / sampler / FX). This gives us the pattern language _and_ a capable
browser synthesis layer in one coherent JS stack.

- Use the **`@strudel/*`** npm namespace. The older `@strudel.cycles/*` namespace
  is deprecated — do not introduce it.
- Do **not** use `@strudel/embed`. It loads strudel.cc in an iframe, which
  conflicts with the offline / self-hosted requirement.
- Do **not** pursue TidalCycles-via-WASM. See §7 for the full reasoning; in short,
  Tidal is a Haskell pattern DSL that emits OSC to a separate SuperCollider-based
  audio engine. Compiling the pattern half to WASM is a research project, and the
  audio half you'd then have to build in the browser is functionally what
  `superdough` already is. Choosing Strudel is choosing the finished version of
  that path.

`superdough` covers the full palette we need: oscillators (sine/saw/square/
triangle), noise (white/pink/brown) and crackle, FM synthesis with per-operator
envelopes, filters with envelopes, parametric convolution reverb (`room`/`size`/
`fade`), delay, phaser, and granular sample playback. We drive all of it
algorithmically.

### D2 — Synthesis only, no samples in v1

All sound comes from `superdough`'s oscillators and noise generators. No sample
files ship with v1. Consequences:

- **Zero external audio assets**, so the offline requirement is satisfied by
  construction — there is nothing to fetch.
- Samples are a _possible_ future extension (vendored locally, never from a CDN),
  but they are out of scope until explicitly reopened. Do not add a CDN sample
  dependency under any circumstances.

### D3 — Build with Vite; `dist/` is the artifact, `docs/` is documentation

Strudel's packages assume ESM bundling, so a bundler is required, not optional.
Vite is the bundler.

- Build output goes to `dist/`.
- `docs/` holds human/agent documentation (this file, the backlog) and is **never
  served** as web content.
- `vite.config.js` sets `base: '/'` (the site is served at the apex of the custom
  domain) and `build.outDir: 'dist'`.

Build tooling stops at Vite. There is no test runner, no linter pipeline, no CI.

### D4 — Hosting via the `gh-pages` branch, deployed locally

GitHub Pages serves the **`gh-pages`** branch. Publishing is a single local
command (`npm run deploy`, which runs `vite build` then publishes `dist/` to the
branch). There is no GitHub Actions workflow.

- `public/CNAME` contains `music.bran.name`; Vite copies it into `dist/`, so the
  published branch root carries the custom-domain file.
- `main` stays clean — no build output is committed to it.

This keeps deployment to one command while honoring "no CI/CD" and keeping `docs/`
free for documentation.

### D5 — Layered architecture with one-directional data flow

The codebase is four layers (§2) with a single data-flow direction (§3). This is
the decision that makes the future controls panel a drop-in rather than a rewrite,
and it is the most important structural invariant in the project.

### D6 — Determinism via a seeded, cycle-driven PRNG

Randomness comes from a seeded PRNG whose stream is a function of cycle number
(see `src/rng.js`). This gives reproducibility (same seed → same piece, useful for
debugging and for the fast-forward test harness) while still evolving continuously
over time. Never call `Math.random()` in the generator.

---

## 2. Layers

Four layers. Each has one job and a strict boundary. The import rules below are
invariants, not style preferences.

### Transport / UI — `src/ui/transport.js`, `src/main.js`

Owns the DOM and the play/pause button. Knows nothing about music or audio
internals. It calls `engine.start()` / `engine.stop()` and (later) writes to the
params store. It must gesture-gate audio: browsers require a user interaction
before an `AudioContext` can produce sound, so the first click both starts the
context and starts playback.

The future controls panel is added **here** and is only allowed to write to the
params store.

### Engine — `src/engine.js`

The audio lifecycle. This is the **only** file permitted to import
`@strudel/webaudio` / `superdough`. It wraps Strudel's scheduler and exposes a
tiny, stable surface:

```js
engine.start() // resume context, start scheduler
engine.stop() // stop scheduler
engine.setPattern(pattern) // swap the playing pattern at the next cycle boundary
```

Because every audio-engine concern is funneled through this file, swapping or
upgrading the synthesis layer later touches `engine.js` and nothing else.

### Generator — `src/generator.js`

Pure composition. Exposes:

```js
buildPattern(params, rng) -> Pattern
```

No audio, no DOM, no module-level mutable state, no `Math.random()`. Given the
same `params` and `rng` seed it returns the same Strudel pattern. All musical
intelligence and all long-horizon variation logic (§5) live here. This purity is
what makes the generator testable by ear via the fast-forward harness and safe to
reason about in isolation.

### Params — `src/params.js`

A plain object / tiny observable store holding the knobs and their defaults — the
single source of truth for everything tunable: drone density, harmonic-movement
rate, reverb size, noise-bed level, event sparsity, detune spread, register, etc.
The generator reads it; the UI/controls panel writes it. Decoupling params from
_both_ the generator and the UI is precisely what lets controls be added without
touching either.

---

## 3. Data flow

One direction only:

```
UI ──writes──> params ──read by──> generator ──produces──> pattern ──> engine ──> sound
```

Two interaction paths, kept strictly separate:

- **Play / pause** touches _only_ the engine. It never rebuilds a pattern.
- **A parameter change** touches _only_ the params store, then asks the app to
  rebuild: `engine.setPattern(buildPattern(params, rng))`. The engine swaps the
  pattern at the next cycle boundary.

In v1 the pattern swap on a param change is an abrupt boundary swap (acceptable
for slow drones). A crossfade-on-swap is a deliberately deferred enhancement
(backlog item 10), not part of v1.

---

## 4. Lifecycles

### Startup / first play

1. User clicks the button (the required audio gesture).
2. Transport calls `engine.start()`; the engine resumes/creates the
   `AudioContext`, builds the initial pattern via `buildPattern(params, rng)`,
   sets it on the scheduler, and starts.
3. Audio begins; the button reflects "playing".

### Pause / resume

`engine.stop()` halts the scheduler but preserves state and the context.
`engine.start()` resumes. Pausing does not regenerate the piece.

### Parameter change (post-v1, but design for it now)

The control panel mutates the params store → the app rebuilds the pattern →
`engine.setPattern(...)` swaps it at the next cycle boundary. No restart, no audio
glitch beyond the boundary swap.

---

## 5. Long-horizon non-repetition strategy

"No perceived repetition across 12+ hours" is a design requirement, not a freebie.
The generator achieves it by combining four independent mechanisms so their
joint period is effectively unbounded:

1. **Incommensurate layer periods.** Each sustained voice cycles on a mutually
   coprime / irrational slow length (e.g. 17, 23, 31 cycles). The combined state
   only realigns after the product of those lengths — far beyond any listening
   session.
2. **Continuous slow modulation.** Filter cutoff, detune, pan, reverb send, and
   layer gains are driven by slow LFOs at incommensurate rates (`perlin`,
   `sine.slow(n).range(...)`). Nothing holds still.
3. **Probabilistic sparse events.** Melodic/percussive events emerging from the
   texture are gated by low per-cycle probabilities, seeded off cycle position, so
   they never fall into an audible loop.
4. **Slow scene changes.** On a minutes-scale timescale the harmonic center drifts
   via a slow random walk over the active mode, so the macro-structure evolves too.

Incommensurate periods × continuous noise modulation × probabilistic events ×
slow harmonic drift is what pushes perceptual non-repetition well past 12 hours.
Any change to the generator must preserve all four; dropping one (e.g. snapping
layers to a common period) reintroduces audible looping.

---

## 6. Invariants for agents

Treat these as tests you run in your head before opening a PR:

- **No network at runtime.** No `fetch`, no CDN, no remote samples. Verify with
  DevTools Network throttled to "Offline".
- **`engine.js` is the only superdough import site.** If you need an audio
  capability elsewhere, expose it through the engine, don't import the engine
  packages in another module.
- **`generator.js` is pure.** No DOM, no audio, no module-level mutable state, no
  `Math.random()` — randomness flows through the seeded `rng`.
- **Params are the only place controls touch.** UI writes params; generator reads
  params. Nothing else.
- **Data flows one way:** UI → params → generator → pattern → engine. No back-edges.
- **Use `@strudel/*`, never `@strudel.cycles/*`.**
- **Keep the page single-file in spirit:** one HTML page, one button in v1. New UI
  must not require restructuring engine or generator.

---

## 7. Why not the alternatives (so this isn't relitigated)

### Why not TidalCycles via WASM

TidalCycles is two separate things: a Haskell pattern DSL that emits **OSC**, and
a sound engine (SuperDirt, a quark running on SuperCollider's `scsynth`) that
receives that OSC. To run "Tidal in the browser" you would need both halves:

- **Pattern half:** GHC's wasm backend (9.10+) is real and has a working
  JavaScript FFI, but the browser wasm runtime has no host filesystem and no
  native OSC sockets, so you'd marshal everything across the FFI and rebuild Tidal
  plus its full Haskell dependency tree for wasm. That's a research project.
- **Audio half:** historically blocked (no SuperCollider in the browser). As of
  late 2025 there are genuine AudioWorklet ports of `scsynth` (Sam Aaron's
  SuperSonic, Dennis Scheiba's sc.wasm), but getting _SuperDirt_ running on top of
  an in-browser `scsynth` and wiring OSC out of a wasm-compiled Tidal is
  bleeding-edge integration that nobody ships turnkey.

After all that, the in-browser synthesis layer you'd have assembled is
functionally what `superdough` already is. Strudel is the finished version of this
path. (If, far down the line, we ever need true SuperCollider-grade bespoke DSP,
the scsynth-in-browser work is the thing to revisit — but the drone/ambient
aesthetic here does not require it.)

### Why not `@strudel/embed`

It loads strudel.cc in an iframe. That's a runtime network dependency and gives us
no control over the page — both disqualifying for an offline, self-hosted,
single-button app.
