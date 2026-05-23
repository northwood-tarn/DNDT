import { createStarterCharacterDraft, loadCombatActorFromCharacter, loadCharacterRecord, resolveCharacterSheet, resolvedSheetToCombatActor } from "../../character/index.js";
import { createEnemyCombatActor } from "../enemyFactory.js";

export function createGeneratedCharacterArenaScenario(options = {}) {
  const hero = resolveHeroSource(options);
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
      createHeroActor(hero),
      createArenaSwordsman(options),
    ],
    metadata: {
      generatedHeroSource: hero.source,
      generatedHeroVariantId: hero.variantId,
      generatedHeroRecordId: hero.recordId,
      generatedHeroSheet: hero.sheet,
      diceSeed: options.diceSeed || null,
    },
  };
}

function resolveHeroSource(options) {
  if (options.characterRecord) {
    if (options.characterRecord.status !== "ready" || !options.characterRecord.resolvedCharacterSheet) {
      throw new Error("CharacterRecord is not combat-ready");
    }
    return {
      source: "character_record",
      recordId: options.characterRecord.id || null,
      variantId: null,
      actor: options.freshCharacterRuntime === true
        ? resolvedSheetToCombatActor(options.characterRecord.resolvedCharacterSheet)
        : loadCombatActorFromCharacter({ record: options.characterRecord }),
      sheet: structuredClone(options.characterRecord.resolvedCharacterSheet),
    };
  }
  if (options.characterDraft) {
    return {
      source: "character_draft",
      recordId: null,
      variantId: null,
      sheet: resolveCharacterSheet(options.characterDraft, {}, options.resolveOptions || {}),
    };
  }
  const stored = loadCharacterRecord({ store: options.characterStore, slot: options.characterSlot });
  if (stored?.status === "ready" && stored.resolvedCharacterSheet) {
    return {
      source: "character_store",
      recordId: stored.id,
      variantId: null,
      actor: loadCombatActorFromCharacter({ record: stored }),
      sheet: stored.resolvedCharacterSheet,
    };
  }
  const variantId = options.variantId || "fighter";
  return {
    source: "starter_variant",
    recordId: null,
    variantId,
    sheet: resolveCharacterSheet(createStarterCharacterDraft(variantId)),
  };
}

function createHeroActor(hero) {
  const actor = hero.actor || resolvedSheetToCombatActor(hero.sheet);
  return {
    ...structuredClone(actor),
    id: "generated_pc",
    name: hero.sheet.identity.characterName,
    position: { x: 1, y: 1 },
  };
}

function createArenaSwordsman(options = {}) {
  return createEnemyCombatActor({
    id: "arena_swordsman",
    name: "Enemy Swordsman",
    role: "swordsman",
    creatureType: "humanoid",
    size: "medium",
    hp: 18,
    maxHp: 18,
    ac: 14,
    speed: 6,
    initiativeBonus: 1,
    attackBonus: options.enemyAttackBonus ?? 4,
    weaponId: "longsword",
    damage: "1d8+2",
    damageType: "slashing",
    aiProfile: "melee",
    saves: { str: 3, dex: 1, con: 2, int: 0, wis: 0, cha: 0 },
  }, {
    id: "generated_enemy",
    position: options.enemyPosition || { x: 8, y: 8 },
    actionId: "blade",
    actionName: "Sword",
  });
}
