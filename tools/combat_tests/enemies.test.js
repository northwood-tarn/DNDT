import { enemies, getEnemyStats } from "../../app/data/enemies.js";
import { expandEncounterEnemyRefs, getEncounterById } from "../../app/data/encounters.js";
import { createEncounterEnemyActors, createEnemyCombatActor, createEnemyCombatActors } from "../../app/combat/enemyFactory.js";
import { checkEnemyAwareness } from "../../app/systems/enemyAwareness.js";
import { getEffectiveAc } from "../../app/combat/modifiers.js";
import { combatAuraEffectsAffectingActor } from "../../app/combat/auras.js";
import { assert, createCombatLog, createSnapshotFromScenario, fixedDice, hasCondition, resolveAction, validateCombatActor } from "./helpers.js";

export async function runEnemyCombatTests() {
  testEnemyLookupAndShape();
  testEnemyAwarenessReadsNestedAwareness();
  testEnemyCombatActorFactory();
  testEnemyCombatActorFactoryNaturalAttack();
  testEnemyCombatActorFeatureSurface();
  testEnemyDataFeatureExamples();
  testEnemyFeatureDamageAndConditionRiders();
  testEnemyPassiveModifierAndAuraSurface();
  testEnemyWeaponMasteryGating();
  testEnemyCombatActorBatchFactory();
  testEncounterDataExpansion();
  testEncounterInstanceOverrides();
  testEncounterEnemyActorFactory();
}

function testEnemyFeatureDamageAndConditionRiders() {
  const enemy = createEnemyCombatActor({
    ...getEnemyStats("goblin"),
    features: [{
      id: "dirty_blade",
      name: "Dirty Blade",
      effects: {
        damageRiders: [{
          id: "dirty_blade_damage",
          trigger: "source_hits_with_attack_roll",
          damage: "1d4",
          damageType: "poison",
          oncePerTurn: true,
        }],
        conditionRiders: [{
          id: "dirty_blade_shaken",
          trigger: "source_hits_with_attack_roll",
          condition: "next_attack_disadvantage",
          duration: { type: "turns", remaining: 1 },
        }],
      },
    }],
  }, { id: "dirty_goblin", position: { x: 1, y: 1 } });
  const hero = testHero({ id: "hero", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("enemy-feature-riders", [enemy, hero]));
  const actor = snapshot.actors.find((item) => item.id === "dirty_goblin");
  const target = snapshot.actors.find((item) => item.id === "hero");

  assert.equal(resolveAction(snapshot, actor, "scimitar", "hero", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(target.hp, 12, "enemy feature damage riders should use the same damage-rider system as character features");
  assert.equal(hasCondition(target, "next_attack_disadvantage"), true, "enemy feature condition riders should use the same condition-rider system as character features");
}

function testEnemyPassiveModifierAndAuraSurface() {
  const enemy = createEnemyCombatActor({
    ...getEnemyStats("goblin"),
    activeEffects: [{ id: "shielded", type: "modifier", stat: "ac", amount: 2, label: "Shielded" }],
    auras: [{
      id: "goblin_pack_aura",
      name: "Goblin Pack Aura",
      radiusSquares: 2,
      affects: "allies",
      effects: [{ id: "pack_ac", type: "modifier", stat: "ac", amount: 1 }],
    }],
  }, { id: "aura_goblin", position: { x: 1, y: 1 } });
  const ally = createEnemyCombatActor("goblin", { id: "ally_goblin", position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("enemy-passive-and-aura", [enemy, ally, testHero()]));
  const source = snapshot.actors.find((item) => item.id === "aura_goblin");
  const auraTarget = snapshot.actors.find((item) => item.id === "ally_goblin");

  assert.equal(getEffectiveAc(snapshot, source), 15, "enemy active effects should feed the shared passive modifier system");
  assert.ok(combatAuraEffectsAffectingActor(snapshot, auraTarget).some((effect) => effect.auraId === "goblin_pack_aura"), "enemy auras should feed the shared aura system");
  assert.equal(getEffectiveAc(snapshot, auraTarget), 14, "enemy aura modifiers should affect valid allies");
}

function testEnemyLookupAndShape() {
  const goblin = getEnemyStats("goblin");
  const wolf = getEnemyStats("wolf");

  assert.equal(goblin.id, "goblin", "enemy lookup should return records by id");
  assert.equal(goblin.saves.dex, 2, "enemy saves should use resolver-facing saves key");
  assert.equal(goblin.awareness.hostility, "onsight", "enemy awareness should be nested under awareness");
  assert.equal(wolf.naturalAttack.damageType, "piercing", "natural attacks should carry explicit damage type");
  assert.equal(Object.keys(enemies).length, new Set(Object.values(enemies).map((enemy) => enemy.id)).size, "enemy ids should be unique");
}

function testEnemyAwarenessReadsNestedAwareness() {
  const goblin = { ...getEnemyStats("goblin"), x: 5, y: 0 };
  const aware = checkEnemyAwareness({ x: 0, y: 0 }, [goblin], null, null);

  assert.equal(aware.length, 1, "enemy awareness should read normalized nested awareness data");
  assert.equal(aware[0].id, "goblin", "aware enemy should be returned unchanged");
}

function testEnemyCombatActorFactory() {
  const actor = createEnemyCombatActor("goblin", { id: "goblin_a", position: { x: 3, y: 2 } });

  assert.equal(actor.id, "goblin_a", "enemy factory should create instance ids");
  assert.equal(actor.sourceId, "goblin", "enemy factory should preserve source id");
  assert.equal(actor.team, "enemies", "enemy factory should create enemy-team actors");
  assert.equal(actor.position.x, 3, "enemy factory should apply requested position");
  assert.equal(actor.actions[0].damage, "1d6+2", "enemy factory should use enemy damage expression");
  assert.equal(actor.actions[0].damageType, "slashing", "enemy factory should use enemy damage type");
  assert.deepEqual(validateCombatActor({ ...actor, economy: {} }), [], "enemy factory output should satisfy combat actor validation after economy exists");

  const snapshot = createSnapshotFromScenario({
    id: "enemy-factory-test",
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors: [
      {
        id: "hero",
        name: "Hero",
        team: "heroes",
        hp: 10,
        maxHp: 10,
        ac: 12,
        position: { x: 0, y: 0 },
        actions: [],
      },
      actor,
    ],
  });

  assert.equal(snapshot.actors.find((item) => item.id === "goblin_a").actions[0].type, "weapon_attack", "enemy factory actor should normalize into snapshots");
}

function testEnemyCombatActorFactoryNaturalAttack() {
  const actor = createEnemyCombatActor("wolf", { id: "wolf_a" });

  assert.equal(actor.actions[0].id, "bite", "natural attackers should get natural attack actions");
  assert.equal(actor.actions[0].damageType, "piercing", "natural attack damage type should be explicit");
  assert.equal(actor.actions[0].tags.natural, true, "natural attack actions should be tagged as natural");
  assert.deepEqual(validateCombatActor({ ...actor, economy: {} }), [], "natural enemy action should satisfy the combat action schema");
}

function testEnemyCombatActorFeatureSurface() {
  const actor = createEnemyCombatActor({
    ...getEnemyStats("goblin"),
    id: "goblin",
    resources: [{ id: "nimble_escape", name: "Nimble Escape", max: 1, current: 1 }],
    features: [{
      id: "spiteful_shove",
      name: "Spiteful Shove",
      effects: {
        actionOptions: [{
          id: "spiteful_shove",
          name: "Spiteful Shove",
          actionKind: "push",
          requiresTarget: true,
          rangeFt: 5,
          distanceFt: 5,
        }],
      },
    }],
    featureHooks: [{ id: "ambusher", kind: "damage_rider", damage: "1d4", damageType: "piercing" }],
    activeEffects: [{ id: "braced", type: "modifier", stat: "ac", amount: 1 }],
    auras: [{ id: "pack_aura", name: "Pack Aura", radiusSquares: 1, effects: [] }],
  }, { id: "goblin_featured" });

  assert.equal(actor.resources[0].id, "nimble_escape", "enemy bridge should preserve declarative resources");
  assert.equal(actor.features[0].id, "spiteful_shove", "enemy bridge should preserve declarative features");
  assert.equal(actor.featureHooks[0].id, "ambusher", "enemy bridge should preserve declarative feature hooks");
  assert.equal(actor.activeEffects[0].id, "braced", "enemy bridge should preserve active effects");
  assert.equal(actor.auras[0].id, "pack_aura", "enemy bridge should preserve auras");
  assert.equal(actor.actions.some((action) => action.id === "spiteful_shove" && action.type === "push"), true, "enemy feature action options should become generated actions");
}

function testEnemyDataFeatureExamples() {
  const goblin = createEnemyCombatActor("goblin", { id: "data_goblin" });
  const wolf = createEnemyCombatActor("wolf", { id: "data_wolf" });
  const skeleton = createEnemyCombatActor("skeleton", { id: "data_skeleton" });
  const shadow = createEnemyCombatActor("shadow", { id: "data_shadow" });
  const knight = createEnemyCombatActor("knight", { id: "data_knight" });

  assert.equal(goblin.resources.some((resource) => resource.id === "nimble_escape"), true, "goblin data should include a resource-based feature");
  assert.equal(goblin.actions.some((action) => action.id === "nimble_escape_dash" && action.cost === "bonus"), true, "goblin resource feature should generate a bonus action");
  assert.equal(wolf.features.some((feature) => feature.id === "pack_bite"), true, "wolf data should include a damage rider feature");
  assert.equal(skeleton.features.some((feature) => feature.id === "rattling_blade"), true, "skeleton data should include a condition rider feature");
  assert.equal(shadow.activeEffects.some((effect) => effect.id === "shade_form"), true, "shadow data should include a passive modifier example");
  assert.equal(knight.auras.some((aura) => aura.id === "commanding_presence"), true, "knight data should include an aura example");
}

function testEnemyWeaponMasteryGating() {
  const inactive = createEnemyCombatActor("goblin", { id: "goblin_plain" });
  const active = createEnemyCombatActor({ ...getEnemyStats("goblin"), masteredWeaponIds: ["scimitar"] }, { id: "goblin_master" });

  assert.equal(inactive.actions[0].weaponMasteryActive, undefined, "enemy weapon mastery should be inactive unless explicitly enabled");
  assert.equal(active.actions[0].weaponMasteryActive, true, "enemy masteredWeaponIds should activate weapon mastery");
}

function testEnemyCombatActorBatchFactory() {
  const actors = createEnemyCombatActors(["wolf", "wolf", "skeleton"], {
    instances: [
      { position: { x: 1, y: 1 } },
      { position: { x: 2, y: 1 } },
      { position: { x: 3, y: 1 } },
    ],
  });

  assert.deepEqual(actors.map((actor) => actor.id), ["wolf_1", "wolf_2", "skeleton_3"], "batch factory should create stable instance ids");
  assert.equal(actors[2].actions[0].id, "shortsword", "batch factory should create weapon actions");
}

function testEncounterEnemyActorFactory() {
  const actors = createEncounterEnemyActors("combat_goblins_2", {
    instances: [
      { position: { x: 1, y: 1 } },
      { position: { x: 2, y: 1 } },
    ],
  });

  assert.equal(actors.length, 2, "encounter bridge should create an actor for each enemy id");
  assert.deepEqual(actors.map((actor) => actor.sourceId), ["goblin", "goblin"], "encounter bridge should preserve source ids");
}

function testEncounterDataExpansion() {
  const encounter = getEncounterById("combat_wolves_1");
  assert.equal(encounter.name, "Wolf Pack", "encounter lookup should return structured records");
  assert.deepEqual(expandEncounterEnemyRefs(encounter).map((ref) => ref.enemyId), ["wolf", "wolf", "wolf"], "encounter enemy groups should expand into enemy refs");
}

function testEncounterInstanceOverrides() {
  const refs = expandEncounterEnemyRefs({
    id: "override_test",
    enemies: [{
      enemyId: "goblin",
      count: 2,
      defaults: { masteredWeaponIds: ["scimitar"] },
      instances: [
        { id: "left_goblin", position: { x: 1, y: 1 } },
        { id: "right_goblin", hp: 3, position: { x: 2, y: 1 } },
      ],
    }],
  });
  const actors = createEnemyCombatActors(refs);

  assert.deepEqual(actors.map((actor) => actor.id), ["left_goblin", "right_goblin"], "encounter refs should carry instance ids");
  assert.equal(actors[1].hp, 3, "encounter refs should carry per-instance HP overrides");
  assert.equal(actors[0].actions[0].weaponMasteryActive, true, "encounter defaults should carry mastered weapon ids");
}

function testHero(overrides = {}) {
  return {
    id: "hero",
    name: "Hero",
    team: "heroes",
    hp: 20,
    maxHp: 20,
    ac: 12,
    speed: 6,
    position: { x: 4, y: 1 },
    actions: [],
    ...overrides,
  };
}

function testScenario(id, actors) {
  return {
    id,
    grid: { width: 6, height: 4, blocked: [], cover: [] },
    actors,
  };
}
