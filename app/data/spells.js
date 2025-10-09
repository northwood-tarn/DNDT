// app/data/spells.js
// Comprehensive, pure-data spell library (cantrips + key 1st‑level) for our prototype.
// KEEP THIS FILE CODE‑FREE. Engines should read these fields and decide how to execute.
// Distances in feet unless unit === 'tile'. 5 ft === 1 tile.
// "dialogueRelated" marks spells that can appear as dialogue options.

export const SPELL_SCHEMA = {
  id: "unique_id_string",
  name: "Display Name",
  level: 0, // 0..7 supported
  school: "Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation",
  casting: { time: 1, unit: "action", reactionTrigger: null }, // unit: action|bonus_action|reaction|minute|hour
  components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
  concentration: false,
  ritual: false,
  duration: { type: "instant|timed|until_dispelled|special", value: 0, unit: "rounds", special: null },
  range: { type: "self|touch|distance|sight|special", distance: 0, unit: "ft", special: null },
  target: { type: "self|creature|object|point|area", count: 1, friendly: true, requiresSight: true },
  area: { shape: "none|sphere|cube|line|cone|cylinder", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
  scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
  classes: [],
  source: "PHB",
  tags: [],
  text: "",
  dialogueRelated: false,
  hooks: {
    attack: null,        // { type:'melee_spell|ranged_spell', ability:'spellcasting|INT|WIS|CHA' }
    save: null,          // { ability:'DEX|CON|WIS|CHA|INT|STR', dcFrom:'casterSpellDC', onSave:'half|negates|none' }
    damage: null,        // { dice:'2d8', type:'fire|cold|force|...', addMod:false, perDart:false }
    healing: null,       // { dice:'1d8', modFrom:'spellcasting', tempHP:false }
    autoHit: false,      // true if no attack/save required
    darts: null,         // number of missiles for auto-hit spells
    applyEffect: null,   // declarative effect payload; engines interpret
    remoteInteract: null // Mage Hand support
  }
};

export const SPELLS = {
  // --- Cantrips ---
  minor_illusion: {
    id: "minor_illusion",
    name: "Minor Illusion",
    level: 0,
    school: "Illusion",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "seconds", special: "Dialogue-only" },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    tags: ["illusion","dialogue","utility"],
    text: "Create a brief, simple illusion used only in dialogue or scripted scenes (distraction, phantom sounds, false sentry). This spell has no combat function and does not appear in combat actions.",
    dialogueRelated: true,
    hooks: {
      dialogueOnly: true,
      ui: { hideInCombat: true }
    }
  },

  dread_whisper: {
    id: "dread_whisper",
    name: "Dread Whisper",
    level: 0,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: false, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "seconds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    tags: ["debuff","psychic","dialogue"],
    text: "You breathe terror into a creature\'s mind. The target makes a Wisdom save or has disadvantage on its next attack before the end of its next turn. Also unlocks intimidation/persuasion options in dialogue.",
    dialogueRelated: true,
    hooks: {
      save: { ability: "WIS", dcFrom: "spellSaveDC", onFail: { applyCondition: "disadvantage_next_attack" }, onSuccess: {} },
      ui: { showsAsDebuff: true }
    }
  },

  eldritch_grasp: {
    id: "eldritch_grasp",
    name: "Eldritch Grasp",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "seconds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: ["1d6","2d6","3d6","4d6"] } },
    classes: ["Warlock"],
    tags: ["attack","force","control"],
    text: "A shadowy tendril lashes a creature within 30 ft. Make a ranged spell attack: on hit, the target takes force damage (scales with level) and is pulled 5 ft toward you.",
    dialogueRelated: false,
    hooks: {
      attack: { kind: "spell", toHitFrom: "spellAttack", damage: { diceByTier: ["1d6","2d6","3d6","4d6"], type: "force" } },
      forcedMovement: { pullFt: 5 }
    }
  },

  distant_light: {
    id: "distant_light",
    name: "Distant Light",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A bit of phosphorus or a glowworm", consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard"],
    tags: ["utility","light"],
    text: "Create a single torch-size light at a point within 30 ft; bright 20 ft, dim +20 ft (concentration, 1 min).",
    dialogueRelated: false,
    hooks: { applyEffect: { kind: "light", brightFt: 20, dimFt: 20, movable: false } }
  },

  guidance: {
    id: "guidance",
    name: "Guidance",
    level: 0,
    school: "Divination",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "touch", distance: 5, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Cleric","Druid"],
    tags: ["buff","utility"],
    text: "Once before the spell ends, the target adds 1d4 to one ability check.",
    dialogueRelated: false,
    hooks: { applyEffect: { kind: "guidance", target: "self", bonus: "1d4", expires: "next_ability_check", maxRounds: 10 } }
  },

  sacred_flame: {
    id: "sacred_flame",
    name: "Sacred Flame",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d8"},{level:11, add:"+2d8"},{level:17, add:"+3d8"}] } },
    classes: ["Cleric"],
    tags: ["damage"],
    text: "DEX save or radiant damage; no effect on a success.",
    dialogueRelated: false,
    hooks: { save: { ability: "DEX", dcFrom: "casterSpellDC", onSave: "negates" }, damage: { dice: "1d8", type: "radiant", addMod: false, perDart: false } }
  },

  mage_hand: {
    id: "mage_hand",
    name: "Mage Hand",
    level: 0,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Wizard","Sorcerer","Warlock","Bard","Artificer"],
    tags: ["utility"],
    text: "Create a spectral hand to manipulate an object within range. No attacks.",
    dialogueRelated: false,
    hooks: { remoteInteract: { rangeTiles: 6, weightLimit: 10, allowedTypes: ["lever","button","pickup"], deliverToCaster: true } }
  },

  fire_bolt: {
    id: "fire_bolt",
    name: "Fire Bolt",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d10"},{level:11, add:"+2d10"},{level:17, add:"+3d10"}] } },
    classes: ["Wizard","Sorcerer","Artificer"],
    tags: ["damage"],
    text: "Ranged spell attack; on hit, fire damage.",
    dialogueRelated: false,
    hooks: { attack: { type: "ranged_spell", ability: "spellcasting" }, damage: { dice: "1d10", type: "fire", addMod: false, perDart: false } }
  },


  thorn_whip: {
    id: "thorn_whip",
    name: "Thorn Whip",
    level: 0,
    school: "Transmutation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A stem with thorns", consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d6"},{level:11, add:"+2d6"},{level:17, add:"+3d6"}] } },
    classes: ["Druid"],
    tags: ["damage","control","pull"],
    text: "Ranged spell attack; on hit, 1d6 piercing and if the target is Large or smaller, pull it up to 10 feet closer to you.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "1d6", type: "piercing", addMod: false, perDart: false },
      applyEffect: { kind: "pull_toward_caster", distanceFt: 10, sizeMax: "Large" }
    }
  },
  vicious_mockery: {
    id: "vicious_mockery",
    name: "Vicious Mockery",
    level: 0,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d4"},{level:11, add:"+2d4"},{level:17, add:"+3d4"}] } },
    classes: ["Bard"],
    tags: ["damage","debuff"],
    text: "WIS save or take 1d4 psychic damage and have Disadvantage on the next attack roll it makes before the end of its next turn.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "WIS", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d4", type: "psychic", addMod: false, perDart: false },
      applyEffect: { kind: "disadvantage_next_attack", until: "end_of_target_next_turn" }
    }
  },
  poison_spray: {
    id: "poison_spray",
    name: "Poison Spray",
    level: 0,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 10, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d12"},{level:11, add:"+2d12"},{level:17, add:"+3d12"}] } },
    classes: ["Sorcerer","Warlock","Wizard","Druid"],
    tags: ["damage"],
    text: "A puff of noxious gas. The target must succeed on a CON save or take poison damage.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d12", type: "poison", addMod: false, perDart: false }
    }
  },
  word_of_radiance: {
    id: "word_of_radiance",
    name: "Word of Radiance",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: false },
    area: { shape: "sphere", size: 5, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d6"},{level:11, add:"+2d6"},{level:17, add:"+3d6"}] } },
    classes: ["Cleric"],
    tags: ["damage","area"],
    text: "You utter a divine word, and each creature of your choice that you can see within 5 feet must make a CON save or take radiant damage.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d6", type: "radiant", addMod: false, perDart: false },
      applyEffect: { kind: "area_affects_enemies_only", radiusFt: 5 }
    }
  },
  acid_splash: {
    id: "acid_splash",
    name: "Acid Splash",
    level: 0,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 2, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d6"},{level:11, add:"+2d6"},{level:17, add:"+3d6"}] } },
    classes: ["Wizard","Sorcerer"],
    tags: ["damage","splash"],
    text: "Choose one or two creatures within 5 feet of each other that you can see within 30 feet. Each target makes a DEX save or takes acid damage.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "DEX", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d6", type: "acid", addMod: false, perDart: false },
      applyEffect: { kind: "pairing_constraint", maxTargets: 2, withinFt: 5 }
    }
  },
  chill_touch: {
    id: "chill_touch",
    name: "Chill Touch",
    level: 0,
    school: "Necromancy",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d8"},{level:11, add:"+2d8"},{level:17, add:"+3d8"}] } },
    classes: ["Wizard","Sorcerer","Warlock"],
    tags: ["damage","debuff"],
    text: "Ranged spell attack; on hit, necrotic damage and the target can’t regain hit points until the start of your next turn. If the target is Undead, it also can’t regain hit points until the start of your next turn.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "1d8", type: "necrotic", addMod: false, perDart: false },
      applyEffect: { kind: "no_healing", undeadAlso: true, until: "start_of_caster_next_turn" }
    }
  },
  ray_of_frost: {
    id: "ray_of_frost",
    name: "Ray of Frost",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d8"},{level:11, add:"+2d8"},{level:17, add:"+3d8"}] } },
    classes: ["Wizard","Sorcerer","Artificer"],
    tags: ["damage","debuff"],
    text: "Ranged spell attack; on hit, cold damage and the target’s speed is reduced by 10 feet until the start of your next turn.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "1d8", type: "cold", addMod: false, perDart: false },
      applyEffect: { kind: "speed_penalty", amountFt: 10, until: "start_of_caster_next_turn" }
    }
  },
  shocking_grasp: {
    id: "shocking_grasp",
    name: "Shocking Grasp",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "touch", distance: 5, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d8"},{level:11, add:"+2d8"},{level:17, add:"+3d8"}] } },
    classes: ["Wizard","Sorcerer","Artificer"],
    tags: ["damage","control"],
    text: "Melee spell attack; on hit, lightning damage and the target can’t take reactions until the end of its next turn.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "melee_spell", ability: "spellcasting" },
      damage: { dice: "1d8", type: "lightning", addMod: false, perDart: false },
      applyEffect: { kind: "no_reactions", until: "end_of_target_next_turn" }
    }
  },

    toll_the_dead: {
    id: "toll_the_dead",
    name: "Toll the Dead",
    level: 0,
    school: "Necromancy",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d8"},{level:11, add:"+2d8"},{level:17, add:"+3d8"}] } },
    classes: ["Cleric","Warlock","Wizard"],
    tags: ["damage","save"],
    text: "Wisdom save or take necrotic damage. Target at full HP takes 1d8, otherwise 1d12.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "WIS", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d8_or_1d12", type: "necrotic", addMod: false, perDart: false },
      applyEffect: { kind: "conditional_die", condition: "if_damaged", base: "1d8", alternate: "1d12" }
    }
  },

  produce_flame: {
    id: "produce_flame",
    name: "Produce Flame",
    level: 0,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: null }, // 10 minutes
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d8"},{level:11, add:"+2d8"},{level:17, add:"+3d8"}] } },
    classes: ["Druid"],
    tags: ["damage","utility","light"],
    text: "Flame in your hand sheds light. You can attack with it as a ranged spell attack (30 ft, 1d8 fire).",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "1d8", type: "fire", addMod: false, perDart: false },
      applyEffect: { kind: "light", brightFt: 10, dimFt: 10 }
    }
  },

  infestation: {
    id: "infestation",
    name: "Infestation",
    level: 0,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d6"},{level:11, add:"+2d6"},{level:17, add:"+3d6"}] } },
    classes: ["Druid","Warlock","Sorcerer","Wizard"],
    tags: ["damage","debuff"],
    text: "Con save or take 1d6 poison damage and be moved 5 feet in a random direction.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d6", type: "poison", addMod: false, perDart: false },
      applyEffect: { kind: "random_move", distanceFt: 5 }
    }
  },

  frostbite: {
    id: "frostbite",
    name: "Frostbite",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d6"},{level:11, add:"+2d6"},{level:17, add:"+3d6"}] } },
    classes: ["Druid","Sorcerer","Wizard"],
    tags: ["damage","debuff"],
    text: "Con save or 1d6 cold damage, and the target has Disadvantage on the next weapon attack roll it makes before the end of its next turn.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d6", type: "cold", addMod: false, perDart: false },
      applyEffect: { kind: "disadvantage_next_weapon_attack", until: "end_of_target_next_turn" }
    }
  },

    eldritch_blast: {
    id: "eldritch_blast",
    name: "Eldritch Blast",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    tags: ["damage"],
    text: "Ranged spell attack; on hit, force damage. At higher levels, creates multiple beams: 2 at 5th, 3 at 11th, 4 at 17th.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "1d10", type: "force", addMod: false, perDart: false },
      applyEffect: { kind: "multi_beam", beamsByLevel: {5:2, 11:3, 17:4} }
    }
  },

  thunderclap: {
    id: "thunderclap",
    name: "Thunderclap",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: false },
    area: { shape: "sphere", size: 5, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [{level:5, add:"+1d6"},{level:11, add:"+2d6"},{level:17, add:"+3d6"}] } },
    classes: ["Bard","Druid","Sorcerer","Warlock","Wizard"],
    tags: ["damage","area"],
    text: "Each creature other than you within 5 feet must succeed on a CON save or take thunder damage.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d6", type: "thunder", addMod: false, perDart: false },
      applyEffect: { kind: "area_around_caster", radiusFt: 5 }
    }
  },

  blade_ward: {
    id: "blade_ward",
    name: "Blade Ward",
    level: 0,
    school: "Abjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "timed", value: 6, unit: "seconds", special: null }, // 1 round
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Bard","Sorcerer","Warlock","Wizard"],
    tags: ["defense","buff"],
    text: "Until the end of your next turn, you have resistance against bludgeoning, piercing, and slashing damage from weapon attacks.",
    dialogueRelated: false,
    hooks: {
      applyEffect: { kind: "resistance_weapon_damage", until: "end_of_caster_next_turn" }
    }
  },

  resistance: {
    id: "resistance",
    name: "Resistance",
    level: 0,
    school: "Abjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null }, // 1 minute
    range: { type: "touch", distance: 5, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Cleric","Druid"],
    tags: ["buff","utility"],
    text: "Once before the spell ends, the target can roll a d4 and add it to one saving throw of its choice.",
    dialogueRelated: false,
    hooks: {
      applyEffect: { kind: "resistance", bonus: "1d4", expires: "next_saving_throw", maxRounds: 10 }
    }
  },

mind_sliver: {
    id: "mind_sliver",
    name: "Mind Sliver",
    level: 0,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [
      { level: 5, add: "+1d6" },
      { level: 11, add: "+2d6" },
      { level: 17, add: "+3d6" }
    ] } },
    classes: ["Sorcerer","Warlock","Wizard","Bard"],
    source: "PHB",
    tags: ["damage","debuff","psychic"],
    text: "INT save or take 1d6 psychic damage. On a failure, the target subtracts 1d4 from the next saving throw it makes before the end of your next turn.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "INT", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: { dice: "1d6", type: "psychic", addMod: false, perDart: false },
      applyEffect: { kind: "penalty_next_save", amount: "1d4", until: "end_of_caster_next_turn" }
    }
  },

    minor_magic: {
    id: "minor_magic",
    name: "Minor Magic",
    level: 0,
    school: "Transmutation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "special", value: 0, unit: "rounds", special: "Up to 1 hour, depending on effect" },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: false },
    area: { shape: "special", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Bard","Cleric","Druid","Sorcerer","Warlock","Wizard"],
    source: "PHB",
    tags: ["utility","dialogue"],
    text: "You perform a simple magical effect: create a harmless sensory effect (spark, sound, odor, tremor, breeze, petals, motes of light), alter a minor feature of an object (clean, soil, chill, warm, flavor), conjure a tiny illusion or natural sign (whisper of leaves, flicker of fire, glow of stars), or make a small voice-like proclamation. Effects are cosmetic, last up to 1 hour, and cannot deal damage or impose conditions.",
    dialogueRelated: true,
    hooks: {
      applyEffect: { 
        kind: "minor_magic",
        categories: [
          "sensory_flourish",
          "object_trick",
          "elemental_whisper",
          "voice_or_omen"
        ],
        maxDurationSeconds: 3600
      }
    }
  },

  // --- Level 1 ---
  magic_missile: {
    id: "magic_missile",
    name: "Magic Missile",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "creature", count: 3, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1 dart per slot level above 1st" }, cantrip: { tiers: [] } },
    classes: ["Wizard","Sorcerer"],
    tags: ["damage","auto_hit"],
    text: "Create three darts of force. Each automatically hits for 1d4+1 force damage.",
    dialogueRelated: false,
    hooks: { autoHit: true, darts: 3, damage: { dice: "1d4+1", type: "force", addMod: false, perDart: true } }
  },

  burning_hands: {
    id: "burning_hands",
    name: "Burning Hands",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: false },
    area: { shape: "cone", size: 15, length: 15, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d6 damage per slot level above 1st" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard"],
    tags: ["damage","area"],
    text: "15‑ft cone; DEX save, 3d6 fire on a fail or half on success.",
    dialogueRelated: false,
    hooks: { save: { ability: "DEX", dcFrom: "casterSpellDC", onSave: "half" }, damage: { dice: "3d6", type: "fire", addMod: false, perDart: false } }
  },

  thunderwave: {
    id: "thunderwave",
    name: "Thunderwave",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: false },
    area: { shape: "cube", size: 15, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d8 damage per slot level above 1st" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard"],
    tags: ["damage","control","area"],
    text: "Self‑centered 15‑ft cube; CON save for 2d8 thunder (half on success). On a failed save, target is pushed 10 ft.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "half" },
      damage: { dice: "2d8", type: "thunder", addMod: false, perDart: false },
      applyEffect: { kind: "push", distanceFt: 10, shape: "from_caster" }
    }
  },

  charm_person: {
    id: "charm_person",
    name: "Charm Person",
    level: 1,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "timed", value: 3600, unit: "seconds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: true, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "Target +1 creature per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard","Warlock","Druid"],
    tags: ["social","control"],
    text: "Humanoid WIS save or charmed for 1 hour; knows after it ends.",
    dialogueRelated: true,
    hooks: { save: { ability: "WIS", dcFrom: "casterSpellDC", onSave: "negates" }, applyEffect: { kind: "charmed", attitude: "friendly", hostileAfter: true , combatFallback: { cannotTargetCaster: true, mustChooseOtherTarget: true } } }
  },

  chromatic_orb: {
    id: "chromatic_orb",
    name: "Chromatic Orb",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A diamond worth at least 50 gp", consume: false, costGp: 50 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 90, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d8 per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard"],
    tags: ["damage"],
    text: "Ranged spell attack for 3d8; choose acid, cold, fire, lightning, poison, or thunder on cast.",
    dialogueRelated: false,
    hooks: { attack: { type: "ranged_spell", ability: "spellcasting" }, damage: { dice: "3d8", type: "choice", choices: ["acid","cold","fire","lightning","poison","thunder"], addMod: false, perDart: false } }
  },

  disguise_self: {
    id: "disguise_self",
    name: "Disguise Self",
    level: 1,
    school: "Illusion",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "timed", value: 3600, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard","Warlock"],
    tags: ["utility","social","illusion"],
    text: "You appear unremarkable, blending with local norms for 1 hour. Investigation vs your Spell Save DC may see through it when scrutinized or acting oddly.",
    dialogueRelated: true,
    hooks: { applyEffect: { kind: "disguise_unremarkable", investigationDC: "casterSpellDC", maxSeconds: 3600, breakOnHostile: true } }
  },

  detect_magic: {
    id: "detect_magic",
    name: "Detect Magic",
    level: 1,
    school: "Divination",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A pinch of red ochre and salt", consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "sphere", size: 30, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard","Cleric","Druid","Paladin","Ranger","Artificer","Warlock"],
    tags: ["utility","detection"],
    text: "Sense presence of magic within 30 ft; see faint auras.",
    dialogueRelated: false,
    hooks: { applyEffect: { kind: "detect_magic", radiusFt: 30 } }
  },

  comprehend_languages: {
    id: "comprehend_languages",
    name: "Comprehend Languages",
    level: 1,
    school: "Divination",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A pinch of soot and salt", consume: false, costGp: 0 },
    concentration: false, ritual: true,
    duration: { type: "timed", value: 3600, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard","Warlock"],
    tags: ["utility","language"],
    text: "For 1 hour, you understand spoken language you hear and can read text you touch.",
    dialogueRelated: true,
    hooks: { applyEffect: { kind: "comprehend_languages", spoken: true, written: true } }
  },

  expeditious_retreat: {
    id: "expeditious_retreat",
    name: "Expeditious Retreat",
    level: 1,
    school: "Transmutation",
    casting: { time: 1, unit: "bonus_action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard"],
    tags: ["buff","mobility"],
    text: "You can Dash as a bonus action each turn while concentrating.",
    dialogueRelated: false,
    hooks: { applyEffect: { kind: "expeditious_retreat", dashBonusAction: true } }
  },

  false_life: {
    id: "false_life",
    name: "False Life",
    level: 1,
    school: "Necromancy",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A small amount of alcohol or distilled spirits", consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "timed", value: 3600, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+5 temp HP per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard"],
    tags: ["buff","temp_hp"],
    text: "Gain 1d4+4 temporary hit points for 1 hour.",
    dialogueRelated: false,
    hooks: { healing: { dice: "1d4+4", modFrom: null, tempHP: true } }
  },

  ray_of_sickness: {
    id: "ray_of_sickness",
    name: "Ray of Sickness",
    level: 1,
    school: "Necromancy",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d8 per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard"],
    tags: ["damage","debuff"],
    text: "Ranged spell attack for 2d8 poison damage; CON save or become Poisoned until end of your next turn.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "2d8", type: "poison", addMod: false, perDart: false },
      save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "negates_effect" },
      applyEffect: { kind: "condition", name: "Poisoned", maxRounds: 1 }
    }
  },

  silent_image: {
    id: "silent_image",
    name: "Silent Image",
    level: 1,
    school: "Illusion",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A bit of fleece", consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: false },
    area: { shape: "cube", size: 15, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard"],
    tags: ["utility","illusion","control"],
    text: "Create an image in a 15‑ft cube (no sound). Investigation vs your Spell Save DC can see through it on scrutiny.",
    dialogueRelated: true,
    hooks: { applyEffect: { kind: "silent_image", cubeFt: 15, investigationDC: "casterSpellDC" } }
  },

  sleep: {
    id: "sleep",
    name: "Sleep",
    level: 1,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A pinch of fine sand, rose petals, or a cricket", consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "timed", value: 12, unit: "seconds", special: null }, // 2 rounds
    range: { type: "distance", distance: 90, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: false },
    area: { shape: "sphere", size: 20, unit: "ft" },
    scaling: { type: "slot", slot: { text: "We can scale HP threshold later if desired" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Bard"],
    tags: ["control","debuff"],
    text: "Creatures in a 20‑ft radius with 20 HP or less must succeed on a CON save or fall Unconscious for 2 rounds (ends early if damaged).",
    dialogueRelated: false,
    hooks: { save: { ability: "CON", dcFrom: "casterSpellDC", onSave: "negates" }, applyEffect: { kind: "sleep_hp_gate", hpMax: 20, rounds: 2 } }
  },

  fog_cloud: {
    id: "fog_cloud",
    name: "Fog Cloud",
    level: 1,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "sphere", size: 20, unit: "ft" },
    scaling: { type: "slot", slot: { text: "Radius +20 ft per slot above 1st (optional later)" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Druid","Ranger"],
    tags: ["control","obscurement"],
    text: "Create a 20‑ft radius sphere of fog; area is heavily obscured while you concentrate (10 minutes).",
    dialogueRelated: false,
    hooks: { applyEffect: { kind: "area_obscure", radiusFt: 20, blocksSight: true } }
  },

  witch_bolt: {
    id: "witch_bolt",
    name: "Witch Bolt (Rewritten)",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A twig from a tree that has been struck by lightning", consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 24, unit: "seconds", special: null }, // up to ~4 rounds sustained
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "On hit, higher slots add +1 to the initial damage die size step (optional)" }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Warlock","Wizard"],
    tags: ["damage","sustain"],
    text: "Ranged spell attack for 1d12 lightning on hit. While you maintain concentration, at the start of your next turns you can deal 1d10, then 1d8, then 1d6, then 1d4; the spell then ends.",
    dialogueRelated: false,
    hooks: { attack: { type: "ranged_spell", ability: "spellcasting" }, applyEffect: { kind: "witch_bolt_decay", steps: ["1d10","1d8","1d6","1d4"] }, damage: { dice: "1d12", type: "lightning", addMod: false, perDart: false } }
  },

  shield_of_faith: {
    id: "shield_of_faith",
    name: "Shield of Faith",
    level: 1,
    school: "Abjuration",
    casting: { time: 1, unit: "bonus_action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A small parchment with holy text", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: null }, // 10 minutes
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: true, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Cleric","Paladin"],
    source: "PHB",
    tags: ["buff","defense"],
    text: "A shimmering field surrounds a creature of your choice, granting +2 AC while you concentrate (up to 10 minutes).",
    dialogueRelated: false,
    hooks: {
      applyEffect: { kind: "ac_bonus", amount: 2, concentration: true, until: "end_of_duration" }
    }
  },

  cure_wounds: {
    id: "cure_wounds",
    name: "Cure Wounds",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "touch", distance: 5, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d8 healing per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Cleric","Druid","Paladin","Bard","Artificer"],
    source: "PHB",
    tags: ["healing"],
    text: "Touch a creature to restore hit points equal to 1d8 + your spellcasting ability modifier. Healing increases when cast with higher slots.",
    dialogueRelated: false,
    hooks: {
      healing: { dice: "1d8", modFrom: "spellcasting", tempHP: false }
    }
  },

  bless: {
    id: "bless",
    name: "Bless",
    level: 1,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A sprinkling of holy water", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null }, // 1 minute
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 3, friendly: true, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "Affect +1 creature per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Cleric","Paladin"],
    source: "PHB",
    tags: ["buff","party"],
    text: "Up to three creatures of your choice gain +1d4 to attack rolls and saving throws for 1 minute while you concentrate.",
    dialogueRelated: false,
    hooks: {
      applyEffect: { kind: "attack_save_bonus", amount: "1d4", maxTargets: 3, concentration: true, until: "end_of_duration" }
    }
  },

  detect_presence: {
    id: "detect_presence",
    name: "Detect Presence",
    level: 1,
    school: "Divination",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A strip of blessed parchment", consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "timed", value: 3600, unit: "seconds", special: "Up to 1 hour" },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "sphere", size: 60, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Cleric"],
    source: "Homebrew",
    tags: ["utility","exploration","sense"],
    text: "By attuning your divine senses, you gain a number of divine pulses equal to your proficiency bonus. Each pulse, as a bonus action, reveals the presence and nature of creatures or powerful forces within 60 feet. This includes whether they are magical, undead, fiend, celestial, or corrupted. The pulses last until you finish a long rest, after which they are replenished. This spell requires a 1st-level slot to activate the sense.",
    dialogueRelated: false,
    hooks: {
      applyEffect: { 
        kind: "divine_sense_pulses",
        radiusFt: 60,
        pulsesFrom: "proficiency",
        until: "end_of_long_rest"
      }
    }
  },
  guiding_bolt: {
    id: "guiding_bolt",
    name: "Guiding Bolt",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d6 damage per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Cleric"],
    source: "PHB",
    tags: ["damage","debuff","radiant"],
    text: "Make a ranged spell attack. On a hit, the target takes 4d6 radiant damage, and the next attack roll made against it before the start of your next turn has advantage.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "4d6", type: "radiant", addMod: false, perDart: false },
      applyEffect: { kind: "advantage_next_attack_against_target", until: "start_of_caster_next_turn" }
    }
  },

  inflict_wounds: {
    id: "inflict_wounds",
    name: "Inflict Wounds",
    level: 1,
    school: "Necromancy",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "touch", distance: 5, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d10 damage per slot above 1st" }, cantrip: { tiers: [] } },
    classes: ["Cleric"],
    source: "PHB",
    tags: ["damage","necrotic"],
    text: "Make a melee spell attack against a creature you can reach. On a hit, the target takes 3d10 necrotic damage.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "melee_spell", ability: "spellcasting" },
      damage: { dice: "3d10", type: "necrotic", addMod: false, perDart: false }
    }
  },

  sanctuary: {
    id: "sanctuary",
    name: "Sanctuary",
    level: 1,
    school: "Abjuration",
    casting: { time: 1, unit: "bonus_action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A small holy symbol", consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "timed", value: 6, unit: "seconds", special: "Ends early if you make an attack or cast an offensive spell" }, // 1 round
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Cleric"],
    source: "PHB (tweaked)",
    tags: ["defense","buff"],
    text: "You ward yourself for a brief moment. Until the start of your next turn, when a creature targets you with an attack, it must make a Wisdom saving throw. On a failure, the attack fizzles and is wasted. The ward ends early if you make an attack or cast an offensive spell.",
    dialogueRelated: false,
    hooks: {
      save: null,
      damage: null,
      autoHit: false,
      darts: null,
      applyEffect: { 
        kind: "sanctuary_self",
        // Engine notes:
        // - Intercept incoming attack target selection against caster during duration.
        // - For each incoming attack: roll WIS save vs casterSpellDC; on failure, attack is wasted (no retarget in solo mode).
        // - End effect immediately if caster makes an attack or casts an offensive spell.
        savePerAttack: { ability: "WIS", dcFrom: "casterSpellDC", onFail: "attack_wasted" },
        endsOnOffense: true,
        until: "start_of_caster_next_turn"
      },
      remoteInteract: null
    }
  },

  command: {
    id: "command",
    name: "Command",
    level: 1,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: "Immediate effect on failed save" },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Cleric"],
    source: "PHB (tweaked)",
    tags: ["control","debuff","dialogue"],
    text: "Speak a one-word command: Drop, Flee, or Betray. The target must succeed on a Wisdom saving throw or obey the chosen command. Drop: it drops what it is holding. Flee: it uses its movement to move directly away from you by the safest route. Betray (stub): it immediately makes one melee attack against its nearest ally, then the effect ends.",
    dialogueRelated: true,
    hooks: {
      save: { ability: "WIS", dcFrom: "casterSpellDC", onSave: "negates" },
      damage: null,
      autoHit: false,
      darts: null,
      applyEffect: {
        kind: "command_choice",
        // Engine notes:
        // - Provide UI with options: ["flee","betray"] when casting.
        // - On failed save, execute the matching sub-effect below.
        options: ["drop","flee","betray"],
        effects: {
           flee: { kind: "forced_move_away", useAllMovement: true, avoidHazards: true, pathing: "safest" },
          // Stub for later implementation:
          betray: { 
            kind: "force_attack_ally_once",
            weaponPreference: "melee",
            chooseTarget: "nearest_ally",
            // Implementation details:
            // - Temporarily mark the target as 'compelled' to make 1 attack against nearest ally.
            // - Resolve one attack with normal modifiers; then remove 'compelled'.
            // - If no ally is in reach, the target uses movement to get adjacent if possible; otherwise the effect fizzles.
            // - No ongoing charm condition is applied; this is a one-and-done override.
            until: "after_single_attack"
          }
        }
      },
      remoteInteract: null
    }
  },

  mage_armor: {
    id: "mage_armor",
    name: "Mage Armor",
    level: 1,
    school: "Abjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A piece of cured leather", consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "timed", value: 28800, unit: "seconds", special: "8 hours; ends if target dons armor" },
    range: { type: "touch", distance: 5, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard","Artificer"],
    source: "PHB",
    tags: ["buff","defense"],
    text: "You touch a willing creature not wearing armor. The target’s AC becomes 13 + its Dexterity modifier for the duration.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "mage_armor",
        acBase: 13,
        addDex: true,
        endsIfArmorEquipped: true,
        until: "end_of_duration"
      }
    }
  },

  shield: {
    id: "shield",
    name: "Shield",
    level: 1,
    school: "Abjuration",
    casting: { time: 1, unit: "reaction", reactionTrigger: "When you are hit by an attack or targeted by Magic Missile" },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "timed", value: 6, unit: "seconds", special: "Until the start of your next turn" }, // 1 round
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Sorcerer","Wizard"],
    source: "PHB",
    tags: ["defense","reaction"],
    text: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from Magic Missile.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "shield_reaction",
        acBonus: 5,
        blocksMagicMissile: true,
        appliesToTriggeringAttack: true,
        until: "start_of_caster_next_turn"
      }
    }
  },

  entangle: {
    id: "entangle",
    name: "Entangle",
    level: 1,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A thread of vine or fungal filament", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: "Up to 1 minute (concentration)" },
    range: { type: "distance", distance: 90, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: true },
    area: { shape: "square", size: 20, length: 20, width: 20, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Wizard"], // gate to Fossicker/Wanderer via subclass logic
    source: "Homebrew",
    tags: ["control","area","difficult_terrain"],
    text: "Grasping roots/fungal mats erupt in a 20-foot square. Creatures in the area must succeed on a STR save or be Restrained by the growths until the spell ends. The area is difficult terrain. A Restrained creature can use its action to make a STR check against your spell save DC, freeing itself on a success.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "STR", dcFrom: "casterSpellDC", onSave: "negates" },
      applyEffect: {
        kind: "entangle_area",
        difficultTerrain: true,
        restrainedOnFail: true,
        escapeCheck: { ability: "STR", dcFrom: "casterSpellDC", actionCost: "action" },
        concentration: true,
        area: { shape: "square", size: 20, unit: "ft" }
      }
    }
  },

  faerie_fire: {
    id: "faerie_fire",
    name: "Faerie Fire",
    level: 1,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A pinch of phosphorescent dust", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: "Up to 1 minute (concentration)" },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: true },
    area: { shape: "cube", size: 20, length: 20, width: 20, height: 20, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Wizard"],
    source: "Homebrew",
    tags: ["control","debuff","reveal"],
    text: "Each creature in a 20-foot cube must make a DEX save or be outlined in light for the duration. Affected creatures shed dim light and cannot benefit from being invisible. Attack rolls against an affected creature have advantage.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "DEX", dcFrom: "casterSpellDC", onSave: "negates" },
      applyEffect: {
        kind: "faerie_fire",
        grantsAdvantageToAttackers: true,
        cancelsInvisibility: true,
        shedsLight: { dimFt: 10 },
        concentration: true,
        area: { shape: "cube", size: 20, unit: "ft" }
      }
    }
  },

  detect_poison_and_disease: {
    id: "detect_poison_and_disease",
    name: "Detect Poison and Disease",
    level: 1,
    school: "Divination",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A withered sprig of nightshade", consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: "One-off pulse" },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "sphere", size: 30, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: "Each casting grants a single pulse; no concentration." }, cantrip: { tiers: [] } },
    classes: ["Wizard"],
    source: "Homebrew",
    tags: ["utility","exploration","sense"],
    text: "You emit a brief divinatory pulse that reveals sources of poison, poisonous creatures, poisons, and disease within 30 feet. The pulse reports what and where are affected (general locations) at the moment of casting. This is a single burst of insight (not sustained).",
    dialogueRelated: true,
    hooks: {
      applyEffect: {
        kind: "detect_filter",
        mode: "pulse",
        filter: "poison_disease",
        radiusFt: 30,
        report: "list_and_locations" // engine returns a list; no types beyond 'poison/disease' categories
      }
    }
  },

  // --- Level 2 ---

    lesser_restoration: {
    id: "lesser_restoration",
    name: "Lesser Restoration",
    level: 2,
    school: "Abjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "touch", distance: 5, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Wizard", "Cleric", "Paladin"], // gate via Fossicker / Wanderer subclass logic
    source: "Homebrew",
    tags: ["cleanse","support"],
    text: "You end one disease or condition afflicting the target: blinded, deafened, paralyzed, or poisoned.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "cleanse_one",
        conditions: ["blinded","deafened","paralyzed","poisoned"]
      }
    }
  },

  spike_growth: {
    id: "spike_growth",
    name: "Spike Growth",
    level: 2,
    school: "Transmutation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "Rusty caltrops or thorny scrap", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: "Up to 10 minutes (concentration)" },
    range: { type: "distance", distance: 150, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: false, requiresSight: true },
    area: { shape: "radius", size: 20, unit: "ft" }, // 20-foot radius
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Wizard"],
    source: "Homebrew",
    tags: ["area","control","hazard"],
    text: "The ground twists with jagged scrap and thorny growths in a 20-foot radius. The area is difficult terrain. A creature moving within the area takes 2d4 piercing damage for every 5 feet it travels there. The transformation is camouflaged; a creature must succeed on a Perception check against your spell save DC to spot the hazard when entering it for the first time.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "hazard_zone",
        concentration: true,
        area: { shape: "radius", size: 20, unit: "ft" },
        difficultTerrain: true,
        damagePer5ft: { dice: "2d4", type: "piercing" },
        revealCheck: { skill: "PERCEPTION", dcFrom: "casterSpellDC" }
      }
    }
  },

    flame_blade: {
    id: "flame_blade",
    name: "Flame Blade",
    level: 2,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A leaf of sumac or ember scrap", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 600, unit: "seconds", special: "Up to 10 minutes (concentration)" },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d6 fire damage for every 2 slot levels above 2nd" }, cantrip: { tiers: [] } },
    classes: ["Wizard"], // gate via Fossicker/Wanderer subclass logic
    source: "Homebrew",
    tags: ["conjuration","weapon","light","concentration"],
    text: "A fiery blade appears in your hand. While the spell lasts, you can make a melee spell attack with the blade as a bonus action on each of your turns. On a hit, the target takes 3d6 fire damage (increases at higher slots). The blade sheds bright light in a 10-foot radius and dim light for an additional 10 feet. If you let go of the blade, it disappears, but you can use a bonus action to summon the blade back to your hand while the spell persists.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "conjured_blade",
        hand: "main",
        concentration: true,
        light: { brightFt: 10, dimFt: 10 },
        attack: { type: "melee_spell", ability: "spellcasting", asBonusActionEachTurn: true },
        damage: { dice: "3d6", type: "fire", addMod: false },
        // Engine notes:
        // - While active, treat blade as an equipped light weapon that uses melee_spell attack rules.
        // - Allow re-summon to hand as a bonus action if dropped while concentration persists.
        // - Scaling: add +1d6 fire damage at slot levels 4th, 6th, etc.
        scaling: { per2SlotsAboveBase: { baseLevel: 2, add: "+1d6" } }
      }
    }
  },

  
  misty_step: {
    id: "misty_step",
    name: "Misty Step",
    level: 2,
    school: "Conjuration",
    casting: { time: 1, unit: "bonus_action", reactionTrigger: null },
    components: { v: true, s: false, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Sorcerer","Wizard","Bard"],
    source: "PHB",
    tags: ["mobility","bonus_action","teleport"],
    text: "Briefly wreathed in silvery mist, you teleport up to 30 feet to an unoccupied space you can see.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "teleport",
        distanceFt: 30,
        requiresLoS: true,
        target: "unoccupied_space",
        provokeOA: false,
        breaks: ["grapple","grappling"],
        enterCause: "teleport"
      }
    }
  },

  darkness: {
    id: "darkness",
    name: "Darkness",
    level: 2,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: false, m: true, material: "A pinch of soot and pitch", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "sphere", size: 15, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Sorcerer","Wizard"],
    source: "PHB",
    tags: ["control","obscurement","darkness","concentration"],
    text: "A 15‑ft‑radius sphere becomes fully dark for 1 minute (concentration). Vision is blocked for all creatures; ambient light is suppressed within the area. Cast on a point (not a creature).",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "area_obscure",
        variant: "darkness",
        radiusFt: 15,
        blocksSight: true,
        overrideLightTo: "none",
        suppressLightEffects: true,
        followsTarget: false
      }
    }
  },

  hold_person: {
    id: "hold_person",
    name: "Hold Person",
    level: 2,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A small, straight piece of iron", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null }, // up to 1 minute
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Cleric","Bard","Sorcerer","Wizard"],
    source: "PHB",
    tags: ["control","paralyze","concentration"],
    text: "Humanoid makes a Wisdom save or becomes Paralyzed for the duration. The target can repeat the save at the end of each of its turns, ending the effect on a success.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" },
      applyEffect: {
        kind: "apply_condition",
        name: "Paralyzed",
        until: "end_of_spell",
        targetRestriction: { creatureType: "Humanoid" },
        saveEndsEachTurn: { ability: "WIS", dcFrom: "spellSaveDC" }
      }
    }
  },

  shatter: {
    id: "shatter",
    name: "Shatter",
    level: 2,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A chip of mica", consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "sphere", size: 10, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d8 damage per slot level above 2nd" }, cantrip: { tiers: [] } },
    classes: ["Warlock","Bard","Sorcerer","Wizard"],
    source: "PHB",
    tags: ["damage","area","thunder"],
    text: "A sudden loud ringing noise, painfully intense, erupts from a point. Creatures in a 10‑ft radius sphere must make a CON save, taking 3d8 thunder damage on a failed save, or half as much on a success.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "spellSaveDC", onSave: "half" },
      damage: { dice: "3d8", type: "thunder", addMod: false, perDart: false },
      applyEffect: { kind: "area_point_radius", radiusFt: 10 }
    }
  },

  hold_foe: {
    id: "hold_foe",
    name: "Hold Foe",
    level: 2,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null }, // up to 1 minute
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "At higher levels, DMs may allow additional targets (optional)" }, cantrip: { tiers: [] } },
    classes: ["Warlock","Bard","Cleric","Sorcerer","Wizard"],
    source: "Homebrew (merged Hold Person/Monster)",
    tags: ["control","paralyze","concentration"],
    text: "Choose a creature you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration. At the end of each of its turns, the target can make another Wisdom saving throw, ending the effect on itself on a success. This spell affects any creature type. The save DC becomes harder as you gain Warlock levels (every two levels above 3rd: +1 DC).",
    dialogueRelated: false,
    hooks: {
      save: {
        ability: "WIS",
        dcFrom: "spellSaveDC",
        onSave: "negates",
        dcBonusFromLevel: { class: "Warlock", baselineLevel: 3, intervalLevels: 2, bonusPerInterval: 1 }
      },
      applyEffect: {
        kind: "apply_condition_bundle",
        name: "Held (Paralyzed)",
        until: "end_of_spell",
        grants: [
          { kind: "condition", name: "Paralyzed" }
        ]
      },
      ticks: [
        {
          phase: "turn_end",
          save: { ability: "WIS", dcFrom: "spellSaveDC", dcBonusFromLevel: { class: "Warlock", baselineLevel: 3, intervalLevels: 2, bonusPerInterval: 1 }, onSave: "end_spell" }
        }
      ]
    }
  },
// --- Level 3 ---
  erupting_earth: {
    id: "erupting_earth",
    name: "Erupting Earth",
    level: 3,
    school: "Transmutation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A shard of stone and a handful of dirt", consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "special", value: 0, unit: "rounds", special: "Area becomes difficult terrain until cleared" },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: true },
    area: { shape: "cube", size: 20, length: 20, width: 20, height: 20, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d12 damage per slot above 3rd" }, cantrip: { tiers: [] } },
    classes: ["Wizard"], // gate to Fossicker/Wanderer via subclass logic
    source: "Homebrew",
    tags: ["area","damage","control","terrain"],
    text: "Jagged stone and rubble erupt in a 20-foot cube centered on a point you can see. Each creature in the area makes a Dexterity save, taking 3d12 bludgeoning damage on a fail or half as much on a success. The ground in the area becomes difficult terrain until cleared.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "DEX", dcFrom: "casterSpellDC", onSave: "half" },
      damage: { dice: "3d12", type: "bludgeoning", addMod: false },
      applyEffect: {
        kind: "create_terrain",
        area: { shape: "cube", size: 20, unit: "ft" },
        difficultTerrain: true,
        clearable: true // engine may allow time/tools to clear
      }
    }
  },

  conjure_vermin: {
    id: "conjure_vermin",
    name: "Conjure Vermin",
    level: 3,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A smear of offal or mold", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: "Up to 1 minute (concentration)" },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "donut", size: 5, length: 0, width: 0, height: 0, unit: "ft" }, // ring 5 ft from caster
    scaling: { type: "slot", slot: { text: "+1d4 damage per 2 slot levels above 3rd (5th, 7th)" }, cantrip: { tiers: [] } },
    classes: ["Wizard"], // gate via subclass logic
    source: "Homebrew",
    tags: ["control","area","hazard","summoning"],
    text: "You conjure a gnashing ring of rats, roaches, and biting vermin that swarms in a 5-foot ring around you and moves with you. When a creature starts its turn in the ring or enters it for the first time on a turn, it must make a Dexterity save, taking 2d4 piercing damage on a failed save, or half as much on a success. The ring counts as difficult terrain. The swarm disperses when the spell ends.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "DEX", dcFrom: "casterSpellDC", onSave: "half" },
      applyEffect: {
        kind: "moving_ring_hazard",
        followsCaster: true,
        innerRadiusFt: 5,   // empty center around caster
        outerRadiusFt: 10,  // 5-ft wide ring
        difficultTerrain: true,
        tickOn: ["start_of_turn","enter"],
        damage: { dice: "2d4", type: "piercing" },
        concentration: true,
        scaling: { per2SlotsAboveBase: { baseLevel: 3, add: "+1d4" } }
      }
    }
  },

  wind_wall: {
    id: "wind_wall",
    name: "Wind Wall",
    level: 3,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A tiny fan and a feather", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: "Up to 1 minute (concentration)" },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: false, requiresSight: true },
    area: { shape: "line", size: 50, length: 50, width: 1, height: 15, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Wizard"], // druid import for Fossicker/Wanderer
    source: "Homebrew",
    tags: ["control","wall","area"],
    text: "A roaring wall of air rises from a line you choose, up to 50 feet long, 15 feet high, and 1 foot thick. When the wall appears, each creature in its space makes a Strength save, taking 3d8 bludgeoning damage on a failed save, or half as much on a success, and is pushed 5 feet to one side of the wall (your choice) on a failure. The wall persists, dispersing gases and fog, extinguishing small flames, and making ranged weapon attacks that pass through it have disadvantage (or are deflected, at the DM’s discretion for very light missiles). Small flying creatures cannot pass through the wall.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "STR", dcFrom: "casterSpellDC", onSave: "half" },
      damage: { dice: "3d8", type: "bludgeoning", addMod: false },
      applyEffect: {
        kind: "wind_wall",
        line: { lengthFt: 50, heightFt: 15, thicknessFt: 1 },
        pushOnFailFt: 5,
        affectsProjectiles: { rangedWeaponAttacks: "disadvantage", lightMissiles: "deflect" },
        dispersesGases: true,
        extinguishSmallFlames: true,
        blocksSmallFliers: true,
        concentration: true
      }
    }
  },


  armor_of_agathys: {
  id: "armor_of_agathys",
  name: "Armor of Agathys (Simplified)",
  level: 1,
  school: "Abjuration",
  casting: { time: 1, unit: "action", reactionTrigger: null },
  components: { v: true, s: true, m: true, material: "A cup of water frozen overnight", consume: false, costGp: 0 },
  concentration: false, ritual: false,
  duration: { type: "timed", value: 3600, unit: "seconds", special: null }, // 1 hour
  range: { type: "self", distance: 0, unit: "ft", special: null },
  target: { type: "self", count: 1, friendly: true, requiresSight: false },
  area: { shape: "none", size: 0, unit: "ft" },
  scaling: { type: "slot", slot: { text: "+5 temp HP per slot above 1st; reactive damage equals slot level" }, cantrip: { tiers: [] } },
  classes: ["Warlock"],
  tags: ["buff","temp_hp","retaliation"],
  text: "Frost shrouds you with temporary hit points (5 + 5 per slot above 1st). While any of these temporary hit points remain, when a creature hits you with a melee attack it takes cold damage equal to the spell’s slot level.",
  dialogueRelated: false,
  hooks: {
    applyEffect: {
      kind: "temp_hp_with_retal",
      tempHP: { base: 5, perSlotAboveFirst: 5 },
      retaliation: { trigger: "hit_by_melee", damage: { amountFrom: "slotLevel", type: "cold" } }
    }
  }
},

  arms_of_hadar: {
  id: "arms_of_hadar",
  name: "Arms of Hadar",
  level: 1,
  school: "Conjuration",
  casting: { time: 1, unit: "action", reactionTrigger: null },
  components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
  concentration: false, ritual: false,
  duration: { type: "instant", value: 0, unit: "rounds", special: null },
  range: { type: "self", distance: 0, unit: "ft", special: null },
  target: { type: "area", count: 0, friendly: false, requiresSight: false },
  area: { shape: "sphere", size: 10, unit: "ft" },
  scaling: { type: "slot", slot: { text: "+1d6 damage per slot above 1st" }, cantrip: { tiers: [] } },
  classes: ["Warlock"],
  tags: ["area","damage","control"],
  text: "Tendrils of dark energy erupt from you. Each creature in 10 ft makes a STR save, taking 2d6 necrotic on a failure (half on success). On a failed save, a creature also can’t take reactions until the end of its next turn.",
  dialogueRelated: false,
  hooks: {
    save: { ability: "STR", dcFrom: "casterSpellDC", onSave: "half" },
    damage: { dice: "2d6", type: "necrotic", addMod: false, perDart: false },
    applyEffect: { kind: "no_reactions_on_fail", until: "end_of_target_next_turn" }
  }
},

  hellish_rebuke: {
  id: "hellish_rebuke",
  name: "Hellish Rebuke",
  level: 1,
  school: "Evocation",
  casting: { time: 1, unit: "reaction", reactionTrigger: "When you take damage from a creature within 60 ft that you can see" },
  components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
  concentration: false, ritual: false,
  duration: { type: "instant", value: 0, unit: "rounds", special: null },
  range: { type: "distance", distance: 60, unit: "ft", special: null },
  target: { type: "creature", count: 1, friendly: false, requiresSight: true },
  area: { shape: "none", size: 0, unit: "ft" },
  scaling: { type: "slot", slot: { text: "+1d10 fire per slot above 1st" }, cantrip: { tiers: [] } },
  classes: ["Warlock"],
  tags: ["reaction","damage"],
  text: "Reaction to being damaged: wreath the attacker in hellish flames. It makes a DEX save, taking 2d10 fire damage on a failed save, or half as much on a success.",
  dialogueRelated: false,
  hooks: {
    save: { ability: "DEX", dcFrom: "casterSpellDC", onSave: "half" },
    damage: { dice: "2d10", type: "fire", addMod: false, perDart: false }
  }
},

  hex: {
  id: "hex",
  name: "Hex",
  level: 1,
  school: "Enchantment",
  casting: { time: 1, unit: "bonus_action", reactionTrigger: null },
  components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
  concentration: true, ritual: false,
  duration: { type: "timed", value: 3600, unit: "seconds", special: null }, // up to 1 hour
  range: { type: "distance", distance: 90, unit: "ft", special: null },
  target: { type: "creature", count: 1, friendly: false, requiresSight: true },
  area: { shape: "none", size: 0, unit: "ft" },
  scaling: { type: "slot", slot: { text: "Duration may scale later; damage scales by beam if Eldritch Blast applies per hit" }, cantrip: { tiers: [] } },
  classes: ["Warlock"],
  tags: ["debuff","damage_rider","bonus_action","concentration"],
  text: "Bonus action: curse a creature. While you concentrate, your attacks deal +1d6 necrotic to it when you hit. Choose an ability; the target has Disadvantage on ability checks with that ability. If the target drops to 0 HP, you can move the curse (no action) to a new creature you can see on your next turn.",
  dialogueRelated: false,
  hooks: {
    applyEffect: { kind: "hex_curse", bonusDamage: "1d6", abilityCheckDisadvantage: true, transferableOnKill: true }
  }
},

  protection_from_evil_and_good: {
  id: "protection_from_evil_and_good",
  name: "Protection from Evil and Good",
  level: 1,
  school: "Abjuration",
  casting: { time: 1, unit: "action", reactionTrigger: null },
  components: { v: true, s: true, m: true, material: "Holy water or powdered silver and iron", consume: false, costGp: 0 },
  concentration: true, ritual: false,
  duration: { type: "timed", value: 600, unit: "seconds", special: null }, // 10 minutes
  range: { type: "touch", distance: 5, unit: "ft", special: null },
  target: { type: "creature", count: 1, friendly: true, requiresSight: false },
  area: { shape: "none", size: 0, unit: "ft" },
  scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
  classes: ["Cleric","Paladin","Warlock"],
  tags: ["defense","abjuration","concentration"],
  text: "Until the spell ends, the target benefits against aberrations, celestials, elementals, fey, fiends, and undead: such creatures have Disadvantage on attack rolls against the target, and the target can’t be charmed, frightened, or possessed by them. If already charmed, frightened, or possessed by such a creature, the target has advantage on any new save made to end the effect.",
  dialogueRelated: false,
  hooks: {
    applyEffect: {
      kind: "protection_types",
      types: ["aberration","celestial","elemental","fey","fiend","undead"],
      effects: { disadvantageToHit: true, immuneTo: ["charmed","frightened","possession"] },
      advantageOnEndSaves: true
    }
  }
},
}



  



export function getSpellById(id) {
  return SPELLS[id] || null;
}
export function listSpellsByClass(cls) {
  return Object.values(SPELLS).filter(s => s.classes?.includes(cls));
}
  


  counterspell: {
    id: "counterspell",
    name: "Counterspell",
    level: 3,
    school: "Abjuration",
    casting: { time: 1, unit: "reaction", reactionTrigger: "creature_casts_spell_in_range" },
    components: { v: false, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Wizard","Sorcerer","Bard"],
    source: "PHB",
    tags: ["reaction","utility","interruption"],
    text: "You attempt to interrupt a creature in the process of casting a spell. If the spell is 3rd level or lower, it fails and has no effect. If it is 4th level or higher, make an ability check using your spellcasting ability (DC 10 + the spell’s level). On a success, the spell fails; otherwise, it succeeds.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "counterspell",
        rangeFt: 60,
        autoNegateUpToLevel: 3,
        checkBeyond: { ability: "spellcasting", dcBase: 10, dcAdds: "targetSpellLevel" },
        onSuccess: "negate_cast",
        onFailure: "cast_resolves"
      }
    }
  },

  hunger_of_hadar: {
    id: "hunger_of_hadar",
    name: "Hunger of Hadar",
    level: 3,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A pickled octopus tentacle", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null }, // 1 minute
    range: { type: "distance", distance: 150, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "sphere", size: 20, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    source: "PHB",
    tags: ["control","area","darkness","hazard","concentration"],
    text: "You open a gateway to the dark between the stars. A 20‑ft‑radius sphere of darkness appears for 1 minute (concentration). The area is difficult terrain. Creatures that start their turn in the area take 2d6 cold damage. Creatures that end their turn in the area must succeed on a DEX save or take 2d6 acid damage. Vision is blocked for all creatures and light is suppressed within the area.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "area_hazard",
        variant: "hunger_of_hadar",
        radiusFt: 20,
        blocksSight: true,
        overrideLightTo: "none",
        suppressLightEffects: true,
        difficultTerrain: true,
        followsTarget: false,
        ticks: [
          { phase: "turn_start", save: null, damage: { dice: "2d6", type: "cold", addMod: false, perDart: false } },
          { phase: "turn_end", save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "negates" }, damage: { dice: "2d6", type: "acid", addMod: false, perDart: false } }
        ]
      }
    }
  },

  blight: {
    id: "blight",
    name: "Blight",
    level: 4,
    school: "Necromancy",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false,
    ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 30, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d8 damage per slot level above 4th" }, cantrip: { tiers: [] } },
    classes: ["Warlock","Sorcerer","Wizard","Druid"],
    source: "PHB",
    tags: ["damage","necrotic","single_target"],
    text: "Necromantic energy washes over a creature of your choice that you can see within range, draining moisture and vitality. The target must make a Constitution saving throw. The target takes 8d8 necrotic damage on a failed save, or half as much damage on a successful one.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CON", dcFrom: "spellSaveDC", onSave: "half" },
      damage: { dice: "8d8", type: "necrotic", addMod: false, perDart: false }
    }
  },

  banishment: {
    id: "banishment",
    name: "Banishment",
    level: 4,
    school: "Abjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "An item distasteful to the target", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null }, // up to 1 minute
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Cleric","Paladin","Sorcerer"],
    source: "PHB (adapted)",
    tags: ["control","banish","concentration"],
    text: "You banish a creature to a sealed stasis within the battlefield for up to 1 minute (concentration). The target makes a Charisma saving throw. On a failure, it is moved to an empty square and encased in an impenetrable magical shell: it cannot act, move, or be targeted or affected by any other effects. The target reappears when your concentration ends or after 1 minute. On a successful save, the spell has no effect.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "CHA", dcFrom: "spellSaveDC", onSave: "negates" },
      applyEffect: {
        kind: "local_banish_stasis",
        stasisBubble: true,
        moveToEmptySquare: true,
        untargetable: true,
        invulnerable: true,
        cannotAct: true,
        endsOn: ["concentration_end","duration_end"],
        durationRounds: 10,
        returnOnEnd: { to: "stasis_position_or_nearest_valid" }
      }
    }
  },

  wall_of_force: {
    id: "wall_of_force",
    name: "Wall of Force",
    level: 5,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A pinch of powdered quartz", consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "line", length: 50, width: 10, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Wizard","Sorcerer"],
    source: "PHB (adapted)",
    tags: ["control","wall","concentration"],
    text: "Create an invisible, indestructible wall up to 50 ft long and 10 ft high that blocks movement, projectiles, and line of sight. The wall persists while you concentrate (up to 1 minute).",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "wall",
        shape: "line",
        lengthFt: 50,
        heightFt: 10,
        blocksMovement: true,
        blocksProjectiles: true,
        blocksSight: true,
        immuneToDamage: true,
        endsOn: ["concentration_end","duration_end"]
      }
    }
  },

  synaptic_static: {
    id: "synaptic_static",
    name: "Synaptic Static",
    level: 5,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: true },
    area: { shape: "sphere", size: 20, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Wizard","Sorcerer","Bard"],
    source: "XGtE (adapted)",
    tags: ["damage","debuff","psychic","area","concentration"],
    text: "A 20‑foot‑radius psychic detonation. Creatures in the area make an INT save, taking 8d6 psychic damage on a failure or half on a success. On a failure, a creature is mentally scrambled for up to 1 minute while you concentrate; at the end of each of its turns it can make an INT save to end the effect.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "INT", dcFrom: "spellSaveDC", onSave: "half" },
      damage: { dice: "8d6", type: "psychic", addMod: false, perDart: false },
      applyEffect: {
        kind: "apply_condition_bundle",
        name: "Synaptic Shock",
        until: "end_of_spell",
        grants: [
          { kind: "attackPenaltyDie", die: "1d6" },
          { kind: "abilityCheckPenaltyDie", die: "1d6" },
          { kind: "concentrationPenaltyDie", die: "1d6" }
        ]
      },
      ticks: [
        { phase: "turn_end", save: { ability: "INT", dcFrom: "spellSaveDC", onSave: "end_spell" } }
      ]
    }
  },

  far_step: {
    id: "far_step",
    name: "Far Step",
    level: 5,
    school: "Conjuration",
    casting: { time: 1, unit: "bonus_action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true,
    ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Wizard","Sorcerer"],
    source: "PHB (adapted)",
    tags: ["mobility","concentration","teleport"],
    text: "You blur and displace. For up to 1 minute while concentrating, you can use a bonus action on each of your turns to teleport up to 60 feet to a space you can see.",
    dialogueRelated: false,
    hooks: {
      applyEffect: {
        kind: "grant_bonus_action_ability",
        name: "Far Step: Teleport",
        ability: {
          type: "teleport",
          distanceFt: 60,
          requiresSight: true
        },
        perTurnCharges: 1,
        refreshPhase: "turn_start",
        endsOn: ["concentration_end","duration_end"]
      }
    }
  },

  leech: {
    id: "leech",
    name: "Leech",
    level: 0,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "cantrip", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    source: "Homebrew",
    tags: ["damage","temp_hp","party_support","warlock_only"],
    text: "Make a ranged spell attack dealing Eldritch Blast-like force damage (beams at 5/11/17). After resolving all beams, your entire party (companions included) gains temporary hit points equal to one third of the total damage actually dealt by this casting (rounded down). Each ally keeps the higher of their current temp HP or this amount. Temp HP is removed at end of combat.",
    dialogueRelated: false,
    hooks: {
      attack: { type: "ranged_spell", ability: "spellcasting" },
      damage: { dice: "1d10", type: "force", addMod: false, perDart: false },
      applyEffect: { kind: "multi_beam", beamsByLevel: {5:2,11:3,17:4} },
      requirements: { minClassLevel: { Warlock: 7 } },
      onCastEnd: {
        kind: "party_temp_hp_from_damage",
        source: "this_cast_total_damage_after_resist",
        share: { fraction: 0.3333333333, round: "floor" },
        distribution: "party_wide",
        bestOf: true,
        expires: "end_of_combat"
      }
    }
  },

  fear: {
    id: "fear",
    name: "Fear",
    level: 3,
    school: "Illusion",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: false },
    area: { shape: "cone", size: 30, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Wizard","Sorcerer","Bard"],
    source: "PHB",
    tags: ["control","frighten","area","concentration"],
    text: "Project a phantasmal terror in a 30‑ft cone. Each creature in the area makes a WIS save or drops what it is holding and becomes Frightened while you concentrate (up to 1 minute). The target can repeat the save at the end of each of its turns.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" },
      applyEffect: { kind: "condition", name: "Frightened", until: "end_of_spell" },
      ticks: [{ phase: "turn_end", save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "end_spell" } }]
    }
  },

  fireball: {
    id: "fireball",
    name: "Fireball",
    level: 3,
    school: "Evocation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A tiny ball of bat guano and sulfur", consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 150, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: true },
    area: { shape: "sphere", size: 20, unit: "ft" },
    scaling: { type: "slot", slot: { text: "+1d6 per slot above 3rd" }, cantrip: { tiers: [] } },
    classes: ["Wizard","Sorcerer","Warlock"],
    source: "PHB",
    tags: ["damage","area","fire"],
    text: "A bright streak blossoms into a 20‑ft radius explosion. Creatures make a DEX save, taking 8d6 fire damage on a failure or half as much on a success.",
    dialogueRelated: false,
    hooks: { save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "half" }, damage: { dice: "8d6", type: "fire", addMod: false, perDart: false } }
  },

  hypnotic_pattern: {
    id: "hypnotic_pattern",
    name: "Hypnotic Pattern",
    level: 3,
    school: "Illusion",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A glowing stick of incense", consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 120, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: true },
    area: { shape: "cube", size: 30, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Bard","Sorcerer","Warlock","Wizard"],
    source: "PHB",
    tags: ["control","incapacitate","area","concentration"],
    text: "A twisting pattern of colors charms and incapacitates. Creatures in the area make a WIS save or become Charmed and Incapacitated with speed 0 while you concentrate (1 minute). The effect ends for a creature if it takes any damage.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" },
      applyEffect: { kind: "apply_condition_bundle", name: "Enthralled", until: "end_of_spell",
        grants: [ { kind: "condition", name: "Charmed" }, { kind: "condition", name: "Incapacitated" }, { kind: "speed_set", amountFt: 0 } ],
        breakOn: ["takes_damage"] }
    }
  },

  evards_maw: {
    id: "evards_maw",
    name: "Evard's Maw",
    level: 4,
    school: "Conjuration",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A knotted cord", consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 90, unit: "ft", special: null },
    target: { type: "point", count: 1, friendly: true, requiresSight: true },
    area: { shape: "sphere", size: 20, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    source: "Homebrew",
    tags: ["control","difficult_terrain","restrain","area","concentration"],
    text: "Writhing tentacles fill a 20‑ft radius area, turning it into difficult terrain. A creature that starts its turn there or enters it must succeed on a STR save or become Restrained. While Restrained this way, it takes 3d6 bludgeoning damage at the start of its turn. It can use an action to make a STR (Athletics) check vs your spell save DC to escape.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "STR", dcFrom: "spellSaveDC", onSave: "negates_effect" },
      applyEffect: {
        kind: "area_tentacles",
        radiusFt: 20,
        difficultTerrain: true,
        onEnterOrStart: { requireSave: true, conditionOnFail: "Restrained" },
        perTurnWhileRestrained: { damage: { dice: "3d6", type: "bludgeoning" } },
        escapeCheck: { abilityCheck: "STR", skill: "Athletics", dcFrom: "spellSaveDC", actionCost: "action" }
      }
    }
  },

  wrack_of_the_patron: {
    id: "wrack_of_the_patron",
    name: "Wrack of the Patron",
    level: 4,
    school: "Enchantment",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    source: "Homebrew",
    tags: ["debuff","psychic","concentration"],
    text: "WIS save or the target is wracked by pain: disadvantage on attack rolls and ability checks; at each of its turn ends it takes 2d6 psychic damage and repeats the WIS save to end the spell.",
    dialogueRelated: false,
    hooks: {
      save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" },
      applyEffect: { kind: "apply_condition_bundle", name: "Wracked by Pain", until: "end_of_spell",
        grants: [ { kind: "disadvantage_on_attacks", value: true }, { kind: "disadvantage_on_ability_checks", value: true } ] },
      ticks: [ { phase: "turn_end", save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "end_spell" }, damage: { dice: "2d6", type: "psychic" } } ]
    }
  },

  circle_of_death: {
    id: "circle_of_death",
    name: "Circle of Death",
    level: 6,
    school: "Necromancy",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "Crushed black pearl dust", consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 150, unit: "ft", special: null },
    target: { type: "area", count: 0, friendly: false, requiresSight: true },
    area: { shape: "sphere", size: 60, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Wizard","Sorcerer"],
    source: "PHB",
    tags: ["damage","area","necrotic", "arcanum_warlock_only"],
    ui: { badges: ["Arcanum"] },
    text: "A 60‑ft radius necrotic wave. CON save for 8d6 necrotic damage (half on success).",
    dialogueRelated: false,
    hooks: {
      requirements: { arcanumOnlyFor: ["Warlock"] }, save: { ability: "CON", dcFrom: "spellSaveDC", onSave: "half" }, damage: { dice: "8d6", type: "necrotic", addMod: false, perDart: false } }
  },

  investiture_of_the_patron: {
    id: "investiture_of_the_patron",
    name: "Investiture of the Patron",
    level: 6,
    school: "Transmutation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "self", distance: 0, unit: "ft", special: null },
    target: { type: "self", count: 1, friendly: true, requiresSight: false },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock"],
    source: "Homebrew",
    tags: ["self_buff","aura","concentration","form_choice", "arcanum_warlock_only"],
    ui: { badges: ["Arcanum"] },
    text: "When you learn this spell, choose one form — Flame, Ice, Stone, or Wind. You can only cast the chosen form. For 1 minute while you concentrate, you gain that form’s aura and special attack.",
    dialogueRelated: false,
    choiceOnLearn: { key: "investiture_form", options: ["flame","ice","stone","wind"], enforcePermanent: true },
    hooks: {
      requirements: { arcanumOnlyFor: ["Warlock"] },
      applyEffect: {
        kind: "investiture_form",
        formFromChoiceKey: "investiture_form",
        forms: {
          flame: { aura: { damageToEnemies: { dice: "1d10", type: "fire", trigger: "start_of_enemy_turn_in_5ft" } },
                   actionRider: { rangedAttack: { rangeFt: 30, damage: { dice: "2d8", type: "fire" } } },
                   resist: ["fire"] },
          ice:   { aura: { difficultTerrainForEnemies: true, radiusFt: 10 },
                   actionRider: { rangedAttack: { rangeFt: 30, damage: { dice: "2d8", type: "cold" }, slow: { speedPenaltyFt: 10, until: "start_of_caster_next_turn" } } },
                   resist: ["cold"] },
          stone: { aura: { tempHPRefreshEachTurn: { amount: 5 } },
                   actionRider: { slam: { melee: true, damage: { dice: "2d8", type: "bludgeoning" }, pushFt: 10 } },
                   resist: ["bludgeoning","piercing","slashing"] },
          wind:  { aura: { disadvantageOnRangedAttacksAgainstYou: true },
                   actionRider: { dashOrDisengageBonus: true, gust: { lineFt: 30, pushFt: 10 } },
                   special: { hover: true, speedBonusFt: 10 } }
        },
        endsOn: ["concentration_end","duration_end"]
      }
    }
  },

  mental_prison: {
    id: "mental_prison",
    name: "Mental Prison",
    level: 6,
    school: "Illusion",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
    concentration: true, ritual: false,
    duration: { type: "timed", value: 60, unit: "seconds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Warlock","Wizard"],
    source: "XGtE",
    tags: ["control","psychic","concentration", "arcanum_warlock_only"],
    ui: { badges: ["Arcanum"] },
    text: "INT save; on a failure, 5d10 psychic and the target is Restrained while you concentrate (save at end of each of its turns to end). On a success, it takes half damage and the spell ends.",
    dialogueRelated: false,
    hooks: {
      requirements: { arcanumOnlyFor: ["Warlock"] },
      save: { ability: "INT", dcFrom: "spellSaveDC", onSave: "half_then_end" },
      damage: { dice: "5d10", type: "psychic", addMod: false, perDart: false },
      applyEffect: { kind: "condition", name: "Restrained", until: "end_of_spell" },
      ticks: [{ phase: "turn_end", save: { ability: "INT", dcFrom: "spellSaveDC", onSave: "end_spell" } }]
    }
  },

  disintegrate: {
    id: "disintegrate",
    name: "Disintegrate",
    level: 6,
    school: "Transmutation",
    casting: { time: 1, unit: "action", reactionTrigger: null },
    components: { v: true, s: true, m: true, material: "A lodestone and dust", consume: false, costGp: 0 },
    concentration: false, ritual: false,
    duration: { type: "instant", value: 0, unit: "rounds", special: null },
    range: { type: "distance", distance: 60, unit: "ft", special: null },
    target: { type: "creature", count: 1, friendly: false, requiresSight: true },
    area: { shape: "none", size: 0, unit: "ft" },
    scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
    classes: ["Wizard","Warlock","Sorcerer"],
    source: "PHB",
    tags: ["damage","single_target","force", "arcanum_warlock_only"],
    ui: { badges: ["Arcanum"] },
    text: "DEX save; on failure, the target takes 10d6+40 force damage. On success, no effect. This build does not remove corpses/items.",
    dialogueRelated: false,
    hooks: {
      requirements: { arcanumOnlyFor: ["Warlock"] }, save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "negates" }, damage: { dice: "10d6+40", type: "force", addMod: false, perDart: false } }
  },
