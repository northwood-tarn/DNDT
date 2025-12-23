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

// Backwards-compat: some modules expect { classes } from this file
export const classes = CLASSES;

export default CLASSES;
