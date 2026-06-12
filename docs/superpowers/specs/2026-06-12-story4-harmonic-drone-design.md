# Story 4 Design — Harmonic / Drone Core

**Date:** 2026-06-12
**Backlog item:** 4 — Harmonic / drone core
**Depends on:** Stories 1 (scaffold), 2 (engine), 3 (params + rng)
**Stories deferred to:** 5 (noise layer), 6 (sparse events), 5b (sample layers)

---

## Goal

Implement `buildPattern(params, rng)` in `src/generator.js` with five synthesized
layers: sub bass, drone pair (A + B), harmonic pad, FM swell, and high shimmer.
These are the harmonic/drone core — the sustained, slowly-evolving foundation that
everything else sits on top of.

After this story, playing the app produces a real ambient drone: layered sine tones
with subtle beating, a filtered sawtooth pad breathing through chord voicings, and
FM-modulated swells — all driven by a seeded zone sequence and params.

---

## File structure

`src/generator.js` is the only file changed. It exports exactly one function:

```
imports (@strudel/core only)

HARMONIC_ZONES          — 5 zone definitions
NUM_ZONES               — constant (12); ZONE_LEN computed in buildPattern from params

Named-interval helpers  — root(z), fifth(z), seventh(z), ninth(z), fourth(z)
buildZoneSeq(rng)       — returns 12-zone array

buildSubBassLayer(zones, params)
buildDroneLayer(zones, params)      — returns stack(droneA, droneB)
buildPadLayer(zones, params)
buildFmSwellLayer(zones, params)
buildShimmerLayer(zones, params)

export buildPattern(params, rng)
```

No module-level mutable state. No `Math.random()`. No imports outside
`@strudel/core`. Consistent with architecture invariants (§6 of `architecture.md`).

---

## Zone system

### HARMONIC_ZONES

Five entries. All are natural-minor-family modes, which gives them a consistent
interval layout across the `notes` array — the property that makes index-based
note derivation safe (architecture D7).

```js
const HARMONIC_ZONES = [
  { id: "d-aeolian",  root: "d", notes: ["d","f","a","c","e","g"]       },  // 6 notes
  { id: "d-dorian",   root: "d", notes: ["d","f","a","c","e","g","b"]   },  // maj6 = B
  { id: "a-aeolian",  root: "a", notes: ["a","c","e","g","b","d","f"]   },
  { id: "e-phrygian", root: "e", notes: ["e","g","b","d","f","a","c"]   },  // reordered (see note)
  { id: "g-aeolian",  root: "g", notes: ["g","bb","d","f","a","c","eb"] },
]
```

**E Phrygian reordering note:** the source spec lists E Phrygian notes ascending by
pitch (E F A B C D G), which puts the b2 (F) at index 1 and the 5th (B) at index 3 —
breaking the index contract. The array above reorders to chord-tone priority
(root, b3, 5th, b7, b2, 4th, b6) so that indices 0–5 are consistent with every
other zone: 5th at index 2, b7 at index 3, 4th at index 5. The b2 (F, the
Phrygian characteristic) sits at index 4 where other zones have the 9th; the
shimmer layer using this slot will get a slightly tense, dark upper note — an
acceptable and interesting Phrygian colour.

**D Dorian note:** the source spec lists F# as the Dorian characteristic, which
appears to be a typo. D Dorian's characteristic note is B (major 6th: D E F G A **B** C).
Corrected here.

Index contract (consistent across all zones for indices 0–5):

| Index | Role | Exception |
|-------|------|-----------|
| 0 | Root | — |
| 1 | Minor 3rd (b3) | — |
| 2 | Perfect 5th | — |
| 3 | Minor 7th (b7) | — |
| 4 | 9th / 2nd | E Phrygian: b2 (F) — dark shimmer colour |
| 5 | Perfect 4th | — |
| 6 | b6 or maj6 (absent in D Aeolian — never read) | — |

If a future zone breaks this layout, add a `voiceOverride` field to its zone
object rather than generalising the rule functions (per architecture D7).

### Named-interval helpers

```js
const root    = z => z.notes[0]  // index 0 — tonic
const fifth   = z => z.notes[2]  // index 2 — perfect 5th in all current zones
const seventh = z => z.notes[3]  // index 3 — minor 7th
const ninth   = z => z.notes[4]  // index 4 — major 9th / 2nd
const fourth  = z => z.notes[5]  // index 5 — 4th or 6th (used in FM swell)
```

These are the only place where zone-to-interval mapping lives. Rule functions call
these helpers; they never access `zone.notes[n]` directly.

### Zone sequence

```js
const NUM_ZONES = 12

function buildZoneSeq(rng) {
  return Array.from({ length: NUM_ZONES }, (_, i) =>
    HARMONIC_ZONES[Math.floor(rng.at(i) * HARMONIC_ZONES.length)]
  )
}
```

`ZONE_LEN` is **not** a module-level constant — it depends on `params.harmonicRate`
and is computed inside `buildPattern` then passed into each layer builder:

```js
const zoneLenCycles = Math.round(1801 / params.harmonicRate)
```

Default 1.0 → 1801 cycles (~30 min at cps=1); 0.5 → ~3600 cycles (slower
drift); 2.0 → ~900 cycles (faster). Total arc: 12 × zoneLenCycles before the
zone sequence repeats.

### Per-layer note rules

Each `build*Layer` function contains an inline helper that maps a zone to a
mini-notation note string. The rules:

| Layer | Notes used |
|---|---|
| Sub bass | root (oct 0–1), fifth (oct 0) |
| Drone A & B | root, fifth, root+octave, seventh (oct 1–3) |
| Pad | root, fifth, seventh, ninth — 4-note chord voicings |
| FM swell | root, fourth, fifth, seventh (power notes) |
| Shimmer | fifth, seventh, ninth — oct 4–5 |

---

## Layers 1–5

All presence periods and LFO periods are prime and match the tables in
`docs/generative-pattern.md`. No two layers share any period.

### Layer 1 — Sub bass

```
source:   sine
period:   277 cycles (note slot)
presence: sine.slow(191).range(0, 0.42 × layerActivity × droneDensity)
attack:   18s   release: 16s
detune:   perlin.slow(67).range(-4, 4) × detuneSpread
pan:      0.5 (fixed)
FX:       .room(reverbSend).size(reverbSize).orbit(1)
register: octave shift by params.register
```

### Layers 2a / 2b — Drone pair

Returned as `stack(droneA, droneB)`. Both use the same zone note sequence (same
note pool, independent detune LFOs). DroneB's detune range is always positive
(stays sharp of A), producing beating whose rate drifts independently.

```
source:    sine
period:    277 cycles (same slot sequence as sub bass)

droneA:
  presence: sine.slow(127).range(0, 0.36 × layerActivity × droneDensity)
  attack: 12s  release: 10s
  detune: perlin.slow(53).range(-8, 8) × detuneSpread
  pan:    0.40
  FX:     .room(reverbSend × 0.99).size(reverbSize × 0.98).orbit(1)

droneB:
  presence: sine.slow(163).range(0, 0.28 × layerActivity × droneDensity)
  attack: 14s  release: 10s
  detune: perlin.slow(37).range(6, 22) × detuneSpread   (always sharp)
  pan:    0.60
  FX:     .room(reverbSend × 0.99).size(reverbSize × 0.98).orbit(1)
```

### Layer 3 — Harmonic pad

```
source:   sawtooth
period:   421 cycles
presence: sine.slow(149).range(0, 0.12 × layerActivity × droneDensity)
attack:   9s   release: 9s
cutoff:   perlin.slow(89).range(260, 1500 × (1 + brightness))
resonance: 2
pan:      perlin.slow(43).range(0.28, 0.72)
FX:       .room(reverbSend × 0.91).size(reverbSize × 0.97).orbit(2)
```

Notes voiced as 4-note chords in mini-notation: `[root3,fifth3,seventh3,ninth4]`
plus a few sus voicings using available zone notes.

### Layer 4 — FM swell

```
source:       sine + FM
period:       337 cycles
presence:     sine.slow(89).range(0, 0.18 × layerActivity × droneDensity)
attack:       11s   release: 13s
FM depth:     perlin.slow(73).range(0.5, 4)
FM harmonicity: perlin.slow(83).range(0.3, 2)
cutoff:       perlin.slow(73).range(400, 2200 × (1 + brightness))
pan:          perlin.slow(47).range(0.2, 0.8)
FX:           .room(reverbSend × 0.94).size(reverbSize × 0.98).orbit(3)
```

### Layer 5 — High shimmer

```
source:   sine
period:   641 cycles
presence: sine.slow(211).range(0, 0.09 × layerActivity × droneDensity)
attack:   16s   release: 14s
detune:   perlin.slow(61).range(-22, 22) × detuneSpread
pan:      perlin.slow(29).range(0.12, 0.88)
FX:       .room(reverbSend × 0.97).size(reverbSize × 0.99).orbit(4)
```

---

## Params wiring

| Param | Story 4 effect |
|---|---|
| `masterGain` | Engine-level; generator ignores it |
| `reverbSize` | `.size()` value on all orbits |
| `reverbSend` | `.room()` value on all orbits |
| `detuneSpread` | Multiplier on detune ranges for sub bass, drone A/B, shimmer |
| `droneDensity` | Scales presence-envelope `maxGain` on layers 1–5 |
| `harmonicRate` | `ZONE_LEN = round(1801 / harmonicRate)` |
| `noiseLevel` | Deferred — Story 5 |
| `eventSparsity` | Deferred — Story 6 |
| `brightness` | Scales cutoff ceiling on pad and FM swell |
| `layerActivity` | Global multiplier on every layer's presence-envelope `maxGain` |
| `register` | Integer octave shift (clamped ±2) on all pitched layers |
| `stereoWidth` | Scales pan deviation from centre: `0.5 + (rawPan - 0.5) × stereoWidth` |

`droneDensity` and `layerActivity` are independent: `layerActivity` scales all
layers uniformly; `droneDensity` controls the drone bed specifically (relevant
once noise and event layers arrive in Stories 5–6 and the mix needs balancing).

---

## Acceptance criteria

- App plays an audible, evolving drone when the play button is clicked.
- All five layers are present and contribute to the sound (verify by ear; each
  has a different presence period so not all peak simultaneously).
- No abrupt pitch jumps at zone boundaries (long envelopes cover the transition).
- Same seed produces the same zone sequence and the same piece.
- `buildPattern` returns a pattern even when called with default params and a
  fresh rng — no errors thrown.
- `generator.js` imports only from `@strudel/core`; no audio, DOM, or
  `Math.random()`.
- Check LoC at end; propose split if >300 and a balanced split exists.
