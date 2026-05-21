#!/usr/bin/env node

import {
  createCharacterFeatureImplementationReport,
  createClassFeatureImplementationReport,
} from "../app/character/index.js";

const report = createClassFeatureImplementationReport();
const characterReport = createCharacterFeatureImplementationReport();

console.log(`Class feature implementation: ${report.totals.implemented}/${report.totals.total} implemented`);
for (const classReport of report.classes) {
  if (!classReport.totals.unimplemented) continue;
  console.log(`\n${classReport.className} (${classReport.totals.unimplemented} unimplemented)`);
  for (const [level, features] of Object.entries(classReport.unimplemented)) {
    console.log(`  Level ${level}`);
    for (const feature of features) {
      console.log(`    - [${feature.ownerKind}] ${feature.ownerName}: ${feature.name}`);
    }
  }
}

console.log(`\nCharacter feature implementation: ${characterReport.totals.implemented}/${characterReport.totals.total} implemented`);
for (const [ownerId, features] of Object.entries(characterReport.unimplementedByOwner)) {
  console.log(`\n${ownerId} (${features.length} unimplemented)`);
  for (const feature of features) {
    console.log(`  - [${feature.source}] Level ${feature.level}: ${feature.name}`);
  }
}
