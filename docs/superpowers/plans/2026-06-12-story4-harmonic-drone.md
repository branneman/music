# Story 4: Harmonic / Drone Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `buildPattern(params, rng)` in `src/generator.js` with five synthesized harmonic layers — sub bass, drone pair, harmonic pad, FM swell, and high shimmer — producing a real, evolving ambient drone driven by a seeded zone system and params.

**Architecture:** All five layers use the same `zonePattern()` helper: a `cat()` of 12 zone voices with an inner slow factor `ta = notePeriod / S` (where `S = NUM_ZONES × zoneLenCycles`) so that note sequences cycle exactly `notePeriod` cycles regardless of zone length. Continuous LFOs (`sine.slow(n)`, `perlin.slow(n)`) drive presence envelopes and per-parameter modulation. `buildPattern` computes `zoneLenCycles` from `params.harmonicRate`, builds the 12-zone sequence using `rng`, and stacks all five layers.

**Tech Stack:** `@strudel/core` — `note`, `stack`, `cat`, `sine`, `perlin`. Superdough pattern methods (`.s`, `.gain`, `.attack`, `.release`, `.sustain`, `.detune`, `.pan`, `.room`, `.size`, `.orbit`, `.cutoff`, `.resonance`, `.fm`, `.fmh`) are available on all patterns after `engine.js` loads (it calls `registerSynthSounds()` on import). No test runner exists — verification is by browser console inspection and listening.

---

### Task 1: Zone foundation and imports

**Files:**
- Modify: `src/generator.js`

The zone sequence maths: `S = NUM_ZONES × zoneLenCycles` is the total cycle span of the full 12-zone `cat`. `ta = notePeriod / S` is the inner slow factor so that after the outer `.slow(S)`, the note sequence cycles exactly `notePeriod` cycles and each zone lasts `zoneLenCycles` cycles. Slows compound multiplicatively in Strudel: inner × outer = effective.

- [ ] **Step 1: Replace generator.js with zone foundation**

```js
import { note, stack, cat, sine, perlin } from '@strudel/core'

const HARMONIC_ZONES = [
  { id: 'd-aeolian',  root: 'd', notes: ['d','f','a','c','e','g']       },
  { id: 'd-dorian',   root: 'd', notes: ['d','f','a','c','e','g','b']   },
  { id: 'a-aeolian',  root: 'a', notes: ['a','c','e','g','b','d','f']   },
  { id: 'e-phrygian', root: 'e', notes: ['e','g','b','d','f','a','c']   },
  { id: 'g-aeolian',  root: 'g', notes: ['g','bb','d','f','a','c','eb'] },
]

const NUM_ZONES = 12

// Index contract: [root, b3, 5th, b7, 9th*, 4th, b6]
// *index 4 is b2 in E Phrygian — intentional dark shimmer colour (see architecture D7)
const root    = z => z.notes[0]
const fifth   = z => z.notes[2]
const seventh = z => z.notes[3]
const ninth   = z => z.notes[4]
const fourth  = z => z.notes[5]

function buildZoneSeq(rng) {
  return Array.from({ length: NUM_ZONES }, (_, i) =>
    HARMONIC_ZONES[Math.floor(rng.at(i) * HARMONIC_ZONES.length)]
  )
}

// Core zone assembly. ta = notePeriod/S ensures note sequence cycles
// at exactly notePeriod cycles; each zone lasts zoneLenCycles cycles.
function zonePattern(zones, buildVoice, notePeriod, zoneLenCycles) {
  const S  = NUM_ZONES * zoneLenCycles
  const ta = notePeriod / S
  return cat(...zones.map(z => buildVoice(z).slow(ta))).slow(S)
}

export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack()  // placeholder — filled out task by task
}
```

- [ ] **Step 2: Start dev server and verify no console errors**

```bash
npm run dev
```

Open http://localhost:5173. Click Play. Console must show no errors. Audio will be silence (`stack()` with no args — correct for now).

- [ ] **Step 3: Verify zone sequence is deterministic**

In the browser console:
```js
window._rng.at(0)   // note the value
window._rng.at(11)  // note the value
```

Reload and re-run — values must be identical both times.

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: zone foundation — HARMONIC_ZONES, interval helpers, buildZoneSeq"
```

---

### Task 2: Sub bass layer

**Files:**
- Modify: `src/generator.js`

Sub bass plays root + fifth alternating, deep register. Presence envelope `sine.slow(191)` starts at 0 and peaks at ~47s — the layer is silent on first click and slowly emerges. Wait 60–90s to hear it, or run `window._set('droneDensity', 2)` in console to push the gain multiplier higher immediately.

- [ ] **Step 1: Add buildSubBassLayer before buildPattern**

```js
function buildSubBassLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const maxGain = 0.42 * params.layerActivity * params.droneDensity
  const dw      = params.detuneSpread

  const buildVoice = zone => {
    const r = root(zone), f = fifth(zone)
    const oct  = 1 + reg
    const fOct = Math.max(0, oct - 1)  // fifth one octave lower, min oct 0
    return note(`<${r}${oct} ${r}${oct} ${f}${fOct} ${r}${oct} ${r}${oct} ${f}${fOct}>`)
  }

  return zonePattern(zones, buildVoice, 277, zoneLenCycles)
    .s('sine')
    .gain(sine.slow(191).range(0, maxGain))
    .attack(18).sustain(1).release(16)
    .detune(perlin.slow(67).range(-4 * dw, 4 * dw))
    .pan(0.5)
    .room(params.reverbSend).size(params.reverbSize)
    .orbit(1)
}
```

- [ ] **Step 2: Wire into buildPattern**

```js
export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack(
    buildSubBassLayer(zones, params, zoneLenCycles),
  )
}
```

- [ ] **Step 3: Verify in browser**

Reload dev server page. Click Play. Check console — no errors. Wait 60–90s for the presence envelope to rise. A deep, slow sine tone should emerge from silence. If impatient: `window._set('droneDensity', 2)` — the layer should become immediately audible (resets on reload).

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: sub bass layer (layer 1)"
```

---

### Task 3: Drone pair layer

**Files:**
- Modify: `src/generator.js`

Two detuned sine voices sharing the same note pool but with independent presence periods (127s and 163s) and pan positions. DroneB's detune range is always positive (stays sharp of A), producing a slow beating whose rate drifts independently on its own perlin period.

- [ ] **Step 1: Add buildDroneLayer before buildPattern**

```js
function buildDroneLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const dw      = params.detuneSpread
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const r = root(zone), f = fifth(zone), sv = seventh(zone)
    const oct = 2 + reg
    return note(
      `<${r}${oct} ${r}${oct} ${f}${oct} ${r}${oct + 1} ${sv}${oct} ${f}${oct} ${r}${oct} ${r}${oct + 1}>`
    )
  }

  const seq  = zonePattern(zones, buildVoice, 277, zoneLenCycles)
  const panA = 0.5 + (0.40 - 0.5) * sw
  const panB = 0.5 + (0.60 - 0.5) * sw

  const droneA = seq
    .s('sine')
    .gain(sine.slow(127).range(0, 0.36 * la))
    .attack(12).sustain(1).release(10)
    .detune(perlin.slow(53).range(-8 * dw, 8 * dw))
    .pan(panA)
    .room(params.reverbSend * 0.99).size(params.reverbSize * 0.98)
    .orbit(1)

  const droneB = seq
    .s('sine')
    .gain(sine.slow(163).range(0, 0.28 * la))
    .attack(14).sustain(1).release(10)
    .detune(perlin.slow(37).range(6 * dw, 22 * dw))
    .pan(panB)
    .room(params.reverbSend * 0.99).size(params.reverbSize * 0.98)
    .orbit(1)

  return stack(droneA, droneB)
}
```

- [ ] **Step 2: Wire into buildPattern**

```js
export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack(
    buildSubBassLayer(zones, params, zoneLenCycles),
    buildDroneLayer(zones, params, zoneLenCycles),
  )
}
```

- [ ] **Step 3: Verify in browser**

Reload. Click Play. Wait ~60s. You should hear the sub bass from Task 2 plus a mid-register drone pair emerging at slightly different times (127s and 163s presence peaks). The slight pitch difference between A and B produces a slow, subtle beating texture. Check console for no errors.

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: drone pair layer (layers 2a/2b)"
```

---

### Task 4: Harmonic pad layer

**Files:**
- Modify: `src/generator.js`

Sawtooth oscillator, heavily LPF-filtered, playing 3 cycling 4-note chord voicings. Cutoff breathes on 89s perlin. Presence period: 149s. Note period: 421 cycles — the voicings hold a long time before rotating.

- [ ] **Step 1: Add buildPadLayer before buildPattern**

```js
function buildPadLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const r = root(zone), f = fifth(zone), sv = seventh(zone), ni = ninth(zone)
    const oct = 3 + reg
    return note(
      `<[${r}${oct},${f}${oct},${sv}${oct},${ni}${oct + 1}] ` +
      `[${r}${oct},${f}${oct},${sv}${oct},${ni}${oct}] ` +
      `[${r}${oct},${sv}${oct},${ni}${oct},${r}${oct + 1}]>`
    )
  }

  const cutoffHi = Math.max(280, 1500 * (1 + params.brightness))
  const panLo    = 0.5 + (0.28 - 0.5) * sw
  const panHi    = 0.5 + (0.72 - 0.5) * sw

  return zonePattern(zones, buildVoice, 421, zoneLenCycles)
    .s('sawtooth')
    .gain(sine.slow(149).range(0, 0.12 * la))
    .attack(9).sustain(1).release(9)
    .cutoff(perlin.slow(89).range(260, cutoffHi))
    .resonance(2)
    .pan(perlin.slow(43).range(panLo, panHi))
    .room(params.reverbSend * 0.91).size(params.reverbSize * 0.97)
    .orbit(2)
}
```

- [ ] **Step 2: Wire into buildPattern**

```js
export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack(
    buildSubBassLayer(zones, params, zoneLenCycles),
    buildDroneLayer(zones, params, zoneLenCycles),
    buildPadLayer(zones, params, zoneLenCycles),
  )
}
```

- [ ] **Step 3: Verify in browser**

Reload. Click Play. After ~75s the pad should add a filtered, warm chord texture above the drones. The filter starts mostly closed (~260Hz) and breathes open; expect a soft, muted sound that opens gradually. Check console for no errors.

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: harmonic pad layer (layer 3)"
```

---

### Task 5: FM swell layer

**Files:**
- Modify: `src/generator.js`

Sine carrier with FM modulation. FM depth (perlin.slow(73)) and harmonicity (perlin.slow(83)) modulate on incommensurate periods, creating a metallic-organic, shape-shifting quality. Cutoff shares perlin.slow(73) with FM depth — they correlate intentionally. Presence period: 89s (shortest — appears most frequently).

- [ ] **Step 1: Add buildFmSwellLayer before buildPattern**

```js
function buildFmSwellLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const r = root(zone), fo = fourth(zone), f = fifth(zone), sv = seventh(zone)
    const oct = 3 + reg
    return note(`<${r}${oct} ${fo}${oct} ${f}${oct} ${sv}${oct} ${r}${oct}>`)
  }

  const cutoffHi = Math.max(420, 2200 * (1 + params.brightness))
  const panLo    = 0.5 + (0.2 - 0.5) * sw
  const panHi    = 0.5 + (0.8 - 0.5) * sw

  return zonePattern(zones, buildVoice, 337, zoneLenCycles)
    .s('sine')
    .fm(perlin.slow(73).range(0.5, 4))
    .fmh(perlin.slow(83).range(0.3, 2))
    .gain(sine.slow(89).range(0, 0.18 * la))
    .attack(11).sustain(1).release(13)
    .cutoff(perlin.slow(73).range(400, cutoffHi))
    .pan(perlin.slow(47).range(panLo, panHi))
    .room(params.reverbSend * 0.94).size(params.reverbSize * 0.98)
    .orbit(3)
}
```

- [ ] **Step 2: Wire into buildPattern**

```js
export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack(
    buildSubBassLayer(zones, params, zoneLenCycles),
    buildDroneLayer(zones, params, zoneLenCycles),
    buildPadLayer(zones, params, zoneLenCycles),
    buildFmSwellLayer(zones, params, zoneLenCycles),
  )
}
```

- [ ] **Step 3: Verify in browser**

Reload. Click Play. After ~45s the FM swell should appear — a metallic, wavering tone whose timbre shifts as FM depth and harmonicity modulate. Check console: if `.fm()` or `.fmh()` throw errors ("not a function"), it means `registerSynthSounds()` in engine.js hasn't run yet at pattern-build time. In that case, move the `buildPattern` call in main.js to fire after a microtask delay: `await Promise.resolve(); applyPattern(params)`.

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: FM swell layer (layer 4)"
```

---

### Task 6: High shimmer layer

**Files:**
- Modify: `src/generator.js`

High-register sines with wide detuning creating a shimmering beating halo. Presence period: 211s (slowest — appears least often and most gradually). Note period: 641 cycles. Expect to wait 100s+ after clicking Play before this layer becomes audible.

- [ ] **Step 1: Add buildShimmerLayer before buildPattern**

```js
function buildShimmerLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const dw      = params.detuneSpread
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const f = fifth(zone), sv = seventh(zone), ni = ninth(zone)
    const oct = 4 + reg
    return note(`<${f}${oct} ${ni}${oct} ${sv}${oct} ${f}${oct + 1} ${ni}${oct} ${sv}${oct + 1}>`)
  }

  const panLo = 0.5 + (0.12 - 0.5) * sw
  const panHi = 0.5 + (0.88 - 0.5) * sw

  return zonePattern(zones, buildVoice, 641, zoneLenCycles)
    .s('sine')
    .gain(sine.slow(211).range(0, 0.09 * la))
    .attack(16).sustain(0.8).release(14)
    .detune(perlin.slow(61).range(-22 * dw, 22 * dw))
    .pan(perlin.slow(29).range(panLo, panHi))
    .room(params.reverbSend * 0.97).size(params.reverbSize * 0.99)
    .orbit(4)
}
```

- [ ] **Step 2: Wire final buildPattern**

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
  )
}
```

- [ ] **Step 3: Verify full stack — 3–5 minute listening session**

Reload. Click Play. Let it run for 3–5 minutes. The full mix should evolve as each layer's presence envelope rises and falls independently:

- 0–45s: mostly silence as all envelopes rise from 0
- 45–90s: sub bass and FM swell emerge
- 90–150s: drone pair and pad add warmth
- 150s+: shimmer appears as a high, shimmering halo

Listen for:
- No audio clicks or pops at zone-boundary transitions (long envelopes cover them)
- No two layers consistently peaking together (they should feel independent)
- No clipping — if it clips, run `window._set('layerActivity', 0.6)` and note the value for tuning

Check console: no errors throughout the session.

- [ ] **Step 4: Commit**

```bash
git add src/generator.js
git commit -m "feat: shimmer layer (layer 5) — full harmonic/drone core wired"
```

---

### Task 7: Params verification and LoC check

**Files:**
- Modify: `src/generator.js` only if a split is warranted

- [ ] **Step 1: Verify each param via console**

With the dev server running and all layers audible, run each test. Listen for the expected effect before restoring.

```js
// detuneSpread — beating thickness
window._set('detuneSpread', 0)    // tones align cleanly, no beating
window._set('detuneSpread', 2)    // thick beating, diffuse spatial image
window._set('detuneSpread', 1)    // restore

// layerActivity — global presence multiplier
window._set('layerActivity', 0.3) // only 1–2 layers audible at a time
window._set('layerActivity', 1)   // restore

// droneDensity — drone-bed presence only
window._set('droneDensity', 0.2)  // drone bed recedes to near-silence
window._set('droneDensity', 1)    // restore

// brightness — cutoff ceiling on pad + FM swell
window._set('brightness', -0.8)   // very dark, filter mostly closed on pad and FM
window._set('brightness', 0.8)    // brighter, filter opens further
window._set('brightness', 0)      // restore

// register — octave shift on all pitched layers
window._set('register', 1)        // all pitched layers shift up one octave
window._set('register', -1)       // all shift down one octave
window._set('register', 0)        // restore

// stereoWidth
window._set('stereoWidth', 0)     // all panned layers collapse to centre
window._set('stereoWidth', 2)     // maximum spread
window._set('stereoWidth', 1)     // restore

// harmonicRate — triggers subscribe → rebuilds pattern with new zoneLenCycles
window._set('harmonicRate', 2)    // faster zone sequence (shorter zone duration)
window._set('harmonicRate', 0.5)  // slower zone sequence (longer zone duration)
window._set('harmonicRate', 1)    // restore
```

Each param change should take effect without a full reload (params store fires `subscribe` → `applyPattern` → `engine.setPattern`). No console errors expected.

- [ ] **Step 2: Verify determinism**

Reload the page twice (do not change the seed in main.js). In each session, immediately after clicking Play:
```js
window._rng.at(0)   // must match between sessions
window._rng.at(5)   // must match between sessions
window._rng.at(11)  // must match between sessions
```

Identical values in both sessions confirms `buildZoneSeq` is deterministic.

- [ ] **Step 3: LoC check and split decision**

```bash
wc -l src/generator.js
```

- **≤300 lines:** no split. Done.
- **>300 lines AND a balanced split exists** (each resulting file ≥80 lines): split. A natural split point is zone system + sub-bass/drone in `src/generator-core.js`, and pad/FM/shimmer + `buildPattern` in `src/generator.js`. Update imports in `main.js` if anything moves.
- **>300 lines but no balanced split:** no split. Leave as one file.

- [ ] **Step 4: Final commit**

If a split was made:
```bash
git add src/generator.js src/generator-core.js
git commit -m "refactor: split generator into balanced modules (>300 LoC)"
```

If no split:
```bash
git commit --allow-empty -m "chore: Story 4 done — generator.js within size limit, no split needed"
```
