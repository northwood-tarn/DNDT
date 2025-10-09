
# Project Structure & Module Contracts (DNDT)

**Purpose:** Lock the folder boundaries, naming, and import rules so any new files or proposals stay consistent.

## Top-level Folders (authoritative)

- `boot/` — start scripts, command-line switches, entry wiring.
- `flow/` — **only place that changes scenes** and routes between areas; listens to game events and calls `sceneManager.replace(...)`.
- `engine/` — deterministic rules & math (no DOM, no Pixi, no file I/O). Examples: action economy, movement math, spell execution, log utilities, `sceneManager` host/ticker.
- `systems/` — gameplay glue that wires data + engine + renderer. Examples: map pipeline, dialogue runtime, encounters, lighting/perception, save/load.
- `scenes/` — screen controllers (Title, Exploration, Combat). Scenes call systems; they do not decide global navigation.
- `renderer/` — Pixi/DOM rendering layers, world view, FX, minimap, filters.
- `state/` — state store and slices (player, combat, rest counters).
- `data/` — content: enemies, items, classes, spells, areas, dialogue JSON.
- `ui/` — UI widgets and overlays (top bar, modals, SFX hooks).
- `assets/` — art/audio (no code), referenced via loader helpers.
- `docs/` — design notes, roadmaps, and this document.

## Allowed Imports (dependency direction)

```
assets  → (none)
data    → (none)
engine  → (none)          # core rules are leaf-agnostic

renderer → engine (types only), state
systems  → engine, renderer, data, state
scenes   → systems, renderer, state
flow     → scenes, systems, state, engine/sceneManager

boot     → flow (app start), scenes (initial), state
ui       → renderer, systems (for events), state
```

**Rule:** Only `flow/` calls `sceneManager.replace(...)`. Scenes emit events or return values; `flow/` decides routing.

## ESM-Only & Single Pixi

- Use ESM everywhere; **no `require()`**.
- Keep one Pixi build: `lib/pixi.mjs`. Delete the UMD folder `pixi/`.
- All Pixi imports: `import * as PIXI from "../lib/pixi.mjs"` (path depth varies).

## Asset Paths & Electron

- All file paths go through a single loader helper (e.g., `assets.getPath(key)`).
- Do not embed `file:///` URLs inline in scenes/systems.

## Effects & Lighting

- All visual FX live in `renderer/fxLayer.js` (or a subfolder). Systems request FX via a small API; scenes never own ad-hoc fog loops.

## Dialogue & Checks

- Dialogue content in `data/dialogue/*.json` (or per-area subfolders).
- Dialogue system handles skill/class gates and dispatches outcomes; `flow/` handles routing to combat or new scenes.

## Naming Conventions

- Modules export a single default if they represent a Scene: `export default class CombatScene {}`
- Systems export functions/objects: `export function buildEncounter(...)`
- Events use `namespace:eventName` (e.g., `game:exit`, `game:postCombatOutcome`, `ui:loadGame`).

## Module Contract Header (paste this at the top of each new file)

```md
# Module Contract
**Location:** <folder>/<file>.js
**Exports:** <functions/classes>
**Calls:** <list of modules it imports directly>
**Called By:** <expected callers>
**Side Effects:** <events emitted, DOM mutations, state writes>
**Routing:** (yes/no; only allowed in `flow/`)
**Notes:** <quirks, performance, TODOs>
```

## Scene Policy

- Scene lifecycle: `start(data)`, `update(dt)`, `render()`, `cleanup()`.
- No scene owns `requestAnimationFrame`; a single loop in `engine/sceneManager` (or `engine/loop.js`) ticks the current scene.

## Checklist for New Files / PRs

- Folder matches role (flow vs systems vs engine vs scene).
- ESM import paths only; no globals.
- No scene routing except in `flow/`.
- Imports follow Allowed Imports matrix.
- Asset references are via the loader helper.
- Add a short **Module Contract** header comment.

---

## Minimal Folder Changes to Apply Now

1) Move `engine/flow/*` → `flow/*` and update imports to `../flow/...` from callers.
2) Remove `pixi/` UMD folder; keep `lib/pixi.mjs` only.
3) Ensure `index.html` uses `<div id="game-root"></div>` and `main.js` binds to it.
4) Centralize FX under `renderer/fxLayer.js`; delete scene-specific fog rollers after migration.
5) Ensure `encounterRunner` never changes scenes (it doesn’t); `PostCombatResolver` emits `game:postCombatOutcome` (done).

## Event Routing Canon

- `game:exit` → handled by `flow/ExitRouter.routeExit(...)`.
- `game:postCombatOutcome` → handled by `flow/ExitRouter` (victory returns to area). Defeat is a modal; flow may later decide additional routes.

---

By adopting this document as policy in the repo and your GPT project, any generated or proposed files will respect these boundaries by default.
