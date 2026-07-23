import { createStarterCharacterDraft, loadCombatActorFromCharacter, loadCharacterRecord, resolveCharacterSheet, resolvedSheetToCombatActor } from "../../character/index.js";
import { createEnemyCombatActor } from "../enemyFactory.js";
import { createPresentationFromStage, createScenarioGridFromStage, getCombatStageMetadata } from "../stageMetadata.js";

export function createGeneratedCharacterArenaScenario(options = {}) {
  const hero = resolveHeroSource(options);
  return {
    id: "generated-character-arena",
    grid: createBaseArenaGrid(),
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

export function createGeneratedEmptyArenaScenario(options = {}) {
  const hero = resolveHeroSource(options);
  return {
    id: "generated-empty-arena",
    grid: {
      width: 10,
      height: 7,
      blocked: [],
      cover: [],
    },
    actors: [
      createHeroActor(hero, { x: 1, y: 4 }),
      createArenaSwordsman({ ...options, enemyPosition: options.enemyPosition || { x: 6, y: 2 } }),
    ],
    combatObjects: [],
    metadata: {
      diceSeed: options.diceSeed || null,
      presentation: {
        visualStyle: "miniature_tilt_shift",
        visualGround: "black_projection_test",
        camera: {
          projection: "orthographic_3_4",
          yawDegrees: 35,
          pitchDegrees: 60,
          allowPan: false,
          rotationStepDegrees: null,
        },
        gridProjection: {
          kind: "dndt_orthographic",
          viewBox: { width: 1000, height: 562.5 },
          origin: { x: 410, y: 150 },
          xAxis: { x: 46, y: 28 },
          yAxis: { x: -32, y: 40 },
        },
        demoMiniatures: [
          {
            id: "warrior_a",
            name: "Lantern Warrior",
            kind: "image",
            footprint: { width: 1, height: 1 },
            position: { x: 2, y: 4 },
            baseAccent: "amber",
            image: "../visual_spike/assets/protagonist_warlock_guard_crop.png",
          },
          {
            id: "warrior_b",
            name: "Lantern Warrior",
            kind: "image",
            footprint: { width: 1, height: 1 },
            position: { x: 6, y: 2 },
            baseAccent: "blue",
            image: "../visual_spike/assets/protagonist_warlock_guard_crop.png",
          },
        ],
      },
    },
  };
}

export function createDocksideStageGridScenario(options = {}) {
  const stage = getCombatStageMetadata(options.stageId || "dockside_gridfirst_stage_v1");
  if (!stage) throw new Error(`Unknown combat stage: ${options.stageId}`);
  const hero = resolveHeroSource(options);

  return {
    id: "dockside-stage-grid",
    grid: createScenarioGridFromStage(stage),
    actors: [
      createHeroActor(hero, options.heroPosition || stage.spawns?.defaultHeroSpawns?.[0] || { x: 1, y: 6 }),
      createArenaSwordsman({ ...options, enemyPosition: options.enemyPosition || stage.spawns?.defaultEnemySpawns?.[2] || { x: 8, y: 3 } }),
    ],
    combatObjects: [],
    metadata: {
      diceSeed: options.diceSeed || null,
      combatStageId: stage.stageId,
      presentation: {
        ...createPresentationFromStage(stage),
        demoMiniatures: [
          {
            id: "hero_spawn_1",
            name: "Hero Spawn",
            kind: "image",
            footprint: { width: 1, height: 1 },
            position: { x: 1, y: 6 },
            baseAccent: "amber",
            image: "../visual_spike/assets/protagonist_staff_guard_miniature_base_gold_runtime_192x320.png",
            size: { width: 160, height: 267 },
          },
          {
            id: "enemy_spawn_1",
            name: "Enemy Spawn",
            kind: "image",
            footprint: { width: 1, height: 1 },
            position: { x: 8, y: 3 },
            baseAccent: "blue",
            image: "../visual_spike/assets/protagonist_staff_guard_miniature_base_gold_runtime_192x320.png",
            size: { width: 160, height: 267 },
          },
        ],
      },
    },
  };
}

export function createBacklandsFieldPlateauScenario(options = {}) {
  const stage = getCombatStageMetadata(options.stageId || "backlands_field_plateau_01");
  if (!stage) throw new Error(`Unknown combat stage: ${options.stageId}`);
  const heroSpawns = stage.spawns?.defaultHeroSpawns || [];
  const enemySpawns = stage.spawns?.defaultEnemySpawns || [];

  return {
    id: "backlands-field-plateau-01",
    grid: createScenarioGridFromStage(stage),
    actors: [
      createStarterHeroActor("fighter", {
        id: "backlands_fighter",
        name: "Greyharbour Fighter",
        position: heroSpawns[0],
      }),
      createStarterHeroActor("rogue", {
        id: "backlands_rogue",
        name: "Greyharbour Rogue",
        position: heroSpawns[1],
      }),
      createStarterHeroActor("cleric", {
        id: "backlands_cleric",
        name: "Greyharbour Cleric",
        position: heroSpawns[2],
      }),
      createBacklandsEnemy({
        id: "backlands_swordsman",
        name: "Field Swordsman",
        position: enemySpawns[0],
        weaponId: "longsword",
        damage: "1d8+2",
        role: "swordsman",
        token: "S",
      }),
      createBacklandsEnemy({
        id: "backlands_skirmisher",
        name: "Field Skirmisher",
        position: enemySpawns[1],
        weaponId: "scimitar",
        damage: "1d6+2",
        role: "skirmisher",
        token: "K",
        speed: 7,
        ac: 13,
      }),
      createBacklandsEnemy({
        id: "backlands_acolyte",
        name: "Field Acolyte",
        position: enemySpawns[2],
        weaponId: "quarterstaff",
        damage: "1d6+1",
        role: "acolyte",
        token: "A",
        hp: 14,
        maxHp: 14,
        ac: 12,
        saves: { str: 0, dex: 1, con: 1, int: 0, wis: 3, cha: 1 },
      }),
    ],
    combatObjects: [],
    metadata: {
      diceSeed: options.diceSeed || null,
      combatStageId: stage.stageId,
      presentation: {
        ...createPresentationFromStage(stage),
        actorMiniatures: {
          enabled: true,
          defaultSize: { width: 132, height: 220 },
          sizes: {
            fighter: { width: 128, height: 213 },
            rogue: { width: 120, height: 202 },
            cleric: { width: 126, height: 208 },
            swordsman: { width: 118, height: 206 },
            skirmisher: { width: 112, height: 198 },
            acolyte: { width: 112, height: 198 },
          },
          assets: {
            fighter: "../visual_spike/assets/protagonist_staff_guard_miniature_base_gold_runtime_192x320.png",
            rogue: "../visual_spike/assets/protagonist_rogue_guard_crop.png",
            cleric: "../visual_spike/assets/protagonist_cleric_guard_crop.png",
            swordsman: "../visual_spike/assets/shadow_enemy_crop.png",
            skirmisher: "../visual_spike/assets/shadow_enemy_crop.png",
            acolyte: "../visual_spike/assets/shadow_enemy_crop.png",
            heroes: "../visual_spike/assets/protagonist_staff_guard_miniature_base_gold_runtime_192x320.png",
            enemies: "../visual_spike/assets/shadow_enemy_crop.png",
          },
        },
      },
    },
  };
}

function createBaseArenaGrid() {
  return {
    width: 10,
    height: 10,
    blocked: [
      { x: 4, y: 4 },
    ],
    cover: [
      { x: 6, y: 5, kind: "three_quarters" },
      { x: 2, y: 6, kind: "half" },
    ],
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

function createHeroActor(hero, position = { x: 1, y: 1 }) {
  const actor = hero.actor || resolvedSheetToCombatActor(hero.sheet);
  return {
    ...structuredClone(actor),
    id: "generated_pc",
    name: hero.sheet.identity.characterName,
    position: { ...position },
  };
}

function createStarterHeroActor(variantId, { id, name, position }) {
  const draft = createStarterCharacterDraft(variantId);
  draft.identity.level = 2;
  draft.identity.characterName = name;
  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true });
  const actor = resolvedSheetToCombatActor(sheet);
  return {
    ...structuredClone(actor),
    id,
    name,
    position: { ...position },
  };
}

function createArenaSwordsman(options = {}) {
  const enemyHp = options.enemyHp ?? 18;
  return createEnemyCombatActor({
    id: "arena_swordsman",
    name: "Enemy Swordsman",
    role: "swordsman",
    creatureType: "humanoid",
    size: "medium",
    hp: enemyHp,
    maxHp: enemyHp,
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

function createBacklandsEnemy(options = {}) {
  return createEnemyCombatActor({
    id: options.sourceId || "backlands_field_humanoid",
    name: options.name,
    role: options.role || "swordsman",
    creatureType: "humanoid",
    size: "medium",
    hp: options.hp ?? 16,
    maxHp: options.maxHp ?? 16,
    ac: options.ac ?? 14,
    speed: options.speed ?? 6,
    initiativeBonus: options.initiativeBonus ?? 1,
    attackBonus: options.attackBonus ?? 4,
    weaponId: options.weaponId || "longsword",
    damage: options.damage || "1d8+2",
    damageType: options.damageType || "slashing",
    aiProfile: options.aiProfile || "melee",
    saves: options.saves || { str: 2, dex: 1, con: 2, int: 0, wis: 0, cha: 0 },
  }, {
    id: options.id,
    name: options.name,
    position: options.position,
    token: options.token,
    actionId: `${options.id}_attack`,
    actionName: options.actionName || "Strike",
  });
}
