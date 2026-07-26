// app/data/spells/level7.js
// Choice-list records for level-up validation. Add combat hooks as implementation catches up.

const level7Spell = (id, name, school, classes, text, tags = []) => ({
  id, name, level: 7, school,
  casting: { time: 1, unit: "action", reactionTrigger: null },
  components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
  concentration: false,
  ritual: false,
  duration: { type: "instant", value: 0, unit: "rounds", special: null },
  range: { type: "distance", distance: 60, unit: "ft", special: null },
  target: { type: "creature", count: 1, friendly: false, requiresSight: true },
  area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
  scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
  classes,
  minCasterLevel: null,
  featureGate: null,
  hiddenUntilUnlocked: false,
  source: "PHB",
  tags,
  text,
  dialogueRelated: false,
  hooks: {}
});

export const SPELLS_LEVEL_7 = {
  "power_word_fortify": {"id":"power_word_fortify","name":"Power Word Fortify","level":7,"school":"Enchantment","casting":{"time":1,"unit":"action","reactionTrigger":null},"components":{"v":true,"s":false,"m":false,"material":null,"consume":false,"costGp":0},"concentration":false,"ritual":false,"duration":{"type":"instant","value":0,"unit":"rounds","special":null},"range":{"type":"distance","distance":60,"unit":"ft","special":null},"target":{"type":"creature","count":6,"friendly":true,"requiresSight":true},"area":{"shape":"none","size":0,"length":0,"width":0,"height":0,"unit":"ft"},"scaling":{"type":"none","slot":{"text":null},"cantrip":{"tiers":[]}},"classes":["Cleric"],"source":"PHB 2024 (adapted)","tags":["buff","temp_hp","multi_target"],"text":"Choose up to six creatures within 60 feet. Divide 120 temporary hit points evenly among the selected targets, discarding any remainder.","dialogueRelated":false,"hooks":{"applyEffect":{"kind":"temp_hp_pool","amount":120,"distribution":"even_selected_targets","maxTargets":6}}},
  "prismatic_disarray": {"id":"prismatic_disarray","name":"Prismatic Disarray","level":7,"school":"Evocation","casting":{"time":1,"unit":"action","reactionTrigger":null},"components":{"v":true,"s":true,"m":false,"material":null,"consume":false,"costGp":0},"concentration":false,"ritual":false,"duration":{"type":"instant","value":0,"unit":"rounds","special":null},"range":{"type":"self","distance":0,"unit":"ft","special":null},"target":{"type":"area","count":0,"friendly":false,"requiresSight":false},"area":{"shape":"cone","size":60,"length":60,"width":0,"height":0,"unit":"ft"},"scaling":{"type":"none","slot":{"text":null},"cantrip":{"tiers":[]}},"classes":["Wizard"],"source":"Homebrew (Prismatic Spray 2024 adaptation)","tags":["damage","area","random_damage_type"],"text":"Creatures in a 60-foot cone make a Dexterity save. Each target is randomly struck by fire, acid, lightning, poison, cold, or thunder, taking 12d6 damage on a failure or half on a success.","dialogueRelated":false,"hooks":{"save":{"ability":"DEX","dcFrom":"spellSaveDC","onSave":"half"},"damage":{"dice":"12d6","type":"fire","addMod":false,"perDart":false,"randomChoices":["fire","acid","lightning","poison","cold","thunder"]}}},
  "dancing_flames": {"id":"dancing_flames","name":"Dancing Flames","level":7,"school":"Evocation","casting":{"time":1,"unit":"action","reactionTrigger":null},"components":{"v":true,"s":true,"m":false,"material":null,"consume":false,"costGp":0},"concentration":false,"ritual":false,"duration":{"type":"instant","value":0,"unit":"rounds","special":null},"range":{"type":"distance","distance":90,"unit":"ft","special":null},"target":{"type":"creature","count":3,"friendly":false,"requiresSight":true},"area":{"shape":"none","size":0,"length":0,"width":0,"height":0,"unit":"ft"},"scaling":{"type":"none","slot":{"text":null},"cantrip":{"tiers":[]}},"classes":["Wizard"],"minCasterLevel":null,"featureGate":null,"hiddenUntilUnlocked":false,"source":"Homebrew (D&D 4e adaptation)","tags":["damage","fire","multi_target"],"text":"Choose up to three creatures you can see within 90 feet. Each target makes a Dexterity saving throw, taking 7d10 fire damage on a failed save or half as much on a success.","dialogueRelated":false,"hooks":{"save":{"ability":"DEX","dcFrom":"spellSaveDC","onSave":"half"},"damage":{"dice":"7d10","type":"fire","addMod":false,"perDart":false}}},
  "divine_word": level7Spell("divine_word", "Divine Word", "Evocation", ["Cleric"], "Utter a divine word that overwhelms weakened enemies.", ["radiant","control"]),
  "finger_of_death": level7Spell("finger_of_death", "Finger of Death", "Necromancy", ["Warlock","Wizard"], "Assault a creature with lethal necrotic energy.", ["damage","necrotic"]),
  "fire_storm": {"id":"fire_storm","name":"Fire Storm","level":7,"school":"Evocation","casting":{"time":1,"unit":"action","reactionTrigger":null},"components":{"v":true,"s":true,"m":false,"material":null,"consume":false,"costGp":0},"concentration":false,"ritual":false,"duration":{"type":"instant","value":0,"unit":"rounds","special":null},"range":{"type":"distance","distance":150,"unit":"ft","special":null},"target":{"type":"area","count":0,"friendly":false,"requiresSight":true},"area":{"shape":"cube","size":100,"length":100,"width":10,"height":10,"unit":"ft"},"scaling":{"type":"none","slot":{"text":null},"cantrip":{"tiers":[]}},"classes":["Cleric"],"source":"PHB","tags":["damage","fire","area"],"text":"Choose up to ten contiguous 10-foot cubes within 150 feet. Creatures in the area make a Dexterity save, taking 7d10 fire damage on a failure or half on a success. Unattended flammable objects ignite; you may spare plant life in the area.","dialogueRelated":false,"hooks":{"save":{"ability":"DEX","dcFrom":"spellSaveDC","onSave":"half"},"damage":{"dice":"7d10","type":"fire","addMod":false,"perDart":false}}},
  "forcecage": {"id":"forcecage","name":"Forcecage","level":7,"school":"Evocation","casting":{"time":1,"unit":"action","reactionTrigger":null},"components":{"v":true,"s":true,"m":true,"material":"Ruby dust worth 1,500 gp","consume":true,"costGp":1500},"concentration":false,"ritual":false,"duration":{"type":"timed","value":1,"unit":"hours","special":"1 hour"},"range":{"type":"distance","distance":100,"unit":"ft","special":null},"target":{"type":"point","count":1,"friendly":false,"requiresSight":true},"area":{"shape":"cube","size":20,"length":20,"width":20,"height":20,"unit":"ft"},"scaling":{"type":"none","slot":{"text":null},"cantrip":{"tiers":[]}},"classes":["Warlock","Wizard"],"minCasterLevel":null,"featureGate":null,"hiddenUntilUnlocked":false,"source":"PHB (adapted)","tags":["control","force","area"],"text":"Create a 20-foot barred cage of magical force for 1 hour. Creatures cannot cross its boundary by physical movement. A trapped creature attempting teleportation or planar travel must succeed on a Charisma save against your spell save DC to escape. The cage cannot be dispelled.","dialogueRelated":false,"hooks":{"applyEffect":{"kind":"containment","area":{"shape":"cube","size":20},"blocksBoundaryMovement":true,"blocksTeleport":true,"teleportSaveAbility":"CHA","immuneToDispel":true}}},
  "power_word_pain": level7Spell("power_word_pain", "Power Word Pain", "Enchantment", ["Warlock","Wizard"], "Overwhelm a creature with crippling pain.", ["control"]),
  "regenerate": level7Spell("regenerate", "Regenerate", "Transmutation", ["Cleric"], "Stimulate a creature's healing and restore lost body parts.", ["healing"]),
  "symbol": level7Spell("symbol", "Symbol", "Abjuration", ["Cleric","Wizard"], "Inscribe a magical glyph that triggers a chosen effect.", ["ward","trap"]),
};

export default SPELLS_LEVEL_7;
