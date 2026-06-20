# Story 7: Space & FX — Design Spec

**Date:** 2026-06-20
**Backlog item:** 7 — Space & FX
**Status:** Ready for implementation

---

## Goal

Add delay and reverb fade to the pitched synthesis layers, giving each one a
spatial field calibrated to its register. Reverb (`.room`/`.size`) is already in
place on all layers; this story adds `.delay`/`.delaytime`/`.delayfeedback` and
`.fade` where they belong.

---

## What is already done (not in scope)

- `.room()` + `.size()` on every layer, driven by `reverbSend` / `reverbSize` params
- Detune + beating on sub bass, drone pair, shimmer
- Pan spread scaling with `stereoWidth` param

---

## Layer assignment

Every pitched synthesis layer gets delay calibrated to register. Sample layers
and the noise bed are excluded.

| Layer | Orbit | Delay character | Rationale |
|-------|-------|-----------------|-----------|
| Sub bass | 1 | None | Low end stays clean; delay blooms into muddy resonance |
| Drone pair (A+B) | 1 | Long spatial | Foundational layers benefit most from depth illusion |
| Harmonic pad | 2 | Medium spatial | Mid-register blur widens the chord spread |
| FM swell | 3 | Medium spatial, low wet | Swells already dynamic; delay adds ambient trail |
| High shimmer | 4 | Short shimmer | Fast repeats create a halo without being heard as echo |
| Noise atmosphere | 5 | None | Grounding bed; delay smears the frequency |
| Sparse events | 6 | None | Long release already present; delay creates trailing mud |
| Industrial hits | 7 | None | Cavernous reverb already the intended effect |
| Metal hits | 8 | None | Same |

---

## Parameter values

Delay times are non-rhythmic at cps=1 (no integer or simple-fraction multiples
of 1 s) and distinct from each other. Feedback stays below 0.5.

| Layer | `.delay()` | `.delaytime()` | `.delayfeedback()` | `.fade()` |
|-------|-----------|---------------|-------------------|-----------|
| Drone A | 0.14 | 2.3 s | 0.38 | 4.0 |
| Drone B | 0.12 | 1.9 s | 0.34 | 4.0 |
| Pad | 0.10 | 1.7 s | 0.30 | 3.0 |
| FM swell | 0.07 | 1.3 s | 0.26 | — |
| Shimmer | 0.18 | 0.11 s | 0.46 | — |

`.fade()` controls how quickly the convolution reverb tail builds — it makes
the reverb bloom from silence rather than snap in. On sustained drone layers
this softens zone-boundary transitions. Not applied to FM swell or shimmer
where the existing ADSR envelope already handles the tail shape.

No LFO periods are introduced — all values are constants. No entries needed in
the period tables in `generative-pattern.md`.

---

## Files changed

### `src/generator.js` (only file with code changes)

Four function bodies change; no new functions, no new imports:

- **`buildDroneLayer`**: `droneA` gains `.delay(0.14).delaytime(2.3).delayfeedback(0.38).fade(4.0)`; `droneB` gains `.delay(0.12).delaytime(1.9).delayfeedback(0.34).fade(4.0)`
- **`buildPadLayer`**: gains `.delay(0.10).delaytime(1.7).delayfeedback(0.30).fade(3.0)`
- **`buildFmSwellLayer`**: gains `.delay(0.07).delaytime(1.3).delayfeedback(0.26)`
- **`buildShimmerLayer`**: gains `.delay(0.18).delaytime(0.11).delayfeedback(0.46)`

### `docs/generative-pattern.md`

Update the LFO/period tables to note these FX constants exist and why those
specific values were chosen. No new period rows (these are constants, not LFO
periods).

### Not changed

- `src/params.js` — no new params; all values baked in
- `src/engine.js` — no changes
- `src/ui/` — no changes

---

## Size check

`generator.js` is 245 LoC before this story. Four single-line chain additions
bring it to ~249 LoC — well within the ~300 LoC threshold.

---

## Invariants preserved

- No new `.slow()` or LFO periods introduced → no risk of shared periods
- All delay feedback < 0.5 → no runaway feedback build-up
- No new imports in `generator.js`
- `engine.js` remains the only superdough import site
- `params.js` unchanged → controls panel extension path unaffected

---

## Acceptance criteria

- Long, smooth reverb tails on drone and pad layers; no metallic/ringing artifacts
- Shimmer layer has audible but subtle halo character
- Reverb size and send still respond to `reverbSize` / `reverbSend` params (unchanged)
- Wide stereo image maintained (unchanged)
- `npm run build` succeeds; no new network requests
