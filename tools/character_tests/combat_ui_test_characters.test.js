import assert from "node:assert/strict";
import test from "node:test";
import { createCombatUiTestCharacterRecord } from "../../app/character/combatUiTestCharacters.js";
import { createCombatScenario, createSnapshotFromScenario } from "../../app/combat/scenario.js";
import { createCombatGame } from "../../app/combat/api.js";
import { getCurrentActor, getValidTargets } from "../../app/combat/selectors.js";

const BUILDS = [
  { id: "battlemage", scenarioId: "combat-ui-battlemage-l13", minimumActions: 20 },
  { id: "saboteur", scenarioId: "combat-ui-saboteur-l13", minimumActions: 10 },
  { id: "lantern_cleric", scenarioId: "combat-ui-lantern-cleric-l13", minimumActions: 20 },
];

for (const build of BUILDS) {
  test(`${build.id} level-13 combat UI character resolves into a playable actor`, () => {
    const record = createCombatUiTestCharacterRecord(build.id);
    assert.equal(record.status, "ready");
    assert.equal(record.validityReport.valid, true);
    assert.equal(record.resolvedCharacterSheet.identity.level, 13);
    assert.equal(record.resolvedCharacterSheet.metadata.unresolved.length, 0);
    assert.ok(record.combatActor.actions.length >= build.minimumActions);
    assert.equal(record.combatActor.portraitId, record.resolvedCharacterSheet.metadata.presentation.portraitId || null);

    const snapshot = createSnapshotFromScenario(createCombatScenario(build.scenarioId));
    const hero = snapshot.actors.find((actor) => actor.id === "generated_pc");
    assert.ok(hero);
    assert.equal(hero.level, 13);
    assert.ok(hero.actions.length >= build.minimumActions);
    assert.equal(hero.portraitId, record.resolvedCharacterSheet.metadata.presentation.portraitId || null);
  });
}

test("Saboteur build exercises five distinct prepared recipe interaction types", () => {
  const record = createCombatUiTestCharacterRecord("saboteur");
  assert.deepEqual(record.resolvedCharacterSheet.devices.preparedRecipeIds, [
    "fire_paper",
    "smoke_vial",
    "thunder_wire",
    "makeshift_fan",
    "frost_grenado",
  ]);
  const deviceActions = record.combatActor.actions.filter((action) => action.tags?.device && action.resourceId === "prepared_devices");
  const standardDeviceActions = deviceActions.filter((action) => action.id.startsWith("device_"));
  assert.equal(standardDeviceActions.length, 5);
  assert.equal(deviceActions.length, 20);
  assert.ok(standardDeviceActions.some((action) => action.cost === "reaction"));
  assert.ok(deviceActions.some((action) => action.targeting?.shape === "radius"));
  assert.ok(deviceActions.some((action) => action.targeting?.shape === "line"));
  assert.match(standardDeviceActions.find((action) => action.name === "Smoke Vial").description, /for 5 rounds/i);
  assert.doesNotMatch(standardDeviceActions.find((action) => action.name === "Smoke Vial").description, /\bPB\b/i);
  assert.match(standardDeviceActions.find((action) => action.name === "Frost Grenado").description, /5d12 cold damage/i);
  assert.ok(deviceActions.some((action) => action.choiceParentResourceId === "quick_rigging"));
  assert.ok(deviceActions.some((action) => action.choiceParentResourceId === "double_rig"));
});

test("prepared spells are exposed at every available casting level", () => {
  const mara = createCombatUiTestCharacterRecord("battlemage").combatActor;
  const fireballs = mara.actions.filter((action) => action.sourceSpellId === "fireball");
  assert.deepEqual(fireballs.map((action) => action.spellLevel), [3, 4, 5, 6, 7]);
  assert.deepEqual(fireballs.map((action) => action.damage), ["8d6", "9d6", "10d6", "11d6", "12d6"]);

  const elian = createCombatUiTestCharacterRecord("lantern_cleric").combatActor;
  assert.deepEqual(
    elian.actions.filter((action) => action.sourceSpellId === "cure_wounds").map((action) => action.spellLevel),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(elian.combatSpellLevelStyle, "slot_pips");
  assert.deepEqual(elian.actions.find((action) => action.id === "sear_undead").damageByTargetProperty.values, {
    profane: "5d8",
    bound: "4d8",
    sovereign: "3d8",
  });
});

test("Sister Elian's complete selected spell set compiles into combat actions", () => {
  const record = createCombatUiTestCharacterRecord("lantern_cleric");
  const sheet = record.resolvedCharacterSheet;
  const actor = record.combatActor;
  const selected = [...new Set([
    ...(sheet.spellcasting.knownSpellIds || []),
    ...(sheet.spellcasting.preparedSpellIds || []),
  ])];
  const missing = selected.filter((spellId) => !actor.actions.some((action) => action.sourceSpellId === spellId));
  assert.deepEqual(missing, [], `Every selected spell should compile; missing: ${missing.join(", ")}`);

  assert.equal(actor.actions.find((action) => action.id === "aid")?.maxTargets, 3);
  assert.equal(actor.actions.find((action) => action.id === "spiritual_weapon")?.cost, "bonus");
  assert.deepEqual(
    actor.actions.filter((action) => action.sourceSpellId === "spiritual_weapon").map((action) => action.damage),
    ["1d8+3", "1d8+3", "2d8+3", "2d8+3", "3d8+3", "3d8+3"],
  );
  assert.equal(actor.actions.find((action) => action.id === "mass_healing_word")?.maxTargets, 6);
  assert.equal(actor.actions.find((action) => action.id === "heal")?.healing, "70");
  assert.equal(actor.actions.find((action) => action.id === "heal:level_7")?.healing, "80");
  assert.equal(actor.actions.find((action) => action.id === "fire_storm")?.damage, "7d10");
  assert.deepEqual(
    actor.actions.filter((action) => action.sourceSpellId === "spirit_guardians").map((action) => action.object.effects[0].damage),
    ["3d8", "4d8", "5d8", "6d8", "7d8"],
  );
});

test("every selected Sister Elian spell resolves and produces a meaningful combat log event", async () => {
  const spellIds = [
    "guidance", "sacred_flame", "light", "toll_the_dead", "word_of_radiance",
    "bless", "cure_wounds", "guiding_bolt", "shield_of_faith", "aid",
    "spiritual_weapon", "lesser_restoration", "spirit_guardians", "dispel_magic",
    "mass_healing_word", "banishment", "death_ward", "dawn", "greater_restoration",
    "heal", "fire_storm",
  ];
  const meaningfulTypes = new Set([
    "attack.result", "damage.applied", "healing.applied", "effect.applied", "effect.removed",
    "condition.applied", "condition.removed", "object.created", "area.target", "action.granted",
  ]);

  for (const spellId of spellIds) {
    const game = createCombatGame({
      scenarioId: "combat-ui-lantern-cleric-l13",
      scenarioOptions: { enemyHp: 999, enemyPosition: { x: 2, y: 1 } },
    });
    while (getCurrentActor(game.snapshot)?.team === "enemies") await game.runEnemyTurnIfNeeded();
    const actor = getCurrentActor(game.snapshot);
    const enemy = game.snapshot.actors.find((item) => item.team === "enemies");
    actor.hp = Math.floor(actor.maxHp / 2);
    actor.conditions = [{ id: "poisoned", label: "Poisoned" }];
    const action = actor.actions.find((item) => item.id === spellId);
    assert.ok(action, `${spellId} should have a native combat action`);
    const validTargets = getValidTargets(game.snapshot, actor.id, action.id);
    let target = null;
    if (action.targeting?.shape) {
      const anchor = action.tags?.harmful === false ? actor.position : enemy.position;
      target = { anchor: { ...anchor }, cells: [{ ...anchor }] };
    } else if (action.maxTargets > 1) {
      const preferred = validTargets.find((item) => action.tags?.harmful ? item.team === "enemies" : item.team === actor.team) || validTargets[0];
      target = { targetIds: preferred ? [preferred.id] : [] };
    } else if (action.requiresTarget !== false) {
      const preferred = action.tags?.harmful
        ? validTargets.find((item) => item.team === "enemies")
        : validTargets.find((item) => item.id === actor.id);
      target = (preferred || validTargets[0])?.id || actor.id;
    }
    const start = game.log.events.length;
    const slotBefore = action.spellLevel > 0 ? actor.spellSlots[action.spellLevel].current : null;
    const result = game.resolveAction(actor.id, action.id, target);
    assert.equal(result.ok, true, `${spellId} should resolve: ${result.reason}`);
    const emitted = game.log.events.slice(start).map((event) => event.type);
    assert.ok(emitted.some((type) => meaningfulTypes.has(type)), `${spellId} should produce a meaningful log event; got ${emitted.join(", ")}`);
    if (action.spellLevel > 0) assert.equal(actor.spellSlots[action.spellLevel].current, slotBefore - 1, `${spellId} should spend exactly one level-${action.spellLevel} slot`);
    if (action.cost === "action") assert.equal(actor.economy.actionAvailable, false, `${spellId} should spend the action`);
    if (action.cost === "bonus") assert.equal(actor.economy.bonusActionAvailable, false, `${spellId} should spend the bonus action`);
  }
});

test("Mara returns for round two with turn economy refreshed and spent slots preserved", async () => {
  const game = createCombatGame({
    scenarioId: "combat-ui-battlemage-l13",
    scenarioOptions: { enemyHp: 999, enemyAttackBonus: -100, enemyPosition: { x: 2, y: 1 } },
  });
  while (getCurrentActor(game.snapshot)?.team === "enemies") await game.runEnemyTurnIfNeeded();

  const mara = getCurrentActor(game.snapshot);
  const before = mara.spellSlots[1].current;
  const result = game.resolveAction(mara.id, "magic_missile", {
    targetIds: ["generated_enemy", "generated_enemy", "generated_enemy"],
  });
  assert.equal(result.ok, true);
  assert.equal(mara.spellSlots[1].current, before - 1);
  assert.equal(mara.economy.actionAvailable, false);

  game.endTurn();
  while (getCurrentActor(game.snapshot)?.team === "enemies") await game.runEnemyTurnIfNeeded();

  const nextMara = getCurrentActor(game.snapshot);
  assert.equal(nextMara.name, "Mara Vey, Battlemage");
  assert.equal(nextMara.economy.actionAvailable, true);
  assert.equal(nextMara.spellSlots[1].current, before - 1);
  assert.equal(game.snapshot.round, 2);
});

test("Mara compiles her native fifth-, sixth-, and seventh-level spells", () => {
  const mara = createCombatUiTestCharacterRecord("battlemage").combatActor;
  for (const [spellId, level] of [["cone_of_cold", 5], ["chain_lightning", 6], ["forcecage", 7]]) {
    const action = mara.actions.find((candidate) => candidate.id === spellId);
    assert.ok(action, `${spellId} should compile into Mara's combat actions`);
    assert.equal(action.spellLevel, level);
    assert.equal(action.baseSpellLevel, level);
  }
});
