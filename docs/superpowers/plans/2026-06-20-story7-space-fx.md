# Story 7: Space & FX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add register-calibrated delay (spatial on low/mid layers, shimmer on high) and reverb fade to the four pitched synthesis layers in `src/generator.js`.

**Architecture:** All changes are single-line method chain additions to existing layer builder functions. No new files, no new imports, no new params. Reverb (`.room`/`.size`) is already wired; this story adds `.delay`/`.delaytime`/`.delayfeedback` (all layers) and `.fade` (drone + pad only).

**Tech Stack:** Strudel `@strudel/core` pattern API, superdough Web Audio engine. Pattern methods are chained directly on the pattern object returned by `zonePattern()`.

## Global Constraints

- No new imports in any file
- No new params in `src/params.js`
- No changes to `src/engine.js` or `src/ui/`
- All delay feedback values < 0.5 (prevents runaway build-up)
- No new `.slow()` periods introduced (would need to be prime and unique across all layers)
- `generator.js` must stay under ~300 LoC after changes (currently 245; target ~249)

> **Testing note:** There is no automated test runner in this project. Each task's "test" is an aural check: run `npm run dev`, open the browser URL it prints, click play, and listen for the described quality. Stop the dev server after each task's aural check before committing.

---

### Task 1: Spatial delay + fade on drone pair (`buildDroneLayer`)

DroneA gets the longest delay (2.3 s, wet 0.14) for maximum spatial depth. DroneB gets slightly shorter (1.9 s, wet 0.12) so the two delay tails don't perfectly overlap. Both get `.fade(4.0)` so the reverb tail blooms in slowly rather than snapping.

**Files:**
- Modify: `src/generator.js` — `buildDroneLayer` function (lines ~58–95)

**Interfaces:**
- Produces: no API change — `buildDroneLayer` still returns a stacked pattern

- [ ] **Step 1: Add delay + fade to `droneA`**

In `src/generator.js`, inside `buildDroneLayer`, find the `droneA` definition and add `.fade(4.0)` after `.size(...)` and `.delay(0.14).delaytime(2.3).delayfeedback(0.38)` before `.orbit(1)`:

```js
const droneA = seq
  .s('sine')
  .gain(sine.slow(127).range(0, 0.36 * la))
  .attack(12).sustain(1).release(10)
  .detune(perlin.slow(53).range(-8 * dw, 8 * dw))
  .pan(panA)
  .room(params.reverbSend * 0.99).size(params.reverbSize * 0.98).fade(4.0)
  .delay(0.14).delaytime(2.3).delayfeedback(0.38)
  .orbit(1)
```

- [ ] **Step 2: Add delay + fade to `droneB`**

Find the `droneB` definition directly below and apply the same pattern:

```js
const droneB = seq
  .s('sine')
  .gain(sine.slow(163).range(0, 0.28 * la))
  .attack(14).sustain(1).release(10)
  .detune(perlin.slow(37).range(6 * dw, 22 * dw))
  .pan(panB)
  .room(params.reverbSend * 0.99).size(params.reverbSize * 0.98).fade(4.0)
  .delay(0.12).delaytime(1.9).delayfeedback(0.34)
  .orbit(1)
```

- [ ] **Step 3: Aural test**

```bash
npm run dev
```

Open the URL printed (typically `http://localhost:5173`). Click play. Listen for ~60 seconds.

Expected: the drone pair has a deeper, more diffuse spatial quality. No audible rhythmic echo — only a sense of expanded physical space. The reverb tail on zone transitions fades in smoothly rather than snapping. Stop the dev server (`Ctrl+C`).

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: spatial delay + fade on drone pair (orbit 1)"
```

---

### Task 2: Spatial delay + fade on pad; spatial delay on FM swell

Pad gets medium spatial delay (1.7 s, wet 0.10) plus `.fade(3.0)` — the chord voicings develop a blurred, widened character. FM swell gets the lowest wet value (0.07) since it's already the most dynamically active layer; delay only adds a subtle ambient trail.

**Files:**
- Modify: `src/generator.js` — `buildPadLayer` (~lines 97–125) and `buildFmSwellLayer` (~lines 127–153)

**Interfaces:**
- Produces: no API change

- [ ] **Step 1: Add delay + fade to pad layer**

In `buildPadLayer`, find the `return zonePattern(...)` chain and add `.fade(3.0)` after `.size(...)` and `.delay(0.10).delaytime(1.7).delayfeedback(0.30)` before `.orbit(2)`:

```js
return zonePattern(zones, buildVoice, 421, zoneLenCycles)
  .s('sawtooth')
  .gain(sine.slow(149).range(0, 0.12 * la))
  .attack(9).sustain(1).release(9)
  .cutoff(perlin.slow(97).range(260, cutoffHi))
  .resonance(2)
  .pan(perlin.slow(43).range(panLo, panHi))
  .room(params.reverbSend * 0.91).size(params.reverbSize * 0.97).fade(3.0)
  .delay(0.10).delaytime(1.7).delayfeedback(0.30)
  .orbit(2)
```

- [ ] **Step 2: Add delay to FM swell layer**

In `buildFmSwellLayer`, find the `return zonePattern(...)` chain and add `.delay(0.07).delaytime(1.3).delayfeedback(0.26)` before `.orbit(3)` (no `.fade` on this layer):

```js
return zonePattern(zones, buildVoice, 337, zoneLenCycles)
  .s('sine')
  .fm(perlin.slow(73).range(0.5, 4))
  .fmh(perlin.slow(83).range(0.3, 2))
  .gain(sine.slow(89).range(0, 0.18 * la))
  .attack(11).sustain(1).release(13)
  .cutoff(perlin.slow(73).range(400, cutoffHi))
  .pan(perlin.slow(47).range(panLo, panHi))
  .room(params.reverbSend * 0.94).size(params.reverbSize * 0.98)
  .delay(0.07).delaytime(1.3).delayfeedback(0.26)
  .orbit(3)
```

- [ ] **Step 3: Aural test**

```bash
npm run dev
```

Open the browser URL, click play, listen for ~90 seconds (long enough for the pad to emerge on its 149 s presence arc and the FM swell on its 89 s arc).

Expected: pad chord voicings have a blurred, widened spatial quality. FM swells feel like they're fading into a large space rather than cutting off. No rhythmic echoes. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: spatial delay + fade on pad (orbit 2), delay on FM swell (orbit 3)"
```

---

### Task 3: Shimmer delay on high shimmer layer (`buildShimmerLayer`)

Short delay time (0.11 s) with moderate feedback (0.46) creates a dense halo of closely-spaced repeats around each shimmer note. Combined with the wide perlin detune already on this layer, the result is an ethereal shimmer rather than a discrete echo.

**Files:**
- Modify: `src/generator.js` — `buildShimmerLayer` (~lines 155–179)

**Interfaces:**
- Produces: no API change

- [ ] **Step 1: Add shimmer delay**

In `buildShimmerLayer`, find the `return zonePattern(...)` chain and add `.delay(0.18).delaytime(0.11).delayfeedback(0.46)` before `.orbit(4)` (no `.fade` — the 16 s attack already shapes the tail):

```js
return zonePattern(zones, buildVoice, 641, zoneLenCycles)
  .s('sine')
  .gain(sine.slow(211).range(0, 0.09 * la))
  .attack(16).sustain(0.8).release(14)
  .detune(perlin.slow(61).range(-22 * dw, 22 * dw))
  .pan(perlin.slow(29).range(panLo, panHi))
  .room(params.reverbSend * 0.97).size(params.reverbSize * 0.99)
  .delay(0.18).delaytime(0.11).delayfeedback(0.46)
  .orbit(4)
```

- [ ] **Step 2: Aural test**

```bash
npm run dev
```

Open the browser URL, click play, listen for at least 3–4 minutes (shimmer's presence arc is 211 s — roughly 3.5 minutes — so you need to wait for it to emerge).

Expected: when the shimmer layer rises, it has a glowing halo character — a dense high-frequency blur around each note rather than a clear echo. The effect should feel like light scattering, not a rhythmic repeat. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/generator.js
git commit -m "feat: shimmer delay halo on high shimmer layer (orbit 4)"
```

---

### Task 4: Update docs + verify build

Add a delay constants table to `docs/generative-pattern.md` and confirm the production build is clean.

**Files:**
- Modify: `docs/generative-pattern.md` — add FX constants section after the LFO period tables
- No code changes

- [ ] **Step 1: Add FX constants table to `generative-pattern.md`**

Find the end of the "Tier 1 — Per-layer LFOs" table (after the Metal row, before the "Tier 2" heading). Insert this new sub-section between Tier 1 and Tier 2:

```markdown
### FX constants (delay — baked in per layer)

These are fixed constants, not LFO-driven. No entry in the period table is needed.
Delay times are non-rhythmic at cps=1 and distinct from each other. Feedback < 0.5
prevents runaway build-up. `.fade()` is the reverb-tail bloom time (seconds).

| Layer | `.delay()` wet | `.delaytime()` s | `.delayfeedback()` | `.fade()` s |
|-------|---------------|-----------------|-------------------|------------|
| Drone A | 0.14 | 2.3 | 0.38 | 4.0 |
| Drone B | 0.12 | 1.9 | 0.34 | 4.0 |
| Pad | 0.10 | 1.7 | 0.30 | 3.0 |
| FM swell | 0.07 | 1.3 | 0.26 | — |
| Shimmer | 0.18 | 0.11 | 0.46 | — |

All other layers (sub bass, noise, sparse events, industrial, metal): no delay.
```

- [ ] **Step 2: Verify production build**

```bash
npm run build
```

Expected output ends with something like:
```
✓ built in Xs
dist/index.html        ...
dist/assets/index-...  ...
```

No errors, no warnings about missing imports. The `dist/` directory is produced.

- [ ] **Step 3: Size check**

```bash
wc -l src/generator.js
```

Expected: ≤ 252 lines (was 245; four added lines plus any whitespace).

- [ ] **Step 4: Commit**

```bash
git add docs/generative-pattern.md
git commit -m "docs: Story 7 done — FX constants table in generative-pattern.md"
```
