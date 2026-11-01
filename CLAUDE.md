# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

*Polvo y Barro* is an isometric rally/off-road browser game (2D physics, isometric rendering) with an arcade mode, a championship mode and a track editor (the editor stays top-down). It uses plain HTML/CSS/ES-module JavaScript on canvas, with **no dependencies, no build step, no tests and no linter**. All UI text, identifiers, comments, commit messages and the README are in **Spanish**; keep it that way.

## Commands

```bash
python3 -m http.server 8000           # run locally (ES modules need a server), open http://localhost:8000
node tools/build-single.mjs           # bundle into dist/polvo-y-barro.html (single file, inline CSS/JS)
node tools/build-single.mjs --fragment  # same, without <html>/<head>/<body> (for embedding)
```

Debug from the browser console: `__pyb.game.cars`, `__pyb.game.track`, `__pyb.editor.def` (`window.__pyb` also exposes `audio`, `career`).

## Architecture

Module dependency order (also the concatenation order in `tools/build-single.mjs`): `util → config → tracks → track → car → iso → audio → game → career → editor → main`.

- **`main.js`** is the only module with global side effects. It wires the DOM, tabs, input, the `requestAnimationFrame` loop and persistence of preferences, and it creates the other subsystems through factories (`createGame(cv, hooks)`, `createEditor(cv, hooks)`, `createAudio()`, `createCareer()`). Subsystems never touch each other directly. They call back into `main.js` through the `hooks` object (`hooks.sfx`, `hooks.onResults`, `hooks.livery`, `hooks.test`, `hooks.save`, …).
- **`config.js`** holds all tuning data: surfaces (`SURF`, `VERGE`), environments (`THEME`, which sets the off-track surface and decor), object collision (`OBJ`), physics (`PHYS`), car models, upgrades and prices, and weather/night `CONDITIONS`. `carSpec(id, upgrades)` turns a model plus upgrade levels into effective stats. Handling changes belong here.
- **`track.js`**: a track definition (`{pts, objs, patches, type, theme, ...}`, format documented in the README) is turned into a Catmull-Rom spline sampled every `SP` = 8 px. Each sample stores position, normal, width, surface and the curvature over the next ~100 px. Pace notes and AI target speeds both come from that. `buildTrack` also finds self-intersections and turns the second pass into a bridge (the layer is tracked per car). The ground and the tree canopy are pre-rendered once into two 2400×1500 (`WW`×`WH`) canvases; the game passes `{ iso: true }` and only uses the ground (ramps, canopy and gate posts are drawn with volume instead), while the editor still uses both. `normalizeDef`/`cleanDef` sanitize defs from the editor or storage, and `trackKey` hashes a def for records and ghosts.
- **`game.js`**: fixed-step physics at 1/120 s, rival AI, damage, cones, particles, rain/night rendering and the HUD. `simulate(rival)` runs the same simulation headless (`sim = true`, which suppresses sfx, particles and dirt) to compute rival times in rally championship events. Any new side effect inside the step must respect the `sim` flag.
- **Isometric view**: `isoView()` in `util.js` builds the 2:1 projection (world `x, y` plus height `z`). Physics never sees it. `game.js` blits the top-down ground canvas through the iso transform, then draws everything with height sorted by `x + y` (bridge pieces get a +40 bias and cars on a bridge +80). Bridge deck heights are stored per sample in `S[i].z` (`findBridges`).
- **`car.js`**: procedural car sprites drawn once at high resolution per livery/model (`LIVERIES`), with dirt overlays from the surfaces driven. `drawCarIso` stacks layers of that sprite at increasing heights (sprite stacking).
- **`iso.js`**: scene objects with volume (billboards for trees/rocks/cacti/bales, plus cones, nitro cans, ramps, lamps, gate arches and bridge pieces).
- **Arcade mode** (`mode === 'arcade'` in `game.js`, run state in `main.js`, stages in `ARCADE_STAGES`, tuning in `ARCADE`): countdown timer where each gate adds the reference driver's split time × `slack`, plus drift scoring.
- **`audio.js`**: everything is synthesized with Web Audio (engine with gears, surfaces, sfx, music), and the co-driver uses `speechSynthesis` in Spanish. There are no audio asset files.
- **`career.js`**: season (`SEASON` in `tracks.js`), points/prizes, garage, upgrades and repairs.
- **Persistence**: `localStorage` only, through `store.get/set` in `util.js`, which tolerates failures. Keys are prefixed `pyb-`.

## Constraints

- `tools/build-single.mjs` strips `import … from` lines with a regex and removes `export` only before `const|let|function|class`, then wraps all modules in a single IIFE scope. So: put each import on lines that match that pattern, don't use `export default`/`export { … }`/re-exports, and avoid top-level name clashes between modules.
- The build takes the app markup from between `<!--app-->` and `<!--/app-->` in `index.html`. Keep those markers.
- Deployed as static files via GitHub Pages (branch `main`, root).
