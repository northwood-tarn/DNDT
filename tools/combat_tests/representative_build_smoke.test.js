import {
  assert,
  createCombatController,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  getMovementRemaining,
  hasCondition,
  moveActor,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
  startTurn,
} from "./helpers.js";
import { getEffectiveSpeed } from "../../app/combat/modifiers.js";
import { hasCombatObjectLineOfSight } from "../../app/combat/combatObjects.js";
import { createCatastrophicChargeVariant } from "../../app/combat/deviceActions.js";

export function runRepresentativeBuildSmokeTests() {
  testGeneratedWarClericUsesGuidedStrike();
  testGeneratedAssassinCritsSurprisedTarget();
  testGeneratedStoneGoliathUsesEndurance();
  testGeneratedPaladinAuraAffectsAlly();
  testGeneratedWarlockRetaliatesWithStormsThunder();
  testSaboteurFirePaperAddsWeaponDamage();
  testSaboteurSaintPaperDoublesRadiantDamageAgainstUndead();
  testSaboteurFrostGrenadoSlowsTarget();
  testSaboteurPersistentDevicesResolve();
  testSaboteurSafeGeometryExemptsFriendlyNpc();
  testSaboteurCatastrophicChargeRepeatsAndSpendsOnce();
}

function testSaboteurSafeGeometryExemptsFriendlyNpc() {
  const saboteur = saboteurActor("safe_geometry_saboteur", ["poison_vial"]);
  saboteur.position = { x: 0, y: 4 };
  const friend = createEnemyCombatActor("goblin", { id: "friendly_npc", hp: 30, maxHp: 30, position: { x: 3, y: 1 }, saves: { con: 0 } });
  friend.team = "heroes";
  const enemy = createEnemyCombatActor("goblin", { id: "safe_geometry_enemy", hp: 30, maxHp: 30, position: { x: 4, y: 1 }, saves: { con: 0 } });
  const snapshot = createSnapshotFromScenario(testScenario("safe-geometry-runtime", [saboteur, friend, enemy]));
  const source = snapshot.actors[0];
  const friendlyNpc = snapshot.actors[1];
  const hostile = snapshot.actors[2];

  assert.equal(source.actions.find((action) => action.id === "device_poison_vial").safeGeometry, true, "level-7 Safe Geometry should be attached automatically to every device action");
  assert.equal(resolveAction(snapshot, source, "device_poison_vial", { anchor: { ...friendlyNpc.position } }, fixedDice({ d20: 1, damage: 4 }), createCombatLog()), true);
  assert.equal(friendlyNpc.hp, 30, "Safe Geometry should exempt friendly NPCs from device damage automatically");
  assert.ok(hostile.hp < 30, "Safe Geometry should not protect enemies caught in the same device area");
}

function testSaboteurPersistentDevicesResolve() {
  testPoisonVialPlacementAndTurnTrigger();
  testTarVialCreatesDifficultTerrain();
  testSmokeVialBlocksLineOfSight();
  testGraveLimeBlocksHealing();
}

function testPoisonVialPlacementAndTurnTrigger() {
  const saboteur = saboteurActor("poison_saboteur", ["poison_vial"]);
  const enemy = createEnemyCombatActor("goblin", { id: "poison_target", hp: 30, maxHp: 30, position: { x: 3, y: 1 }, saves: { con: 0 } });
  const snapshot = createSnapshotFromScenario(testScenario("poison-vial-runtime", [saboteur, enemy]));
  const source = snapshot.actors[0];
  const target = snapshot.actors[1];
  const dice = fixedDice({ d20: 1, damage: 4 });
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, source, "device_poison_vial", { anchor: { ...target.position } }, dice, log), true);
  assert.ok(target.hp < 30, "Poison Vial should damage creatures caught when its fumes appear");
  assert.equal(snapshot.combatObjects[0].duration.remaining, source.proficiencyBonus, "Poison Vial should persist for proficiency bonus rounds");
  const afterPlacement = target.hp;
  startTurn(snapshot, target, log, dice);
  assert.ok(target.hp < afterPlacement, "Poison Vial should trigger again when a creature starts its turn in the fumes");
}

function testTarVialCreatesDifficultTerrain() {
  const saboteur = saboteurActor("tar_saboteur", ["tar_vial"]);
  saboteur.position = { x: 0, y: 4 };
  const enemy = createEnemyCombatActor("goblin", { id: "tar_target", hp: 30, maxHp: 30, speed: 6, position: { x: 1, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("tar-vial-runtime", [saboteur, enemy]));
  const source = snapshot.actors[0];
  const target = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, source, "device_tar_vial", { anchor: { x: 3, y: 1 } }, fixedDice(), createCombatLog()), true);
  startTurn(snapshot, target, createCombatLog(), fixedDice());
  const before = getMovementRemaining(target);
  assert.equal(moveActor(snapshot, target, { x: 2, y: 1 }, createCombatLog(), { dice: fixedDice() }), true);
  assert.equal(before - getMovementRemaining(target), 2, "Tar Vial should make its area difficult terrain");
}

function testSmokeVialBlocksLineOfSight() {
  const saboteur = saboteurActor("smoke_saboteur", ["smoke_vial"]);
  saboteur.position = { x: 0, y: 1 };
  const enemy = createEnemyCombatActor("goblin", { id: "smoke_target", hp: 30, maxHp: 30, position: { x: 5, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("smoke-vial-runtime", [saboteur, enemy]));
  const source = snapshot.actors[0];
  const target = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, source, "device_smoke_vial", { anchor: { x: 3, y: 1 } }, fixedDice(), createCombatLog()), true);
  assert.equal(hasCombatObjectLineOfSight(snapshot, source.position, target.position), false, "Smoke Vial should block line of sight through its area");
}

function testGraveLimeBlocksHealing() {
  const saboteur = saboteurActor("grave_dirt_saboteur", ["grave_dirt_grenado"]);
  saboteur.position = { x: 0, y: 4 };
  const enemy = createEnemyCombatActor("goblin", { id: "grave_dirt_target", hp: 5, maxHp: 20, position: { x: 3, y: 1 } });
  enemy.actions = [{ id: "self_heal", name: "Self Heal", type: "self_heal", cost: "action", requiresTarget: false, healing: "1d6", tags: { harmful: false } }];
  const snapshot = createSnapshotFromScenario(testScenario("grave-lime-runtime", [saboteur, enemy]));
  const source = snapshot.actors[0];
  const target = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, source, "device_grave_dirt_grenado", { anchor: { ...target.position } }, fixedDice(), createCombatLog()), true);
  startTurn(snapshot, target, createCombatLog(), fixedDice());
  assert.equal(resolveAction(snapshot, target, "self_heal", null, fixedDice({ damage: 6 }), createCombatLog()), false);
  assert.equal(target.hp, 5, "Grave Dirt Grenado should prevent every hit point recovery route while the target remains inside");
}

function testSaboteurCatastrophicChargeRepeatsAndSpendsOnce() {
  const saboteur = saboteurActor("catastrophic_saboteur", ["acid_grenado"]);
  const enemy = createEnemyCombatActor("goblin", { id: "catastrophic_target", hp: 100, maxHp: 100, position: { x: 2, y: 1 }, saves: { dex: 0 } });
  const snapshot = createSnapshotFromScenario(testScenario("catastrophic-charge-runtime", [saboteur, enemy]));
  const source = snapshot.actors[0];
  const charge = source.actions.find((action) => action.id === "catastrophic_charge");
  const device = source.actions.find((action) => action.id === "device_acid_grenado");
  const variant = createCatastrophicChargeVariant(charge, device);
  source.actions.push(variant);
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, source, variant.id, enemy.id, fixedDice({ d20: 1, damage: 5 }), log), true);
  assert.equal(log.events.filter((event) => event.type === "save.result" && event.detail.spellName === variant.name).length, 2, "Catastrophic Charge should resolve the selected device twice");
  assert.equal(source.resources.find((resource) => resource.id === "catastrophic_charge").current, 0, "Catastrophic Charge should spend its own use once");
  assert.equal(source.resources.find((resource) => resource.id === "prepared_devices").current, 12, "Catastrophic Charge should expend one prepared device, not two");
}

function saboteurActor(id, preparedRecipeIds, advancedRecipeIds = ["lightning_grenado", "fire_paper"]) {
  return actorFromDraft(id, {
    identity: { characterName: id, level: 13, backgroundId: "criminal", speciesId: "halfling", lineageId: "lightfoot", classId: "rogue", subclassId: "saboteur" },
    abilities: { strength: 8, dexterity: 16, constitution: 14, intelligence: 16, wisdom: 10, charisma: 10 },
    choices: {
      classChoices: {
        rogue_expertise_skills: ["stealth", "investigation"],
        origin_device: "poison_vial",
        saboteur_cookbook_recipes: ["tar_vial", "smoke_vial"],
        saboteur_grenado_recipe: "acid_grenado",
        saboteur_free_recipe: "grave_dirt_grenado",
        saboteur_advanced_recipes: advancedRecipeIds,
      },
    },
    devices: { preparedRecipeIds },
  });
}

function testSaboteurFirePaperAddsWeaponDamage() {
  const controller = createCombatController({
    scenarioId: "combat-ui-saboteur-l13",
    scenarioOptions: { enemyHp: 999, enemyPosition: { x: 2, y: 1 } },
  });
  const snapshot = controller.snapshot;
  const nix = snapshot.actors.find((actor) => actor.team === "heroes");
  const enemy = snapshot.actors.find((actor) => actor.team === "enemies");
  const log = createCombatLog();
  const dice = fixedDice({ d20: 20, damage: 4 });

  assert.equal(resolveAction(snapshot, nix, "device_fire_paper", nix.id, dice, log), true);
  assert.equal(resolveAction(snapshot, nix, "rapier", enemy.id, dice, log), true);
  assert.equal(
    log.events.some((event) => event.type === "damage.applied" && event.detail.damageType === "fire"),
    true,
    "Fire Paper should add fire damage to Nix's next weapon hit",
  );
}

function testSaboteurSaintPaperDoublesRadiantDamageAgainstUndead() {
  const saboteur = saboteurActor("saint_paper_saboteur", ["saint_paper"], ["lightning_grenado", "saint_paper"]);
  saboteur.actions.push(meleeAttack({ id: "saint_paper_strike" }));
  const undead = createEnemyCombatActor("skeleton", {
    id: "saint_paper_undead",
    hp: 50,
    maxHp: 50,
    position: { x: 2, y: 1 },
  });
  const snapshot = createSnapshotFromScenario(testScenario("saint-paper-runtime", [saboteur, undead]));
  const source = snapshot.actors[0];
  const target = snapshot.actors[1];
  const log = createCombatLog();

  assert.equal(target.creatureType, "undead", "Saint Paper regression target should be undead");
  assert.equal(resolveAction(snapshot, source, "device_saint_paper", source.id, fixedDice({ damage: 4 }), log), true);
  source.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, source, "saint_paper_strike", target.id, fixedDice({ d20: 10, damage: 4 }), log), true);
  assert.equal(
    log.events.some((event) => event.type === "damage.applied" && event.detail.damageType === "radiant" && event.detail.amount === 8),
    true,
    "Saint Paper should double its rolled radiant rider damage against undead",
  );
}

function testSaboteurFrostGrenadoSlowsTarget() {
  const controller = createCombatController({
    scenarioId: "combat-ui-saboteur-l13",
    scenarioOptions: { enemyHp: 999, enemyPosition: { x: 2, y: 1 } },
  });
  const snapshot = controller.snapshot;
  const nix = snapshot.actors.find((actor) => actor.team === "heroes");
  const enemy = snapshot.actors.find((actor) => actor.team === "enemies");
  const baseSpeed = enemy.speed;

  assert.equal(resolveAction(snapshot, nix, "device_frost_grenado", enemy.id, fixedDice({ d20: 20, damage: 10 }), createCombatLog()), true);
  assert.equal(getEffectiveSpeed(snapshot, enemy), baseSpeed - 2, "Frost Grenado should reduce the target's speed by two squares");
}

function testGeneratedWarClericUsesGuidedStrike() {
  const cleric = actorFromDraft("war_cleric", {
    identity: { characterName: "War Cleric", level: 7, backgroundId: "acolyte", speciesId: "dwarf", classId: "cleric", subclassId: "war_domain" },
    abilities: casterAbilities("wisdom"),
    spells: { knownSpellIds: ["guidance", "sacred_flame"], preparedSpellIds: ["bless", "cure_wounds"] },
  });
  cleric.actions.push(meleeAttack({ id: "mace", attackBonus: 0 }));
  const enemy = createEnemyCombatActor("goblin", { id: "target", hp: 12, maxHp: 12, ac: 15, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("generated-war-cleric-smoke", [cleric, enemy]));

  assert.equal(resolveAction(snapshot, snapshot.actors[0], "mace", "target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((actor) => actor.id === "target").hp, 8, "generated War Cleric should use Guided Strike in combat");
}

function testGeneratedAssassinCritsSurprisedTarget() {
  const assassin = actorFromDraft("assassin", {
    identity: { characterName: "Assassin", level: 11, backgroundId: "criminal", speciesId: "halfling", lineageId: "lightfoot", classId: "rogue", subclassId: "assassin" },
    abilities: martialAbilities("dexterity"),
    choices: { classChoices: { rogue_expertise_skills: ["stealth", "deception"] } },
  });
  assassin.actions.push(meleeAttack({ id: "dagger", damage: "1d6", damageType: "piercing" }));
  const enemy = createEnemyCombatActor("goblin", { id: "surprised_target", hp: 30, maxHp: 30, position: { x: 2, y: 1 } });
  enemy.conditions = [{ id: "surprised", label: "Surprised" }];
  const snapshot = createSnapshotFromScenario(testScenario("generated-assassin-smoke", [assassin, enemy]));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors[0], "dagger", "surprised_target", fixedDice({ d20: 10, damage: 3 }), log), true);
  assert.ok(log.events.some((event) => event.type === "attack.result" && event.detail.critical === true), "generated Assassin should crit surprised targets");
}

function testGeneratedStoneGoliathUsesEndurance() {
  const fighter = actorFromDraft("stone_fighter", {
    identity: { characterName: "Stone Fighter", level: 11, backgroundId: "soldier", speciesId: "goliath", lineageId: "stone", classId: "fighter", subclassId: "champion" },
    abilities: martialAbilities("strength"),
  });
  fighter.hp = 20;
  fighter.maxHp = 30;
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "3d10" })];
  const snapshot = createSnapshotFromScenario(testScenario("generated-stone-goliath-smoke", [fighter, attacker]));

  assert.equal(resolveAction(snapshot, snapshot.actors[1], "club", "stone_fighter", fixedDice({ d20: 10, damage: 8 }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((actor) => actor.id === "stone_fighter").hp, 20, "generated Stone Goliath should reduce incoming damage");
}

function testGeneratedPaladinAuraAffectsAlly() {
  const paladin = actorFromDraft("glory_paladin", {
    identity: { characterName: "Glory Paladin", level: 7, backgroundId: "guard", speciesId: "dragonborn", lineageId: "red", classId: "paladin", subclassId: "oath_of_glory" },
    abilities: paladinAbilities(),
    spells: { preparedSpellIds: ["bless", "shield_of_faith"] },
  });
  const enemy = createEnemyCombatActor("goblin", { id: "enemy", hp: 12, maxHp: 12, saves: { wis: 0 }, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("generated-paladin-aura-smoke", [paladin, enemy]));

  assert.equal(snapshot.actors.find((actor) => actor.id === "glory_paladin").auras.some((aura) => aura.id === "aura_of_alacrity_self"), true);
  assert.equal(snapshot.actors.find((actor) => actor.id === "enemy").speed, 6);
  startTurn(snapshot, snapshot.actors.find((actor) => actor.id === "enemy"), createCombatLog(), scriptedDice());
  assert.equal(snapshot.actors.find((actor) => actor.id === "enemy").economy.movementMax, 4, "generated Glory Paladin aura should reduce nearby enemy speed");
}

function testGeneratedWarlockRetaliatesWithStormsThunder() {
  const warlock = actorFromDraft("storm_warlock", {
    identity: { characterName: "Storm Warlock", level: 11, backgroundId: "guide", speciesId: "goliath", lineageId: "storm", classId: "warlock", subclassId: "the_fiend", pactId: "pact_of_the_blade" },
    abilities: casterAbilities("charisma"),
    choices: { classChoices: { pact: "pact_of_the_blade", mystic_arcanum_spell: "mental_prison" } },
    spells: { knownSpellIds: ["eldritch_grasp", "dread_whisper"], preparedSpellIds: ["hex"] },
  });
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20 })];
  const snapshot = createSnapshotFromScenario(testScenario("generated-storm-warlock-smoke", [warlock, attacker]));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors[1], "club", "storm_warlock", fixedDice({ d20: 10, damage: 4 }), log), true);
  assert.equal(snapshot.actors.find((actor) => actor.id === "attacker").hp, 8, "generated Warlock should spend only one automatic reaction");
  assert.equal(log.events.filter((event) => event.type === "reaction.resolve").length, 1, "only one reaction should resolve from one incoming hit");
  assert.equal(log.events.some((event) => event.type === "reaction.suppressed" && event.detail.reactionId === "storms_thunder"), true, "eligible lower-priority reactions should be logged as suppressed");
  assert.equal(warlock.resources.find((item) => item.id === "hellish_rebuke").max, 2, "Hellish Rebuke escalation should merge into one upgraded resource");
}

function actorFromDraft(id, overrides) {
  const draft = createEmptyCharacterDraft({
    identity: overrides.identity,
    abilities: overrides.abilities,
    choices: {
      backgroundAbilityScores: ["primary", "secondary"],
      weaponMasteryIds: defaultWeaponMasteries(overrides.identity?.classId),
      ...(overrides.choices || {}),
    },
    gear: {
      weaponIds: ["quarterstaff"],
      armorId: null,
      shieldId: null,
      inventory: [],
      attunedItemIds: [],
      ...(overrides.gear || {}),
    },
    spells: overrides.spells || {},
    devices: overrides.devices || {},
  });
  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true });
  assert.equal(sheet.metadata.unresolved.length, 0, `${id} smoke sheet should resolve cleanly`);
  return resolvedSheetToCombatActor(sheet, { id, position: { x: 1, y: 1 } });
}

function defaultWeaponMasteries(classId) {
  if (classId === "fighter") return ["longsword", "warhammer", "greatsword"];
  if (classId === "rogue") return ["dagger", "rapier"];
  if (classId === "paladin") return ["longsword", "warhammer"];
  return [];
}

function meleeAttack(overrides = {}) {
  return {
    id: "strike",
    name: "Strike",
    type: "weapon_attack",
    range: 1,
    attackBonus: 20,
    damage: "1d6",
    damageType: "bludgeoning",
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
    ...overrides,
  };
}

function testScenario(id, actors) {
  return {
    id,
    grid: { width: 6, height: 5, blocked: [], cover: [] },
    actors,
  };
}

function martialAbilities(primary) {
  return {
    strength: primary === "strength" ? 16 : 10,
    dexterity: primary === "dexterity" ? 16 : 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 12,
    charisma: 8,
  };
}

function casterAbilities(primary) {
  return {
    strength: 8,
    dexterity: 14,
    constitution: 12,
    intelligence: primary === "intelligence" ? 16 : 10,
    wisdom: primary === "wisdom" ? 16 : 10,
    charisma: primary === "charisma" ? 16 : 10,
  };
}

function paladinAbilities() {
  return {
    strength: 16,
    dexterity: 10,
    constitution: 14,
    intelligence: 8,
    wisdom: 10,
    charisma: 14,
  };
}
