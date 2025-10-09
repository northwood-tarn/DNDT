
# FLOW Migration Notes

**Goal:** Move routing out of `engine/flow/*` into top-level `flow/` and make `flow/` the only layer that calls `sceneManager.replace(...)`.

## Steps

1. Move files:
   - `engine/flow/ExitRouter.js` → `flow/ExitRouter.js`
   - `engine/flow/PostCombatResolver.js` → `flow/PostCombatResolver.js`

2. Update imports:
   - Any `import { initExitRouter } from "./flow/ExitRouter.js"` inside `engine/sceneManager.js` becomes `import("../flow/ExitRouter.js")` (adjust path depth).
   - Any reference to `../sceneManager.js` from moved files becomes `../engine/sceneManager.js` if needed.

3. Event wiring:
   - Ensure `flow/ExitRouter.initExitRouter()` binds listeners for `game:exit` and `game:postCombatOutcome`.

4. Verify:
   - Run app, trigger an exit, ensure routing occurs.
   - Win a test combat; confirm return to area fires through `flow` and not `systems`.

This migration is file-path only; no behavior change intended.
