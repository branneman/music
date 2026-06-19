# Story 6 — Sparse Events Layer Design

**Date:** 2026-06-19  
**Backlog item:** 6 (sparse event layer)  
**Depends on:** Stories 1–5 done; `buildPattern` has 8 layers; `params.eventSparsity` exists.

---

## Scope

Add one new layer to `buildPattern`: **Layer 7 — Sparse Events** (orbit 6).

This is the last missing synthesized layer from the nine-layer architecture. After this story, all layers from the `generative-pattern.md` table are implemented.

---

## 1. `buildSparseEventLayer(zones, params, zoneLenCycles)`

### Note pool

For each zone, build a `cat()` of:
- All zone notes (`z.notes`) in octave `3 + reg` (6–7 notes depending on zone)
- Root, fifth, and seventh in octave `4 + reg` (3 more)

Total: 9–10 notes per zone. Events always sit in the active tonal center; when the zone drifts, the pitch pool drifts with it.

```js
const buildVoice = zone => {
  const reg = Math.round(Math.max(-2, Math.min(2, params.register)))
  const oct = 3 + reg
  const lo  = zone.notes.map(n => note(`${n}${oct}`))
  const hi  = [note(`${root(zone)}${oct+1}`), note(`${fifth(zone)}${oct+1}`), note(`${seventh(zone)}${oct+1}`)]
  return cat(...lo, ...hi)
}
```

### Rate math

With default params (slot period 103, degradeBy 0.72, ~9.5 notes/zone):
- surviving slots per 103 cycles ≈ 9.5 × 0.28 ≈ 2.66
- mean gap ≈ 103 / 2.66 ≈ **39 s** — falls in the target range of "roughly 1 per 35 s"

### Pattern assembly

```js
return zonePattern(zones, buildVoice, 103, zoneLenCycles)
  .s('sine')
  .gain(perlin.slow(41).range(0.10, 0.24 * params.layerActivity))
  .attack(0.5).sustain(1).release(perlin.slow(19).range(2, 12))
  .pan(rand.range(0.12, 0.88))
  .room(params.reverbSend * 0.97).size(params.reverbSize * 0.99)
  .orbit(6)
  .degradeBy(params.eventSparsity)
```

### Key decisions

- **No presence arc** — sparsity is handled entirely by `degradeBy`. A presence arc would cause sustained stretches of silence between events, making them feel gated rather than random.
- **Short attack (0.5 s)** — events should have a clean, identifiable onset so they read as "melodic moments" rather than blurring into the texture.
- **Variable release (2–12 s)** — each event's tail is unique; prevents events from sounding templated.
- **`layerActivity` on gain** — consistent with other layers; scales down when the user wants a sparser, quieter overall mix.
- **`reverbSend` / `reverbSize` on FX chain** — consistent with other layers so reverb param changes affect all layers uniformly.

---

## 2. `buildPattern` — updated assembly

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
    buildSparseEventLayer(zones, params, zoneLenCycles),   // NEW — orbit 6
    buildIndustrialLayer(params),
    buildMetalLayer(params),
  )
}
```

---

## Period registry additions

| Period | Layer | Use |
|--------|-------|-----|
| 19 | Sparse events | release LFO |
| 41 | Sparse events | gain LFO |
| 103 | Sparse events | slot period |

All three are prime and unused by any existing layer.

**Full period registry after this story** (all periods, for reference):

| Period | Layer | Use |
|--------|-------|-----|
| 19 | Sparse events | release LFO |
| 29 | Shimmer | pan LFO |
| 37 | Drone B | detune LFO |
| 41 | Sparse events | gain LFO |
| 43 | Pad | pan LFO |
| 47 | FM swell | pan LFO |
| 53 | Drone A | detune LFO |
| 59 | Metal | speed LFO |
| 61 | Shimmer | detune LFO |
| 67 | Sub bass | detune LFO |
| 73 | FM swell | FM depth LFO |
| 79 | Metal | slot period |
| 83 | FM swell | FM harmonicity LFO |
| 89 | FM swell | presence arc |
| 97 | Pad | cutoff LFO |
| 101 | Industrial | speed LFO |
| 103 | Sparse events | slot period |
| 107 | Noise | cutoff LFO |
| 113 | Industrial | slot period |
| 127 | Drone A | presence arc |
| 149 | Pad | presence arc |
| 151 | Noise | gain LFO |
| 157 | Metal | gain LFO |
| 163 | Drone B | presence arc |
| 173 | Industrial | presence arc |
| 191 | Sub bass | presence arc |
| 211 | Shimmer | presence arc |
| 277 | Sub bass / Drones | note period |
| 337 | FM swell | note period |
| 421 | Pad | note period |
| 641 | Shimmer | note period |

---

## Acceptance criteria

- `npm run build` succeeds.
- Events appear sparsely — audibly no more frequent than roughly one per 30 s on average.
- Events never form a perceptible rhythmic pattern.
- Events are pitched into the active zone (no out-of-scale notes).
- Each event has a variable reverb tail (some short, some trailing off over several seconds).
- No two layers share a `.slow()` period value.
- `generator.js` remains pure: no DOM, no audio imports, no `Math.random()`.
- `generator.js` line count stays within the ~300 LoC soft limit (currently ~224 LoC; new function adds ~15 lines, total ≈ 239).
