# Engine Wrapper Design — Story 2

**Date:** 2026-06-11
**Status:** Approved

---

## Scope

Implement `src/engine.js`: the single audio-lifecycle module that wraps Strudel's
scheduler and exposes a minimal, stable surface to the rest of the app. This is
backlog item 2.

---

## Architecture

### Module structure

`engine.js` is a flat ES module with named exports. No class, no factory function.
Module-level variables hold the scheduler instance and an `audioResumed` flag.

This matches the rest of the codebase and requires no instantiation ceremony.
There is exactly one engine per page, ever.

### Initialization (eager)

At module load, `repl({ defaultOutput: webaudioOutput, getTime })` is called to
create the scheduler. This produces no sound: browsers create an `AudioContext`
in a suspended state until a user gesture fires. The scheduler sits idle.

No async work, no audible side-effects at import time.

---

## Public API

```js
export async function start()        // resume context + start/resume scheduler
export function stop()               // pause scheduler in place
export function setPattern(pattern)  // swap pattern at next cycle boundary
```

### `start()` — async

1. On the first call: `audioContext.resume()` to satisfy the browser gesture
   requirement. Sets `audioResumed = true`.
2. On every call: tells the scheduler to start/resume from its current position.
3. If `setPattern()` has not been called yet, the scheduler starts silently.

### `stop()` — synchronous

Pauses the scheduler. The `AudioContext` stays open; the scheduler preserves its
clock position. A subsequent `start()` resumes from exactly the same point.
True pause/resume — not restart.

### `setPattern(pattern)` — synchronous

Delegates to the scheduler's built-in pattern-swap mechanism. Takes effect at the
next cycle boundary — no audible glitch beyond the boundary swap. Can be called
before or after `start()`.

---

## Import boundary

`engine.js` is the **only** file permitted to import `@strudel/webaudio` or
`superdough`. This is an architectural invariant (see `architecture.md` §2 and §6).

Corollaries:
- `main.js` and all future modules call only `engine.start/stop/setPattern`.
- When Story 5b adds sample registration (`samples('/samples/strudel.json')`),
  that call also lives here, not in the generator.

---

## Acceptance wiring (temporary)

Story 3 (params/generator) doesn't exist yet. To exercise the engine:

- `main.js` sets a throwaway constant pattern via `engine.setPattern(...)` on page
  load — e.g. `note("c3").sound("sine")` as a minimal single-voice drone.
- A second pattern (`note("g3").sound("sine")`) can be swapped in from the browser
  console to verify live swap at the cycle boundary.

**This `main.js` wiring is temporary scaffolding** and is replaced when
`buildPattern(params, rng)` exists in Story 3.

---

## Acceptance criteria (from backlog)

- A throwaway constant pattern can be started/stopped from the button and swapped
  live via `setPattern` without a glitch beyond the cycle boundary.
- No module other than `engine.js` imports `@strudel/webaudio` / `superdough`.
