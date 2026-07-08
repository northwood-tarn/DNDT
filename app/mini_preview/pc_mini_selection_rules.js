import { CLASSES } from "../data/classes.js";
import { SPECIES } from "../data/species.js";
import {
  MINI_BASE_COMBINATIONS,
  MINI_BASE_METALS,
  MINI_BASE_RUNTIME_FOOTPRINT,
  UNIQUE_MINI_BASES,
} from "./base_asset_manifest.js";

export const PC_MINI_CLASS_IDS = Object.keys(CLASSES);
export const PC_MINI_SPECIES_IDS = [
  "human",
  "aasimar",
  "elf",
  "dwarf",
  "gnome",
  "halfling",
  "dragonborn",
  "goliath",
  "tiefling",
];

export const PC_MINI_BODY_TYPES = [
  { id: "masculine", label: "Masculine body reference" },
  { id: "feminine", label: "Feminine body reference" },
];

export const PC_MINI_SKIN_TONES = [
  { id: "aasimar_pale", label: "Aasimar pale", speciesOnly: ["aasimar"] },
  { id: "human_pale", label: "Pale" },
  { id: "human_brown", label: "Brown" },
  { id: "human_black", label: "Black" },
];

export const PC_MINI_LINEAGE_COLORED_SPECIES = new Set(["dragonborn", "tiefling"]);
export const PC_MINI_HUMANLIKE_HEAD_SPECIES = new Set([
  "human",
  "elf",
  "dwarf",
  "halfling",
  "gnome",
  "goliath",
  "tiefling",
  "aasimar",
]);

export const PC_MINI_HEADS = [
  {
    id: "humanlike_narrow_severe",
    label: "Narrow severe humanlike head",
    compatibleSpecies: [...PC_MINI_HUMANLIKE_HEAD_SPECIES],
    scaleBySpecies: { halfling: 0.85, gnome: 0.85 },
  },
  {
    id: "humanlike_broad_solid",
    label: "Broad solid humanlike head",
    compatibleSpecies: [...PC_MINI_HUMANLIKE_HEAD_SPECIES],
    scaleBySpecies: { halfling: 0.85, gnome: 0.85 },
  },
  {
    id: "humanlike_soft_round",
    label: "Soft round humanlike head",
    compatibleSpecies: [...PC_MINI_HUMANLIKE_HEAD_SPECIES],
    scaleBySpecies: { halfling: 0.85, gnome: 0.85 },
  },
  {
    id: "dragonborn_head",
    label: "Dragonborn lineage-coloured head",
    compatibleSpecies: ["dragonborn"],
  },
];

export const PC_MINI_HAIR = [
  { id: "short_messy", label: "Short messy", incompatibleSpecies: ["dragonborn"] },
  { id: "scruffy_short", label: "Scruffy short", incompatibleSpecies: ["dragonborn"] },
  { id: "short_severe", label: "Short severe", incompatibleSpecies: ["dragonborn"] },
  { id: "long_loose", label: "Long loose", incompatibleSpecies: ["dragonborn"] },
  { id: "scruffy_shoulder_length", label: "Scruffy shoulder length", incompatibleSpecies: ["dragonborn"] },
  { id: "long_tied_back", label: "Long tied back", incompatibleSpecies: ["dragonborn"] },
  { id: "topknot_bun", label: "Topknot or bun", incompatibleSpecies: ["dragonborn"] },
  { id: "bald_or_shaved", label: "Bald or shaved", incompatibleSpecies: ["dragonborn"] },
];

export const PC_MINI_HAIR_COLORS = [
  { id: "black", label: "Black" },
  { id: "blonde", label: "Blonde" },
  { id: "red", label: "Red" },
  { id: "white", label: "White" },
];

export const PC_MINI_FACIAL_HAIR = [
  { id: "none", label: "None" },
  { id: "full_beard", label: "Full beard", recommendedSpecies: ["dwarf"], incompatibleSpecies: ["aasimar"] },
  { id: "moustache", label: "Moustache", recommendedSpecies: ["dwarf"], incompatibleSpecies: ["aasimar"] },
];

export const PC_MINI_POSTURES = [
  { id: "posture_1", label: "Posture 1", role: "default readable stance" },
  { id: "posture_2", label: "Posture 2", role: "more active class stance" },
  { id: "posture_3", label: "Posture 3", role: "guarded staff-compatible stance" },
];

export const PC_MINI_OUTFITS = [
  { id: "outfit_1", label: "Outfit 1" },
  { id: "outfit_2", label: "Outfit 2" },
];

export const PC_MINI_CLOAKS = [
  { id: "none", label: "No cloak" },
  { id: "cloak", label: "Cloak, hood down" },
  { id: "hood_up", label: "Cloak, hood up" },
];

export const PC_MINI_WEAPON_SLOTS = [
  { id: "main", label: "Main weapon / primary class carry" },
  { id: "offhand_or_shield", label: "Offhand or shield set" },
  { id: "heavy_reach_two_handed", label: "Heavy, reach, or two-handed option" },
  { id: "ranged_sidearm_focus", label: "Ranged, sidearm, magic glove, or alternate staff option" },
  { id: "empty_gesture", label: "Empty-hand gesture" },
];

export const PC_MINI_WEAPON_DISPLAYS_BY_CLASS = {
  fighter: [
    { id: "fighter_1_primary_sword", sourceCell: 1, slot: "main", label: "Primary sword" },
    { id: "fighter_2_sword_and_shield", sourceCell: 2, slot: "offhand_or_shield", label: "Sword and shield" },
    { id: "fighter_3_halberd", sourceCell: 3, slot: "heavy_reach_two_handed", label: "Two-handed halberd" },
    { id: "fighter_4_spear", sourceCell: 4, slot: "ranged_sidearm_focus", label: "Grounded spear" },
  ],
  rogue: [
    { id: "rogue_1_single_dagger", sourceCell: 1, slot: "main", label: "Single dagger" },
    { id: "rogue_2_dual_daggers", sourceCell: 2, slot: "offhand_or_shield", label: "Dual daggers" },
    { id: "rogue_4_crossbow", sourceCell: 4, slot: "ranged_sidearm_focus", label: "Crossbow" },
    { id: "rogue_5_empty_hand", sourceCell: 5, slot: "empty_gesture", label: "Empty subtle hand" },
  ],
  wizard: [
    { id: "wizard_1_grounded_staff", sourceCell: 1, slot: "main", label: "Grounded staff in hand" },
    { id: "wizard_3_back_strapped_staff", sourceCell: 3, slot: "heavy_reach_two_handed", label: "Staff strapped to back" },
    { id: "wizard_4_sidearm_dagger", sourceCell: 4, slot: "ranged_sidearm_focus", label: "Small sidearm dagger" },
    { id: "wizard_5_empty_casting_hand", sourceCell: 5, slot: "empty_gesture", label: "Empty casting hand" },
  ],
  cleric: [
    { id: "cleric_1_mace_and_shield", sourceCell: 1, slot: "main", label: "Mace and shield" },
    { id: "cleric_2_sword_and_shield", sourceCell: 2, slot: "offhand_or_shield", label: "Sword and shield" },
    { id: "cleric_3_staff", sourceCell: 3, slot: "heavy_reach_two_handed", label: "Ritual staff" },
    { id: "cleric_5_hand_symbol", sourceCell: 5, slot: "empty_gesture", label: "Handheld magic symbol" },
  ],
  paladin: [
    { id: "paladin_1_primary_sword", sourceCell: 1, slot: "main", label: "Primary sword" },
    { id: "paladin_2_sword_and_shield", sourceCell: 2, slot: "offhand_or_shield", label: "Sword and shield" },
    { id: "paladin_3_greatsword_rest", sourceCell: 3, slot: "heavy_reach_two_handed", label: "Hands resting on huge greatsword" },
    { id: "paladin_4_grounded_spear", sourceCell: 4, slot: "ranged_sidearm_focus", label: "Grounded spear" },
  ],
  warlock: [
    { id: "warlock_1_short_blade", sourceCell: 1, slot: "main", label: "Short blade" },
    { id: "warlock_2_magic_glove", sourceCell: 2, slot: "offhand_or_shield", label: "Magic glove hand" },
    { id: "warlock_3_pact_staff", sourceCell: 3, slot: "heavy_reach_two_handed", label: "Pact staff" },
    { id: "warlock_5_empty_casting_hand", sourceCell: 5, slot: "empty_gesture", label: "Empty casting hand" },
  ],
};

export const PC_MINI_DROPPED_WEAPON_DISPLAY_CELLS = {
  fighter: [5],
  rogue: [3],
  wizard: [2],
  cleric: [4],
  paladin: [5],
  warlock: [4],
};

export const PC_MINI_LANTERNA_ATTACHMENTS = [
  { id: "dangling", label: "Dangling from belt or strap" },
  { id: "side_affixed", label: "Side-affixed to belt, pack, armor, or robe hardware" },
  { id: "neck_chain", label: "Neck-chain charm" },
];

export const PC_MINI_SPECIES_SCALE = {
  human: { heightScale: 1, build: "standard" },
  elf: { heightScale: 1, build: "leaner_longer" },
  dwarf: { heightScale: 0.75, build: "broad_compact" },
  halfling: { heightScale: 0.5, build: "small_compact" },
  gnome: { heightScale: 0.5, build: "small_rounder" },
  dragonborn: { heightScale: 1, build: "bulky_draconic" },
  goliath: { heightScale: 1.5, build: "large_powerful" },
  tiefling: { heightScale: 1, build: "standard", featureToggle: "horns_tail" },
  aasimar: { heightScale: 1, build: "pale_uncanny_human" },
};

export const PC_MINI_ANCHOR_SCHEMA = {
  coordinateSpace: "source_asset_pixels",
  required: [
    "baseCenter",
    "groundContactLeft",
    "groundContactRight",
    "bodyRoot",
    "head",
    "hair",
    "cloak",
    "weaponHand",
    "offhand",
    "staffBottom",
    "lanternaDangling",
    "lanternaSideAffixed",
    "lanternaNeckChain",
  ],
  optional: ["hornLeft", "hornRight", "tailRoot", "wingSuppressed"],
  pointShape: "{ x: number, y: number }",
  rules: [
    "baseCenter is the only combat placement anchor.",
    "groundContactLeft and groundContactRight must land inside the selected base perimeter.",
    "staffBottom must land inside the selected base perimeter and near the front-foot side of posture_3.",
    "weaponHand and offhand must be close enough to the torso for every legal weapon slot.",
    "Lanterna anchors must not collide with shield, cloak hem, tail, or staffBottom.",
    "hood_up may hide head and hair visually, but must not delete head or hair anchors.",
  ],
};

export const PC_MINI_SELECTION_STAGES = [
  "class",
  "species",
  "lineage",
  "bodyType",
  "skinTone",
  "speciesFeatures",
  "posture",
  "outfit",
  "cloak",
  "head",
  "hair",
  "weapon",
  "lanterna",
  "base",
  "anchors",
  "composition",
];

export const PC_MINI_SELECTION_RULES = {
  classes: PC_MINI_CLASS_IDS,
  species: PC_MINI_SPECIES_IDS,
  lineagesBySpecies: Object.fromEntries(
    PC_MINI_SPECIES_IDS.map((speciesId) => [
      speciesId,
      Object.keys(SPECIES[speciesId]?.lineages || {}),
    ]),
  ),
  bodyTypes: PC_MINI_BODY_TYPES.map((item) => item.id),
  skinTones: PC_MINI_SKIN_TONES.map((item) => item.id),
  heads: PC_MINI_HEADS.map((item) => item.id),
  hair: PC_MINI_HAIR.map((item) => item.id),
  hairColors: PC_MINI_HAIR_COLORS.map((item) => item.id),
  facialHair: PC_MINI_FACIAL_HAIR.map((item) => item.id),
  lineageColoredSpecies: [...PC_MINI_LINEAGE_COLORED_SPECIES],
  postures: PC_MINI_POSTURES.map((item) => item.id),
  outfits: PC_MINI_OUTFITS.map((item) => item.id),
  cloaks: PC_MINI_CLOAKS.map((item) => item.id),
  weaponSlots: PC_MINI_WEAPON_SLOTS.map((item) => item.id),
  weaponDisplaysByClass: PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
  droppedWeaponDisplayCells: PC_MINI_DROPPED_WEAPON_DISPLAY_CELLS,
  lanternaAttachments: PC_MINI_LANTERNA_ATTACHMENTS.map((item) => item.id),
  baseMetals: MINI_BASE_METALS.map((item) => item.id),
  baseCombinations: MINI_BASE_COMBINATIONS.map((item) => item.id),
  uniqueBases: UNIQUE_MINI_BASES.map((item) => item.id),
  baseRuntimeFootprint: MINI_BASE_RUNTIME_FOOTPRINT,
  speciesScale: PC_MINI_SPECIES_SCALE,
  anchorSchema: PC_MINI_ANCHOR_SCHEMA,
  validationStages: PC_MINI_SELECTION_STAGES,
};

export default PC_MINI_SELECTION_RULES;
