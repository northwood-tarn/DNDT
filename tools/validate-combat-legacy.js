#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const DEFAULT_ROOT = "app";
const FORBIDDEN_PATTERNS = [
  { pattern: /\bhealth_potion\b/i, message: "use healing_potion only" },
  { pattern: /\bexpandEncounterEnemyIds\b/, message: "use expandEncounterEnemyRefs" },
  { pattern: /\btrial-arena\b/, message: "old hardwired trial arena must not be addressable" },
];

export function validateCombatLegacy(root = DEFAULT_ROOT) {
  const errors = [];
  for (const file of walk(root)) {
    if (!/\.(js|mjs|html|md)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(text)) errors.push(`${file}: ${rule.message}`);
    }
  }
  return errors;
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", "build", "coverage"].includes(entry.name)) continue;
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const errors = validateCombatLegacy(process.argv[2] || DEFAULT_ROOT);
  if (errors.length) {
    console.error(`[combat-legacy] Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("[combat-legacy] Validation OK");
}
