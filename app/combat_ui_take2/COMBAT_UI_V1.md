# Combat UI v1 — locked reference

Status: **LOCKED**

This is the canonical reference for the three completed level-13 combat UI presentations. Do not modify this presentation in place unless the user explicitly unlocks **Combat UI v1**. New combat-interface exploration belongs in a separate **Combat UI v2** implementation.

## Locked presentations

| Character | Build | Scenario ID | Portrait source |
| --- | --- | --- | --- |
| Mara Vey | Level 13 Battlemage | `combat-ui-battlemage-l13` | `app/character_creator/assets/player_portraits/dwarf_feminine_01.png` |
| Nix Calder | Level 13 Saboteur | `combat-ui-saboteur-l13` | `app/character_creator/assets/player_portraits/halfling_masculine_01.png` |
| Sister Elian | Level 13 Lantern Cleric | `combat-ui-lantern-cleric-l13` | `app/character_creator/assets/player_portraits/aasimar_feminine_02.png` |

The character builds are defined data-first in `app/character/combatUiTestCharacters.js`; none of these presentation identities or portraits should be hard-wired into shared combat UI logic.

## Locked presentation files

- `app/combat_ui_take2/index.html`
- `app/combat_ui_take2/combatUi.css`
- `app/combat_ui_take2/combatUi.js`
- `app/character/combatUiTestCharacters.js`
- The three exact portrait sources listed above

Shared combat rules and data remain outside this presentation lock. If later systems work necessarily changes what v1 displays, preserve this manifest and treat the original v1 interaction and visual presentation as the comparison target.

## Reference checksums at lock time

```text
29ddb36ab07cded74fb1a0bb22f4faaf76a6abd9392a3549b644413c3e07f019  app/combat_ui_take2/index.html
5590bcaf780628bb8a2dcb177b535a10263916b67111f21a974c093850096c77  app/combat_ui_take2/combatUi.css
c6487d875493e82ee5c664ed8d5a8da43d24e634bf55c8f09b30d44f937c02a2  app/combat_ui_take2/combatUi.js
412df4d752f80c66e1bf802d0234cbb1460f6ade7da73fc9d1fc2a222866df0c  app/character/combatUiTestCharacters.js
922e53c3865b891da08249bac0dd6242018507e3b8ef66654ce4334d1ee89cff  app/character_creator/assets/player_portraits/dwarf_feminine_01.png
73a3dc064040050d7d4889cb7050b76ed4545950818a8ededc02e9fb52599025  app/character_creator/assets/player_portraits/halfling_masculine_01.png
91c79b74ef3a20ce92064d986cbab2bc912f37e93cb46dfc107ab24a70f9c661  app/character_creator/assets/player_portraits/aasimar_feminine_02.png
```

These hashes identify the exact locked presentation state and portrait files. They are verification records, not runtime dependencies.
