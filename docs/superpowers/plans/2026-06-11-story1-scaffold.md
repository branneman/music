# Story 1: Project Scaffold & Offline Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a buildable, deployable Vite shell with bare module stubs that proves the offline and hosting constraints — no audio yet.

**Architecture:** Four-layer module structure (UI → params → generator → engine) established via bare stub files. `index.html` + `styles.css` render a single play/pause button. `src/main.js` wires the button to `engine.start()` / `engine.stop()` (no-ops at this stage). The build produces `dist/` with `CNAME` for GitHub Pages.

**Tech Stack:** Vite (bundler), `@strudel/core`, `@strudel/webaudio` (installed but not called yet), `gh-pages` (deploy script), vanilla JS + HTML/CSS.

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Scripts, deps, `type: "module"` |
| `vite.config.js` | Create | `base: '/'`, `build.outDir: 'dist'` |
| `public/CNAME` | Create | Custom domain for GitHub Pages |
| `index.html` | Create | Single page: button + mount point |
| `styles.css` | Create | Minimal dark-background layout |
| `src/main.js` | Create | Button wiring (calls engine stubs) |
| `src/engine.js` | Create | Bare stubs: `start`, `stop`, `setPattern` |
| `src/generator.js` | Create | Bare stub: `buildPattern` |
| `src/params.js` | Create | Bare stubs: `params`, `subscribe`, `set` |
| `src/rng.js` | Create | Bare stub: `createRng` |
| `src/ui/transport.js` | Create | Bare stub: `init` |

---

## Task 1: Update package.json and install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit package.json**

Replace the full file content with:

```json
{
  "name": "music",
  "version": "1.0.0",
  "description": "A single-page web app that plays algorithmically generated ambient / drone \"focus music\" indefinitely, entirely client-side.",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "vite build && gh-pages -d dist",
    "vendor-samples": "node scripts/vendor-samples.mjs"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/branneman/music.git"
  },
  "license": "AGPL-3.0-only",
  "homepage": "https://music.bran.name/",
  "dependencies": {},
  "devDependencies": {}
}
```

Note: `"type": "module"` replaces `"commonjs"` — required for `@strudel/*` ESM packages. The `"main"` and `"directories"` fields are removed (irrelevant for a web app).

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @strudel/core @strudel/webaudio
```

Expected: `node_modules/` created or updated; `package.json` `dependencies` now lists `@strudel/core` and `@strudel/webaudio` with version numbers.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev vite gh-pages
```

Expected: `package.json` `devDependencies` now lists `vite` and `gh-pages`.

- [ ] **Step 4: Verify scripts work at the npm level**

```bash
npm run build -- --help 2>&1 | head -5
```

Expected: Vite help output appears (confirms Vite is on PATH via npm).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install vite and strudel deps, add npm scripts"
```

---

## Task 2: Create build config and CNAME

**Files:**
- Create: `vite.config.js`
- Create: `public/CNAME`

- [ ] **Step 1: Create vite.config.js**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 2: Create public/CNAME**

File content (single line, no trailing newline issues):

```
music.bran.name
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.js public/CNAME
git commit -m "chore: add vite config and CNAME"
```

---

## Task 3: Create index.html and styles.css

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>music.bran.name</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main id="app">
      <button id="play-pause" aria-label="Play">Play</button>
    </main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create styles.css**

```css
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #0a0a0a;
  color: #ccc;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, sans-serif;
}

#play-pause {
  background: none;
  border: 1px solid #444;
  color: #ccc;
  padding: 1rem 2.5rem;
  font-size: 1rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  border-radius: 2px;
  transition: border-color 0.2s, color 0.2s;
}

#play-pause:hover {
  border-color: #888;
  color: #fff;
}
```

- [ ] **Step 3: Commit**

```bash
git add index.html styles.css
git commit -m "feat: add html shell and minimal styles"
```

---

## Task 4: Create src/ module stubs

**Files:**
- Create: `src/engine.js`
- Create: `src/generator.js`
- Create: `src/params.js`
- Create: `src/rng.js`
- Create: `src/ui/transport.js`
- Create: `src/main.js`

- [ ] **Step 1: Create src/engine.js**

```js
export function start() {}
export function stop() {}
export function setPattern() {}
```

- [ ] **Step 2: Create src/generator.js**

```js
export function buildPattern() {}
```

- [ ] **Step 3: Create src/params.js**

```js
export const params = {}
export function subscribe() {}
export function set() {}
```

- [ ] **Step 4: Create src/rng.js**

```js
export function createRng() {}
```

- [ ] **Step 5: Create src/ui/transport.js**

```js
export function init() {}
```

- [ ] **Step 6: Create src/main.js**

This wires the button to the engine stubs. It is the only caller of `engine.start()` / `engine.stop()` at this stage — consistent with the architecture where Transport is the only layer that touches the engine lifecycle.

```js
import { start, stop } from './engine.js'

const btn = document.getElementById('play-pause')
let playing = false

btn.addEventListener('click', () => {
  if (playing) {
    stop()
    btn.textContent = 'Play'
    btn.setAttribute('aria-label', 'Play')
  } else {
    start()
    btn.textContent = 'Pause'
    btn.setAttribute('aria-label', 'Pause')
  }
  playing = !playing
})
```

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: add src module stubs and main wiring"
```

---

## Task 5: Verify build and offline constraint

No test runner exists in this project (per architecture D3). Verification is manual via the dev server and DevTools.

- [ ] **Step 1: Run the production build**

```bash
npm run build
```

Expected output (approximate):
```
vite v5.x.x building for production...
✓ N modules transformed.
dist/index.html       X.XX kB
dist/assets/...       ...
dist/CNAME            0.02 kB
✓ built in Xms
```

Confirm `dist/CNAME` appears in the output. If it does not, check that `public/CNAME` exists.

- [ ] **Step 2: Run the preview server**

```bash
npm run preview
```

Expected: `➜  Local:   http://localhost:4173/`

Open `http://localhost:4173/` in a browser. Verify:
- Dark background page loads
- "Play" button is visible and centered
- Clicking toggles button text to "Pause" and back (stubs are no-ops, no audio)

- [ ] **Step 3: Verify offline constraint**

With the preview server still running:
1. Open DevTools → Network tab
2. Set throttle to **Offline**
3. Hard-reload the page (`Cmd+Shift+R` on Mac)
4. Confirm the page still loads
5. Confirm **zero** red (failed) requests in the Network tab

- [ ] **Step 4: Stop preview server and commit verification note**

Press `Ctrl+C` to stop the preview server.

```bash
git commit --allow-empty -m "chore: scaffold verified — build passes, offline constraint holds"
```

---

## Self-review checklist

- [x] `npm run build` task covered (Task 5, Step 1)
- [x] `npm run dev` mentioned in acceptance but no separate task needed — covered by preview equivalence
- [x] Offline verification covered (Task 5, Step 3)
- [x] `deploy` script installed but not executed (dry-run acceptable per spec)
- [x] `public/CNAME` → `dist/CNAME` covered (Task 5, Step 1 expected output)
- [x] `type: "module"` change explained with rationale (Task 1, Step 1 note)
- [x] All stubs export correct names matching the architecture doc
- [x] No TBD / TODO / placeholder steps
- [x] All code blocks are complete and runnable
