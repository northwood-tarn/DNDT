import {
  assert,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  hasCondition,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
  startTurn,
} from "./helpers.js";
import { getEffectiveSpeed } from "../../app/combat/modifiers.js";
import { canSeeActor } from "../../app/combat/perception.js";

export function runSpeciesFeatureCombatTests() {
  testDragonbornAwakenedBreath();
  testOrcAdrenalineRushAndRelentlessEndurance();
  testGoliathDamageRiderAndReaction();
  testGoliathControlRidersAndEndurance();
  testSpeciesRollModifiersAndRerolls();
  testStonecunningSeesInvisible();
}

function testDragonbornAwakenedBreath() {
  const dragonborn = speciesActor("dragonborn", "red", { level: 5, id: "dragonborn" });
  const enemy = createEnemyCombatActor("goblin", { id: "enemy", hp: 30, maxHp: 30, ac: 12, position: { x: 2, y: 1 } });
  const snapshot = snapshotWith([dragonborn, enemy]);
  const actor = snapshot.actors.find((item) => item.id === "dragonborn");
  const target = snapshot.actors.find((item) => item.id === "enemy");
  const log = createCombatLog();

  assert.equal(actor.actions.some((action) => action.id === "draconic_flight"), false);
  const breath = actor.actions.find((action) => action.id === "breath_weapon");
  assert.equal(breath.requiresTarget, true, "Breath Weapon should require an explicit cone target");
  assert.equal(breath.targeting?.shape, "cone", "Breath Weapon should use area targeting rather than auto-targeting");
  assert.equal(resolveAction(snapshot, actor, "breath_weapon", { anchor: target.position }, scriptedDice({ d20: [1], damage: [12] }), log), true);
  assert.equal(target.hp, 18, "Breath Weapon should damage enemies in range");
  assert.equal(hasCondition(target, "burning"), true, "Awakened Breath should apply the lineage failed-save rider");
  assert.equal(actor.resources.find((item) => item.id === "breath_weapon").current, 2, "Breath Weapon should spend a use");

  startTurn(snapshot, target, log, scriptedDice({ damage: [3] }));
  assert.equal(target.hp, 15, "Fire lineage rider should tick at the target turn start");
}

function testOrcAdrenalineRushAndRelentlessEndurance() {
  const orc = speciesActor("orc", null, { id: "orc", hp: 8 });
  const enemy = createEnemyCombatActor("goblin", { id: "enemy", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  enemy.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "2d8" })];
  const snapshot = snapshotWith([orc, enemy]);
  const actor = snapshot.actors.find((item) => item.id === "orc");
  const attacker = snapshot.actors.find((item) => item.id === "enemy");

  assert.equal(resolveAction(snapshot, actor, "adrenaline_rush", null, scriptedDice({ damage: [2] }), createCombatLog()), true);
  assert.equal(actor.tempHp, 2, "Adrenaline Rush should grant PB temporary HP");
  assert.equal(actor.movementRemaining, 12, "Adrenaline Rush should grant Dash movement");
  assert.equal(actor.resources.find((item) => item.id === "adrenaline_rush").current, 2, "Adrenaline Rush should spend a use");

  assert.equal(resolveAction(snapshot, attacker, "club", "orc", scriptedDice({ d20: [10], damage: [20] }), createCombatLog()), true);
  assert.equal(actor.hp, 1, "Relentless Endurance should leave the orc at 1 HP");
  assert.equal(actor.resources.find((item) => item.id === "relentless_endurance").current, 0, "Relentless Endurance should spend its resource");
}

function testGoliathDamageRiderAndReaction() {
  const fireGoliath = speciesActor("goliath", "fire", { id: "fire_goliath" });
  const target = createEnemyCombatActor("goblin", { id: "target", hp: 30, maxHp: 30, ac: 12, position: { x: 2, y: 1 } });
  const first = snapshotWith([fireGoliath, target]);
  const attacker = first.actors.find((item) => item.id === "fire_goliath");
  attacker.actions.push(meleeAttack({ id: "sword", attackBonus: 20, damage: "1d8" }));

  assert.equal(resolveAction(first, attacker, "sword", "target", scriptedDice({ d20: [10], damage: [5, 7] }), createCombatLog()), true);
  assert.equal(first.actors.find((item) => item.id === "target").hp, 18, "Fire's Burn should add fire damage after a damaging hit");
  assert.equal(attacker.resources.find((item) => item.id === "fires_burn").current, 2, "Fire's Burn should spend one resource");

  const stormGoliath = speciesActor("goliath", "storm", { id: "storm_goliath" });
  const enemy = createEnemyCombatActor("goblin", { id: "enemy", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  enemy.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d6" })];
  const second = snapshotWith([stormGoliath, enemy]);
  assert.equal(resolveAction(second, second.actors.find((item) => item.id === "enemy"), "club", "storm_goliath", scriptedDice({ d20: [10], damage: [4, 6] }), createCombatLog()), true);
  assert.equal(second.actors.find((item) => item.id === "enemy").hp, 14, "Storm's Thunder should retaliate after damage");
  assert.equal(second.actors.find((item) => item.id === "storm_goliath").resources.find((item) => item.id === "storms_thunder").current, 2);
}

function testGoliathControlRidersAndEndurance() {
  const frostGoliath = speciesActor("goliath", "frost", { id: "frost_goliath" });
  const frostTarget = createEnemyCombatActor("goblin", { id: "frost_target", hp: 30, maxHp: 30, ac: 12, position: { x: 2, y: 1 } });
  const frostSnapshot = snapshotWith([frostGoliath, frostTarget]);
  const frostActor = frostSnapshot.actors.find((item) => item.id === "frost_goliath");
  frostActor.actions.push(meleeAttack({ id: "frost_sword", attackBonus: 20, damage: "1d8" }));
  assert.equal(resolveAction(frostSnapshot, frostActor, "frost_sword", "frost_target", scriptedDice({ d20: [10], damage: [5, 6] }), createCombatLog()), true);
  assert.equal(getEffectiveSpeed(frostSnapshot, frostSnapshot.actors.find((item) => item.id === "frost_target")), 4, "Frost's Chill should slow the damaged target");

  const hillGoliath = speciesActor("goliath", "hill", { id: "hill_goliath" });
  const hillTarget = createEnemyCombatActor("goblin", { id: "hill_target", hp: 30, maxHp: 30, ac: 12, position: { x: 2, y: 1 } });
  const hillSnapshot = snapshotWith([hillGoliath, hillTarget]);
  const hillActor = hillSnapshot.actors.find((item) => item.id === "hill_goliath");
  hillActor.actions.push(meleeAttack({ id: "hill_sword", attackBonus: 20, damage: "1d8" }));
  assert.equal(resolveAction(hillSnapshot, hillActor, "hill_sword", "hill_target", scriptedDice({ d20: [10], damage: [5, 0] }), createCombatLog()), true);
  assert.equal(hasCondition(hillSnapshot.actors.find((item) => item.id === "hill_target"), "prone"), true, "Hill's Tumble should knock the damaged target prone");

  const stoneGoliath = speciesActor("goliath", "stone", { id: "stone_goliath", hp: 20 });
  const enemy = createEnemyCombatActor("goblin", { id: "enemy", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  enemy.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d10" })];
  const stoneSnapshot = snapshotWith([stoneGoliath, enemy]);
  const defender = stoneSnapshot.actors.find((item) => item.id === "stone_goliath");
  assert.equal(resolveAction(stoneSnapshot, stoneSnapshot.actors.find((item) => item.id === "enemy"), "club", "stone_goliath", scriptedDice({ d20: [10], damage: [10, 6] }), createCombatLog()), true);
  assert.equal(defender.hp, 16, "Stone's Endurance should reduce incoming damage");
  assert.equal(defender.resources.find((item) => item.id === "stones_endurance").current, 2, "Stone's Endurance should spend one resource");
}

function testSpeciesRollModifiersAndRerolls() {
  const gnome = speciesActor("gnome", "forest", { id: "gnome" });
  const caster = createEnemyCombatActor("goblin", { id: "caster", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  caster.actions = [saveAction({ id: "fear", saveAbility: "wis", damage: "1d6" })];
  const saveSnapshot = snapshotWith([gnome, caster]);
  const saveLog = createCombatLog();
  assert.equal(resolveAction(saveSnapshot, saveSnapshot.actors.find((item) => item.id === "caster"), "fear", "gnome", scriptedDice({ d20: [1, 18], damage: [4] }), saveLog), true);
  assert.equal(saveLog.events.some((event) => event.type === "save.roll" && event.detail?.mode === "advantage"), true, "Gnomish Cunning should grant save advantage");

  const halfling = speciesActor("halfling", "lightfoot", { id: "halfling" });
  const target = createEnemyCombatActor("goblin", { id: "target", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  const attackSnapshot = snapshotWith([halfling, target]);
  const actor = attackSnapshot.actors.find((item) => item.id === "halfling");
  actor.actions.push(meleeAttack({ id: "dagger", attackBonus: 20, damage: "1d4" }));
  const attackLog = createCombatLog();
  assert.equal(resolveAction(attackSnapshot, actor, "dagger", "target", scriptedDice({ d20: [1, 14], damage: [4] }), attackLog), true);
  assert.equal(attackLog.events.some((event) => event.type === "lucky.roll" && event.detail?.originalRoll === 1 && event.detail?.secondRoll === 14), true, "Halfling Lucky should reroll natural 1s");

  const largeGoliath = speciesActor("goliath", "stone", { id: "large_goliath", level: 5 });
  const largeSnapshot = snapshotWith([largeGoliath]);
  const largeActor = largeSnapshot.actors.find((item) => item.id === "large_goliath");
  assert.equal(resolveAction(largeSnapshot, largeActor, "large_form", null, scriptedDice({ damage: [2] }), createCombatLog()), true);
  assert.equal(getEffectiveSpeed(largeSnapshot, largeActor), 9, "Large Form should apply its speed modifier");
}

function testStonecunningSeesInvisible() {
  const dwarf = speciesActor("dwarf", null, { id: "dwarf" });
  const invisible = createEnemyCombatActor("goblin", { id: "invisible", hp: 20, maxHp: 20, ac: 12, position: { x: 3, y: 1 } });
  invisible.conditions = [{ id: "invisible", label: "Invisible" }];
  const snapshot = snapshotWith([dwarf, invisible]);
  const actor = snapshot.actors.find((item) => item.id === "dwarf");
  const target = snapshot.actors.find((item) => item.id === "invisible");

  assert.equal(canSeeActor(snapshot, actor, target).ok, false, "Invisible targets should be unseen before Stonecunning");
  assert.equal(resolveAction(snapshot, actor, "stonecunning", null, scriptedDice(), createCombatLog()), true);
  assert.equal(canSeeActor(snapshot, actor, target).ok, true, "Stonecunning should grant see invisible through active senses");
  assert.equal(actor.resources.find((item) => item.id === "stonecunning").current, 0, "Stonecunning should spend its resource");
}

function speciesActor(speciesId, lineageId = null, options = {}) {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: options.id || speciesId,
      level: options.level || 5,
      backgroundId: "guard",
      speciesId,
      lineageId,
      classId: "fighter",
      subclassId: "champion",
    },
    abilities: {
      strength: 14,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    choices: {
      speciesChoices: speciesChoices(speciesId),
      weaponMasteryIds: ["longsword"],
      classChoices: {},
    },
    gear: {
      weaponIds: ["longsword"],
      armorId: "leather",
      inventory: [],
      attunedItemIds: [],
    },
  }), {}, { allowNonCreationLevel: true });
  return resolvedSheetToCombatActor(sheet, { id: options.id || speciesId, hp: options.hp, position: options.position || { x: 1, y: 1 } });
}

function speciesChoices(speciesId) {
  if (speciesId === "elf") return { keen_senses_skill: "perception" };
  if (speciesId === "human") return { skillful_skill: "perception", versatile_feat: "tough" };
  return {};
}

function snapshotWith(actors) {
  return createSnapshotFromScenario({
    id: "species-feature-test",
    grid: { width: 8, height: 5, blocked: [], cover: [] },
    actors,
  });
}

function meleeAttack(overrides = {}) {
  return {
    id: "strike",
    name: "Strike",
    type: "weapon_attack",
    cost: "action",
    requiresTarget: true,
    range: 1,
    attackBonus: 5,
    damage: "1d8",
    damageType: "slashing",
    tags: { attackRoll: true, weapon: true, melee: true, harmful: true },
    ...overrides,
  };
}

function saveAction(overrides = {}) {
  return {
    id: "save_action",
    name: "Save Action",
    type: "feature_action",
    cost: "action",
    requiresTarget: true,
    range: 6,
    saveAbility: "wis",
    spellSaveDC: 12,
    save: { ability: "wis", onSuccess: "half" },
    damage: "1d6",
    damageType: "psychic",
    tags: { harmful: true },
    ...overrides,
  };
}
