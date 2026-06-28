import {
  assert,
  createEnemyCombatActor,
  createEmptyCharacterDraft,
  createSnapshotFromScenario,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
} from "./helpers.js";
import { preflightAction } from "../../app/combat/actionResult.js";
import { enemies } from "../../app/data/enemies.js";
import { buildSpecs, draftFor } from "./build_matrix_smoke.test.js";

const CONTRACT_LEVELS = [1, 3, 5, 7, 9, 11, 13];

export function runCombatActionContractTests() {
  for (const actor of generatedPcActors()) {
    assertActorActionContracts(actor);
  }
  for (const enemyId of Object.keys(enemies)) {
    assertActorActionContracts(createEnemyCombatActor(enemyId, { id: `enemy_${enemyId}` }));
  }
  assertBadPayloadsFailPredictably();
}

function assertActorActionContracts(actor) {
  assert.ok((actor.actions || []).length, `${actor.id} should expose combat actions`);
  for (const action of actor.actions || []) {
    assertActionMetadataContract(actor, action);
  }
}

function assertActionMetadataContract(actor, action) {
  const label = `${actor.id}:${action.id}`;
  if (action.targeting?.shape && action.selfCenteredArea !== true) {
    assert.equal(action.requiresTarget, true, `${label} has area targeting but does not require a target payload`);
  }
  if (action.tags?.harmful === true && action.type === "feature_action" && action.selfCenteredArea !== true) {
    assert.notEqual(action.targeting?.mode, "nearby_actors", `${label} is a harmful auto-target feature; use an explicit target or area shape`);
  }
  if (action.type === "spell_auto_damage" && action.hits > 1) {
    assert.equal(action.targetAssignments, "per_hit", `${label} multi-hit auto spell must use per-hit target assignment`);
    assert.equal(action.allowRepeatedTargets, true, `${label} must allow repeated targets for dart assignment`);
    assert.equal(action.requireExactTargetCount, true, `${label} must require one assignment per hit`);
    assert.equal(action.maxTargets, action.hits, `${label} maxTargets must match hit count`);
  }
  if (action.type === "spell_attack" && action.repeatAttacks > 1) {
    assert.equal(action.targetAssignments, "per_hit", `${label} multi-beam spell must use per-hit target assignment`);
    assert.equal(action.allowRepeatedTargets, true, `${label} must allow repeated targets for beam assignment`);
    assert.equal(action.requireExactTargetCount, true, `${label} must require one assignment per beam`);
    assert.equal(action.maxTargets, action.repeatAttacks, `${label} maxTargets must match beam count`);
  }
  if (action.requireExactTargetCount) {
    assert.equal(Number.isFinite(action.maxTargets), true, `${label} exact target actions need numeric maxTargets`);
  }
}

function assertBadPayloadsFailPredictably() {
  const actor = generatedPcActors().find((item) => item.actions.some((action) => action.id === "breath_weapon"));
  const enemy = createEnemyCombatActor("goblin", { id: "target", position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario({
    id: "action-contract-bad-payloads",
    grid: { width: 10, height: 8, blocked: [], cover: [] },
    actors: [{ ...structuredClone(actor), position: { x: 1, y: 1 } }, enemy],
  });
  const runtimeActor = snapshot.actors.find((item) => item.id === actor.id);
  const breath = runtimeActor.actions.find((action) => action.id === "breath_weapon");
  assert.equal(preflightAction(snapshot, runtimeActor, breath.id, null).ok, false, "area actions must reject missing area anchors");

  const blast = runtimeActor.actions.find((action) => action.id === "eldritch_blast");
  if (blast?.requireExactTargetCount) {
    const result = preflightAction(snapshot, runtimeActor, blast.id, { targetIds: ["target"] });
    assert.equal(result.ok, false, "exact per-hit spells must reject incomplete target assignments");
  }

  const weapon = runtimeActor.actions.find((action) => action.type === "weapon_attack");
  if (weapon) {
    assert.equal(preflightAction(snapshot, runtimeActor, weapon.id, null).ok, false, "single-target attacks must reject missing targets");
  }
}

function* generatedPcActors() {
  for (const spec of buildSpecs(CONTRACT_LEVELS)) {
    const sheet = resolveCharacterSheet(draftFor(spec), {}, { allowNonCreationLevel: true });
    if (sheet.metadata.unresolved?.length) continue;
    yield resolvedSheetToCombatActor(sheet, { id: spec.id, position: { x: 1, y: 1 } });
  }
  yield resolvedSheetToCombatActor(resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Contract Dragonborn Warlock",
      level: 7,
      backgroundId: "guide",
      speciesId: "dragonborn",
      lineageId: "red",
      classId: "warlock",
      subclassId: "the_lantern",
      pactId: "pact_of_the_tome",
    },
    abilities: { strength: 10, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 16 },
    choices: {
      backgroundAbilityScores: ["charisma", "constitution"],
      classChoices: { pact: "pact_of_the_tome", book_of_shadows_cantrips: ["fire_bolt", "ray_of_frost"] },
    },
    gear: { weaponIds: ["dagger"], armorId: "leather", shieldId: null, inventory: [], attunedItemIds: [] },
    spells: { knownSpellIds: ["eldritch_blast"], preparedSpellIds: ["hex"] },
  }), {}, { allowNonCreationLevel: true }), { id: "contract_dragonborn_warlock", position: { x: 1, y: 1 } });
}
