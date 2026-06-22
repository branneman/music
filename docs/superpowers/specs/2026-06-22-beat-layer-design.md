# Beat Layer — Design Spec

**Date:** 2026-06-22
**Inspiration:** "Drain This Lord" (SHXCXCHCXSH, *Linear S Decoded*, Avian, 2014) and "UUUUR" (SHXCXCHCXSH, *EEEER* EP, Mental Disorder, 2026)

---

## Aesthetic goal

Add a tight 128 BPM industrial beat that sits underneath the existing ambient drone layers. The beat contributes rhythmic drive without displacing the ambient character — it is the engine the drones float over, not the focus.

Two elements, both drawn from the SHXCXCHCXSH analysis:

- **Kick**: "hydraulic pump" / "piston pump" — 4-on-the-floor, mechanical, compressed, slightly pitch-drifting. "Crushed drum patterns" (lo-fi bitcrusher texture).
- **Counter-hit**: every 8th-note off-beat ("and" of every beat), sharp transient, more degraded than the kick, sits behind it in the mix. Likely a sharp-attack industrial sample processed to read as a whipcrack.

Unlike the ambient layers, the beat does **not** use a presence oscillator. It is either on or off. The `beatActivity` param is the future toggle; at 0 the beat is fully silent, at 1.0 it is at full presence.

---

## New samples

### Kick bank: `gabba`

Source: `github:tidalcycles/Dirt-Samples/master` — `gabba/` directory (9 samples).

This bank contains heavily distorted, crushed gabba/industrial kicks. The distortion and compression are baked in at the source, which is what gives the "hydraulic pump" quality. Speed variation in the pattern shifts pitch downward for weight.

Add `gabba` to `scripts/vendor-samples.mjs` alongside `industrial` and `metal`. Same vendoring pattern: download to `public/samples/gabba/`, regenerate `public/samples/strudel.json`, commit.

**Fallback:** if `gabba` auditions poorly (wrong character), try `hardkick` from the same Dirt-Samples source.

### Counter-hit: reuse existing `industrial` bank

No new samples needed. The existing `industrial` bank (32 samples) contains short sharp transients suitable for the off-beat counter-hit. During implementation, audition indices 0–31 and identify 2–3 with fast attack and short decay. Hardcode those indices in the pattern (e.g. `industrial:3` or `industrial:7`). Document chosen indices in a comment.

---

## Pattern structure

Two new builder functions in `src/generator.js`: `buildBeatKickLayer(params)` and `buildBeatHitLayer(params)`.

Neither takes `zones` or `rng` — the beat is rhythmically fixed, not harmonically derived.

```js
// Kick: 4-on-the-floor
s("gabba").fast(4).n(irand(9))

// Counter-hit: every 8th-note off-beat
// Replace N with the auditioning-chosen industrial index (sharp transient)
s("~ industrial:N").fast(4)
```

No `.slow()` wrapping on these patterns — they play at CPS tempo.

`irand(9)` on the kick gives slight sample-to-sample variation (which of the 9 gabba samples plays each hit), preventing mechanical repetition without losing the 4-on-the-floor feel.

---

## Processing chain

### Kick (orbit 9)

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `speed` | `perlin.slow(103).range(0.82, 0.98)` | Slight pitch drift → hydraulic pump feel |
| `crush` | `6` | Lo-fi bitcrusher → crushed drum texture |
| `gain` | `0.8 * params.beatActivity` | Base level × toggle control |
| `room` | `0.22` | Some space, but kick stays grounded |
| `size` | `0.42` | Moderate tail |
| `orbit` | `9` | Independent reverb bus |

### Counter-hit (orbit 10)

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `speed` | `perlin.slow(109).range(0.88, 1.12)` | More pitch movement than kick |
| `crush` | `8` | More degraded than kick |
| `gain` | `params.beatActivity * 0.55` | Sits behind kick in mix |
| `room` | `0.16` | Shorter, sharper space |
| `size` | `0.32` | Tighter tail than kick |
| `orbit` | `10` | Independent reverb bus |

Both 103 and 109 are prime and absent from the existing LFO period table.

---

## Tempo and CPS

### New param: `bpm`

Add to `src/params.js`:

```js
bpm: { default: 128, min: 60, max: 200, label: 'BPM' },
```

This param exists now even though no UI control is wired yet. It is the hook for future tempo variation.

### CPS derivation

`engine.js` derives CPS from `params.bpm` on startup and on every pattern rebuild:

```js
// 1 cycle = 1 bar = 4 beats; CPS = BPM / (4 × 60) = BPM / 240
const cps = params.bpm / 240  // 128 BPM → 0.5333 CPS
```

The CPS is applied via Strudel's `setcps()` before or alongside `setPattern()`. At 128 BPM (CPS ≈ 0.533), the existing ambient layers' `.slow(n)` values map to:

| Layer | `slow(n)` | Duration at 128 BPM |
|-------|-----------|---------------------|
| Sub bass presence | 191 | ~358 s (~6 min) |
| Drone A presence | 127 | ~238 s (~4 min) |
| Industrial hits slot | 113 | ~212 s (~3.5 min) |
| Metal hits slot | 79 | ~148 s (~2.5 min) |

All durations remain long; no ambient layer is disturbed.

---

## Beat toggle param

Add to `src/params.js`:

```js
beatActivity: { default: 1.0, min: 0, max: 1, label: 'Beat activity' },
```

Both beat layers scale gain by `params.beatActivity`. At `0` the beat is completely silent. This is the mechanism for the future UI toggle — no structural change will be needed when that control is added.

---

## Generator integration

Add to the `stack(...)` in `buildPattern`:

```js
export function buildPattern(params, rng) {
  ...
  return stack(
    buildSubBassLayer(...),
    buildDroneLayer(...),
    buildPadLayer(...),
    buildFmSwellLayer(...),
    buildShimmerLayer(...),
    buildNoiseAtmosphereLayer(params),
    buildSparseEventLayer(...),
    buildIndustrialLayer(params),
    buildMetalLayer(params),
    buildBeatKickLayer(params),   // new
    buildBeatHitLayer(params),    // new
  )
}
```

---

## New LFO periods

Both new periods are prime and absent from the existing period table in `generative-pattern.md`. The table must be updated to include them.

| Layer | Parameter | Signal | Period (s) |
|-------|-----------|--------|------------|
| Beat kick | speed | `perlin.slow(103)` | 103 |
| Beat hit | speed | `perlin.slow(109)` | 109 |

---

## Orbit allocation

| Orbit | Layer |
|-------|-------|
| 1 | Sub bass, Drone A, Drone B |
| 2 | Harmonic pad |
| 3 | FM swell |
| 4 | High shimmer |
| 5 | Noise atmosphere |
| 6 | Sparse events |
| 7 | Industrial hits |
| 8 | Metal hits |
| **9** | **Beat kick** |
| **10** | **Beat hit** |

---

## Constraints this work must not break

- **All existing architectural invariants** in `architecture.md §6` apply.
- **No new period collisions.** 103 and 109 are the only new LFO periods; both must be added to the period table in `generative-pattern.md`.
- **`generator.js` stays pure.** No audio imports; the two new builder functions follow the same signature pattern as existing ones.
- **`engine.js` is the only place CPS is set.** `setcps()` belongs there, not in the generator or UI.
- **Beat samples are vendored locally.** `gabba` goes through `vendor-samples.mjs` → committed to `public/samples/` → registered via `engine.js`. No CDN path.
- **`beatActivity` at 0 must produce silence**, not reduced volume. Confirm that `gain(0)` in Strudel's superdough fully silences the layer (it does — this is the expected behaviour).

---

## Out of scope

- UI control / toggle button for the beat — wired via `beatActivity` param when that story lands
- BPM UI control — `bpm` param exists; control deferred to controls panel story
- Snare on 2 and 4 (traditional backbeat) — not part of the SHXCXCHCXSH character being referenced; off-beat counter-hit is sufficient
