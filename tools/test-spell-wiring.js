import assert from "node:assert/strict";
import { createSpellAction } from "../app/combat/actionFactory.js";
import { validateCombatAction } from "../app/combat/actionSchema.js";
import { createCombatLog } from "../app/combat/combatLog.js";
import { resolveAction, startTurn } from "../app/combat/resolver.js";
import { SPELLS } from "../app/data/spells.js";
import { canResolveUtilitySpell, resolveUtilitySpell } from "../app/systems/utilitySpellResolver.js";
import { makeHarnessSnapshot, scriptedDice } from "./combat_tests/helpers.js";

function harness() {
  const snapshot = makeHarnessSnapshot();
  snapshot.grid.width = 20;
  snapshot.grid.height = 20;
  snapshot.grid.blocked = new Set();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 3, y: 0 };
  hero.hp = hero.maxHp = 30;
  enemy.hp = enemy.maxHp = 30;
  return { snapshot, hero, enemy, log: createCombatLog() };
}

function resetEconomy(actor) {
  actor.economy.actionAvailable = true;
  actor.economy.bonusActionAvailable = true;
  actor.economy.reactionAvailable = true;
  actor.turnFlags = {};
}

function testCompleteCatalogueCoverage() {
  const active = Object.values(SPELLS).filter((spell) => spell.active !== false);
  assert.equal(active.length, 151);
  for (const spell of active) {
    assert.equal(spell.classes?.some((name) => name === "Fighter" || name === "Rogue"), false, `${spell.id} should not retain Fighter/Rogue spell access`);
    if (canResolveUtilitySpell(spell)) continue;
    const action = createSpellAction(spell, { spellSaveDC: 15, attackBonus: 7, spellcastingModifier: 4 });
    assert.ok(action, `${spell.id} should compile to a combat action`);
    assert.deepEqual(validateCombatAction(action), [], `${spell.id} should compile to a valid combat action`);
  }
  assert.equal(active.filter(canResolveUtilitySpell).length, 7);
}

function testUtilityResolvers() {
  const object = { id: "chain", broken: true, breakSizeFt: 0.5 };
  assert.equal(resolveUtilitySpell("mending", { target: object }).ok, true);
  assert.equal(object.repaired, true);
  assert.equal(resolveUtilitySpell("mage_hand", { target: { id: "key", weightLb: 1 }, distanceFt: 25 }).ok, true);
  const detected = resolveUtilitySpell("detect_magic", { entities: [{ id: "rune", magical: true, position: { x: 2, y: 0 } }] });
  assert.deepEqual(detected.matches.map((item) => item.id), ["rune"]);
  let illusion = null;
  assert.equal(resolveUtilitySpell("silent_image", { anchor: { x: 1, y: 1 }, addIllusion: (value) => { illusion = value; } }).ok, true);
  assert.equal(illusion.spellId, "silent_image");
  assert.equal(resolveUtilitySpell("minor_magic", { category: "sensory_flourish", description: "sparks" }).ok, true);
}

function testRevivifyAndAuraOfVitality() {
  const { snapshot, hero, log } = harness();
  const ally = structuredClone(hero);
  ally.id = "ally";
  ally.name = "Ally";
  ally.position = { x: 1, y: 0 };
  ally.hp = 0;
  ally.defeated = true;
  snapshot.actors.push(ally);
  hero.actions.push(createSpellAction(SPELLS.revivify));
  assert.equal(resolveAction(snapshot, hero, "revivify", ally.id, scriptedDice({ damage: 1 }), log), true, JSON.stringify(log.events));
  assert.equal(ally.hp, 1);
  assert.equal(ally.defeated, false);

  resetEconomy(hero);
  ally.hp = 1;
  hero.actions.push(createSpellAction(SPELLS.aura_of_vitality));
  assert.equal(resolveAction(snapshot, hero, "aura_of_vitality", null, scriptedDice(), log), true);
  const heal = hero.actions.find((action) => action.id === "aura_of_vitality_heal");
  assert.ok(heal);
  assert.equal(heal.usesSpellSlot, false);
  assert.equal(heal.oncePerTurn, true);
  assert.equal(resolveAction(snapshot, hero, heal.id, ally.id, scriptedDice({ damage: 6 }), log), true);
  assert.equal(ally.hp, 7);
  hero.economy.bonusActionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, heal.id, ally.id, scriptedDice({ damage: 6 }), log), false);
}

function testSilenceAndGlobe() {
  const silenced = harness();
  silenced.hero.actions.push(createSpellAction(SPELLS.silence));
  assert.equal(resolveAction(silenced.snapshot, silenced.hero, "silence", { anchor: silenced.enemy.position }, scriptedDice(), silenced.log), true);
  silenced.enemy.actions.push(createSpellAction(SPELLS.magic_missile));
  resetEconomy(silenced.enemy);
  assert.equal(resolveAction(silenced.snapshot, silenced.enemy, "magic_missile", silenced.hero.id, scriptedDice({ damage: 3 }), silenced.log), false);

  const globe = harness();
  globe.hero.actions.push(createSpellAction(SPELLS.globe_of_invulnerability));
  assert.equal(resolveAction(globe.snapshot, globe.hero, "globe_of_invulnerability", { anchor: globe.hero.position }, scriptedDice(), globe.log), true);
  globe.enemy.actions.push(createSpellAction(SPELLS.magic_missile));
  resetEconomy(globe.enemy);
  assert.equal(resolveAction(globe.snapshot, globe.enemy, "magic_missile", globe.hero.id, scriptedDice({ damage: 3 }), globe.log), false);
}

function testCounterspellAndZones() {
  const counter = harness();
  counter.hero.actions.push(createSpellAction(SPELLS.counterspell));
  const cast = { targetId: counter.enemy.id, spellName: "Fireball", spellLevel: 3 };
  assert.equal(resolveAction(counter.snapshot, counter.hero, "counterspell", cast, scriptedDice(), counter.log), true);
  assert.equal(cast.interrupted, true);

  for (const id of ["wall_of_fire", "wall_of_ice", "blade_barrier", "cloudkill", "symbol"]) {
    const { snapshot, hero, log } = harness();
    const action = createSpellAction(SPELLS[id], { spellSaveDC: 15 });
    hero.actions.push(action);
    const payload = action.object?.placement === "cell_path"
      ? { anchor: { x: 2, y: 2 }, cells: [{ x: 2, y: 2 }, { x: 3, y: 2 }] }
      : { anchor: { x: 3, y: 2 } };
    assert.equal(resolveAction(snapshot, hero, id, payload, scriptedDice(), log), true, `${id} should resolve`);
    assert.ok(snapshot.combatObjects.some((object) => object.sourceActionId === id), `${id} should create its persistent zone`);
  }
}

function testTeleportConditionsAndRegeneration() {
  const tele = harness();
  tele.hero.actions.push(createSpellAction(SPELLS.dimension_door));
  assert.equal(resolveAction(tele.snapshot, tele.hero, "dimension_door", { anchor: { x: 8, y: 8 } }, scriptedDice(), tele.log), true);
  assert.deepEqual(tele.hero.position, { x: 8, y: 8 });

  const command = harness();
  command.hero.actions.push(createSpellAction(SPELLS.command, { spellSaveDC: 15 }));
  assert.equal(resolveAction(command.snapshot, command.hero, "command", {
    targetId: command.enemy.id,
    choices: { effectMode: "flee" },
  }, scriptedDice({ d20: [1] }), command.log), true);
  assert.ok(command.enemy.conditions.some((condition) => condition.id === "frightened"));

  const regen = harness();
  const ally = structuredClone(regen.hero);
  ally.id = "regen_ally";
  ally.name = "Regen Ally";
  ally.position = { x: 1, y: 0 };
  ally.hp = 5;
  regen.snapshot.actors.push(ally);
  regen.hero.actions.push(createSpellAction(SPELLS.regenerate));
  assert.equal(resolveAction(regen.snapshot, regen.hero, "regenerate", ally.id, scriptedDice({ damage: 10 }), regen.log), true);
  assert.equal(ally.hp, 15);
  assert.ok(ally.conditions.some((condition) => condition.id === "regenerating"));
  startTurn(regen.snapshot, ally, regen.log, scriptedDice({ damage: 1 }));
  assert.equal(ally.hp, 16);
}

testCompleteCatalogueCoverage();
testUtilityResolvers();
testRevivifyAndAuraOfVitality();
testSilenceAndGlobe();
testCounterspellAndZones();
testTeleportConditionsAndRegeneration();
console.log("[spell-wiring:test] OK");
