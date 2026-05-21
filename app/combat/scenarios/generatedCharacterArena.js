import { createStarterCharacterDraft, resolveCharacterSheet, resolvedSheetToCombatActor } from "../../character/index.js";
import { weapons } from "../../data/weapons.js";
import { createWeaponAction, indexRecordsById } from "../actionFactory.js";

const WEAPONS = indexRecordsById(weapons);

export function createGeneratedCharacterArenaScenario(options = {}) {
  const variantId = options.variantId || "fighter";
  const sheet = resolveCharacterSheet(createStarterCharacterDraft(variantId));
  return {
    id: "generated-character-arena",
    grid: {
      width: 10,
      height: 10,
      blocked: [
        { x: 4, y: 4 },
      ],
      cover: [
        { x: 6, y: 5, kind: "three_quarters" },
        { x: 2, y: 6, kind: "half" },
      ],
    },
    actors: [
      resolvedSheetToCombatActor(sheet, {
        id: "generated_pc",
        name: sheet.identity.characterName,
        position: { x: 1, y: 1 },
      }),
      createArenaSwordsman(options),
    ],
    metadata: {
      generatedHeroVariantId: variantId,
      generatedHeroSheet: sheet,
      diceSeed: options.diceSeed || null,
    },
  };
}

function createArenaSwordsman(options = {}) {
  return {
    id: "generated_enemy",
    name: "Enemy Swordsman",
    team: "enemies",
    role: "swordsman",
    ai: { profile: "melee", targetPriority: "nearest" },
    token: "E",
    hp: 18,
    maxHp: 18,
    ac: 14,
    initiativeBonus: 1,
    speed: 6,
    position: options.enemyPosition || { x: 8, y: 8 },
    saves: { str: 3, dex: 1, con: 2, int: 0, wis: 0, cha: 0 },
    actions: [
      createWeaponAction(WEAPONS.longsword, {
        id: "blade",
        name: "Sword",
        attackBonus: options.enemyAttackBonus ?? 4,
        damageBonus: 2,
      }),
    ],
  };
}
