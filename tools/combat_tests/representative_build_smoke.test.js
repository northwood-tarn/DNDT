import {
  assert,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  hasCondition,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
  startTurn,
} from "./helpers.js";

export function runRepresentativeBuildSmokeTests() {
  testGeneratedWarClericUsesGuidedStrike();
  testGeneratedAssassinCritsSurprisedTarget();
  testGeneratedStoneGoliathUsesEndurance();
  testGeneratedPaladinAuraAffectsAlly();
  testGeneratedWarlockRetaliatesWithStormsThunder();
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
