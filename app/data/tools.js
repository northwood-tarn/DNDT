// app/data/tools.js

export const TOOL_CATEGORIES = {
  ARTISANS_TOOLS: "artisans_tools",
  GAMING_SET: "gaming_set",
  MUSICAL_INSTRUMENT: "musical_instrument",
  KIT: "kit",
  SPECIALIST_TOOL: "specialist_tool"
};

function tool({ id, name, category, tags = [], description = "" }) {
  return { id, name, category, tags, description };
}

export const TOOLS = {
  alchemists_supplies: tool({ id: "alchemists_supplies", name: "Alchemist's Supplies", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  brewers_supplies: tool({ id: "brewers_supplies", name: "Brewer's Supplies", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  calligraphers_supplies: tool({ id: "calligraphers_supplies", name: "Calligrapher's Supplies", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  carpenters_tools: tool({ id: "carpenters_tools", name: "Carpenter's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  cartographers_tools: tool({ id: "cartographers_tools", name: "Cartographer's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  cobblers_tools: tool({ id: "cobblers_tools", name: "Cobbler's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  cooks_utensils: tool({ id: "cooks_utensils", name: "Cook's Utensils", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  glassblowers_tools: tool({ id: "glassblowers_tools", name: "Glassblower's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  jewelers_tools: tool({ id: "jewelers_tools", name: "Jeweler's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  leatherworkers_tools: tool({ id: "leatherworkers_tools", name: "Leatherworker's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  masons_tools: tool({ id: "masons_tools", name: "Mason's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  painters_supplies: tool({ id: "painters_supplies", name: "Painter's Supplies", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  potters_tools: tool({ id: "potters_tools", name: "Potter's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  smiths_tools: tool({ id: "smiths_tools", name: "Smith's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  tinkers_tools: tool({ id: "tinkers_tools", name: "Tinker's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  weavers_tools: tool({ id: "weavers_tools", name: "Weaver's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),
  woodcarvers_tools: tool({ id: "woodcarvers_tools", name: "Woodcarver's Tools", category: TOOL_CATEGORIES.ARTISANS_TOOLS }),

  dice_set: tool({ id: "dice_set", name: "Dice Set", category: TOOL_CATEGORIES.GAMING_SET }),
  dragonchess_set: tool({ id: "dragonchess_set", name: "Dragonchess Set", category: TOOL_CATEGORIES.GAMING_SET }),
  playing_card_set: tool({ id: "playing_card_set", name: "Playing Card Set", category: TOOL_CATEGORIES.GAMING_SET }),
  three_dragon_ante_set: tool({ id: "three_dragon_ante_set", name: "Three-Dragon Ante Set", category: TOOL_CATEGORIES.GAMING_SET }),

  bagpipes: tool({ id: "bagpipes", name: "Bagpipes", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  drum: tool({ id: "drum", name: "Drum", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  dulcimer: tool({ id: "dulcimer", name: "Dulcimer", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  flute: tool({ id: "flute", name: "Flute", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  horn: tool({ id: "horn", name: "Horn", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  lute: tool({ id: "lute", name: "Lute", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  lyre: tool({ id: "lyre", name: "Lyre", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  pan_flute: tool({ id: "pan_flute", name: "Pan Flute", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  shawm: tool({ id: "shawm", name: "Shawm", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),
  viol: tool({ id: "viol", name: "Viol", category: TOOL_CATEGORIES.MUSICAL_INSTRUMENT }),

  disguise_kit: tool({ id: "disguise_kit", name: "Disguise Kit", category: TOOL_CATEGORIES.KIT }),
  forgery_kit: tool({ id: "forgery_kit", name: "Forgery Kit", category: TOOL_CATEGORIES.KIT }),
  herbalism_kit: tool({ id: "herbalism_kit", name: "Herbalism Kit", category: TOOL_CATEGORIES.KIT }),
  poisoners_kit: tool({ id: "poisoners_kit", name: "Poisoner's Kit", category: TOOL_CATEGORIES.KIT }),

  navigators_tools: tool({ id: "navigators_tools", name: "Navigator's Tools", category: TOOL_CATEGORIES.SPECIALIST_TOOL }),
  strange_kit: tool({
    id: "strange_kit",
    name: "A Strange Kit",
    category: TOOL_CATEGORIES.SPECIALIST_TOOL,
    tags: ["saboteur"],
    description: "Tucked in the corner of an already chaotic collection of sketches, wires and powders, this small tin looks to be filled will wax, small filings, coins of unusual metals, dried flower petals ... a hundred other things. To the untrained eye, it belongs in the garbage - but the Saboteur has their ways.",
  }),
  thieves_tools: tool({ id: "thieves_tools", name: "Thieves' Tools", category: TOOL_CATEGORIES.SPECIALIST_TOOL })
};

export const TOOL_LIST = Object.values(TOOLS);

export const TOOL_POOLS = {
  tools: TOOL_LIST.map((item) => item.id),
  artisans_tools: toolIdsByCategory(TOOL_CATEGORIES.ARTISANS_TOOLS),
  musical_instruments: toolIdsByCategory(TOOL_CATEGORIES.MUSICAL_INSTRUMENT),
  gaming_sets: toolIdsByCategory(TOOL_CATEGORIES.GAMING_SET),
  kits: toolIdsByCategory(TOOL_CATEGORIES.KIT),
  specialist_tools: toolIdsByCategory(TOOL_CATEGORIES.SPECIALIST_TOOL)
};

export function getToolById(id) {
  return TOOLS[id] || null;
}

export function listToolsByPool(poolId) {
  return TOOL_POOLS[poolId] ? [...TOOL_POOLS[poolId]] : [];
}

export function isToolId(id) {
  return Boolean(TOOLS[id]);
}

export function isToolPoolId(id) {
  return Boolean(TOOL_POOLS[id]);
}

function toolIdsByCategory(category) {
  return TOOL_LIST.filter((item) => item.category === category).map((item) => item.id);
}

export default TOOLS;
