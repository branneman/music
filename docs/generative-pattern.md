# Generative Pattern Design

This document specifies the musical architecture for `src/generator.js`. It is
written for implementing agents: read it before touching any layer or
randomization code. Everything here is intentional; departures should be raised
explicitly.

---

## Aesthetic target

Rhythmless or near-rhythmless ambient drone. Long cavernous reverb. Slow-moving
"minor complex" harmony (minor 7th / minor 9th voicings, no simple major triads).
Layered sustained tones with subtle detuning that creates slow beating between
voices. Occasional sparse melodic events that emerge from the texture rather than
establishing a pulse. An underlying noise bed that gives the piece a lived-in,
non-sterile quality.

The mix should never feel static. Something — a layer rising from near-silence,
another receding, a filter opening or closing — should register as a noticeable
shift roughly every 30 seconds.

Reference: Music for Programming episode 68 — ambient / drone / dub / noise /
acoustic / instrumental / study-concentration.

---

## Layer architecture

Nine layers: seven synthesized, two sample-based. Each has an independent
"presence envelope" — a slow sine on its gain that causes it to emerge from and
recede into the texture on a prime-period cycle. Because the periods are all
different primes, layers peak and dip at constantly shifting relative phases,
guaranteeing that some layer is always in mid-transition.

| # | Name | Source | Presence period | Note/slot period | Purpose |
|---|------|--------|-----------------|------------------|---------|
| 1 | Sub bass | sine | 191 s | 277 cycles | Very deep tonal anchor; massive reverb |
| 2a | Mid drone A | sine | 127 s | 277 cycles | Core foundation; tuned flat of droneB |
| 2b | Mid drone B | sine (detuned) | 163 s | 277 cycles | Beats against droneA; slightly sharp |
| 3 | Harmonic pad | sawtooth + LPF | 149 s | 421 cycles | Chord voicings; breathing filter |
| 4 | FM swell | sine + FM | 89 s | 337 cycles | Metallic/organic swells; most dynamic |
| 5 | High shimmer | sine | 211 s | 641 cycles | Upper overtones; wide detuning |
| 6 | Noise atmosphere | brown noise | 151 s (continuous) | n/a | Non-sterile texture bed |
| 7 | Sparse events | sine | none (degradeBy 0.72) | 97 cycles | Melodic moments; ~1 per 35 s |
| 8 | Industrial hits | Dirt-Samples: `industrial` | 173 s | 113 cycles | Large-hall percussive objects |
| 9 | Metal hits | Dirt-Samples: `metal` | none (degradeBy 0.86) | 79 cycles | Distant metallic strikes |

All presence periods (89, 127, 149, 151, 163, 173, 191, 211) and note/slot
periods (79, 97, 113, 277, 337, 421, 641) are prime. No two layers share any
period.

### How presence envelopes work

```js
// Layer is inaudible when sine is near 0; at full presence when sine is near 1.
// With T=127: rises from silence to peak over ~63 seconds, falls back over ~63 s.
.gain(sine.slow(T).range(0, maxGain))
```

Expected active layer count at any moment: 3–4 of the 7 (layers 6 and 7 are
always present at some level). On average, a layer crosses through the audible
50%-of-peak threshold every ~12 seconds. The perceptual result is a shift
noticeable every 20–40 seconds — always gradual, never abrupt.

---

## Harmonic constraint system

All pitched layers draw from a shared note pool defined by the current harmonic
zone. This is the mechanism that keeps the randomness musically coherent — no
matter how independently layers modulate, they never clash.

### Zones

Five harmonic zones, each rooted in a dark minor-family mode:

```
Zone 0 — D Aeolian      D  F  A  C  E  G         (natural minor; dark, stable)
Zone 1 — D Dorian       D  F  A  C  E  F#  G      (adds major 6th; slightly brighter)
Zone 2 — A Aeolian      A  C  E  G  B  D  F       (shifts tonic weight to A; lower)
Zone 3 — E Phrygian     E  F  A  B  C  D  G       (flat-2; unsettled, most tense)
Zone 4 — G Aeolian      G  Bb D  F  A  C  Eb      (lowest register feel; opens up)
```

Zone transitions are modally related — each adjacent pair shares five or more
pitch classes. The full sequence D Aeolian → D Dorian → A Aeolian → E Phrygian
→ G Aeolian is a connected path through that modal graph; any step in it sounds
like a gradual tonal drift rather than a key change.

### Zone sequence generation

```js
const ZONE_LEN  = 1801;   // cycles per zone (~30 min at cps=1); 1801 is prime
const NUM_ZONES = 12;     // unique zones before sequence repeats (~6 hours at cps=1)

const zoneTypes = Array.from({ length: NUM_ZONES }, (_, i) =>
  HARMONIC_ZONES[Math.floor(rng.at(i) * HARMONIC_ZONES.length)]
);
```

Total unique zone arc: 12 × 1801 = 21 612 cycles ≈ 6 hours at cps=1. Combined
with incommensurate layer periods and LFOs, perceptual repetition is effectively
zero across any listening session.

### Note pool per layer

- **Sub bass (1):** root and 5th only (e.g. D1, A1). Keeps the foundation
  unambiguous regardless of which upper-register notes are sounding.
- **Mid drones (2a, 2b):** root, 5th, octave, and minor 7th (e.g. D2, A2, D3, C3).
- **Harmonic pad (3):** all zone notes, used as 4-note voicings (7th chords and
  sus variants). Example D Aeolian voicings: [D,F,A,C], [D,F,A,E], [A,C,E,G].
- **FM swell (4):** root, 4th, 5th, and minor 7th — the "power" notes that
  survive heavy FM modulation without becoming dissonant.
- **High shimmer (5):** zone notes in octaves 4–5, plus the 9th and 11th where
  available.
- **Sparse events (7):** all zone notes across octaves 3–5. Most variety allowed
  here since events are isolated rather than sustained simultaneously.

---

## Randomization strategy

Two tiers operate simultaneously.

### Tier 1 — Per-layer LFOs (seconds to minutes)

Every continuous parameter is driven by `perlin.slow(n)` or `sine.slow(n)` at
a prime period. No two layers share any period value. This is what makes each
layer feel alive from moment to moment.

All periods below are in cycles (= seconds at cps=1). All are prime.

| Layer | Parameter | Signal | Period (s) |
|-------|-----------|--------|------------|
| Sub bass | gain (presence) | `sine.slow(191)` | 191 |
| Sub bass | detune | `perlin.slow(67)` | 67 |
| Drone A | gain (presence) | `sine.slow(127)` | 127 |
| Drone A | detune | `perlin.slow(53)` | 53 |
| Drone B | gain (presence) | `sine.slow(163)` | 163 |
| Drone B | detune | `perlin.slow(37)` | 37 |
| Pad | gain (presence) | `sine.slow(149)` | 149 |
| Pad | cutoff | `perlin.slow(89)` | 89 |
| Pad | pan | `perlin.slow(43)` | 43 |
| FM swell | gain (presence) | `sine.slow(89)` | 89 |
| FM swell | FM depth | `perlin.slow(73)` | 73 |
| FM swell | harmonicity | `perlin.slow(83)` | 83 |
| Shimmer | gain (presence) | `sine.slow(211)` | 211 |
| Shimmer | detune | `perlin.slow(61)` | 61 |
| Shimmer | pan | `perlin.slow(29)` | 29 |
| Noise | gain | `perlin.slow(151)` | 151 |
| Noise | cutoff | `perlin.slow(97)` | 97 |
| Events | gain | `perlin.slow(41)` | 41 |
| Events | release | `perlin.slow(19)` | 19 |
| Industrial | gain (presence) | `sine.slow(173)` | 173 |
| Industrial | speed (pitch) | `perlin.slow(101)` | 101 |
| Industrial | pan | `rand` | per-event |
| Metal | speed (pitch) | `perlin.slow(59)` | 59 |
| Metal | pan | `rand` | per-event |

### FX constants (delay — baked in per layer)

These are fixed constants, not LFO-driven. No entry in the period table is needed.
Delay times are non-rhythmic at cps=1 and distinct from each other. Feedback < 0.5
prevents runaway build-up. Note: `.fade()` is NOT a valid Strudel pattern method.

| Layer | `.delay()` wet | `.delaytime()` s | `.delayfeedback()` |
|-------|---------------|-----------------|-------------------|
| Drone A | 0.14 | 2.3 | 0.38 |
| Drone B | 0.12 | 1.9 | 0.34 |
| Pad | 0.10 | 1.7 | 0.30 |
| FM swell | 0.07 | 1.3 | 0.26 |
| Shimmer | 0.18 | 0.11 | 0.46 |

All other layers (sub bass, noise, sparse events, industrial, metal): no delay.

### Tier 2 — Zone macro-structure (tens of minutes)

Two very slow perlin signals ride above the LFOs as "zone drift", pushing
overall brightness and density through slow arcs:

```js
const brightnessDrift = perlin.slow(1801).range(-200, 200);  // shifts cutoff ceilings
const densityDrift    = perlin.slow(2003).range(-0.05, 0.05); // shifts gain envelopes
```

Periods 1801 and 2003 are both prime and incommensurate with all LFO periods.
Their joint period is > 3.6 million seconds (≈ 41 days). The harmonic zone
sequence (driven by rng) handles tonal-center macro-structure; brightness/density
drifts handle the energy axis. Together they ensure any 30-minute window has a
different character from any other.

---

## Strudel REPL demo

Paste into the Strudel REPL at strudel.cc to hear all seven layers. This is a
self-contained approximation of `buildPattern`'s output. The actual implementation
decomposes this into modular functions per backlog items 4–7, driven by `params`
and `rng` rather than the literals below.

Note: at `setcps(1)` all `.slow(n)` values equal n seconds. Reduce `setcps` to
`setcps(0.5)` to halve the tempo and hear how longer presence arcs feel.

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// Ambient Drone — Strudel REPL demo
// cps = 1 → 1 cycle per second; all slow() values are in seconds.
// ─────────────────────────────────────────────────────────────────────────────

setcps(1)

// ─── LAYER 1: SUB BASS ────────────────────────────────────────────────────────
// Deep sine tone, barely audible most of the time, whose presence creates a
// physical sense of depth when it rises.  191-second presence arc.

const subBass = note("<d1 d1 a0 d1 g0 d1>")
  .s("sine")
  .gain(sine.slow(191).range(0, 0.42))
  .attack(18).sustain(1).release(16)
  .detune(perlin.slow(67).range(-4, 4))
  .pan(0.5)
  .room(0.97).size(0.99).orbit(1)
  .slow(277)

// ─── LAYER 2: MID DRONE PAIR ─────────────────────────────────────────────────
// Two sines detuned against each other.  droneB stays slightly sharp of droneA,
// producing beating whose rate drifts independently.  Different presence periods
// (127 vs 163 s) mean they rarely peak at the same time.

const droneA = note("<d2 d2 d2 a1 a1 d2 g1 d2>")
  .s("sine")
  .gain(sine.slow(127).range(0, 0.36))
  .attack(12).sustain(1).release(10)
  .detune(perlin.slow(53).range(-8, 8))
  .pan(0.40)
  .room(0.95).size(0.98).orbit(1)
  .slow(277)

const droneB = note("<d2 d2 d2 a1 a1 d2 g1 d2>")
  .s("sine")
  .gain(sine.slow(163).range(0, 0.28))
  .attack(14).sustain(1).release(10)
  .detune(perlin.slow(37).range(6, 22))
  .pan(0.60)
  .room(0.95).size(0.98).orbit(1)
  .slow(277)

// ─── LAYER 3: HARMONIC PAD ───────────────────────────────────────────────────
// Chord voicings from Dm7 / Am7 / Gm7 family.  Heavily filtered sawtooth;
// cutoff breathes on an 89-second perlin.  149-second presence arc.

const pad = note("<[d3,f3,a3,c4] [d3,f3,a3,e4] [a2,c3,e3,g3] [d3,g3,c4,f4]>")
  .s("sawtooth")
  .gain(sine.slow(149).range(0, 0.12))
  .attack(9).sustain(1).release(9)
  .cutoff(perlin.slow(89).range(260, 1500))
  .resonance(2)
  .pan(perlin.slow(43).range(0.28, 0.72))
  .room(0.88).size(0.93).orbit(2)
  .slow(421)

// ─── LAYER 4: FM SWELL ───────────────────────────────────────────────────────
// Sine carrier with slowly varying FM depth and harmonicity.  Creates metallic,
// organic swells that are the most dynamically variable layer.  89-second
// presence arc (shortest = most frequent entrances).

const fmSwell = note("<d3 a2 g3 e3 d3>")
  .s("sine")
  .fm(perlin.slow(73).range(0.5, 4))
  .fmh(perlin.slow(83).range(0.3, 2))
  .gain(sine.slow(89).range(0, 0.18))
  .attack(11).sustain(1).release(13)
  .cutoff(perlin.slow(73).range(400, 2200))
  .pan(perlin.slow(47).range(0.2, 0.8))
  .room(0.90).size(0.94).orbit(3)
  .slow(337)

// ─── LAYER 5: HIGH SHIMMER ───────────────────────────────────────────────────
// Upper-register notes waxing and waning on a 211-second presence arc.
// Wide detuning range creates a shimmering, beating halo.

const shimmer = note("<f4 a4 e4 c4 g4 a3 f4>")
  .s("sine")
  .gain(sine.slow(211).range(0, 0.09))
  .attack(16).sustain(0.8).release(14)
  .detune(perlin.slow(61).range(-22, 22))
  .pan(perlin.slow(29).range(0.12, 0.88))
  .room(0.94).size(0.97).orbit(4)
  .slow(641)

// ─── LAYER 6: NOISE ATMOSPHERE ───────────────────────────────────────────────
// Brown noise, heavily filtered.  Each cycle triggers a new grain with a
// 2-second attack/release; overlapping grains form a continuous bed.
// Level and cutoff breathe on incommensurate primes.

const atmosphere = s("brown")
  .gain(perlin.slow(151).range(0.04, 0.14))
  .cutoff(perlin.slow(97).range(100, 480))
  .resonance(1.5)
  .attack(2).sustain(1).release(2)
  .pan(0.5)
  .room(0.55).size(0.68).orbit(5)

// ─── LAYER 7: SPARSE EVENTS ──────────────────────────────────────────────────
// Notes from D Aeolian + colour tones.  degradeBy(0.72) → ~28% survive
// → ~2.8 events per 97-second slot cycle → roughly 1 event per 35 seconds.
// Release varies per event for tail-length variety.

const events = note("d3 f3 a3 c4 g3 d4 e3 a4 c5 f4")
  .s("sine")
  .gain(perlin.slow(41).range(0.10, 0.24))
  .attack(0.5).release(perlin.slow(19).range(2, 12))
  .pan(rand.range(0.12, 0.88))
  .room(0.95).size(0.98).orbit(6)
  .degradeBy(0.72)
  .slow(97)

// ─── LAYER 8: INDUSTRIAL HITS ────────────────────────────────────────────────
// Sampled industrial sounds played sparsely into a cavernous reverb.
// The large .room/.size values simulate the "recorded in a large hall" quality.
// Presence arc: 173 s.  Speed variation shifts pitch down for weight/distance.
//
// REPL NOTE: load CDN samples for in-browser testing only:
//   await samples('github:tidalcycles/Dirt-Samples/master')
// Production uses vendored /samples/strudel.json — never the CDN URL.

const industrialHits = s("industrial")
  .n(irand(32))
  .gain(sine.slow(173).range(0, 0.28))
  .speed(perlin.slow(101).range(0.35, 0.95))
  .pan(rand.range(0.05, 0.95))
  .room(0.96).size(0.99).orbit(7)
  .degradeBy(0.80)
  .slow(113)

// ─── LAYER 9: METAL HITS ─────────────────────────────────────────────────────
// Metallic strikes with extreme reverb.  Speed < 1 shifts pitch downward,
// giving the samples a lower, more massive character; combined with size(0.99)
// they ring out like a struck girder in a hangar.

const metalHits = s("metal")
  .n(irand(10))
  .gain(perlin.slow(157).range(0.05, 0.20))
  .speed(perlin.slow(59).range(0.25, 0.80))
  .pan(rand.range(0.1, 0.9))
  .room(0.97).size(0.99).orbit(8)
  .degradeBy(0.86)
  .slow(79)

// ─── ASSEMBLY ─────────────────────────────────────────────────────────────────
stack(
  subBass, droneA, droneB,
  pad, fmSwell, shimmer,
  atmosphere, events,
  industrialHits, metalHits,
)
```

### REPL vs. generator implementation differences

| Aspect | REPL demo | `buildPattern` implementation |
|--------|-----------|-------------------------------|
| Tempo | `setcps(1)` in-pattern | Set by `engine.js`; generator is CPS-agnostic |
| Harmony | Literals in mini-notation | Note pools derived from zone sequence + `rng` |
| Zone structure | Absent (macro drift via `perlin.slow(1801)`) | 12-zone `cat()` sequence, each `.slow(ZONE_LEN)` |
| Randomness | Strudel built-in `perlin` / `rand` | Structural choices via `rng`; LFOs via `perlin` |

The `perlin` and `rand` signals inside patterns are Strudel-internal and cycle-
deterministic — they do not conflict with the seeded-rng principle. Use `rng`
for structural decisions (zone order, pitch pools, initial voice counts); use
`perlin` / `rand` for continuous within-cycle modulation.

---

## Generator implementation sketch

```js
// src/generator.js (sketch — not final code)
import { note, s, stack, cat } from "@strudel/core";

const HARMONIC_ZONES = [
  { id: "d-aeolian",  root: "d", notes: ["d","f","a","c","e","g"]      },
  { id: "d-dorian",   root: "d", notes: ["d","f","a","c","e","f#","g"] },
  { id: "a-aeolian",  root: "a", notes: ["a","c","e","g","b","d","f"]  },
  { id: "e-phrygian", root: "e", notes: ["e","f","a","b","c","d","g"]  },
  { id: "g-aeolian",  root: "g", notes: ["g","bb","d","f","a","c","eb"]},
];

const ZONE_LEN  = 1801;
const NUM_ZONES = 12;

export function buildPattern(params, rng) {
  const zones = Array.from({ length: NUM_ZONES }, (_, i) =>
    HARMONIC_ZONES[Math.floor(rng.at(i) * HARMONIC_ZONES.length)]
  );

  return stack(
    buildSubBassLayer(zones, params, rng),    // backlog #4
    buildDroneLayer(zones, params, rng),      // backlog #4
    buildPadLayer(zones, params, rng),        // backlog #4
    buildFmSwellLayer(zones, params, rng),    // backlog #4
    buildShimmerLayer(zones, params, rng),    // backlog #4
    buildNoiseLayer(params),                  // backlog #5
    buildEventLayer(zones, params, rng),      // backlog #6
    buildIndustrialLayer(params, rng),        // backlog #5b
    buildMetalLayer(params, rng),             // backlog #5b
  );
}
```

Each `build*Layer` function:
1. Translates zone notes into the correct octave range for that layer
2. Assembles a `cat(...zones.map(z => buildZoneVoice(z).slow(ZONE_LEN)))` structure
3. Applies the layer's presence envelope and per-parameter LFOs from the tables above
4. Applies FX chain from `params`

---

## Samples

**Decision: Option A — vendored locally.** Two Dirt-Samples banks are committed
to the repo in `public/samples/`. No CDN dependency at runtime. See
`architecture.md §D2` for the updated constraint language.

### Banks

| Bank | Files | Size | Character |
|------|-------|------|-----------|
| `industrial` | 32 | ~580 KB | Industrial hits, scrapes, mechanical impacts |
| `metal` | 10 | ~353 KB | Metallic strikes, rings, resonant clangs |

Source: `github:tidalcycles/Dirt-Samples/master` (fetched once during dev setup).

### Setup

```bash
npm run vendor-samples   # downloads to public/samples/, generates strudel.json
git add public/samples   # commit the vendored files
```

The script (`scripts/vendor-samples.mjs`) is idempotent — re-running skips
existing files. To add more banks, extend the `BANKS` object in that script.

### Registration in engine.js

```js
// engine.js — alongside the superdough import, once at startup:
await samples('/samples/strudel.json');
```

This is the only permitted sample registration call. Do not register samples
anywhere other than `engine.js`; do not use a CDN URL.

### Tonal strategy

The Dirt-Samples `industrial` and `metal` banks are short, relatively dry
recordings. The "large hall" character comes from applying maximum reverb in
the pattern (`.room(0.96–0.97).size(0.99)`), not from pre-reverbed samples.
Speed values below 1.0 (`.speed(perlin.slow(n).range(0.25, 0.95))`) shift
the samples downward in pitch, giving them more mass and a sense of distance,
as if the source is at the far end of a large space.

---

## Future control surface

These parameters map cleanly onto user-facing "more/less X" controls. None are
built in v1. They belong in `params.js` and backlog item 10.

### Denser / sparser (events)

`eventSparsity` (0–1, default 0.72) maps directly to `.degradeBy(eventSparsity)`.
At 0.9: very rare events (one per several minutes). At 0.5: events every ~15 s.
Also `eventSlotPeriod` (cycles, default 97) increases or decreases slot density
independently.

### Darker / brighter

`brightness` (−1 to +1, default 0) scales the upper bound of every layer's
`.cutoff().range()`. At +1 the ceiling doubles; at −1 it halves. Additionally
`shimmerLevel` (0–1) scales the shimmer presence maximum and adds or subtracts
overtone energy.

```js
const cutoffHi = baseCutoffHi * (1 + params.brightness);
.cutoff(perlin.slow(n).range(baseCutoffLo, cutoffHi))
```

### More / less melodic

`eventGain` shifts the `.range()` bounds on the events layer's gain LFO upward
or downward. `padGain` shifts the pad into or out of the foreground. `fmSwellGain`
controls whether FM swells are present at all (a perceptually large difference).

### Layer activity (overall presence richness)

`layerActivity` (0–1, default 0.8) scales the `maxGain` bound in every presence
envelope simultaneously:

```js
.gain(sine.slow(presencePeriod).range(0, maxGain * params.layerActivity))
```

At 0.3: only one or two layers are ever substantially audible. At 1.0: full
layering; richer but potentially busier.

### More / less reverb / spaciousness

`reverbSend` (0–1) and `reverbSize` (0–1) scale `.room()` and `.size()` across
all orbits. These already appear as named knobs in backlog item 3.

`detuneSpread` (semitones, 0–30) scales the `.range()` width of both drone
detune LFOs. Wider spread → thicker beating → more diffuse spatial image.

### Layer-level balance

Individual gain params: `subBassGain`, `droneGain`, `padGain`, `fmSwellGain`,
`shimmerGain`, `noiseLevel`. Each scales the `maxGain` of the corresponding
presence envelope without changing the presence cycle timing.

---

## Constraints agents must not break

- **All note values must come from the current zone's pitch set.** Do not
  introduce pitches outside the zone pool.
- **No two layers may share a `.slow()` period or an LFO period.** The tables
  above are the canonical list. Any new period must be prime and not already in use.
- **`degradeBy` and `rand` use Strudel's internal hash (fine), not `Math.random()`.**
  The seeded `rng` is for structural choices only.
- **Zone changes must be gradual in perception.** The long attack/release envelopes
  (≥ 9 s) ensure zone-boundary swaps don't produce clicks. Do not shorten below
  6 seconds.
- **If samples are added (Option A):** the sample loading call must use a local
  path, never a CDN URL. `engine.js` is the only permitted import site for audio
  concerns; sample registration belongs there alongside the superdough import.
