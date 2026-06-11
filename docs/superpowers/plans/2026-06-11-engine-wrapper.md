# Engine Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `src/engine.js` — the single audio-lifecycle module — so that a throwaway constant pattern can be started, stopped, and swapped live via the play/pause button.

**Architecture:** Flat named-export ES module. `webaudioRepl()` is called eagerly at module load to create the Strudel scheduler (AudioContext starts suspended). `start()` resumes the AudioContext on first call (satisfying the browser gesture requirement) then starts the scheduler; `stop()` pauses the scheduler in place; `setPattern()` swaps the pattern at the next cycle boundary. `engine.js` is the only file that may import `@strudel/webaudio`.

**Tech Stack:** `@strudel/webaudio` (webaudioRepl, getAudioContext), `@strudel/core` (note, sound — used only in throwaway test wiring in main.js), Vite, vanilla JS.

---

### Task 1: Implement `src/engine.js`

**Files:**
- Modify: `src/engine.js`

**Context:**
- `webaudioRepl` from `@strudel/webaudio` wraps `repl()` with the Web Audio context pre-configured. It returns `{ start, stop, pause, setPattern, scheduler, ... }`.
- `pause()` halts the scheduler clock in place (preserves position). `stop()` resets the clock to zero. We want `pause()` for our `engine.stop()`.
- `getAudioContext()` from `@strudel/webaudio` returns the shared AudioContext (re-exported from superdough). It is created in a suspended state before a user gesture.
- The `setPattern` returned by `webaudioRepl` is async; we fire-and-forget since the swap takes effect at the next cycle boundary and we don't need to await it.
- `engine.js` is the **only** file allowed to import `@strudel/webaudio`.

- [ ] **Step 1: Replace the stub**

Replace the entire contents of `src/engine.js` with:

```js
import { webaudioRepl, getAudioContext } from '@strudel/webaudio'

const { start: _start, pause: _pause, setPattern: _setPattern } = webaudioRepl()
let audioResumed = false

export async function start() {
  if (!audioResumed) {
    await getAudioContext().resume()
    audioResumed = true
  }
  _start()
}

export function stop() {
  _pause()
}

export function setPattern(pattern) {
  _setPattern(pattern)
}
```

- [ ] **Step 2: Verify the build passes**

```bash
npm run build
```

Expected: Build completes with no errors. `dist/` is produced.

- [ ] **Step 3: Commit**

```bash
git add src/engine.js
git commit -m "feat: implement engine wrapper (Story 2)"
```

---

### Task 2: Wire throwaway test pattern in `src/main.js`

**Files:**
- Modify: `src/main.js`

**Context:**
- `note` and `sound` are both exported from `@strudel/core` (not `@strudel/webaudio`), so importing them here does not violate the import boundary.
- The engine must already be imported before patterns are built, because importing `engine.js` sets up the Web Audio prototype extensions that make `.sound()` available on Pattern objects.
- We expose `window._swapPattern` so the tester can call it from the browser DevTools console to verify live pattern swap at the cycle boundary.
- This entire test wiring is **temporary scaffolding** — it will be replaced when Story 3 (params + generator) lands.

- [ ] **Step 1: Replace `src/main.js` with test-wired version**

```js
import { start, stop, setPattern } from './engine.js'
import { note } from '@strudel/core'

// Throwaway test patterns — replaced by buildPattern(params, rng) in Story 3
const patternA = note('c3 c3 g3 c3').sound('sine').slow(8)
const patternB = note('e3 e3 b3 e3').sound('sine').slow(8)

setPattern(patternA)

// Run from browser console to verify live swap: _swapPattern()
window._swapPattern = () => setPattern(patternB)
window._swapBack = () => setPattern(patternA)

const btn = document.getElementById('play-pause')
let playing = false

btn.addEventListener('click', async () => {
  if (playing) {
    stop()
    btn.textContent = 'Play'
    btn.setAttribute('aria-label', 'Play')
  } else {
    await start()
    btn.textContent = 'Pause'
    btn.setAttribute('aria-label', 'Pause')
  }
  playing = !playing
})
```

Note the two changes vs the original `main.js`: `start()` is now awaited (it is `async`), and `setPattern` is imported and called on load.

- [ ] **Step 2: Verify the build still passes**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "chore: wire throwaway test pattern for Story 2 acceptance"
```

---

### Task 3: Manual acceptance verification

**Files:** None modified — this task is verification only.

**Context:**
Acceptance criteria from the backlog:
1. A throwaway constant pattern can be started/stopped from the button and swapped live via `setPattern` without a glitch beyond the cycle boundary.
2. No module other than `engine.js` imports `@strudel/webaudio` / `superdough`.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open the URL printed in the terminal (typically `http://localhost:5173`).

- [ ] **Step 2: Verify start and stop**

Click the Play button. You should hear a repeating rising sine-wave phrase (`c3 c3 g3 c3`). The button label should change to "Pause".

Click Pause. Audio should stop immediately. The button label should return to "Play".

Click Play again. Audio should resume from approximately the same position (true pause, not restart).

- [ ] **Step 3: Verify live pattern swap**

While audio is playing, open DevTools → Console and run:

```js
_swapPattern()
```

You should hear the pattern change to `e3 e3 b3 e3` at the next cycle boundary (within a few seconds) with no audible click or glitch.

Run `_swapBack()` to confirm the reverse swap also works cleanly.

- [ ] **Step 4: Verify the import boundary**

```bash
grep -r "strudel/webaudio\|superdough" src/ --include="*.js" -l
```

Expected output: only `src/engine.js`. No other file should appear.

- [ ] **Step 5: Stop the dev server** (`Ctrl+C`)
