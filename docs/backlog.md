# Backlog

Numbered, handoff-ready work items. Each is scoped so a focused agent can pick it
up in isolation. Before starting any item, read [`architecture.md`](architecture.md)
— especially the layer boundaries (§2), data flow (§3), and invariants (§6), which
your work must respect.

**Status legend:** `TODO` (not started) · `WIP` · `DONE`. All items start `TODO`.

## Dependency order

- **1–3 are foundational** and must land first, roughly in order. Everything else
  depends on them.
- **4–8 are the parallelizable musical core.** They each depend only on 2 and 3
  and can be worked concurrently, integrated through the params schema.
- **9 (transport UI)** can start any time after 2.
- **10 (controls panel)** depends on 3 and 9.
- **11–12** are continuous / finishing and run alongside 4–8 onward.

---

## 1. Project scaffold & offline build — `TODO`

**Goal:** A buildable, deployable empty shell that already proves the offline and
hosting constraints.

**Scope:**

- Vite project: `index.html` (one button + mount point), `styles.css`,
  `vite.config.js` (`base:'/'`, `build.outDir:'dist'`).
- `package.json` scripts: `dev`, `build`, `preview`, `deploy`
  (`vite build && gh-pages -d dist`).
- `public/CNAME` = `music.bran.name`.
- Install `@strudel/core`, `@strudel/webaudio`, and `gh-pages` (dev).
- Add the AGPL-3.0 `LICENSE` file.

**Acceptance:**

- `npm run build` produces `dist/` containing `CNAME`.
- With the dev/preview server loaded and DevTools Network throttled to "Offline",
  reloading still serves the page and there are **zero** failed/remote requests.
- `npm run deploy` publishes `dist/` to the `gh-pages` branch (dry-run is fine for
  the agent; document the command).

**Depends on:** nothing.

---

## 2. Engine wrapper — `TODO`

**Goal:** The single audio-lifecycle module.

**Scope:**

- `src/engine.js` is the **only** file importing `@strudel/webaudio` / `superdough`.
- Wrap Strudel's scheduler: `repl({ defaultOutput: webaudioOutput, getTime })`.
- Expose `start()`, `stop()`, `setPattern(pattern)`.
- Init the `AudioContext` on first user gesture (coordinate with item 9).

**Acceptance:**

- A throwaway constant pattern can be started/stopped from a button and swapped
  live via `setPattern` without a glitch beyond the cycle boundary.
- No other module imports the engine packages.

**Depends on:** 1.

---

## 3. Params model — `TODO`

**Goal:** The single source of truth for everything tunable.

**Scope:**

- `src/params.js`: schema with defaults, ranges, and types for each knob.
- A minimal observable store (subscribe / set) so the future panel and the app can
  react to changes.
- `src/rng.js`: seeded PRNG whose stream is a function of cycle number, plus small
  modulation helpers. No `Math.random()` anywhere downstream.
- Document each knob's musical meaning in a comment block.

**Initial knobs (extend as the musical layers land):** drone density, harmonic-
movement rate, reverb size, reverb send, noise-bed level, event sparsity, detune
spread, register/octave center, stereo width, master gain.

**Acceptance:**

- Generator and UI both read/write through this module only.
- Same seed reproduces the same RNG stream.

**Depends on:** 1.

---

## 4. Harmonic / drone core — `TODO`

**Goal:** The sustained foundation: layered, detuned, slowly-moving tones.

**Scope:**

- Sustained voices (oscillator sources) with subtle per-voice detuning so they
  beat against each other.
- Slow harmonic movement as a seeded random walk over a chosen mode.
- Register and voicing controlled by params.

**Acceptance:**

- Produces a stable, evolving drone bed driven entirely by params + rng; no abrupt
  jumps; audibly "slow-moving harmony."

**Depends on:** 2, 3.

---

## 5. Texture / atmosphere layer — `TODO`

**Goal:** The underlying noisy/textural bed.

**Scope:**

- Pink/brown noise (and/or crackle) source, heavily filtered.
- Slow modulation of filter cutoff and level so the bed breathes.
- Level controlled by the noise-bed param.

**Acceptance:**

- Adds a continuous atmospheric layer that sits under the drone without masking
  it; never static.

**Depends on:** 2, 3.

---

## 6. Sparse event layer — `TODO`

**Goal:** Occasional melodic/percussive events emerging from the texture.

**Scope:**

- Probabilistic gating (low per-cycle probability), seeded off cycle position.
- Events pitched into the current harmonic context from item 4.
- Density driven by the event-sparsity param.

**Acceptance:**

- Events appear sparsely and unpredictably, never on an audible loop, and read as
  "emerging from" the texture rather than as a beat.

**Depends on:** 3, 4.

---

## 7. Space & FX — `TODO`

**Goal:** The reverberant, shimmering character ("long reverberant tails").

**Scope:**

- Parametric convolution reverb (`room`/`size`/`fade`) on a send.
- Delay and stereo width.
- The detune/beating design that gives sustained tones their movement.

**Acceptance:**

- Long, smooth tails; wide stereo image; no metallic/ringing artifacts; reverb
  size and send respond to params.

**Depends on:** 4 (and benefits from 5, 6).

---

## 5b. Vendor samples + industrial texture layer — `TODO`

**Goal:** Download the industrial/metal sample banks, commit them, and implement
the sample-based texture layers in `buildPattern`.

**Scope:**

- Run `npm run vendor-samples`. This downloads 42 files (~933 KB) from
  Dirt-Samples into `public/samples/industrial/` and `public/samples/metal/`
  and writes a `public/samples/strudel.json` manifest. Commit the result.
- In `engine.js`, register samples once on startup:
  `await samples('/samples/strudel.json')`. This call must be inside `engine.js`
  only — no other module imports or registers samples.
- Add two layers to `buildPattern` per the design in `docs/generative-pattern.md`:
  - **Industrial hits layer**: `s("industrial").n(irand(32))` with heavy reverb
    (`.room(0.96).size(0.99)`), slow presence arc, and `degradeBy(0.80)`.
  - **Metal hits layer**: `s("metal").n(irand(10))` with cavernous reverb,
    `speed(perlin.slow(59).range(0.3, 0.9))` for pitch variation, `degradeBy(0.86)`.

**Acceptance:**

- `public/samples/` is committed; `npm run build` produces a `dist/` that
  contains all sample files.
- With DevTools Network throttled to "Offline", samples play with no failed
  requests.
- Industrial and metal hits appear sparsely and unpredictably, never as a beat.

**Depends on:** 1 (scaffold), 2 (engine).

---

## 8. Long-horizon variation system — `TODO`

**Goal:** Guarantee no perceived repetition over 12+ hours (architecture §5).

**Scope:**

- Assign incommensurate / coprime slow cycle periods across layers.
- Continuous incommensurate modulation of cutoff/detune/pan/send/gain.
- A minutes-scale scene-change scheduler (slow harmonic-center random walk).
- A **fast-forward test harness**: render/inspect the generator's state at an
  arbitrary cycle (e.g. "hour 9") quickly, without listening in real time.

**Acceptance:**

- State sampled at widely separated times (minute 1 vs hour 6 vs hour 11) is
  audibly distinct.
- The harness can jump to an arbitrary cycle deterministically from a seed.

**Depends on:** 4, 5, 6, 7.

---

## 9. Transport UI — `TODO`

**Goal:** The single play/pause control.

**Scope:**

- `src/ui/transport.js`: the button, gesture-gated audio start (coordinate with
  item 2), playing/paused visual state.
- Keyboard activation and ARIA labelling.

**Acceptance:**

- One click starts audio (satisfying the browser gesture requirement); toggles
  cleanly; accessible via keyboard and screen reader.

**Depends on:** 2.

---

## 10. Controls panel (future) — `TODO`

**Goal:** "More/less of X" controls that drop in without touching engine or
generator internals.

**Scope:**

- Render controls from the params schema (item 3); bind each to the store.
- On change: rebuild the pattern and `engine.setPattern(...)`.
- Add crossfade-on-swap so param changes don't produce a boundary click (the
  deferred enhancement noted in architecture §3).

**Acceptance:**

- Adjusting any control changes the sound with no restart and no audible glitch.
- No edits required to `engine.js` or `generator.js` internals — only params and
  UI.

**Depends on:** 3, 9.

---

## 11. Mix, loudness & soak safety — `TODO`

**Goal:** Safe, consistent levels over multi-hour runs.

**Scope:**

- Master gain staging; a limiter / soft-clip so layered reverb tails can't build
  to clipping over time.
- A soak test: multi-hour continuous playback watching for level creep, clipping,
  dropouts, and memory growth.

**Acceptance:**

- No clipping and no runaway level buildup over a long run; stable memory; no
  audio dropouts.

**Depends on:** 4 (meaningful once layers exist); run continuously thereafter.

---

## 12. Listening QA & tuning — `TODO`

**Goal:** Hit the reference aesthetic and catch long-run regressions.

**Scope:**

- Long listening passes; tune params toward the target (sustained detuned layers,
  long tails, slow harmony, quiet noise bed, sparse emergent events).
- Watch for drift, dropouts, or unwanted periodicity over multi-hour playback.

**Acceptance:**

- Sounds like the intended high-quality ambient-drone aesthetic, not generic
  new-age; remains engaging and non-repeating across a long session.

**Depends on:** 4–8 (ongoing).
