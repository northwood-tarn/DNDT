import { armor } from "../data/armor.js";
import { findClassByIdOrName } from "../data/classes.js";
import { listSpellsByClass } from "../data/spells.js";
import { weapons } from "../data/weapons.js";

const LEVEL_ONE_SPELL_CHOICES = {
  cleric: { knownCantrips: 3, preparedSpells: 4, maxSpellLevel: 1 },
  paladin: { knownCantrips: 0, preparedSpells: 2, maxSpellLevel: 1 },
  warlock: { knownCantrips: 2, knownSpells: 2, maxSpellLevel: 1 },
  wizard: { knownCantrips: 3, preparedSpells: 4, maxSpellLevel: 1 },
};

const SIMPLE_WEAPON_IDS = new Set(["dagger", "handaxe", "quarterstaff", "shortbow"]);
const MARTIAL_WEAPON_IDS = new Set([
  "battleaxe",
  "greatsword",
  "longbow",
  "longsword",
  "rapier",
  "scimitar",
  "shortsword",
  "warhammer",
]);

export function createCharacterChoicePools(draft) {
  return {
    spells: createSpellChoicePools(draft),
    gear: createGearChoicePools(draft),
  };
}

export function createSpellChoicePools(draft) {
  const classRecord = findClassByIdOrName(draft.identity?.classId);
  if (!classRecord?.spellcasting) return { required: false, pools: [] };

  const level = draft.identity?.level || 1;
  const startsAtLevel = classRecord.spellcasting.startsAtLevel || 1;
  if (level < startsAtLevel) return { required: false, pools: [] };

  const config = LEVEL_ONE_SPELL_CHOICES[classRecord.id] || null;
  if (!config) return { required: false, pools: [], warnings: [`missing_spell_choice_table:${classRecord.id}`] };

  const className = classRecord.name;
  const classSpells = listSpellsByClass(className)
    .filter((spell) => isAvailableAtLevel(spell, level))
    .sort(byLevelThenName);

  const pools = [];
  if (config.knownCantrips > 0) {
    pools.push(spellPool({
      id: "known_cantrips",
      label: "Known cantrips",
      path: "spells.knownSpellIds",
      count: config.knownCantrips,
      mode: "known",
      options: classSpells.filter((spell) => spell.level === 0),
      selected: draft.spells?.knownSpellIds || [],
    }));
  }

  const leveledOptions = classSpells.filter((spell) => spell.level > 0 && spell.level <= config.maxSpellLevel);
  if (config.knownSpells > 0) {
    pools.push(spellPool({
      id: "known_spells",
      label: "Known spells",
      path: "spells.knownSpellIds",
      count: config.knownSpells,
      mode: "known",
      options: leveledOptions,
      selected: draft.spells?.knownSpellIds || [],
    }));
  }
  if (config.preparedSpells > 0) {
    pools.push(spellPool({
      id: "prepared_spells",
      label: "Prepared spells",
      path: "spells.preparedSpellIds",
      count: config.preparedSpells,
      mode: "prepared",
      options: leveledOptions,
      selected: draft.spells?.preparedSpellIds || [],
    }));
  }

  return {
    required: pools.length > 0,
    classId: classRecord.id,
    className: classRecord.name,
    ability: normalizeAbility(classRecord.spellcasting.ability),
    preparation: classRecord.spellcasting.preparation || null,
    pools,
  };
}

export function createGearChoicePools(draft) {
  const classRecord = findClassByIdOrName(draft.identity?.classId);
  if (!classRecord) return { required: true, pools: [] };

  const proficiencies = {
    armor: classRecord.armor || [],
    weapons: classRecord.weapons || [],
  };
  const weaponOptions = weapons.filter((weapon) => isMundane(weapon) && isWeaponAllowed(weapon, proficiencies.weapons));
  const armorOptions = armor.filter((item) => isMundane(item) && item.type !== "shield" && isArmorAllowed(item, proficiencies.armor));
  const shieldOptions = armor.filter((item) => isMundane(item) && item.type === "shield" && allowsShield(proficiencies.armor));

  return {
    required: true,
    classId: classRecord.id,
    pools: [
      gearPool({
        id: "weapons",
        label: "Weapons",
        path: "gear.weaponIds",
        count: { min: 1, max: 2 },
        options: weaponOptions,
        selected: draft.gear?.weaponIds || [],
      }),
      gearPool({
        id: "armor",
        label: "Armor",
        path: "gear.armorId",
        count: { min: 0, max: 1 },
        options: armorOptions,
        selected: draft.gear?.armorId ? [draft.gear.armorId] : [],
      }),
      gearPool({
        id: "shield",
        label: "Shield",
        path: "gear.shieldId",
        count: { min: 0, max: 1 },
        options: shieldOptions,
        selected: draft.gear?.shieldId ? [draft.gear.shieldId] : [],
      }),
    ],
  };
}

function spellPool({ id, label, path, count, mode, options, selected }) {
  const selectedInPool = selected.filter((spellId) => options.some((spell) => spell.id === spellId));
  return {
    id,
    label,
    path,
    count,
    mode,
    selected: selectedInPool,
    missing: Math.max(0, count - selectedInPool.length),
    options: options.map(spellOption),
  };
}

function gearPool({ id, label, path, count, options, selected }) {
  const selectedInPool = selected.filter((itemId) => options.some((item) => item.id === itemId));
  return {
    id,
    label,
    path,
    count,
    selected: selectedInPool,
    missing: Math.max(0, count.min - selectedInPool.length),
    options: options.map(itemOption),
  };
}

function spellOption(spell) {
  return {
    id: spell.id,
    name: spell.name,
    level: spell.level,
    school: spell.school,
    concentration: spell.concentration === true,
    ritual: spell.ritual === true,
    casting: structuredClone(spell.casting || {}),
    text: spell.text || "",
  };
}

function itemOption(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    damage: item.damage || null,
    ac: item.ac || null,
    properties: [...(item.properties || [])],
    description: item.description || "",
  };
}

function isAvailableAtLevel(spell, level) {
  if (spell.hiddenUntilUnlocked || spell.featureGate) return false;
  return !Number.isFinite(spell.minCasterLevel) || spell.minCasterLevel <= level;
}

function byLevelThenName(a, b) {
  if (a.level !== b.level) return a.level - b.level;
  return a.name.localeCompare(b.name);
}

function isMundane(item) {
  if (item.magical === true) return false;
  if (item.type === "shield") return true;
  return !item.modifiers;
}

function isWeaponAllowed(weapon, proficiencyNames) {
  const names = proficiencyNames.map(normalizeName);
  if (names.includes("simple weapons") && SIMPLE_WEAPON_IDS.has(weapon.id)) return true;
  if (names.includes("martial weapons") && MARTIAL_WEAPON_IDS.has(weapon.id)) return true;
  return names.some((name) => name === normalizeName(weapon.name) || name === normalizeName(`${weapon.name}s`));
}

function isArmorAllowed(item, proficiencyNames) {
  const names = proficiencyNames.map(normalizeName);
  if (names.includes("all armor")) return ["light", "medium", "heavy"].includes(item.type);
  return names.includes(`${item.type} armor`);
}

function allowsShield(proficiencyNames) {
  return proficiencyNames.map(normalizeName).includes("shields");
}

function normalizeAbility(ability) {
  return String(ability || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}
