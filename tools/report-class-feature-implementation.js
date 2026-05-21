#!/usr/bin/env node

import { createClassFeatureImplementationReport } from "../app/character/index.js";

const report = createClassFeatureImplementationReport();

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
