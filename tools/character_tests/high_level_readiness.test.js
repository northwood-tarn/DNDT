import assert from "node:assert/strict";
import { CLASSES } from "../../app/data/classes.js";
import {
  createHighLevelFeatureReadinessReport,
  HIGH_LEVEL_READINESS_LEVELS,
} from "../../app/character/highLevelFeatureReadinessReport.js";

export function runHighLevelReadinessTests() {
  reportsEveryClassAtEveryReadinessLevel();
  identifiesHighRiskInteractionFamilies();
  keepsResolvableBuildsStructurallyValid();
}

function reportsEveryClassAtEveryReadinessLevel() {
  const report = createHighLevelFeatureReadinessReport();
  assert.equal(report.totals.builds, Object.keys(CLASSES).length * HIGH_LEVEL_READINESS_LEVELS.length);
  for (const classId of Object.keys(CLASSES)) {
    for (const level of HIGH_LEVEL_READINESS_LEVELS) {
      assert.ok(report.entries.find((entry) => entry.classId === classId && entry.level === level));
    }
  }
}

function identifiesHighRiskInteractionFamilies() {
  const report = createHighLevelFeatureReadinessReport();
  assert.ok(Object.keys(report.risksByCategory).includes("reaction_conflict"));
  assert.ok(Object.keys(report.risksByCategory).includes("zero_hp_prevention"));
  assert.ok(Object.keys(report.risksByCategory).includes("once_per_turn"));
}

function keepsResolvableBuildsStructurallyValid() {
  const report = createHighLevelFeatureReadinessReport();
  for (const entry of report.entries) {
    assert.deepEqual(entry.sheet.errors, [], `${entry.id} sheet should be structurally valid`);
    if (entry.unresolved.length === 0) {
      assert.deepEqual(entry.combatActor.errors, [], `${entry.id} actor should be structurally valid`);
    }
  }
}
