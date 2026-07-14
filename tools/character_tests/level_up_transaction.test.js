import assert from "node:assert/strict";
import {
  createCharacterMemoryStore,
  createCharacterRecord,
  createLevelUpPlan,
  createStarterCharacterDraft,
  levelUpCharacterRecord,
  levelUpCharacterStore,
  loadCombatActorFromCharacter,
  normalizeCharacterRecord,
  validateLevelUpSubmission,
} from "../../app/character/index.js";

export function runLevelUpTransactionTests() {
  rejectsIncompleteAndInvalidSubmissions();
  appliesOneAtomicLevelAndPreservesRuntime();
  rejectsSkippedAndStaleLevelUps();
  savesOnlySuccessfulTransactions();
  advancesRepresentativeClassesThroughLevelThirteen();
}

function advancesRepresentativeClassesThroughLevelThirteen() {
  for (const variant of ["fighter", "rogue", "wizard", "warlock", "cleric"]) {
    let record = createCharacterRecord(createStarterCharacterDraft(variant));
    while (record.characterDraft.identity.level < 13) {
      let values = {};
      let manifest = createLevelUpPlan(record, { values });
      for (let pass = 0; pass < 4; pass += 1) {
        values = completeWithFirstLegalOptions(manifest, values);
        manifest = createLevelUpPlan(record, { values });
      }
      const report = validateLevelUpSubmission(manifest, values);
      assert.deepEqual(report.errors, [], `${variant} level ${manifest.toLevel}: ${report.errors.join("; ")}`);
      try {
        record = levelUpCharacterRecord(record, values, { manifest });
      } catch (error) {
        throw new Error(`${variant} level ${manifest.toLevel}: ${error.message}`);
      }
    }
    assert.equal(record.characterDraft.identity.level, 13);
    assert.equal(record.status, "ready");
  }
}

function completeWithFirstLegalOptions(manifest, existing) {
  const values = structuredClone(existing);
  for (const step of manifest.steps) {
    if (values[step.id] != null) continue;
    if (step.kind === "hp_roll") {
      values[step.id] = { die: Math.min(step.hitDie, 2) };
      continue;
    }
    if (step.kind === "feat_or_asi") {
      const option = (step.options || []).find((item) => (item.choices || []).every((choice) => (choice.options || []).length >= choice.count));
      if (!option) continue;
      values[step.id] = {
        id: option.id,
        choices: Object.fromEntries((option.choices || []).map((choice) => [
          choice.id,
          Array.from({ length: choice.count }, (_, index) => choice.options[choice.allowDuplicate ? 0 : index]?.id),
        ])),
      };
      continue;
    }
    const count = step.count || 1;
    values[step.id] = (step.options || []).slice(0, count).map((option) => option.id);
  }
  return values;
}

function rejectsIncompleteAndInvalidSubmissions() {
  const record = createCharacterRecord(createStarterCharacterDraft("fighter"));
  const manifest = createLevelUpPlan(record);
  const hpStep = manifest.steps.find((step) => step.kind === "hp_roll");

  assert.equal(validateLevelUpSubmission(manifest, {}).valid, false);
  assert.equal(validateLevelUpSubmission(manifest, { [hpStep.id]: { die: 1 } }).valid, false, "rerolled values must be rejected");
  assert.equal(validateLevelUpSubmission(manifest, { [hpStep.id]: { die: 11 } }).valid, false, "rolls above the hit die must be rejected");
  assert.equal(record.characterDraft.identity.level, 1, "validation must not mutate the source record");
}

function appliesOneAtomicLevelAndPreservesRuntime() {
  const base = createCharacterRecord(createStarterCharacterDraft("fighter"), { actorOptions: { id: "leveling_fighter", position: { x: 3, y: 4 } } });
  const damaged = normalizeCharacterRecord({
    ...base,
    runtime: {
      ...base.runtime,
      hp: 5,
      resources: base.runtime.resources.map((resource) => ({ ...resource, current: 0 })),
      conditions: [{ id: "poisoned" }],
    },
  });
  const manifest = createLevelUpPlan(damaged);
  const hpStep = manifest.steps.find((step) => step.kind === "hp_roll");
  const updated = levelUpCharacterRecord(damaged, { [hpStep.id]: { die: 6 } }, { manifest });
  const actor = loadCombatActorFromCharacter({ record: updated });

  assert.equal(updated.characterDraft.identity.level, 2);
  assert.equal(updated.characterDraft.choices.levelUpHistory["2"].hpDie, 6);
  assert.equal(actor.maxHp, 20, "rolled HP plus Constitution should replace the default level-two average");
  assert.equal(actor.hp, 13, "current HP should increase by the maximum-HP gain without fully healing damage");
  assert.equal(actor.position.x, 3);
  assert.deepEqual(actor.conditions, [{ id: "poisoned" }]);
  const previouslySpentIds = new Set(damaged.runtime.resources.map((resource) => resource.id));
  assert.equal(actor.resources.filter((resource) => previouslySpentIds.has(resource.id)).every((resource) => resource.current === 0), true, "spent resources must not refill during level-up");
}

function rejectsSkippedAndStaleLevelUps() {
  const record = createCharacterRecord(createStarterCharacterDraft("fighter"));
  assert.throws(() => createLevelUpPlan(record, { toLevel: 3 }), /exactly one level/);
  const manifest = createLevelUpPlan(record);
  const hpStep = manifest.steps.find((step) => step.kind === "hp_roll");
  const updated = levelUpCharacterRecord(record, { [hpStep.id]: { die: 6 } }, { manifest });
  assert.throws(() => levelUpCharacterRecord(updated, { [hpStep.id]: { die: 6 } }, { manifest }), /Stale level-up manifest/);
}

function savesOnlySuccessfulTransactions() {
  const store = createCharacterMemoryStore();
  const record = store.save(createCharacterRecord(createStarterCharacterDraft("fighter"), { slot: "active" }));
  const manifest = createLevelUpPlan(record);
  assert.throws(() => levelUpCharacterStore({ store, manifest, values: {} }), /Invalid level-up submission/);
  assert.equal(store.load("active").characterDraft.identity.level, 1);
  const hpStep = manifest.steps.find((step) => step.kind === "hp_roll");
  const updated = levelUpCharacterStore({ store, manifest, values: { [hpStep.id]: { die: 6 } } });
  assert.equal(updated.characterDraft.identity.level, 2);
  assert.equal(store.load("active").characterDraft.identity.level, 2);
}
