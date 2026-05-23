import { armor } from "../data/armor.js";
import { BACKGROUND_LIST } from "../data/backgrounds.js";
import { findClassByIdOrName } from "../data/classes.js";
import { getFeatById, listFeats } from "../data/feats.js";
import { SPECIES_LIST } from "../data/species.js";
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
    weaponMastery: createWeaponMasteryChoicePools(draft),
    feats: createFeatChoicePools(draft),
  };
}

export function createWeaponMasteryChoicePools(draft) {
  const classRecord = findClassByIdOrName(draft.identity?.classId);
  if (!classRecord) return { required: false, pools: [] };
  const level = draft.identity?.level || 1;
  const masteryCount = classWeaponMasteryCount(classRecord, level);
  if (!masteryCount) return { required: false, pools: [] };

  const proficiencies = {
    weapons: classRecord.weapons || [],
  };
  const equipped = new Set(draft.gear?.weaponIds || []);
  const options = weapons
    .filter((weapon) => isMundane(weapon) && weapon.mastery && isWeaponAllowed(weapon, proficiencies.weapons))
    .sort((a, b) => equippedSort(equipped, a, b) || a.name.localeCompare(b.name));
  const selected = (draft.choices?.weaponMasteryIds || []).filter((weaponId) => options.some((weapon) => weapon.id === weaponId));
  return {
    required: true,
    classId: classRecord.id,
    pools: [gearPool({
      id: "weapon_mastery",
      label: "Weapon Masteries",
      path: "choices.weaponMasteryIds",
      count: { min: masteryCount, max: masteryCount },
      options,
      selected,
    })],
  };
}

export function createFeatChoicePools(draft) {
  const classRecord = findClassByIdOrName(draft.identity?.classId);
  if (!classRecord) return { required: false, pools: [] };
  const level = draft.identity?.level || 1;
  const options = listFeats()
    .filter((feat) => feat.type === "general")
    .filter((feat) => (feat.minLevel || 1) <= level)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(featOption);
  const pools = classAdvancementFeatPools(classRecord, level).map((pool) => ({
    ...pool,
    options,
    selected: selectedAdvancementFeat(draft, pool.id),
    missing: 0,
  }));
  return {
    required: false,
    classId: classRecord.id,
    pools,
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
  const granted = collectGrantedSpells(draft);

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
      granted,
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
      granted,
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
      granted,
    }));
  }

  return {
    required: pools.length > 0,
    classId: classRecord.id,
    className: classRecord.name,
    ability: normalizeAbility(classRecord.spellcasting.ability),
    preparation: classRecord.spellcasting.preparation || null,
    granted,
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

function spellPool({ id, label, path, count, mode, options, selected, granted }) {
  const optionIds = new Set(options.map((spell) => spell.id));
  const grantedIds = new Set([...granted.known, ...granted.prepared]);
  const selectedInPool = selected.filter((spellId) => optionIds.has(spellId) && !grantedIds.has(spellId));
  return {
    id,
    label,
    path,
    count,
    mode,
    selected: selectedInPool,
    grantedSpellIds: [...grantedIds].filter((spellId) => optionIds.has(spellId)),
    grantedSpellDetails: granted.details.filter((detail) => optionIds.has(detail.id)),
    missing: Math.max(0, count - selectedInPool.length),
    options: options.map(spellOption),
  };
}

function collectGrantedSpells(draft) {
  const granted = { known: [], prepared: [], details: [] };
  const level = draft.identity?.level || 1;
  collectSpeciesSpellGrants(draft, level, granted);
  collectBackgroundSpellGrants(draft, granted);
  collectSelectedFeatSpellGrants(draft, granted);
  return {
    known: uniqueIds(granted.known),
    prepared: uniqueIds(granted.prepared),
    details: uniqueGrantDetails(granted.details),
  };
}

function collectSpeciesSpellGrants(draft, level, granted) {
  const species = SPECIES_LIST.find((item) => item.id === draft.identity?.speciesId);
  if (!species) return;
  collectFeatureSpellGrants(species.features || [], level, granted, species.name);
  const lineage = species.lineages?.[draft.identity?.lineageId];
  collectFeatureSpellGrants(lineage?.features || [], level, granted, lineage?.name || species.name);
}

function collectFeatureSpellGrants(features, level, granted, sourceName) {
  for (const feature of features || []) {
    if ((feature.minLevel || 1) > level) continue;
    for (const spell of feature.effects?.spells || []) {
      addGrantedSpell(granted, spell.id, spell.mode, feature.name || sourceName || "Feature");
    }
  }
}

function collectBackgroundSpellGrants(draft, granted) {
  const background = BACKGROUND_LIST.find((item) => item.id === draft.identity?.backgroundId);
  collectFeatSpellGrants(background?.originFeat, draft, granted);
}

function collectSelectedFeatSpellGrants(draft, granted) {
  const selectedFeatIds = Object.values(draft.choices?.advancementChoices || {})
    .map((choice) => choice?.featId)
    .filter(Boolean);
  const speciesFeatChoiceIds = Object.values(draft.choices?.speciesChoices || {})
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => getFeatById(value));
  for (const featId of [...selectedFeatIds, ...speciesFeatChoiceIds]) {
    collectFeatSpellGrants(featId, draft, granted);
  }
}

function collectFeatSpellGrants(featId, draft, granted) {
  const feat = getFeatById(featId);
  if (!feat) return;
  for (const grant of feat.effects?.spellGrants || []) {
    addGrantedSpell(granted, grant.spellId, grant.mode, feat.name);
  }
  const choices = draft.choices?.featChoices?.[feat.id] || {};
  for (const choice of feat.choices || []) {
    if (!["spell", "spell_list"].includes(choice.kind)) continue;
    const selected = choices[choice.id];
    for (const spellId of Array.isArray(selected) ? selected : [selected]) {
      addGrantedSpell(granted, spellId, choice.mode, feat.name);
    }
  }
}

function addGrantedSpell(granted, spellId, mode = "known", source = "Feature") {
  if (!spellId) return;
  const bucket = mode === "prepared" ? "prepared" : "known";
  granted[bucket].push(spellId);
  granted.details.push({ id: spellId, mode: bucket, source });
}

function uniqueIds(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueGrantDetails(details) {
  const seen = new Set();
  return details.filter((detail) => {
    const key = `${detail.id}:${detail.mode}:${detail.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    mastery: item.mastery || null,
    description: item.description || "",
  };
}

function featOption(feat) {
  return {
    id: feat.id,
    name: feat.name,
    type: feat.type,
    minLevel: feat.minLevel || 1,
    tags: [...(feat.tags || [])],
    description: feat.description || "",
  };
}

function classAdvancementFeatPools(classRecord, level) {
  const pools = [];
  for (const [levelText, features] of Object.entries(classRecord.features || {})) {
    const featureLevel = Number(levelText);
    if (!Number.isInteger(featureLevel) || featureLevel > level) continue;
    for (const feature of features || []) {
      if (!(feature.effects?.advancement || []).some((item) => item.type === "ability_score_improvement" && (item.choices || []).includes("feat"))) continue;
      pools.push({
        id: advancementChoiceId(classRecord.id, feature, featureLevel),
        label: `Level ${featureLevel} feat`,
        path: `choices.advancementChoices.${advancementChoiceId(classRecord.id, feature, featureLevel)}.featId`,
        count: { min: 0, max: 1 },
        level: featureLevel,
      });
    }
  }
  return pools.sort((a, b) => a.level - b.level);
}

function classWeaponMasteryCount(classRecord, level) {
  let count = 0;
  for (const [levelText, features] of Object.entries(classRecord.features || {})) {
    const featureLevel = Number(levelText);
    if (!Number.isInteger(featureLevel) || featureLevel > level) continue;
    for (const feature of features || []) {
      for (const mastery of feature.effects?.weaponMastery || []) {
        count = Math.max(count, mastery.count || 0);
      }
    }
  }
  return count;
}

function equippedSort(equipped, a, b) {
  return Number(equipped.has(b.id)) - Number(equipped.has(a.id));
}

function selectedAdvancementFeat(draft, poolId) {
  const featId = draft.choices?.advancementChoices?.[poolId]?.featId;
  return featId ? [featId] : [];
}

function advancementChoiceId(classId, feature, level) {
  return `class:${classId}:level_${level}:${slug(feature.name || "advancement")}`;
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
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
