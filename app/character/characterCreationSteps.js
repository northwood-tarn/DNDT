export const CHARACTER_CREATION_STEPS = [
  {
    id: "identity",
    label: "Identity",
    requiredFields: ["identity.characterName"],
    writes: ["identity.characterName"],
    unlocks: ["species"],
  },
  {
    id: "species",
    label: "Species",
    requiredFields: ["identity.speciesId"],
    writes: ["identity.speciesId", "identity.lineageId", "choices.speciesChoices"],
    unlocks: ["background"],
    warnings: ["missing_lineage_choice", "missing_species_feature_choice"],
  },
  {
    id: "background",
    label: "Background",
    requiredFields: ["identity.backgroundId"],
    writes: ["identity.backgroundId", "choices.backgroundOriginFeatChoice", "choices.featChoices"],
    unlocks: ["class"],
    warnings: ["missing_origin_feat_choice"],
  },
  {
    id: "class",
    label: "Class",
    requiredFields: ["identity.classId"],
    writes: ["identity.classId", "identity.subclassId", "identity.pactId", "choices.classChoices"],
    unlocks: ["abilities", "spells", "gear"],
    warnings: ["missing_class_choice", "missing_class_feature_choice", "premature_class_choice"],
  },
  {
    id: "abilities",
    label: "Ability Scores",
    requiredFields: [
      "abilities.strength",
      "abilities.dexterity",
      "abilities.constitution",
      "abilities.intelligence",
      "abilities.wisdom",
      "abilities.charisma",
    ],
    writes: ["abilities"],
    unlocks: ["review"],
  },
  {
    id: "spells",
    label: "Spells",
    requiredFields: [],
    writes: ["spells.knownSpellIds", "spells.preparedSpellIds", "choices.spellChoices"],
    unlocks: ["review"],
  },
  {
    id: "gear",
    label: "Gear",
    requiredFields: ["gear.weaponIds"],
    writes: ["gear.weaponIds", "gear.armorId", "gear.shieldId", "gear.inventory", "choices.weaponMasteryIds"],
    unlocks: ["review"],
  },
  {
    id: "review",
    label: "Review",
    requiredFields: [],
    writes: [],
    unlocks: [],
    warnings: ["invalid_draft", "missing_*", "invalid_*", "unsupported_*"],
  },
];

export function getCharacterCreationStepContract() {
  return structuredClone(CHARACTER_CREATION_STEPS);
}

export function getCreationStepById(stepId) {
  return CHARACTER_CREATION_STEPS.find((step) => step.id === stepId) || null;
}
