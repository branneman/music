# Story 1: Project Scaffold & Offline Build

**Date:** 2026-06-11  
**Status:** Approved  
**Backlog item:** [docs/backlog.md — §1](../../backlog.md)

---

## Goal

A buildable, deployable empty shell that proves the offline and hosting constraints. No audio functionality — that lands in stories 2–9.

---

## Files

| Path | Action | Notes |
|---|---|---|
| `index.html` | Create | One `<button>` + `<main>` mount point; `<script type="module" src="/src/main.js">` |
| `styles.css` | Create | Minimal reset + centered button, dark background |
| `vite.config.js` | Create | `base: '/'`, `build.outDir: 'dist'` |
| `package.json` | Update | Add scripts, deps, change `type` to `"module"` |
| `public/CNAME` | Create | `music.bran.name` |
| `src/main.js` | Create | Imports stubs; wires button click to `engine.start()` as placeholder |
| `src/engine.js` | Create | Bare exports: `start`, `stop`, `setPattern` |
| `src/generator.js` | Create | Bare export: `buildPattern` |
| `src/params.js` | Create | Bare exports: `params`, `subscribe`, `set` |
| `src/rng.js` | Create | Bare export: `createRng` |
| `src/ui/transport.js` | Create | Bare export: `init` |

---

## Package changes

- **Dependencies:** `@strudel/core`, `@strudel/webaudio`
- **devDependencies:** `vite`, `gh-pages`
- **`package.json` `type`:** changed from `"commonjs"` to `"module"` — required because `@strudel/*` packages are ESM-only. The existing `scripts/vendor-samples.mjs` uses the `.mjs` extension so it is unaffected.
- **Scripts:**
  - `dev`: `vite`
  - `build`: `vite build`
  - `preview`: `vite preview`
  - `deploy`: `vite build && gh-pages -d dist`

---

## Stub approach

Bare exports only — correct export names, empty function bodies. No signatures, no JSDoc, no thrown errors. Stories 2, 3, and 9 replace each stub with real implementation; keeping stubs minimal avoids noise to read and delete.

---

## Acceptance criteria

- `npm run build` exits cleanly; `dist/` contains `CNAME`.
- `npm run dev` loads the page with a visible button.
- With DevTools Network throttled to "Offline", reloading serves the page with zero failed requests.
- `npm run deploy` is documented in the README; agent dry-run is acceptable.

---

## Invariants respected

- `engine.js` is the only future import site for `@strudel/webaudio` / `superdough` — scaffold wires this correctly even though stubs are empty.
- `docs/` is never served; Vite's `build.outDir` points to `dist/`.
- `public/CNAME` is copied into `dist/` by Vite automatically.
- No network requests at runtime.
