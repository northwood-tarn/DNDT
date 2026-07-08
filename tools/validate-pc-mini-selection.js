#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASSES } from "../app/data/classes.js";
import { SPECIES } from "../app/data/species.js";
import {
  MINI_BASE_COMBINATIONS,
  MINI_BASE_METALS,
  UNIQUE_MINI_BASES,
} from "../app/mini_preview/base_asset_manifest.js";
import {
  PC_MINI_ANCHOR_SCHEMA,
  PC_MINI_BODY_TYPES,
  PC_MINI_CLOAKS,
  PC_MINI_FACIAL_HAIR,
  PC_MINI_HAIR,
  PC_MINI_HEADS,
  PC_MINI_LANTERNA_ATTACHMENTS,
  PC_MINI_LINEAGE_COLORED_SPECIES,
  PC_MINI_OUTFITS,
  PC_MINI_POSTURES,
  PC_MINI_SELECTION_RULES,
  PC_MINI_SELECTION_STAGES,
  PC_MINI_SKIN_TONES,
  PC_MINI_SPECIES_IDS,
  PC_MINI_SPECIES_SCALE,
  PC_MINI_DROPPED_WEAPON_DISPLAY_CELLS,
  PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
  PC_MINI_WEAPON_SLOTS,
} from "../app/mini_preview/pc_mini_selection_rules.js";

const __filename = fileURLToPath(import.meta.url);

function ids(items) {
  return new Set(items.map((item) => item.id));
}

function hasPoint(value) {
  return value && typeof value === "object" && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function pushUnknown(errors, pathName, value, allowed) {
  if (!allowed.has(value)) errors.push(`${pathName}: unknown "${value}"`);
}

function validateOptionalAssetId(errors, registries, registryName, pathName, value) {
  if (!value) return;
  const registry = registries?.[registryName];
  if (!registry) return;
  const allowed = new Set(Array.isArray(registry) ? registry : Object.keys(registry));
  if (!allowed.has(value)) errors.push(`${pathName}: unknown ${registryName} asset "${value}"`);
}

export function validatePcMiniSelection(selection, registries = {}) {
  const errors = [];
  const bodyTypeIds = ids(PC_MINI_BODY_TYPES);
  const skinToneIds = ids(PC_MINI_SKIN_TONES);
  const headIds = ids(PC_MINI_HEADS);
  const hairIds = ids(PC_MINI_HAIR);
  const facialHairIds = ids(PC_MINI_FACIAL_HAIR);
  const postureIds = ids(PC_MINI_POSTURES);
  const outfitIds = ids(PC_MINI_OUTFITS);
  const cloakIds = ids(PC_MINI_CLOAKS);
  const weaponSlotIds = ids(PC_MINI_WEAPON_SLOTS);
  const lanternaIds = ids(PC_MINI_LANTERNA_ATTACHMENTS);
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
    return ["selection must be an object"];
  }

  pushUnknown(errors, "classId", selection.classId, new Set(Object.keys(CLASSES)));
  pushUnknown(errors, "speciesId", selection.speciesId, new Set(PC_MINI_SPECIES_IDS));
  pushUnknown(errors, "bodyTypeId", selection.bodyTypeId, bodyTypeIds);
  pushUnknown(errors, "postureId", selection.postureId, postureIds);
  pushUnknown(errors, "headId", selection.headId, headIds);
  if (selection.speciesId === "dragonborn") {
    if (selection.hairId) errors.push("hairId: dragonborn do not use hair choices");
  } else {
    pushUnknown(errors, "hairId", selection.hairId, hairIds);
  }
  pushUnknown(errors, "facialHairId", selection.facialHairId ?? "none", facialHairIds);
  pushUnknown(errors, "outfitId", selection.outfitId, outfitIds);
  pushUnknown(errors, "cloakId", selection.cloakId, cloakIds);
  pushUnknown(errors, "weaponSlotId", selection.weaponSlotId, weaponSlotIds);
  pushUnknown(errors, "lanternaAttachmentId", selection.lanternaAttachmentId, lanternaIds);
  validateWeaponDisplaySelection(errors, selection);

  const species = SPECIES[selection.speciesId];
  const lineageIds = new Set(Object.keys(species?.lineages || {}));
  if (lineageIds.size) {
    if (!selection.lineageId) {
      errors.push(`lineageId: required for species "${selection.speciesId}"`);
    } else if (!lineageIds.has(selection.lineageId)) {
      errors.push(`lineageId: unknown "${selection.lineageId}" for species "${selection.speciesId}"`);
    }
  } else if (selection.lineageId) {
    errors.push(`lineageId: species "${selection.speciesId}" does not use lineages`);
  }

  if (PC_MINI_LINEAGE_COLORED_SPECIES.has(selection.speciesId)) {
    if (selection.skinToneId) {
      errors.push(`skinToneId: ${selection.speciesId} colour comes from lineage, not skin-tone selector`);
    }
  } else {
    pushUnknown(errors, "skinToneId", selection.skinToneId, skinToneIds);
    const tone = PC_MINI_SKIN_TONES.find((item) => item.id === selection.skinToneId);
    if (tone?.speciesOnly && !tone.speciesOnly.includes(selection.speciesId)) {
      errors.push(`skinToneId: "${selection.skinToneId}" is only valid for ${tone.speciesOnly.join(", ")}`);
    }
  }
  validateHeadHairSelection(errors, selection);

  if (selection.speciesFeatureIds !== undefined && !Array.isArray(selection.speciesFeatureIds)) {
    errors.push("speciesFeatureIds: must be an array when present");
  }
  if (selection.speciesId === "tiefling") {
    for (const featureId of selection.speciesFeatureIds || []) {
      if (!["horns_tail"].includes(featureId)) errors.push(`speciesFeatureIds: unknown tiefling feature "${featureId}"`);
    }
  }
  if (selection.speciesId === "aasimar") {
    for (const featureId of selection.speciesFeatureIds || []) {
      if (["wings", "halo"].includes(featureId)) errors.push(`speciesFeatureIds: aasimar must not use "${featureId}"`);
    }
  }

  validateOptionalAssetId(errors, registries, "weapons", "weaponAssetId", selection.weaponAssetId);

  if (selection.weaponAssetId && /wand/i.test(selection.weaponAssetId)) {
    errors.push("weaponAssetId: wands are forbidden");
  }

  validateBaseSelection(errors, selection.base);
  validateAnchors(errors, selection.anchors);

  return errors;
}

function validateHeadHairSelection(errors, selection) {
  const head = PC_MINI_HEADS.find((item) => item.id === selection.headId);
  if (head?.compatibleSpecies && !head.compatibleSpecies.includes(selection.speciesId)) {
    errors.push(`headId: "${selection.headId}" is not compatible with species "${selection.speciesId}"`);
  }
  const hair = PC_MINI_HAIR.find((item) => item.id === selection.hairId);
  if (hair?.incompatibleSpecies?.includes(selection.speciesId)) {
    errors.push(`hairId: "${selection.hairId}" is not compatible with species "${selection.speciesId}"`);
  }
  const facialHair = PC_MINI_FACIAL_HAIR.find((item) => item.id === (selection.facialHairId ?? "none"));
  if (facialHair?.incompatibleSpecies?.includes(selection.speciesId)) {
    errors.push(`facialHairId: "${facialHair.id}" is not compatible with species "${selection.speciesId}"`);
  }
  if (selection.speciesId === "aasimar" && (selection.facialHairId ?? "none") !== "none") {
    errors.push("facialHairId: aasimar do not use facial hair choices");
  }
  if (["gnome", "halfling"].includes(selection.speciesId)) {
    const scale = head?.scaleBySpecies?.[selection.speciesId];
    if (scale !== 0.85) errors.push(`headId: ${selection.speciesId} humanlike heads must be scaled to 85%`);
  }
}

function validateWeaponDisplaySelection(errors, selection) {
  if (!selection.weaponDisplayId) return;
  const displays = PC_MINI_WEAPON_DISPLAYS_BY_CLASS[selection.classId] || [];
  const display = displays.find((item) => item.id === selection.weaponDisplayId);
  if (!display) {
    errors.push(`weaponDisplayId: unknown "${selection.weaponDisplayId}" for class "${selection.classId}"`);
    return;
  }
  if (selection.weaponSlotId && display.slot !== selection.weaponSlotId) {
    errors.push(`weaponDisplayId: "${selection.weaponDisplayId}" uses slot "${display.slot}", not "${selection.weaponSlotId}"`);
  }
}

function validateBaseSelection(errors, base) {
  const baseMetalIds = ids(MINI_BASE_METALS);
  const uniqueBaseIds = ids(UNIQUE_MINI_BASES);
  const comboIds = ids(MINI_BASE_COMBINATIONS);

  if (!base || typeof base !== "object" || Array.isArray(base)) {
    errors.push("base: must be an object");
    return;
  }
  if (typeof base.useUniqueBase !== "boolean") errors.push("base.useUniqueBase: must be boolean");
  if (base.useUniqueBase) {
    if (!base.uniqueBaseId) errors.push("base.uniqueBaseId: required when useUniqueBase is true");
    else pushUnknown(errors, "base.uniqueBaseId", base.uniqueBaseId, uniqueBaseIds);
    return;
  }
  pushUnknown(errors, "base.disc", base.disc, baseMetalIds);
  pushUnknown(errors, "base.rim", base.rim, baseMetalIds);
  if (base.disc && base.rim && !comboIds.has(`disc-${base.disc}_rim-${base.rim}`)) {
    errors.push(`base: missing authored combination for disc "${base.disc}" and rim "${base.rim}"`);
  }
}

export function validateAnchors(errors, anchors, { requireAll = false } = {}) {
  if (anchors === undefined) {
    if (requireAll) errors.push("anchors: required");
    return;
  }
  if (!anchors || typeof anchors !== "object" || Array.isArray(anchors)) {
    errors.push("anchors: must be an object");
    return;
  }
  for (const key of PC_MINI_ANCHOR_SCHEMA.required) {
    if (anchors[key] === undefined) {
      if (requireAll) errors.push(`anchors.${key}: required`);
      continue;
    }
    if (!hasPoint(anchors[key])) errors.push(`anchors.${key}: must be { x: number, y: number }`);
  }
  for (const key of Object.keys(anchors)) {
    if (![...PC_MINI_ANCHOR_SCHEMA.required, ...PC_MINI_ANCHOR_SCHEMA.optional].includes(key)) {
      errors.push(`anchors.${key}: unknown anchor`);
    }
  }
}

export async function validatePcMiniRules() {
  const errors = [];
  const classIds = Object.keys(CLASSES);
  const speciesIds = PC_MINI_SPECIES_IDS;

  if (classIds.length !== 6) errors.push(`classes: expected 6 canonical classes, found ${classIds.length}`);
  for (const expected of ["fighter", "rogue", "wizard", "warlock", "cleric", "paladin"]) {
    if (!classIds.includes(expected)) errors.push(`classes: missing "${expected}"`);
  }
  for (const speciesId of speciesIds) {
    if (!SPECIES[speciesId]) errors.push(`species: unknown supported PC mini species "${speciesId}"`);
    if (!PC_MINI_SPECIES_SCALE[speciesId]) errors.push(`speciesScale: missing "${speciesId}"`);
  }
  for (const speciesId of Object.keys(PC_MINI_SPECIES_SCALE)) {
    if (!SPECIES[speciesId]) errors.push(`speciesScale: unknown species "${speciesId}"`);
    if (!PC_MINI_SPECIES_IDS.includes(speciesId)) errors.push(`speciesScale: unsupported PC mini species "${speciesId}"`);
  }
  if (!PC_MINI_SELECTION_STAGES.includes("anchors")) errors.push("validationStages: must include anchors");
  if (!PC_MINI_SELECTION_STAGES.includes("composition")) errors.push("validationStages: must include composition");
  if (PC_MINI_POSTURES.length !== 3) errors.push(`postures: expected 3, found ${PC_MINI_POSTURES.length}`);
  if (PC_MINI_OUTFITS.length !== 2) errors.push(`outfits: expected 2, found ${PC_MINI_OUTFITS.length}`);
  if (PC_MINI_CLOAKS.length !== 3) errors.push(`cloaks: expected none/cloak/hood_up`);
  if (PC_MINI_SKIN_TONES.length !== 4) errors.push(`skinTones: expected 4, found ${PC_MINI_SKIN_TONES.length}`);
  if (!PC_MINI_SKIN_TONES.some((item) => item.id === "aasimar_pale" && item.speciesOnly?.includes("aasimar"))) {
    errors.push("skinTones: aasimar_pale must exist and be aasimar-only");
  }
  for (const head of PC_MINI_HEADS) {
    if (head.compatibleSpecies?.includes("dragonborn") && head.id !== "dragonborn_head") {
      errors.push(`heads.${head.id}: only dragonborn_head may support dragonborn`);
    }
    for (const speciesId of ["gnome", "halfling"]) {
      if (head.compatibleSpecies?.includes(speciesId) && head.scaleBySpecies?.[speciesId] !== 0.85) {
        errors.push(`heads.${head.id}: ${speciesId} head scale must be 0.85`);
      }
    }
  }
  for (const hair of PC_MINI_HAIR) {
    if (!hair.incompatibleSpecies?.includes("dragonborn")) {
      errors.push(`hair.${hair.id}: dragonborn must be incompatible`);
    }
  }
  for (const expected of ["none", "full_beard", "moustache"]) {
    if (!PC_MINI_FACIAL_HAIR.some((item) => item.id === expected)) errors.push(`facialHair: missing "${expected}"`);
  }
  for (const facialHair of PC_MINI_FACIAL_HAIR.filter((item) => item.id !== "none")) {
    if (!facialHair.incompatibleSpecies?.includes("aasimar")) {
      errors.push(`facialHair.${facialHair.id}: aasimar must be incompatible`);
    }
  }
  if (PC_MINI_LANTERNA_ATTACHMENTS.length !== 3) errors.push(`lanternaAttachments: expected 3`);
  for (const classId of classIds) {
    const displays = PC_MINI_WEAPON_DISPLAYS_BY_CLASS[classId] || [];
    if (displays.length !== 4) errors.push(`weaponDisplaysByClass.${classId}: expected 4 displays, found ${displays.length}`);
    const idsSeen = new Set();
    for (const display of displays) {
      if (idsSeen.has(display.id)) errors.push(`weaponDisplaysByClass.${classId}: duplicate display "${display.id}"`);
      idsSeen.add(display.id);
      if (!PC_MINI_WEAPON_SLOTS.some((slot) => slot.id === display.slot)) {
        errors.push(`weaponDisplaysByClass.${classId}.${display.id}: unknown slot "${display.slot}"`);
      }
      if ((PC_MINI_DROPPED_WEAPON_DISPLAY_CELLS[classId] || []).includes(display.sourceCell)) {
        errors.push(`weaponDisplaysByClass.${classId}.${display.id}: uses dropped source cell ${display.sourceCell}`);
      }
      if (/wand/i.test(`${display.id} ${display.label}`)) {
        errors.push(`weaponDisplaysByClass.${classId}.${display.id}: wands are forbidden`);
      }
    }
  }
  for (const classId of Object.keys(PC_MINI_WEAPON_DISPLAYS_BY_CLASS)) {
    if (!CLASSES[classId]) errors.push(`weaponDisplaysByClass: unknown class "${classId}"`);
  }
  if (MINI_BASE_COMBINATIONS.length !== MINI_BASE_METALS.length * MINI_BASE_METALS.length) {
    errors.push("baseCombinations: must contain every disc/rim permutation");
  }
  for (const combo of MINI_BASE_COMBINATIONS) {
    if (!fs.existsSync(path.resolve("app/mini_preview", combo.asset))) {
      errors.push(`baseCombinations.${combo.id}: missing asset ${combo.asset}`);
    }
  }
  for (const unique of UNIQUE_MINI_BASES) {
    if (!fs.existsSync(path.resolve("app/mini_preview", unique.asset))) {
      errors.push(`uniqueBases.${unique.id}: missing asset ${unique.asset}`);
    }
  }
  for (const key of PC_MINI_ANCHOR_SCHEMA.required) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) errors.push(`anchorSchema.required: "${key}" must be camelCase`);
  }
  if (!PC_MINI_SELECTION_RULES.validationStages.includes("base")) errors.push("selectionRules.validationStages: must include base");
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const errors = await validatePcMiniRules();
  if (process.argv[2]) {
    const selection = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    errors.push(...validatePcMiniSelection(selection));
  }
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("[pc-mini-selection] Validation OK");
  }
}
