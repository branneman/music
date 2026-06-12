# Story 3 Design: Params Model & RNG

**Date:** 2026-06-12
**Status:** Approved
**Backlog item:** [Story 3 — Params model](../../backlog.md)

---

## Scope

Two new modules:

- `src/rng.js` — seeded, index-addressable PRNG with modulation helpers
- `src/params.js` — schema + defaults + minimal observable store

Both are zero-dependency, pure JS. No audio, no DOM.

---

## `src/rng.js`

### Approach

Hash-based (Approach A): `rng.at(i)` is a **pure function** that maps `(seed, i)` → float `[0, 1)`. No mutable cursor; any index is O(1) without advancing state. This matches the `rng.at(i)` interface already documented in `generative-pattern.md` and makes the generator trivially reproducible and testable.

### Algorithm

One Mulberry32 finalizer pass over `seed XOR i`. Mulberry32 is a well-regarded 32-bit hash with good avalanche properties, ~4 lines inline, zero dependencies.

### API

```js
const rng = createRng(seed)   // seed: integer

rng.at(i)              // → float [0, 1)  deterministic for (seed, i)
rng.range(lo, hi, i)   // → float in [lo, hi)
rng.choose(arr, i)     // → arr[floor(at(i) * arr.length)]
```

### Seed management

`createRng(seed)` is seed-agnostic — the seed is just an integer. Today `main.js` passes a fixed constant (e.g. `12345`). In a future story the caller can pass a random value, a `localStorage`-persisted value, or a URL-hash value — `rng.js` requires no changes.

### Index discipline

Because `rng.at(i)` with the same `i` always returns the same value, callers must use distinct index offsets per layer/parameter to get independent streams. Convention: pass `i * PRIME + LAYER_OFFSET` where both constants are unique to that call site. Document the offsets used in `generator.js` comments when they are introduced in Stories 4–7.

---

## `src/params.js`

### Schema

`PARAMS` is a plain object mapping each key to `{ default, min, max, label }`. The generator and future controls panel both import `PARAMS` to know the shape and valid ranges.

```js
export const PARAMS = {
  masterGain:    { default: 1.0,  min: 0,  max: 1,  label: 'Master gain' },
  reverbSize:    { default: 0.96, min: 0,  max: 1,  label: 'Reverb size' },
  reverbSend:    { default: 0.90, min: 0,  max: 1,  label: 'Reverb send' },
  detuneSpread:  { default: 1.0,  min: 0,  max: 2,  label: 'Detune spread' },
  droneDensity:  { default: 1.0,  min: 0,  max: 2,  label: 'Drone density' },
  harmonicRate:  { default: 1.0,  min: 0,  max: 2,  label: 'Harmonic movement rate' },
  noiseLevel:    { default: 1.0,  min: 0,  max: 2,  label: 'Noise bed level' },
  eventSparsity: { default: 0.72, min: 0,  max: 1,  label: 'Event sparsity' },
  brightness:    { default: 0.0,  min: -1, max: 1,  label: 'Brightness' },
  layerActivity: { default: 0.8,  min: 0,  max: 1,  label: 'Layer activity' },
  register:      { default: 0,    min: -2, max: 2,  label: 'Register / octave centre' },
  stereoWidth:   { default: 1.0,  min: 0,  max: 2,  label: 'Stereo width' },
}
```

Per-layer gains (`subBassGain`, `droneGain`, etc.) are deferred to Story 10 (controls panel) when the UI needs them.

### Live store

Initialised from defaults at module load. The live store is a plain frozen-key object; `set()` validates and replaces it.

### API

```js
import { params, set, subscribe } from './params.js'

// Read current values (generator side)
params.reverbSize        // → 0.96

// Write a value (UI/controls side, future)
set('reverbSize', 0.8)   // clamps to [min, max], notifies subscribers

// React to any change (app bootstrap)
subscribe(snapshot => {
  engine.setPattern(buildPattern(snapshot, rng))
})
```

`subscribe` returns an unsubscribe function (for completeness; v1 never needs it).

### Clamping

`set(key, val)` silently clamps `val` to `[PARAMS[key].min, PARAMS[key].max]`. Unknown keys are ignored (no throw) to keep the store defensive against future param additions during development.

### No framework dependency

The store is ~15 lines of vanilla JS (a `Set` of callbacks). No reactive library, no signals, no Proxy. The controls panel (Story 10) can wrap this in whatever reactive primitive it likes — the store itself stays dumb.

---

## Data flow reminder

```
UI ──set()──> params ──subscribe callback──> buildPattern(params, rng) ──> engine.setPattern()
```

`main.js` wires this up at bootstrap: one `subscribe` call that rebuilds and sets the pattern on any change. In v1 no UI writes params, so the callback fires zero times after startup — that's fine.

---

## Acceptance criteria

- `createRng(seed).at(i)` returns the same float for the same `(seed, i)` pair across calls and page reloads.
- `createRng(seed1).at(i) !== createRng(seed2).at(i)` for any `seed1 !== seed2` (probabilistic; holds for all reasonable seeds).
- `params` exports the 12 knobs with correct defaults.
- `set('reverbSize', 99)` clamps to `1`; `set('brightness', -99)` clamps to `-1`.
- A `subscribe` callback fires exactly once per `set` call.
- Generator and UI both read/write through this module only — no other file defines knob defaults.
