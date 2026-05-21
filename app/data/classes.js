// app/data/classes.js
// Aggregates the six class definition files into a single CLASSES map

import Fighter from "./classes/Fighter.js";
import Rogue from "./classes/Rogue.js";
import Wizard from "./classes/Wizard.js";
import Warlock from "./classes/Warlock.js";
import Cleric from "./classes/Cleric.js";
import Paladin from "./classes/Paladin.js";

export const CLASSES = {
  fighter: Fighter,
  rogue: Rogue,
  wizard: Wizard,
  warlock: Warlock,
  cleric: Cleric,
  paladin: Paladin
};

export const CLASS_LIST = Object.values(CLASSES);

export function getClassById(id) {
  return CLASSES[id] || null;
}

export function findClassByIdOrName(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return CLASSES[normalized] || CLASS_LIST.find((entry) => entry.name.toLowerCase() === normalized) || null;
}

export function getSubclassByIdOrName(classRecord, value) {
  if (!classRecord || !value) return null;
  const normalized = String(value).trim().toLowerCase();
  return Object.entries(classRecord.subclasses || {}).find(([name, entry]) => (
    entry.id === normalized || name.toLowerCase() === normalized
  ))?.[1] || classRecord.subclasses?.[value] || null;
}

// Backwards-compat: some modules expect { classes } from this file
export const classes = CLASSES;

export default CLASSES;
