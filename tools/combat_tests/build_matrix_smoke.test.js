import {
  assert,
  createEmptyCharacterDraft,
  createCombatLog,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  hasAnyUsefulOption,
  endTurnEffects,
  moveActor,
  resolveCharacterSheet,
  resolveAction,
  resolvedSheetToCombatActor,
  runAiTurn,
  scriptedDice,
  startTurn,
  validateCombatActor,
} from "./helpers.js";
import { preflightAction } from "../../app/combat/actionResult.js";
import { CLASSES } from "../../app/data/classes.js";

const SMOKE_LEVELS = [1, 3, 5, 7, 9, 11, 13];
const SMOKE_ROUNDS = 5;
const CURATED_ENEMY_IDS = ["goblin", "wolf", "skeleton", "shadow", "knight"];

export async function runBuildMatrixSmokeTests() {
  for (const spec of buildSpecs([13])) {
    assertBuildActionsPreflight(spec);
  }
  for (const spec of buildSpecs(SMOKE_LEVELS)) {
    await assertBuildSmokeCombats(spec);
  }
}

function assertBuildActionsPreflight(spec) {
  const sheet = resolveCharacterSheet(draftFor(spec), {}, { allowNonCreationLevel: true });
  assert.deepEqual(sheet.metadata.unresolved, [], `${spec.label}: unresolved character choices`);
  const actor = resolvedSheetToCombatActor(sheet, { id: spec.id, position: { x: 1, y: 1 } });
  assert.deepEqual(validateCombatActor(actor), [], `${spec.label}: invalid combat actor`);
  const enemy = createEnemyCombatActor("goblin", { id: "target", hp: 50, maxHp: 50, ac: 10, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario({
    id: `${spec.id}_matrix`,
    grid: { width: 8, height: 6, blocked: [], cover: [] },
    actors: [actor, enemy],
  });

  assert.equal(hasAnyUsefulOption(snapshot, actor.id), true, `${spec.label}: no useful combat option`);
  for (const action of actor.actions) {
    if (action.postHitOnly && !action.contextual) continue;
    const result = preflightAction(snapshot, actor, action.id, targetPayloadFor(action, actor, enemy));
    assert.equal(result.ok, true, `${spec.label}: ${action.id} failed preflight (${result.code}: ${result.reason})`);
  }
}

async function assertBuildSmokeCombats(spec) {
  const sheet = resolveCharacterSheet(draftFor(spec), {}, { allowNonCreationLevel: true });
  assert.deepEqual(sheet.metadata.unresolved, [], `${spec.label}: unresolved character choices`);
  const actor = resolvedSheetToCombatActor(sheet, { id: spec.id, position: { x: 1, y: 1 } });
  assert.deepEqual(validateCombatActor(actor), [], `${spec.label}: invalid combat actor`);

  for (const enemyId of CURATED_ENEMY_IDS) {
    await runOneSmokeCombat(spec, actor, enemyId);
  }
}

async function runOneSmokeCombat(spec, baseActor, enemyId) {
  const actor = structuredClone(baseActor);
  actor.id = spec.id;
  actor.position = { x: 1, y: 1 };
  const enemy = createEnemyCombatActor(enemyId, { id: `${enemyId}_target`, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario({
    id: `${spec.id}_vs_${enemyId}`,
    grid: { width: 10, height: 8, blocked: [], cover: [] },
    actors: [actor, enemy],
  });
  const log = createCombatLog();

  for (let round = 1; round <= SMOKE_ROUNDS; round += 1) {
    if (actor.hp <= 0 || actor.defeated || enemy.hp <= 0 || enemy.defeated || snapshot.outcome) return;
    snapshot.round = round;

    const playerDice = scriptedDice({ d20: Array(80).fill(15), damage: 4 });
    startTurn(snapshot, actor, log, playerDice);
    const action = findSmokeAction(snapshot, actor, enemy);
    assert.ok(action, `${spec.label} vs ${enemyId} round ${round}: no resolvable smoke action`);
    const resolved = resolveAction(snapshot, actor, action.id, targetPayloadFor(action, actor, enemy), playerDice, log);
    assert.equal(resolved, true, `${spec.label} vs ${enemyId} round ${round}: ${action.id} did not resolve`);
    endTurnEffects(snapshot, actor, playerDice, log);

    if (enemy.hp <= 0 || enemy.defeated || snapshot.outcome) return;
    const enemyDice = scriptedDice({ d20: Array(80).fill(12), damage: 3 });
    startTurn(snapshot, enemy, log, enemyDice);
    const beforeEvents = log.events.length;
    await runAiTurn(snapshot, enemy, smokeController(snapshot, log, enemyDice));
    assert.ok(
      log.events.length > beforeEvents || enemy.economy?.actionAvailable === false,
      `${spec.label} vs ${enemyId} round ${round}: enemy AI produced no action, movement, or log event`,
    );
    endTurnEffects(snapshot, enemy, enemyDice, log);
  }
}

function findSmokeAction(snapshot, actor, enemy) {
  const actions = actor.actions || [];
  const candidates = [
    ...actions.filter((action) => action.tags?.harmful === true),
    ...actions.filter((action) => action.requiresTarget !== false),
    ...actions,
  ];
  return candidates.find((action) => {
    const result = preflightAction(snapshot, actor, action.id, targetPayloadFor(action, actor, enemy));
    return result.ok;
  }) || null;
}

function smokeController(snapshot, log, dice) {
  return {
    log,
    action(actorId, actionId, targetPayload) {
      const actor = snapshot.actors.find((item) => item.id === actorId);
      return resolveAction(snapshot, actor, actionId, targetPayload, dice, log);
    },
    move(actorId, to) {
      const actor = snapshot.actors.find((item) => item.id === actorId);
      return moveActor(snapshot, actor, to, log, { dice });
    },
    async afterStep() {},
  };
}

export function buildSpecs(levels = [13]) {
  const specs = [];
  for (const level of levels) {
    for (const [classId, classRecord] of Object.entries(CLASSES)) {
      const subclasses = level >= 3 ? Object.values(classRecord.subclasses || {}) : [null];
      for (const subclass of subclasses) {
        const subclassLabel = subclass ? ` ${subclass.name || subclass.id}` : "";
        specs.push({
          id: `${classId}_${subclass?.id || "base"}_level_${level}`,
          label: `${classRecord.name}${subclassLabel} level ${level}`,
          classId,
          subclassId: subclass?.id || null,
          level,
        });
      }
    }
  }
  return specs;
}

export function draftFor(spec) {
  return createEmptyCharacterDraft({
    identity: {
      characterName: spec.label,
      level: spec.level,
      backgroundId: "soldier",
      speciesId: "human",
      classId: spec.classId,
      subclassId: spec.subclassId,
      pactId: spec.classId === "warlock" && spec.level >= 3 ? "pact_of_the_blade" : undefined,
    },
    abilities: balancedAbilities(),
    choices: choicesFor(spec),
    gear: {
      weaponIds: weaponIdsFor(spec),
      armorId: null,
      shieldId: null,
      inventory: [{ id: "healing_potion", quantity: 1 }],
      attunedItemIds: [],
    },
    spells: spellChoicesFor(spec.classId, spec.level),
  });
}

function weaponIdsFor(spec) {
  if (spec.classId === "wizard") {
    return [spec.subclassId === "battlemage" ? "longsword" : "quarterstaff", "dagger", focusForClass(spec.classId)];
  }
  if (spec.classId === "cleric") return ["quarterstaff", "mace", focusForClass(spec.classId)];
  if (spec.classId === "rogue") return ["rapier", "dagger"];
  if (spec.classId === "warlock") return ["quarterstaff", "dagger", focusForClass(spec.classId)];
  return ["longsword", "dagger"];
}

function focusForClass(classId) {
  return ({ wizard: "wizards_staff", warlock: "warlocks_gloves", cleric: "clerics_holy_symbol" })[classId] || "quarterstaff";
}

function choicesFor(spec) {
  const classChoices = {};
  if (spec.classId === "rogue") classChoices.rogue_expertise_skills = ["stealth", "deception"];
  if (spec.subclassId === "cutthroat") classChoices.dark_presence_expertise = "deception";
  if (spec.subclassId === "saboteur") {
    classChoices.origin_device = "acid_paper";
    classChoices.saboteur_cookbook_recipes = ["fire_paper", "poison_vial"];
    classChoices.saboteur_advanced_recipes = ["spell_soot", "greater_fire_paper"];
  }
  if (spec.classId === "wizard" && spec.level >= 9) classChoices.jesters_book_spell = "magic_missile_jester";
  if (spec.subclassId === "battlemage") classChoices.arcane_armament_weapon = "longsword";
  if (spec.classId === "warlock" && spec.level >= 3) {
    classChoices.pact = "pact_of_the_blade";
  }
  if (spec.classId === "warlock" && spec.level >= 11) {
    classChoices.mystic_arcanum_spell = "mental_prison";
  }
  return {
    backgroundAbilityScores: ["primary", "secondary"],
    weaponMasteryIds: ["longsword", "dagger", "rapier", "warhammer"],
    speciesChoices: { skillful_skill: "perception", versatile_feat: "tough" },
    classChoices,
  };
}

function spellChoicesFor(classId, level) {
  if (classId === "wizard") {
    const preparedSpellIds = ["magic_missile", "mage_armor", "sleep"];
    if (level >= 3) preparedSpellIds.push("flame_blade");
    if (level >= 9) preparedSpellIds.push("far_step");
    return { knownSpellIds: ["fire_bolt", "chill_touch", "ray_of_frost"], preparedSpellIds };
  }
  if (classId === "warlock") {
    const knownSpellIds = ["eldritch_blast", "mind_sliver"];
    if (level >= 7) knownSpellIds.push("leech");
    return { knownSpellIds, preparedSpellIds: ["hex", "armor_of_agathys"] };
  }
  if (classId === "cleric") return { knownSpellIds: ["guidance", "sacred_flame", "word_of_radiance"], preparedSpellIds: ["bless", "cure_wounds", "shield_of_faith"] };
  if (classId === "paladin") return { knownSpellIds: [], preparedSpellIds: ["bless", "cure_wounds", "shield_of_faith"] };
  return { knownSpellIds: [], preparedSpellIds: [] };
}

export function targetPayloadFor(action, actor, enemy) {
  if (action.requiresTarget === false) return null;
  if (action.targeting?.shape) return { anchor: { x: enemy.position.x, y: enemy.position.y } };
  if (action.tags?.harmful === false) return actor.id;
  return enemy.id;
}

function balancedAbilities() {
  return {
    strength: 14,
    dexterity: 14,
    constitution: 14,
    intelligence: 14,
    wisdom: 14,
    charisma: 14,
  };
}
