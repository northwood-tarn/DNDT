# Unified Combat Runner

This file merges the responsibilities from:
- systems/combatLoader.js
- systems/encounterRunner.js

You can delete those after switching imports to `systems/combatRunner.js`.

Initiative is provided by `systems/initiative.js` and stored into `state.combat.order` and `state.combat.rolls`.

## Minimal usage
```js
import { startCombat } from "./systems/combatRunner.js";
await startCombat("dockside_skirmish");
```

## Helpers
- `spawnDueAtRoundStart(enc)`
- `getEndOfRoundAnnouncements(enc)`
- `getActorById(enc, id)`
- `nextRound(enc)`
