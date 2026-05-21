// app/data/backgrounds.js
//
// DNDT-native background records. BACKGROUNDS is the normalized character
// pipeline contract; backgrounds is a compatibility adapter for the current
// legacy CharacterSelect scene.

export const BACKGROUND_SOURCES = {
  PHB_2024_REFERENCE: "2024_phb_reference",
  DNDT_LEGACY: "dndt_legacy"
};

export const BACKGROUND_ABILITY_IDS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma"
];

export const BACKGROUND_SKILL_IDS = [
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival"
];

const skillNames = {
  acrobatics: "Acrobatics",
  animal_handling: "Animal Handling",
  arcana: "Arcana",
  athletics: "Athletics",
  deception: "Deception",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medicine",
  nature: "Nature",
  perception: "Perception",
  performance: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  sleight_of_hand: "Sleight of Hand",
  stealth: "Stealth",
  survival: "Survival"
};

const implementedFeatIds = new Set([
  "alert",
  "healer",
  "lucky",
  "magic_initiate_cleric",
  "magic_initiate_paladin",
  "magic_initiate_warlock",
  "magic_initiate_wizard",
  "savage_attacker",
  "silver_tongue",
  "skilled",
  "tough"
]);

function background({
  id,
  name,
  source = BACKGROUND_SOURCES.PHB_2024_REFERENCE,
  abilityScoreOptions,
  skillProficiencies,
  toolProficiencies = [],
  originFeat,
  legacyFeatId = null,
  equipment = [],
  gold = null,
  summary,
  description,
  tags = []
}) {
  return {
    id,
    name,
    source,
    category: "background",
    abilityScoreOptions,
    skillProficiencies,
    toolProficiencies,
    originFeat,
    legacyFeatId,
    equipment,
    gold,
    summary,
    description,
    tags
  };
}

export const BACKGROUNDS = {
  acolyte: background({
    id: "acolyte",
    name: "Acolyte",
    abilityScoreOptions: ["intelligence", "wisdom", "charisma"],
    skillProficiencies: ["insight", "religion"],
    toolProficiencies: ["calligraphers_supplies"],
    originFeat: "magic_initiate_cleric",
    summary: "Temple attendant versed in rites and doctrine.",
    description: "You spent your life in service to a temple, shrine, religious order, or sacred tradition.",
    tags: ["religious", "scholarly", "institutional"]
  }),

  artisan: background({
    id: "artisan",
    name: "Artisan",
    abilityScoreOptions: ["strength", "dexterity", "intelligence"],
    skillProficiencies: ["investigation", "persuasion"],
    toolProficiencies: ["tinkers_tools"],
    originFeat: "skilled",
    summary: "Practical craftsperson trained to make, repair, and bargain.",
    description: "You learned a useful trade and know how workshops, guilds, commissions, and materials fit together.",
    tags: ["craft", "guild", "urban"]
  }),

  charlatan: background({
    id: "charlatan",
    name: "Charlatan",
    abilityScoreOptions: ["dexterity", "charisma", "intelligence"],
    skillProficiencies: ["deception", "sleight_of_hand"],
    toolProficiencies: ["disguise_kit"],
    originFeat: "skilled",
    summary: "Smooth operator with false faces and quick hands.",
    description: "You survive by reading people, wearing masks, and knowing when the lie matters more than the truth.",
    tags: ["social", "deception", "urban"]
  }),

  criminal: background({
    id: "criminal",
    name: "Criminal",
    abilityScoreOptions: ["dexterity", "intelligence", "charisma"],
    skillProficiencies: ["deception", "stealth"],
    toolProficiencies: ["thieves_tools"],
    originFeat: "alert",
    summary: "Lawbreaker who thrives in the shadows.",
    description: "You have a history of breaking the law and surviving by nerve, stealth, and timing.",
    tags: ["stealth", "crime", "urban"]
  }),

  entertainer: background({
    id: "entertainer",
    name: "Entertainer",
    abilityScoreOptions: ["dexterity", "charisma", "strength"],
    skillProficiencies: ["acrobatics", "performance"],
    toolProficiencies: ["lute"],
    originFeat: "silver_tongue",
    summary: "Performer trained to command a room.",
    description: "You thrive in front of an audience and know how to turn presence, rhythm, or spectacle into influence.",
    tags: ["performance", "social", "travel"]
  }),

  farmer: background({
    id: "farmer",
    name: "Farmer",
    abilityScoreOptions: ["strength", "constitution", "wisdom"],
    skillProficiencies: ["animal_handling", "nature"],
    toolProficiencies: ["carpenters_tools"],
    originFeat: "tough",
    summary: "Hardy rural worker used to weather, animals, and tools.",
    description: "You were shaped by land, labor, seasons, and the practical knowledge needed to keep people fed.",
    tags: ["rural", "labor", "survival"]
  }),

  guard: background({
    id: "guard",
    name: "Guard",
    abilityScoreOptions: ["strength", "constitution", "wisdom"],
    skillProficiencies: ["athletics", "perception"],
    toolProficiencies: ["calligraphers_supplies"],
    originFeat: "alert",
    summary: "Watchful defender trained to notice trouble before it starts.",
    description: "You kept watch over a gate, road, caravan, prison, noble house, or other post where vigilance mattered.",
    tags: ["martial", "watch", "urban"]
  }),

  guide: background({
    id: "guide",
    name: "Guide",
    abilityScoreOptions: ["dexterity", "wisdom", "constitution"],
    skillProficiencies: ["survival", "nature"],
    toolProficiencies: ["cartographers_tools"],
    originFeat: "lucky",
    summary: "Pathfinder trained to read land, weather, and risk.",
    description: "You helped others move through difficult country, survive bad conditions, and avoid worse routes.",
    tags: ["travel", "wilderness", "survival"]
  }),

  hermit: background({
    id: "hermit",
    name: "Hermit",
    abilityScoreOptions: ["constitution", "wisdom", "intelligence"],
    skillProficiencies: ["medicine", "religion"],
    toolProficiencies: ["herbalism_kit"],
    originFeat: "magic_initiate_cleric",
    summary: "Isolated seeker of insight, remedies, or revelation.",
    description: "You lived apart from society and learned what solitude, ritual, illness, or revelation can teach.",
    tags: ["religious", "medicine", "solitude"]
  }),

  merchant: background({
    id: "merchant",
    name: "Merchant",
    abilityScoreOptions: ["intelligence", "charisma", "dexterity"],
    skillProficiencies: ["insight", "persuasion"],
    toolProficiencies: ["navigators_tools"],
    originFeat: "skilled",
    summary: "Trader who understands routes, value, risk, and people.",
    description: "You made your way through barter, ledgers, market instinct, and the ability to judge a person quickly.",
    tags: ["trade", "social", "travel"]
  }),

  noble: background({
    id: "noble",
    name: "Noble",
    abilityScoreOptions: ["charisma", "intelligence", "wisdom"],
    skillProficiencies: ["history", "persuasion"],
    toolProficiencies: ["dragonchess_set"],
    originFeat: "skilled",
    summary: "Privileged heir familiar with lineage, etiquette, and influence.",
    description: "You were raised among wealth, power, duty, or reputation, and you know how rank changes a room.",
    tags: ["social", "history", "status"]
  }),

  sailor: background({
    id: "sailor",
    name: "Sailor",
    abilityScoreOptions: ["strength", "dexterity", "constitution"],
    skillProficiencies: ["athletics", "perception"],
    toolProficiencies: ["navigators_tools"],
    originFeat: "savage_attacker",
    summary: "Salt-hardened mariner comfortable with rigging and watch.",
    description: "You spent your life at sea, learning balance, weather, hard labor, and the habits of crews.",
    tags: ["travel", "labor", "maritime"]
  }),

  scribe: background({
    id: "scribe",
    name: "Scribe",
    abilityScoreOptions: ["intelligence", "wisdom", "charisma"],
    skillProficiencies: ["investigation", "arcana"],
    toolProficiencies: ["calligraphers_supplies"],
    originFeat: "skilled",
    summary: "Record keeper trained in texts, symbols, and detail.",
    description: "You worked with records, letters, ledgers, archives, contracts, or occult notation.",
    tags: ["scholarly", "arcane", "institutional"]
  }),

  soldier: background({
    id: "soldier",
    name: "Soldier",
    abilityScoreOptions: ["strength", "constitution", "dexterity"],
    skillProficiencies: ["athletics", "intimidation"],
    toolProficiencies: ["dice_set"],
    originFeat: "savage_attacker",
    summary: "Disciplined veteran of drills and battle lines.",
    description: "You are trained in warfare and have lived through command, fear, boredom, and violence.",
    tags: ["martial", "military", "discipline"]
  }),

  wayfarer: background({
    id: "wayfarer",
    name: "Wayfarer",
    abilityScoreOptions: ["dexterity", "wisdom", "charisma"],
    skillProficiencies: ["survival", "insight"],
    toolProficiencies: ["calligraphers_supplies"],
    originFeat: "lucky",
    summary: "Streetwise wanderer who survives by instinct and timing.",
    description: "You learned to get by without a fixed place, reading danger, people, alleys, roads, and opportunity.",
    tags: ["travel", "street", "survival"]
  }),

  folk_hero: background({
    id: "folk_hero",
    name: "Folk Hero",
    source: BACKGROUND_SOURCES.DNDT_LEGACY,
    abilityScoreOptions: ["strength", "constitution", "wisdom"],
    skillProficiencies: ["animal_handling", "survival"],
    originFeat: "tough",
    summary: "Local champion from humble beginnings.",
    description: "You come from humble beginnings and are known for standing up when ordinary people needed help.",
    tags: ["rural", "heroic", "community"]
  }),

  guild_artisan: background({
    id: "guild_artisan",
    name: "Guild Artisan",
    source: BACKGROUND_SOURCES.DNDT_LEGACY,
    abilityScoreOptions: ["intelligence", "wisdom", "charisma"],
    skillProficiencies: ["insight", "persuasion"],
    toolProficiencies: ["smiths_tools"],
    originFeat: "silver_tongue",
    summary: "Guild member who knows trade, quality, and bargaining.",
    description: "You are a member of a guild and know the value of honest work, reputation, and useful contacts.",
    tags: ["craft", "guild", "social"]
  }),

  outlander: background({
    id: "outlander",
    name: "Outlander",
    source: BACKGROUND_SOURCES.DNDT_LEGACY,
    abilityScoreOptions: ["strength", "constitution", "wisdom"],
    skillProficiencies: ["athletics", "survival"],
    originFeat: "tough",
    summary: "Wilderness survivor from beyond settled roads.",
    description: "You grew up in the wilds, far from civilization, and know how to endure hostile country.",
    tags: ["wilderness", "travel", "survival"]
  }),

  sage: background({
    id: "sage",
    name: "Sage",
    source: BACKGROUND_SOURCES.DNDT_LEGACY,
    abilityScoreOptions: ["intelligence", "wisdom", "charisma"],
    skillProficiencies: ["arcana", "history"],
    originFeat: "magic_initiate_wizard",
    summary: "Book-learned scholar of arcane and cosmic lore.",
    description: "You spent years learning the lore of the multiverse through study, debate, and dangerous texts.",
    tags: ["scholarly", "arcane", "history"]
  }),

  urchin: background({
    id: "urchin",
    name: "Urchin",
    source: BACKGROUND_SOURCES.DNDT_LEGACY,
    abilityScoreOptions: ["dexterity", "wisdom", "charisma"],
    skillProficiencies: ["sleight_of_hand", "stealth"],
    originFeat: "lucky",
    summary: "Street survivor trained by hunger, alleys, and opportunity.",
    description: "You grew up alone on the streets and learned how to hide, steal, run, and read danger.",
    tags: ["street", "stealth", "survival"]
  })
};

export const BACKGROUND_LIST = Object.values(BACKGROUNDS);

export function getBackgroundById(id) {
  return BACKGROUNDS[id] || null;
}

function toLegacyKey(name) {
  return name.replace(/\s+/g, "");
}

function toLegacyBackground(record) {
  const featId = record.legacyFeatId || record.originFeat || null;
  return {
    id: record.id,
    name: record.name,
    skills: record.skillProficiencies.map((skillId) => skillNames[skillId] || skillId),
    description: record.description,
    summary: record.summary,
    featId,
    feat: featId,
    featImplemented: implementedFeatIds.has(featId)
  };
}

export const backgrounds = Object.fromEntries(
  BACKGROUND_LIST.map((record) => [toLegacyKey(record.name), toLegacyBackground(record)])
);

export default BACKGROUNDS;
