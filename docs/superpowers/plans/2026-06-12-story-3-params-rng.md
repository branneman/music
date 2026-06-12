# Story 3: Params Model & RNG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `src/rng.js` (deterministic hash-based PRNG) and `src/params.js` (knob schema + observable store), and wire both into `main.js`.

**Architecture:** `rng.js` exports `createRng(seed)` — a pure, index-addressable hash function (Mulberry32 finalizer on `seed ^ i`) with `at/range/choose` helpers. `params.js` exports a 12-knob schema object plus a vanilla pub/sub store. `main.js` creates the rng instance with a fixed seed and subscribes to param changes to rebuild the pattern. `buildPattern` is still a stub so the subscribe callback guards against `undefined`.

**Tech Stack:** Vanilla ESM — no new dependencies. Verification uses `node --input-type=module` inline scripts (project has no test runner per architecture §D3).

---

### Task 1: Implement `src/rng.js`

**Files:**
- Modify: `src/rng.js`

- [ ] **Step 1: Replace the stub with the full implementation**

Replace the entire contents of `src/rng.js`:

```js
function _hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 13), 0x9e3779b9)
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000
}

export function createRng(seed) {
  const s = seed >>> 0
  const at     = i => _hash(s ^ (i >>> 0))
  const range  = (lo, hi, i) => lo + at(i) * (hi - lo)
  const choose = (arr, i) => arr[Math.floor(at(i) * arr.length)]
  return { at, range, choose }
}
```

`_hash` is two rounds of Mulberry32 finalizer — good avalanche, ~4 lines, zero deps. `at(i)` XORs the seed into the index before hashing, so different seeds produce independent streams.

- [ ] **Step 2: Verify determinism, range, and independence**

Run from the project root:

```bash
node --input-type=module << 'EOF'
import { createRng } from './src/rng.js'

const rng  = createRng(12345)
const rng2 = createRng(99999)

// Deterministic: same (seed, i) always returns same value
console.assert(rng.at(0) === rng.at(0), 'at(0) not deterministic')
console.assert(rng.at(7) === rng.at(7), 'at(7) not deterministic')

// Different indices give different values
console.assert(rng.at(0) !== rng.at(1), 'at(0) === at(1) — bad hash')

// Different seeds give different values
console.assert(rng.at(0) !== rng2.at(0), 'different seeds produced same value')

// All at(i) values are in [0, 1)
for (let i = 0; i < 1000; i++) {
  const v = rng.at(i)
  console.assert(v >= 0 && v < 1, `at(${i}) out of [0,1): ${v}`)
}

// range() stays within [lo, hi)
for (let i = 0; i < 50; i++) {
  const v = rng.range(-10, 10, i)
  console.assert(v >= -10 && v < 10, `range out of bounds at i=${i}: ${v}`)
}

// choose() returns an element of the array
const arr = ['a', 'b', 'c', 'd']
for (let i = 0; i < 50; i++) {
  console.assert(arr.includes(rng.choose(arr, i)), `choose invalid at i=${i}`)
}

console.log('rng.js: all assertions passed')
EOF
```

Expected output: `rng.js: all assertions passed`

- [ ] **Step 3: Commit**

```bash
git add src/rng.js
git commit -m "feat: implement createRng — Mulberry32 hash-based seeded PRNG"
```

---

### Task 2: Implement `src/params.js`

**Files:**
- Modify: `src/params.js`

- [ ] **Step 1: Replace the stub with the full implementation**

Replace the entire contents of `src/params.js`:

```js
// Musical meaning of each knob: see docs/generative-pattern.md §Future control surface.
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

const _subscribers = new Set()

export let params = Object.fromEntries(
  Object.entries(PARAMS).map(([k, v]) => [k, v.default])
)

export function set(key, val) {
  if (!(key in PARAMS)) return
  const { min, max } = PARAMS[key]
  params = { ...params, [key]: Math.min(max, Math.max(min, val)) }
  _subscribers.forEach(cb => cb(params))
}

export function subscribe(cb) {
  _subscribers.add(cb)
  return () => _subscribers.delete(cb)
}
```

`params` is a `let` export — ES module live bindings mean importers always see the current value when they read it. `set()` replaces the object (rather than mutating in place) so each subscriber snapshot is stable.

- [ ] **Step 2: Verify defaults, clamping, pub/sub, and unsubscribe**

```bash
node --input-type=module << 'EOF'
import { PARAMS, params, set, subscribe } from './src/params.js'

// All 12 knobs exist with correct defaults
const EXPECTED = {
  masterGain: 1.0, reverbSize: 0.96, reverbSend: 0.90,
  detuneSpread: 1.0, droneDensity: 1.0, harmonicRate: 1.0,
  noiseLevel: 1.0, eventSparsity: 0.72, brightness: 0.0,
  layerActivity: 0.8, register: 0, stereoWidth: 1.0,
}
for (const [k, v] of Object.entries(EXPECTED)) {
  console.assert(params[k] === v, `default wrong for ${k}: ${params[k]} !== ${v}`)
}
console.assert(Object.keys(params).length === 12, `expected 12 knobs, got ${Object.keys(params).length}`)

// PARAMS schema covers every live key
for (const k of Object.keys(params)) {
  console.assert(k in PARAMS, `params key "${k}" missing from PARAMS schema`)
}

// Clamping high
set('reverbSize', 99)
console.assert(params.reverbSize === 1, `clamp high: ${params.reverbSize}`)

// Clamping low
set('brightness', -99)
console.assert(params.brightness === -1, `clamp low: ${params.brightness}`)

// Unknown key is silently ignored
set('nonexistent', 42)
console.assert(!('nonexistent' in params), 'unknown key leaked into params')

// Subscriber fires once per set()
let callCount = 0
const unsub = subscribe(snapshot => {
  callCount++
  console.assert('reverbSize' in snapshot, 'snapshot missing keys')
})
set('reverbSize', 0.5)
set('reverbSize', 0.6)
console.assert(callCount === 2, `expected 2 subscriber calls, got ${callCount}`)

// Unsubscribe stops notifications
unsub()
set('reverbSize', 0.7)
console.assert(callCount === 2, `expected still 2 after unsub, got ${callCount}`)

console.log('params.js: all assertions passed')
EOF
```

Expected output: `params.js: all assertions passed`

- [ ] **Step 3: Commit**

```bash
git add src/params.js
git commit -m "feat: implement params schema and observable store"
```

---

### Task 3: Wire `rng` and `params` into `main.js`

Replace the Story 2 throwaway patterns. `buildPattern` is still a stub returning `undefined` — the `if (p)` guard makes this safe. The subscribe mechanism is live and ready for Stories 4–7 to fill in.

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Replace `main.js`**

Replace the entire contents of `src/main.js`:

```js
import { start, stop, setPattern } from './engine.js'
import { buildPattern } from './generator.js'
import { createRng } from './rng.js'
import { params, subscribe } from './params.js'

const rng = createRng(12345)

function applyPattern(snapshot) {
  const p = buildPattern(snapshot, rng)
  if (p) setPattern(p)
}

applyPattern(params)
subscribe(applyPattern)

// Dev helpers: test from browser console with window._rng.at(0), window._set('reverbSize', 0.5)
window._rng = rng
window._set = set
window._getParams = () => params

const btn = document.getElementById('play-pause')
let playing = false

btn.addEventListener('click', async () => {
  if (playing) {
    stop()
    btn.textContent = 'Play'
    btn.setAttribute('aria-label', 'Play')
  } else {
    try {
      await start()
    } catch (err) {
      console.error('start() failed:', err)
      return
    }
    btn.textContent = 'Pause'
    btn.setAttribute('aria-label', 'Pause')
  }
  playing = !playing
})
```

Wait — `set` is not imported above. Fix the import line:

```js
import { params, set, subscribe } from './params.js'
```

The full correct file:

```js
import { start, stop, setPattern } from './engine.js'
import { buildPattern } from './generator.js'
import { createRng } from './rng.js'
import { params, set, subscribe } from './params.js'

const rng = createRng(12345)

function applyPattern(snapshot) {
  const p = buildPattern(snapshot, rng)
  if (p) setPattern(p)
}

applyPattern(params)
subscribe(applyPattern)

// Dev helpers — test from the browser console:
//   window._rng.at(0)              → float in [0, 1)
//   window._set('reverbSize', 0.5) → updates params + fires subscribe
//   window._getParams()            → current params snapshot
window._rng = rng
window._set = set
window._getParams = () => params

const btn = document.getElementById('play-pause')
let playing = false

btn.addEventListener('click', async () => {
  if (playing) {
    stop()
    btn.textContent = 'Play'
    btn.setAttribute('aria-label', 'Play')
  } else {
    try {
      await start()
    } catch (err) {
      console.error('start() failed:', err)
      return
    }
    btn.textContent = 'Pause'
    btn.setAttribute('aria-label', 'Pause')
  }
  playing = !playing
})
```

- [ ] **Step 2: Verify dev server loads without errors**

```bash
npm run dev
```

Open the browser URL shown (typically `http://localhost:5173`). In DevTools Console, verify:

1. No errors on load.
2. Play button works (click it — no crash; audio may be silent since `buildPattern` is a stub).
3. Run in console:
   ```js
   window._rng.at(0)      // → a float like 0.7234... (not undefined, not NaN)
   window._getParams()    // → object with 12 keys at their defaults
   window._set('reverbSize', 0.5)  // → no error; _getParams().reverbSize === 0.5
   ```

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: wire rng and params into main — subscribe ready for generator"
```

---

### Task 4: Mark Story 3 DONE in backlog

**Files:**
- Modify: `docs/backlog.md`

- [ ] **Step 1: Update the Story 3 heading**

In `docs/backlog.md`, find and change:

```
## 3. Params model — `TODO`
```

to:

```
## 3. Params model — `DONE`
```

- [ ] **Step 2: Commit**

```bash
git add docs/backlog.md
git commit -m "chore: mark Story 3 DONE"
```

---

## Self-review

Checking plan against spec (`docs/superpowers/specs/2026-06-12-params-rng-design.md`):

| Spec requirement | Covered by |
|---|---|
| `createRng(seed)` accepts seed as param | Task 1 Step 1 |
| `at(i)` → float `[0, 1)`, deterministic for same `(seed, i)` | Task 1 Steps 1 & 2 |
| Different seeds give different values | Task 1 Step 2 |
| `range(lo, hi, i)` and `choose(arr, i)` helpers | Task 1 Steps 1 & 2 |
| Seed-agnostic — caller owns the seed value | Task 1 (no hardcoded seed in rng.js) |
| 12 knobs with correct defaults | Task 2 Steps 1 & 2 |
| `set()` clamps to `[min, max]` | Task 2 Steps 1 & 2 |
| Unknown keys ignored | Task 2 Step 2 |
| `subscribe(cb)` fires once per `set()` | Task 2 Step 2 |
| `subscribe` returns unsubscribe | Task 2 Steps 1 & 2 |
| Wire into `main.js` with `applyPattern` + subscribe | Task 3 |
| Guard `if (p)` for stub `buildPattern` | Task 3 Step 1 |
| Dev console helpers | Task 3 Step 2 |
| Backlog updated | Task 4 |

No gaps. No placeholders. Method names (`at`, `range`, `choose`, `set`, `subscribe`, `applyPattern`) consistent across all tasks.
