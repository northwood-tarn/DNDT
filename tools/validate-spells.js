#!/usr/bin/env node
// Strict validator for the active spell data module.
// This guards the resolver-facing contract; it intentionally ignores spells_prev.js.

import path from "node:path";
import url from "node:url";

const DEFAULT_SPELLS_PATH = "app/data/spells.js";

const VALID_SCHOOLS = new Set([
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation"
]);

const VALID_CASTING_UNITS = new Set(["action", "bonus_action", "reaction", "minute", "hour"]);
const VALID_DURATION_TYPES = new Set(["instant", "timed", "until_dispelled", "special"]);
const VALID_RANGE_TYPES = new Set(["self", "touch", "distance", "sight", "special"]);
const VALID_TARGET_TYPES = new Set(["self", "creature", "object", "point", "area"]);
const VALID_AREA_SHAPES = new Set(["none", "sphere", "cube", "line", "cone", "cylinder", "square", "donut", "special"]);
const VALID_SCALING_TYPES = new Set(["none", "slot", "cantrip"]);
const VALID_ATTACK_TYPES = new Set(["melee_spell", "ranged_spell"]);
const VALID_DC_FROM = new Set(["spellSaveDC"]);
const VALID_DAMAGE_KEYS = new Set(["dice", "diceByTier", "type", "choices", "addMod", "perDart"]);
const VALID_ATTACK_KEYS = new Set(["type", "ability"]);
const VALID_SAVE_KEYS = new Set(["ability", "dcFrom", "dcBonusFromLevel", "onSave"]);

const REQUIRED_TOP_LEVEL = [
  "id",
  "name",
  "level",
  "school",
  "casting",
  "components",
  "concentration",
  "ritual",
  "duration",
  "range",
  "target",
  "area",
  "scaling",
  "classes",
  "source",
  "tags",
  "text",
  "dialogueRelated",
  "hooks"
];

const REQUIRED_AREA_KEYS = ["shape", "size", "length", "width", "height", "unit"];

function fail(errors, id, message) {
  errors.push(`${id}: ${message}`);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateNumber(errors, id, pathName, value) {
  if (typeof value !== "number" || Number.isNaN(value)) fail(errors, id, `${pathName} must be a number`);
}

function validateBoolean(errors, id, pathName, value) {
  if (typeof value !== "boolean") fail(errors, id, `${pathName} must be boolean`);
}

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || value.length === 0) fail(errors, id, `${pathName} must be a non-empty string`);
}

function validateArray(errors, id, pathName, value) {
  if (!Array.isArray(value)) fail(errors, id, `${pathName} must be an array`);
}

function validateSave(errors, id, save) {
  if (!isPlainObject(save)) return fail(errors, id, "hooks.save must be an object");
  for (const key of Object.keys(save)) {
    if (!VALID_SAVE_KEYS.has(key)) fail(errors, id, `hooks.save has unsupported key "${key}"`);
  }
  validateString(errors, id, "hooks.save.ability", save.ability);
  if (!VALID_DC_FROM.has(save.dcFrom)) fail(errors, id, `hooks.save.dcFrom must be spellSaveDC`);
  validateString(errors, id, "hooks.save.onSave", save.onSave);
}

function validateDamage(errors, id, damage, pathName = "hooks.damage") {
  if (!isPlainObject(damage)) return fail(errors, id, `${pathName} must be an object`);
  for (const key of Object.keys(damage)) {
    if (!VALID_DAMAGE_KEYS.has(key)) fail(errors, id, `${pathName} has unsupported key "${key}"`);
  }
  if (!("dice" in damage) && !("diceByTier" in damage)) {
    fail(errors, id, `${pathName} must include dice or diceByTier`);
  }
  if ("dice" in damage) validateString(errors, id, `${pathName}.dice`, damage.dice);
  if ("diceByTier" in damage && !Array.isArray(damage.diceByTier)) {
    fail(errors, id, `${pathName}.diceByTier must be an array`);
  }
  validateString(errors, id, `${pathName}.type`, damage.type);
  validateBoolean(errors, id, `${pathName}.addMod`, damage.addMod);
  validateBoolean(errors, id, `${pathName}.perDart`, damage.perDart);
  if ("choices" in damage && !Array.isArray(damage.choices)) {
    fail(errors, id, `${pathName}.choices must be an array`);
  }
}

function validateAttack(errors, id, attack) {
  if (!isPlainObject(attack)) return fail(errors, id, "hooks.attack must be an object");
  const keys = Object.keys(attack).sort();
  if (keys.join(",") !== "ability,type") {
    fail(errors, id, `hooks.attack must contain exactly ability,type`);
  }
  if (!VALID_ATTACK_TYPES.has(attack.type)) fail(errors, id, `hooks.attack.type is unsupported: ${attack.type}`);
  validateString(errors, id, "hooks.attack.ability", attack.ability);
}

function walkObjects(value, visit) {
  if (!value || typeof value !== "object") return;
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visit);
  } else {
    for (const item of Object.values(value)) walkObjects(item, visit);
  }
}

function validateNestedDamage(errors, id, hooks) {
  walkObjects(hooks, node => {
    if (!isPlainObject(node.damage)) return;
    if (!("dice" in node.damage) && !("diceByTier" in node.damage)) return;
    if (node === hooks) return;
    validateDamage(errors, id, node.damage, "nested damage");
  });
}

export async function validateSpells({ spellsPath = DEFAULT_SPELLS_PATH } = {}) {
  const modulePath = path.resolve(spellsPath);
  const mod = await import(url.pathToFileURL(modulePath).href);
  const spells = mod.SPELLS;
  const errors = [];

  if (!isPlainObject(spells)) {
    return ["SPELLS export must be an object"];
  }

  for (const [key, spell] of Object.entries(spells)) {
    const id = key;
    if (!isPlainObject(spell)) {
      fail(errors, id, "spell record must be an object");
      continue;
    }

    for (const prop of REQUIRED_TOP_LEVEL) {
      if (!(prop in spell)) fail(errors, id, `missing required property "${prop}"`);
    }

    if (spell.availability) fail(errors, id, "use top-level classes, not availability");
    if (spell.id !== id) fail(errors, id, `id must match key (${spell.id})`);
    validateString(errors, id, "name", spell.name);
    validateNumber(errors, id, "level", spell.level);
    if (!VALID_SCHOOLS.has(spell.school)) fail(errors, id, `invalid school "${spell.school}"`);
    validateBoolean(errors, id, "concentration", spell.concentration);
    validateBoolean(errors, id, "ritual", spell.ritual);
    validateArray(errors, id, "classes", spell.classes);
    validateArray(errors, id, "tags", spell.tags);
    validateString(errors, id, "source", spell.source);
    validateString(errors, id, "text", spell.text);
    validateBoolean(errors, id, "dialogueRelated", spell.dialogueRelated);
    if ("active" in spell) validateBoolean(errors, id, "active", spell.active);
    if ("inactiveReason" in spell) validateString(errors, id, "inactiveReason", spell.inactiveReason);
    if (spell.active === false && !spell.inactiveReason) fail(errors, id, "inactive spells must include inactiveReason");

    if (Array.isArray(spell.classes)) {
      for (const cls of spell.classes) validateString(errors, id, "classes[]", cls);
    }

    if (!isPlainObject(spell.casting)) fail(errors, id, "casting must be an object");
    else {
      validateNumber(errors, id, "casting.time", spell.casting.time);
      if (!VALID_CASTING_UNITS.has(spell.casting.unit)) fail(errors, id, `invalid casting.unit "${spell.casting.unit}"`);
      if (!("reactionTrigger" in spell.casting)) fail(errors, id, "casting.reactionTrigger missing");
    }

    if (!isPlainObject(spell.components)) fail(errors, id, "components must be an object");
    else {
      for (const flag of ["v", "s", "m", "consume"]) validateBoolean(errors, id, `components.${flag}`, spell.components[flag]);
      if (!("material" in spell.components)) fail(errors, id, "components.material missing");
      validateNumber(errors, id, "components.costGp", spell.components.costGp);
    }

    if (!isPlainObject(spell.duration)) fail(errors, id, "duration must be an object");
    else {
      if (!VALID_DURATION_TYPES.has(spell.duration.type)) fail(errors, id, `invalid duration.type "${spell.duration.type}"`);
      validateNumber(errors, id, "duration.value", spell.duration.value);
      validateString(errors, id, "duration.unit", spell.duration.unit);
      if (!("special" in spell.duration)) fail(errors, id, "duration.special missing");
    }

    if (!isPlainObject(spell.range)) fail(errors, id, "range must be an object");
    else {
      if (!VALID_RANGE_TYPES.has(spell.range.type)) fail(errors, id, `invalid range.type "${spell.range.type}"`);
      validateNumber(errors, id, "range.distance", spell.range.distance);
      validateString(errors, id, "range.unit", spell.range.unit);
      if (!("special" in spell.range)) fail(errors, id, "range.special missing");
    }

    if (!isPlainObject(spell.target)) fail(errors, id, "target must be an object");
    else {
      if (!VALID_TARGET_TYPES.has(spell.target.type)) fail(errors, id, `invalid target.type "${spell.target.type}"`);
      validateNumber(errors, id, "target.count", spell.target.count);
      validateBoolean(errors, id, "target.friendly", spell.target.friendly);
      validateBoolean(errors, id, "target.requiresSight", spell.target.requiresSight);
    }

    if (!isPlainObject(spell.area)) fail(errors, id, "area must be an object");
    else {
      for (const prop of REQUIRED_AREA_KEYS) {
        if (!(prop in spell.area)) fail(errors, id, `area.${prop} missing`);
      }
      if (!VALID_AREA_SHAPES.has(spell.area.shape)) fail(errors, id, `invalid area.shape "${spell.area.shape}"`);
      for (const prop of ["size", "length", "width", "height"]) validateNumber(errors, id, `area.${prop}`, spell.area[prop]);
      validateString(errors, id, "area.unit", spell.area.unit);
    }

    if (!isPlainObject(spell.scaling)) fail(errors, id, "scaling must be an object");
    else {
      if (!VALID_SCALING_TYPES.has(spell.scaling.type)) fail(errors, id, `invalid scaling.type "${spell.scaling.type}"`);
      if (!isPlainObject(spell.scaling.slot)) fail(errors, id, "scaling.slot must be an object");
      if (!isPlainObject(spell.scaling.cantrip)) fail(errors, id, "scaling.cantrip must be an object");
      else if (!Array.isArray(spell.scaling.cantrip.tiers)) fail(errors, id, "scaling.cantrip.tiers must be an array");
    }

    if (!isPlainObject(spell.hooks)) fail(errors, id, "hooks must be an object");
    else {
      for (const [hook, value] of Object.entries(spell.hooks)) {
        if (value === null) fail(errors, id, `hooks.${hook} must be omitted instead of null`);
      }
      if (spell.hooks.attack) validateAttack(errors, id, spell.hooks.attack);
      if (spell.hooks.save) validateSave(errors, id, spell.hooks.save);
      if (spell.hooks.damage) validateDamage(errors, id, spell.hooks.damage);
      if (spell.hooks.attack && !spell.hooks.damage) fail(errors, id, "attack spells must include hooks.damage");
      validateNestedDamage(errors, id, spell.hooks);

      const serialized = JSON.stringify(spell.hooks);
      if (serialized.includes("casterSpellDC")) fail(errors, id, "use spellSaveDC, not casterSpellDC");
      if (serialized.includes("\"kind\":\"spell\"")) fail(errors, id, "use hooks.attack.type, not kind");
    }
  }

  return errors;
}

async function cli() {
  const spellsPath = process.argv[2] || DEFAULT_SPELLS_PATH;
  const errors = await validateSpells({ spellsPath });
  if (errors.length) {
    console.error(`[spells] Validation failed with ${errors.length} error(s):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exitCode = 1;
  } else {
    console.log("[spells] Validation OK");
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  cli().catch(err => {
    console.error("[spells] Fatal error:", err.message);
    process.exit(2);
  });
}
