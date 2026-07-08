# Scene Flow Map
_Last updated: 2026-07-08_

This document tracks the routeable scenes that exist in `app/scenes/`.

The old exploration-centered graph was retired with the Tiled/compiled-area workflow. Early dockside area ideas are preserved under `app/docs/archive/dockside_early_area_ideas/`; the old `ExplorationScene` runtime is no longer registered.

## Active Scenes

- **BootScene** -> **PreloadScene**
- **PreloadScene** -> app entry scene
- **MainMenuScene**
- **CharacterSelectScene**
- **LoadGameScene**
- **IntroScene**
- **DialogueScene**
- **SystemCutsceneScene**
- **SettingsScene**
- **SaveErrorScene**
- **GameOverScene**

## Registered Scene IDs

These are registered in `app/scenes/index.js`:

- `boot`
- `preload`
- `mainMenu`
- `characterSelect`
- `loadGame`
- `dialogue`
- `combat`
- `gameOver`
- `settings`
- `intro`
- `systemCutscene`

`combat` remains a route target, but its preview/runtime is currently hosted outside `app/scenes/` by the combat harness code.

## Retired

- `ExplorationScene`
- Tiled/TMJ area loading
- Generated area registries
- Exploration minimap/layout helpers

