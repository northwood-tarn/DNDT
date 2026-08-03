# Secret System

Secrets are manually authored clue sets that latch onto existing dialogue, item, exploration-node, loot, quest, encounter, and discovery IDs. The system never generates clues or narrative text.

## Lifecycle

`hidden → searching → uncovered → unlocked → completed`

- A secret is absent from Inventory and the journal while `hidden`.
- Its first unique clue starts `searching`. Inventory presents all collected clue IDs as one `Clues (n)` group using the secret's authored static text. The journal uses the authored searching text or latest clue-count milestone.
- Reaching `clueThreshold` changes the secret to `uncovered` in one transaction. Collected clues leave Inventory, every unused clue is disabled at its source, permanent reward items are granted, authored uncover effects run, and the UI event contains `You have uncovered a secret at {target label}`.
- Meeting the authored unlock requirements changes it to `unlocked`. Required key items are permanent by default.
- An authored resolution changes it to `completed`.

Pact of the Tessera contributes one virtual clue to every threshold. It appears in the displayed effective clue count but is not an inventory item.

## Clues and sources

Every clue has a globally unique `clue:` ID and exactly one source:

- `conversation`: an existing dialogue scene ID
- `item`: an existing containing-item ID
- `node`: an existing node ID and its map ID
- `loot`: an existing loot or encounter ID

Awarding a clue twice is idempotent. Source presenters use `isSourceClueAvailable` before showing a pickup, reward, or conversation option. `acquireCluesAtSource` performs the canonical acquisition. Dialogue can use `grant.clue`; loot passes `secretDefinitions` and `secretSourceId` to `applyLootToSaveGame`.

Skill checks may reveal authored information or interactions, including a lock, but never call clue acquisition and never affect the threshold.

## Effects and hidden exploration content

Stage effects reference existing IDs. `reveal.discovery` changes an existing hidden node to visible through canonical discovery state. Traversal excludes destinations authored as hidden or locked until that state changes. Other effects can set a flag, start a quest, update an objective, or enable an existing dialogue or encounter.

Sequential secrets use a permanent outcome item from one secret as the manually authored `item` source of a clue in the next. Parallel resolutions use ordinary interaction requirements against the permanent outcome items; specialised actor/equipment conditions belong to that interaction, not to the global secret rules.

## Authoring

Open **Secret Creator** from `npm run authoring`. The creator:

- creates unique secret and clue IDs;
- assigns every clue to one of the four source types;
- filters source-ID pickers by target location;
- authors Inventory and journal text;
- authors clue thresholds and milestones;
- references permanent rewards, unlock requirements, dependencies, and stage effects;
- validates the definition before saving it under `app/data/secrets/` and updates `index.json`.

Catalogue validation rejects invalid and duplicate IDs, impossible thresholds, duplicate clue ownership, unresolved references when a reference resolver is supplied, and cyclic secret dependencies.
