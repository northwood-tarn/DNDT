export const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

export const SKILL_OPTIONS = [
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
  "survival",
];

export function title(value) {
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function titleCase(value) {
  return title(String(value));
}

export function unique(values) {
  return [...new Set(values)];
}
