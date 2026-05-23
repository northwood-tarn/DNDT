#!/usr/bin/env node

import { createHighLevelFeatureReadinessReport } from "../app/character/highLevelFeatureReadinessReport.js";

const report = createHighLevelFeatureReadinessReport();

console.log(`High-level readiness: ${report.totals.ready}/${report.totals.builds} builds ready`);
console.log(`Combat actors: ${report.totals.withActor}/${report.totals.builds}`);
console.log(`Risks: ${report.totals.risks} total, ${report.totals.highRisks} high`);

for (const entry of report.entries) {
  const status = entry.ready ? "ready" : "review";
  console.log(`\n${entry.className} level ${entry.level}: ${status}`);
  console.log(`  features ${entry.sheet.featureCount}, actions ${entry.combatActor.actionCount}, reactions ${entry.combatActor.reactionCount}, auras ${entry.combatActor.auraCount}`);
  if (entry.unresolved.length) {
    console.log("  unresolved:");
    for (const item of entry.unresolved) console.log(`    - ${item.type}: ${item.choiceId || item.id || item.message || "unknown"}`);
  }
  if (entry.risks.length) {
    console.log("  risks:");
    for (const risk of entry.risks) console.log(`    - [${risk.severity}] ${risk.category}: ${risk.message}`);
  }
}
