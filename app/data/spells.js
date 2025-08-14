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

  // --- Level 1 (Sorcerer relevant) ---
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
    hooks: { save: { ability: "WIS", dcFrom: "casterSpellDC", onSave: "negates" }, applyEffect: { kind: "charmed", attitude: "friendly", hostileAfter: true } }
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
  }
,
light: {
  id: "light",
  name: "Light",
  level: 0,
  school: "Evocation",
  casting: { time: 1, unit: "action", reactionTrigger: null },
  components: { v: true, s: true, m: true, material: "A firefly or phosphorescent moss", consume: false, costGp: 0 },
  concentration: false, ritual: false,
  duration: { type: "timed", value: 3600, unit: "seconds", special: null }, // 1 hour
  range: { type: "self", distance: 0, unit: "ft", special: null },
  target: { type: "self", count: 1, friendly: true, requiresSight: false },
  area: { shape: "none", size: 0, unit: "ft" },
  scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
  classes: ["Sorcerer"],
  tags: ["utility","light"],
  text: "You shed bright light in a 30‑foot radius and dim light for an additional 30 feet for 1 hour.",
  dialogueRelated: true,
  hooks: { applyEffect: { kind: "light_on_self", brightFt: 30, dimFt: 30, maxSeconds: 3600 } }
}

\}

export function getSpellById(id) {
  return SPELLS[id] || null;
}
export function listSpellsByClass(cls) {
  return Object.values(SPELLS).filter(s => s.classes?.includes(cls));
}
