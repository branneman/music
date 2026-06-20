# Story 6 — Sparse Events Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `buildSparseEventLayer` to `generator.js` and wire it into `buildPattern`, completing the nine-layer architecture described in `docs/generative-pattern.md`.

**Architecture:** One new function follows the same `zonePattern` structure as every other pitched layer — builds a per-zone `cat()` of note pool, applies LFOs and FX, returns a Strudel pattern. `buildPattern` gets one new line. No new files, no new dependencies.

**Tech Stack:** Strudel (`@strudel/core` — already imported), Vite build.

## Global Constraints

- `generator.js` must remain pure: no DOM access, no audio imports, no `Math.random()`
- All `.slow()` period values must be prime and unique across the whole system (see period registry in spec)
- All note values must come from the current zone's pitch set
- No period value may appear in two layers (as presence arc, LFO, or slot period)
- `generator.js` must stay under ~300 LoC (currently 223; this task adds ~15 lines)

---

### Task 1: Add `buildSparseEventLayer` and wire into `buildPattern`

**Files:**
- Modify: `src/generator.js` (add function before `buildPattern`; add one call inside `buildPattern`)

**Interfaces:**
- Consumes: `zonePattern(zones, buildVoice, notePeriod, zoneLenCycles)` — already defined in `generator.js:29`
- Consumes: `root(zone)`, `fifth(zone)`, `seventh(zone)` — already defined in `generator.js:15-19`
- Consumes: `note`, `cat`, `perlin`, `rand` — already imported from `@strudel/core` on line 1
- Consumes: `params.eventSparsity`, `params.register`, `params.layerActivity`, `params.reverbSend`, `params.reverbSize` — all present in `src/params.js`
- Produces: `buildSparseEventLayer(zones, params, zoneLenCycles)` — called by `buildPattern`

- [ ] **Step 1: Verify no period conflicts**

  Open `src/generator.js` and confirm none of these values appear anywhere in the file: `19`, `41`, `103`.
  Quick check:
  ```bash
  grep -n '\b19\b\|\b41\b\|\b103\b' src/generator.js
  ```
  Expected: zero matches (these three periods are new to this story).

- [ ] **Step 2: Add `buildSparseEventLayer` to `src/generator.js`**

  Insert the following function immediately before the `export function buildPattern` line (currently line 210):

  ```js
  function buildSparseEventLayer(zones, params, zoneLenCycles) {
    const reg = Math.round(Math.max(-2, Math.min(2, params.register)))

    const buildVoice = zone => {
      const oct = 3 + reg
      const lo  = zone.notes.map(n => note(`${n}${oct}`))
      const hi  = [note(`${root(zone)}${oct+1}`), note(`${fifth(zone)}${oct+1}`), note(`${seventh(zone)}${oct+1}`)]
      return cat(...lo, ...hi)
    }

    return zonePattern(zones, buildVoice, 103, zoneLenCycles)
      .s('sine')
      .gain(perlin.slow(41).range(0.10, 0.24 * params.layerActivity))
      .attack(0.5).sustain(1).release(perlin.slow(19).range(2, 12))
      .pan(rand.range(0.12, 0.88))
      .room(params.reverbSend * 0.97).size(params.reverbSize * 0.99)
      .orbit(6)
      .degradeBy(params.eventSparsity)
  }
  ```

  Notes on this implementation:
  - `zone.notes` is the full pitch array (6–7 elements depending on zone); all go into `lo`
  - `hi` adds root/fifth/seventh one octave up for upper-register colour — same helper functions already used by other layers
  - `103` is the slot period (prime, unused — replaces spec's 97 which was reassigned to pad cutoff in Story 4)
  - `41` = gain LFO, `19` = release LFO — both prime, both unused
  - `degradeBy(params.eventSparsity)` at default 0.72 drops ~72% of slots → ~1 surviving event per 39 s

- [ ] **Step 3: Wire into `buildPattern`**

  In `buildPattern` (currently starting at line ~210 after the insert), add `buildSparseEventLayer` to the `stack()` call between `buildNoiseAtmosphereLayer` and `buildIndustrialLayer`:

  ```js
  export function buildPattern(params, rng) {
    const zoneLenCycles = Math.round(1801 / params.harmonicRate)
    const zones = buildZoneSeq(rng)
    return stack(
      buildSubBassLayer(zones, params, zoneLenCycles),
      buildDroneLayer(zones, params, zoneLenCycles),
      buildPadLayer(zones, params, zoneLenCycles),
      buildFmSwellLayer(zones, params, zoneLenCycles),
      buildShimmerLayer(zones, params, zoneLenCycles),
      buildNoiseAtmosphereLayer(params),
      buildSparseEventLayer(zones, params, zoneLenCycles),
      buildIndustrialLayer(params),
      buildMetalLayer(params),
    )
  }
  ```

- [ ] **Step 4: Build verification**

  ```bash
  npm run build
  ```

  Expected: exits 0, `dist/` produced with no errors. Any Strudel import error or JS syntax error will surface here.

- [ ] **Step 5: Period collision check**

  ```bash
  grep -oE '\.slow\([0-9]+\)' src/generator.js | sort | uniq -d
  ```

  Expected: no output (no duplicate `.slow()` values across the whole file).

- [ ] **Step 6: Line count check**

  ```bash
  wc -l src/generator.js
  ```

  Expected: ≤ 240 lines (current 223 + ~15 for the new function).

- [ ] **Step 7: Commit**

  ```bash
  git add src/generator.js
  git commit -m "feat: add buildSparseEventLayer (sine pings, orbit 6)"
  ```

---

## Listening acceptance

Start the dev server (`npm run dev`), open the browser, press play, and listen for 3–5 minutes:

- [ ] Occasional single sine tones emerge from the texture — never forming a perceptible rhythm or beat
- [ ] Each event has a distinct reverb tail (some short ~2 s, some trailing ~10 s)
- [ ] Events are pitched to the active zone — no obviously out-of-scale notes
- [ ] Events are sparse enough that silence between them is the norm, not the exception
- [ ] No console errors; no failed network requests (DevTools Network tab)
