import { createCharacterDraftFromPlan } from "./characterCreationPlan.js";

const STARTER_CHARACTER_VARIANT_SPECS = {
  fighter: {
    id: "fighter",
    name: "Generated Fighter",
    role: "fighter",
    steps: [
      { type: "identity", value: { characterName: "Generated Fighter", level: 1, backgroundId: "soldier", speciesId: "tiefling", lineageId: "infernal", classId: "fighter" } },
      { type: "abilities", value: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 } },
      { type: "choices", value: { weaponMasteryIds: ["longsword", "warhammer", "greatsword"] } },
      { type: "gear", value: { weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [{ id: "healing_potion", quantity: 2 }], attunedItemIds: [] } },
    ],
  },
  wizard: {
    id: "wizard",
    name: "Generated Wizard",
    role: "wizard",
    steps: [
      { type: "identity", value: { characterName: "Generated Wizard", level: 1, backgroundId: "sage", speciesId: "tiefling", lineageId: "chthonic", classId: "wizard" } },
      { type: "abilities", value: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 10 } },
      { type: "gear", value: { weaponIds: ["wizards_staff"], armorId: null, shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] } },
      { type: "spells", value: { knownSpellIds: ["fire_bolt"], preparedSpellIds: ["magic_missile", "shield"] } },
    ],
  },
  warlock: {
    id: "warlock",
    name: "Generated Warlock",
    role: "warlock",
    steps: [
      { type: "identity", value: { characterName: "Generated Warlock", level: 1, backgroundId: "guide", speciesId: "tiefling", lineageId: "chthonic", classId: "warlock" } },
      { type: "abilities", value: { strength: 8, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 16 } },
      { type: "gear", value: { weaponIds: ["warlocks_gloves"], armorId: "leather", shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] } },
      { type: "spells", value: { knownSpellIds: ["eldritch_blast", "mage_hand", "hex", "armor_of_agathys"], preparedSpellIds: [] } },
    ],
  },
  cleric: {
    id: "cleric",
    name: "Generated Cleric",
    role: "cleric",
    steps: [
      { type: "identity", value: { characterName: "Generated Cleric", level: 1, backgroundId: "acolyte", speciesId: "aasimar", classId: "cleric" } },
      { type: "abilities", value: { strength: 12, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 16, charisma: 10 } },
      { type: "gear", value: { weaponIds: ["clerics_holy_symbol"], armorId: "half_plate", shieldId: "shield", inventory: [{ id: "healing_potion", quantity: 2 }], attunedItemIds: [] } },
      { type: "spells", value: { knownSpellIds: ["guidance", "sacred_flame"], preparedSpellIds: ["cure_wounds", "bless"] } },
    ],
  },
  rogue: {
    id: "rogue",
    name: "Generated Rogue",
    role: "rogue",
    steps: [
      { type: "identity", value: { characterName: "Generated Rogue", level: 1, backgroundId: "criminal", speciesId: "orc", classId: "rogue" } },
      { type: "abilities", value: { strength: 10, dexterity: 16, constitution: 14, intelligence: 12, wisdom: 10, charisma: 10 } },
      { type: "choices", value: { weaponMasteryIds: ["rapier", "shortsword"] } },
      { type: "gear", value: { weaponIds: ["rapier", "shortsword"], armorId: "studded_leather", shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] } },
    ],
  },
};

export const STARTER_CHARACTER_VARIANTS = Object.values(STARTER_CHARACTER_VARIANT_SPECS)
  .map(({ id, name, role }) => ({ id, name, role }));

export function createStarterCharacterDraft(variantId = "fighter") {
  const spec = STARTER_CHARACTER_VARIANT_SPECS[variantId];
  if (!spec) throw new Error(`Unknown starter character variant: ${variantId}`);
  return createCharacterDraftFromPlan({ id: spec.id, steps: spec.steps });
}

export function createStarterFighterDraft() {
  return createStarterCharacterDraft("fighter");
}
