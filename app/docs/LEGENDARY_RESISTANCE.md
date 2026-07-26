# Legendary Resistance

Enemy authors may set `legendaryResistances` to an explicit whole-number charge count. This always overrides automatic drafting, including `0` to disable it.

Automatic enemy drafting uses:

- `campaignAct`: campaign act number;
- `actProgress`: value from `0` to `1` within that act;
- `enemyRank`: `major`, `boss`, `major_boss`, `serious_boss`, `endgame_boss`, or `final_boss`.

Defaults:

- Before the midpoint of Act II: none.
- Act II from `actProgress: 0.5`: major enemies receive 1; major/serious bosses receive 2.
- Act III: major enemies receive at least 1; major/serious bosses receive 2.
- Serious bosses in the latter half of Act III and endgame/final bosses receive 3.

The encounter resource is restored to full when the enemy actor is created. On a failed save, automated enemies spend a charge against encounter-ending control, Restrained, banishment or containment, or damage whose average would defeat them or remove at least half their maximum HP. Other failed saves conserve the resource. Every use is written to the combat log with remaining charges.
