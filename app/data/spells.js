// app/data/spells.js
// Spell registry aggregator. Spell records live in app/data/spells/level*.js.
// Distances in feet unless unit === "tile". 5 ft === 1 tile.
// "dialogueRelated" marks spells that can appear as dialogue options.

import { SPELLS_LEVEL_0 } from "./spells/level0.js";
import { SPELLS_LEVEL_1 } from "./spells/level1.js";
import { SPELLS_LEVEL_2 } from "./spells/level2.js";
import { SPELLS_LEVEL_3 } from "./spells/level3.js";
import { SPELLS_LEVEL_4 } from "./spells/level4.js";
import { SPELLS_LEVEL_5 } from "./spells/level5.js";
import { SPELLS_LEVEL_6 } from "./spells/level6.js";
import { SPELLS_LEVEL_7 } from "./spells/level7.js";

export const SPELL_SCHEMA = {
  "id": "unique_id_string",
  "name": "Display Name",
  "level": 0,
  "school": "Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation",
  "casting": {
    "time": 1,
    "unit": "action",
    "reactionTrigger": null
  },
  "components": {
    "v": true,
    "s": true,
    "m": false,
    "material": null,
    "consume": false,
    "costGp": 0
  },
  "concentration": false,
  "ritual": false,
  "duration": {
    "type": "instant|timed|until_dispelled|special",
    "value": 0,
    "unit": "rounds",
    "special": null
  },
  "range": {
    "type": "self|touch|distance|sight|special",
    "distance": 0,
    "unit": "ft",
    "special": null
  },
  "target": {
    "type": "self|creature|object|point|area",
    "count": 1,
    "friendly": true,
    "requiresSight": true
  },
  "area": {
    "shape": "none|sphere|cube|line|cone|cylinder|square|donut|special",
    "size": 0,
    "length": 0,
    "width": 0,
    "height": 0,
    "unit": "ft"
  },
  "scaling": {
    "type": "none",
    "slot": {
      "text": null
    },
    "cantrip": {
      "tiers": []
    }
  },
  "classes": [],
  "minCasterLevel": null,
  "featureGate": null,
  "hiddenUntilUnlocked": false,
  "source": "PHB",
  "tags": [],
  "text": "",
  "dialogueRelated": false,
  "hooks": {
    "attack": null,
    "save": null,
    "damage": null,
    "healing": null,
    "autoHit": false,
    "darts": null,
    "applyEffect": null,
    "remoteInteract": null
  }
};

export const SPELLS = {
  ...SPELLS_LEVEL_0,
  ...SPELLS_LEVEL_1,
  ...SPELLS_LEVEL_2,
  ...SPELLS_LEVEL_3,
  ...SPELLS_LEVEL_4,
  ...SPELLS_LEVEL_5,
  ...SPELLS_LEVEL_6,
  ...SPELLS_LEVEL_7,
};

export function getSpellById(id) {
  const spell = SPELLS[id] || null;
  return spell?.active === false ? null : spell;
}

export function getSpellRecordById(id, { includeInactive = false } = {}) {
  const spell = SPELLS[id] || null;
  if (!spell) return null;
  if (!includeInactive && spell.active === false) return null;
  return spell;
}

export function isSpellActive(spell) {
  return spell?.active !== false;
}

export function listSpellsByClass(cls) {
  return Object.values(SPELLS).filter((spell) => isSpellActive(spell) && (spell.classes ?? []).includes(cls));
}
