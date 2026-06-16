# Story 5 + 5b — Texture / Atmosphere Layers Design

**Date:** 2026-06-16  
**Backlog items:** 5 (noise atmosphere) and 5b (vendor samples + industrial/metal hits)  
**Depends on:** Stories 1–4 done; samples already vendored and committed.

---

## Scope

Add three new layers to `buildPattern` and wire sample registration into `engine.js`:

| Layer | Name | Source | Orbit |
|-------|------|--------|-------|
| 6 | Noise atmosphere | brown noise | 5 |
| 8 | Industrial hits | `Dirt-Samples: industrial` | 7 |
| 9 | Metal hits | `Dirt-Samples: metal` | 8 |

Layer 7 (sparse events, orbit 6) is backlog item 6 — intentionally out of scope here.

---

## 1. engine.js — sample registration

Import `samples` from `@strudel/webaudio` and call it at module level immediately after `registerSynthSounds()`:

```js
import { samples } from '@strudel/webaudio'
// …
registerSynthSounds()
samples('/samples/strudel.json')
```

No other changes to `engine.js`. The call is synchronous registration — Strudel resolves the bank lazily when the audio engine first needs it. The local path `/samples/strudel.json` is the only permitted URL (architecture §D2: zero CDN dependencies).

---

## 2. generator.js — new imports

Add `s`, `irand`, `rand` to the existing `@strudel/core` import line. All are Strudel-internal and cycle-deterministic; they do not conflict with the seeded `rng`.

---

## 3. buildNoiseAtmosphereLayer(params)

Brown noise bed: per-cycle grains with 2 s attack/release overlap into a continuous texture. No zone dependency, no note pool.

```
s("brown")
  .gain(perlin.slow(151).range(0, 0.14 * params.noiseLevel))
  .cutoff(perlin.slow(107).range(100, cutoffHi))
  .resonance(1.5)
  .attack(2).sustain(1).release(2)
  .pan(0.5)
  .room(0.55).size(0.68).orbit(5)
```

Where:
- `cutoffHi = Math.max(250, 480 * (1 + params.brightness))` — consistent with pad and FM swell brightness handling.
- Period 107 replaces the spec's 97, which was reassigned to the pad in a Story 4 hotfix. 107 is prime and unused.

**LFO periods introduced:** 151 (gain), 107 (cutoff). Both prime and not in use by any existing layer.

---

## 4. buildIndustrialLayer(params)

Sampled industrial sounds with a 173 s presence arc. Heavy reverb simulates large-hall recording character. `speed < 1` shifts pitch down for weight and distance.

```
s("industrial").n(irand(32))
  .gain(sine.slow(173).range(0, 0.28 * params.layerActivity))
  .speed(perlin.slow(101).range(0.35, 0.95))
  .pan(rand.range(0.05, 0.95))
  .room(0.96).size(0.99).orbit(7)
  .degradeBy(0.80).slow(113)
```

**LFO periods introduced:** 173 (presence), 101 (speed). Both prime and unused.  
**Slot period:** 113 cycles (prime, unused).

---

## 5. buildMetalLayer(params)

Metallic strikes with extreme reverb. No presence arc — always sparse via `degradeBy`. Speed range lower than industrial for a more massive, distant character.

```
s("metal").n(irand(10))
  .gain(perlin.slow(157).range(0.05, 0.20 * params.layerActivity))
  .speed(perlin.slow(59).range(0.25, 0.80))
  .pan(rand.range(0.1, 0.9))
  .room(0.97).size(0.99).orbit(8)
  .degradeBy(0.86).slow(79)
```

**LFO periods introduced:** 157 (gain), 59 (speed). Both prime and unused.  
**Slot period:** 79 cycles (prime, unused).

---

## 6. buildPattern — updated assembly

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
    buildIndustrialLayer(params),
    buildMetalLayer(params),
  )
}
```

---

## Period registry after this story

All periods (presence arcs, LFOs, slot cycles) remain mutually prime with no two layers sharing a value.

| Period | Layer | Use |
|--------|-------|-----|
| 29 | Shimmer | pan LFO |
| 37 | Drone B | detune LFO |
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

- `npm run build` succeeds with all three new layers compiled.
- With DevTools Network throttled to Offline, reloading plays without failed requests and samples fire audibly.
- Brown noise bed is present and breathes (level and cutoff shift over ~2–3 minutes).
- Industrial hits appear sparsely — never as a perceptible beat.
- Metal hits appear sparsely with a massive, ringy character.
- No two layers share a `.slow()` period value.
- `generator.js` remains pure: no DOM, no audio imports, no `Math.random()`.
