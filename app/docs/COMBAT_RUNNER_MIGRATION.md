# Unified Combat Runner

This file merges the responsibilities from:
- systems/combatLoader.js
- systems/encounterRunner.js

You can delete those after switching imports to `systems/combatRunner.js`.

## Combat State Contract (Canonical)

The combat container is **only** created and assigned by `systems/combatRunner.startCombat`.  
No other module should ever assign `state.combat = {}`, and all mutation outside of `combatRunner` must occur on existing fields only.

The canonical shape:

```js
state.combat = {
  title,
  encounterId,
  returnAreaId,
  triggers,
  actors: [ /* PCs + NPCs */ ],
  order: [ /* actorIds in initiative order */ ],
  rolls: { actorId: { total, d20, mod, bonus }, ... },
  round: 1,
  turnIdx: 0,
  zones: [],              // e.g. Fog Cloud, Web, etc.
  concentrationByActor: new Map(),
  _roundAnnouncements: []
};
```

Legacy aliases (`turnOrder`, `turnIndex`, `initiativeRolls`) may exist temporarily but should not be relied on.

Prefer selectors from `systems/combatSelectors.js`:
- `getCombatState()`
- `getActiveActor()`
- `getActors()`
- `getRoundNumber()`

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
