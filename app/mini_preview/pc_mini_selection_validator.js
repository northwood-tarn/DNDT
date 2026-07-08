import { CLASSES } from "../data/classes.js";
import { SPECIES } from "../data/species.js";
import {
  MINI_BASE_COMBINATIONS,
  MINI_BASE_METALS,
  UNIQUE_MINI_BASES,
} from "./base_asset_manifest.js";
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
  PC_MINI_SKIN_TONES,
  PC_MINI_SPECIES_IDS,
  PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
  PC_MINI_WEAPON_SLOTS,
} from "./pc_mini_selection_rules.js";

const ids = (items) => new Set(items.map((item) => item.id));

function hasPoint(value) {
  return value && typeof value === "object" && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function pushUnknown(errors, pathName, value, allowed) {
  if (!allowed.has(value)) errors.push(`${pathName}: unknown "${value}"`);
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

  validateLineage(errors, selection);
  validateSkinTone(errors, selection, skinToneIds);
  validateHeadHair(errors, selection);
  validateSpeciesFeatures(errors, selection);
  validateWeaponDisplay(errors, selection);
  validateOptionalAssetId(errors, registries, "weapons", "weaponAssetId", selection.weaponAssetId);
  validateBase(errors, selection.base);
  validateAnchors(errors, selection.anchors);

  if (selection.weaponAssetId && /wand/i.test(selection.weaponAssetId)) {
    errors.push("weaponAssetId: wands are forbidden");
  }

  return errors;
}

function validateLineage(errors, selection) {
  const species = SPECIES[selection.speciesId];
  const lineageIds = new Set(Object.keys(species?.lineages || {}));
  if (lineageIds.size) {
    if (!selection.lineageId) errors.push(`lineageId: required for species "${selection.speciesId}"`);
    else if (!lineageIds.has(selection.lineageId)) errors.push(`lineageId: unknown "${selection.lineageId}" for species "${selection.speciesId}"`);
  } else if (selection.lineageId) {
    errors.push(`lineageId: species "${selection.speciesId}" does not use lineages`);
  }
}

function validateSkinTone(errors, selection, skinToneIds) {
  if (PC_MINI_LINEAGE_COLORED_SPECIES.has(selection.speciesId)) {
    if (selection.skinToneId) errors.push(`skinToneId: ${selection.speciesId} colour comes from lineage, not skin-tone selector`);
    return;
  }
  pushUnknown(errors, "skinToneId", selection.skinToneId, skinToneIds);
  const tone = PC_MINI_SKIN_TONES.find((item) => item.id === selection.skinToneId);
  if (tone?.speciesOnly && !tone.speciesOnly.includes(selection.speciesId)) {
    errors.push(`skinToneId: "${selection.skinToneId}" is only valid for ${tone.speciesOnly.join(", ")}`);
  }
}

function validateHeadHair(errors, selection) {
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
  if (["gnome", "halfling"].includes(selection.speciesId) && head?.scaleBySpecies?.[selection.speciesId] !== 0.85) {
    errors.push(`headId: ${selection.speciesId} humanlike heads must be scaled to 85%`);
  }
}

function validateSpeciesFeatures(errors, selection) {
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
}

function validateWeaponDisplay(errors, selection) {
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

function validateOptionalAssetId(errors, registries, registryName, pathName, value) {
  if (!value) return;
  const registry = registries?.[registryName];
  if (!registry) return;
  const allowed = new Set(Array.isArray(registry) ? registry : Object.keys(registry));
  if (!allowed.has(value)) errors.push(`${pathName}: unknown ${registryName} asset "${value}"`);
}

function validateBase(errors, base) {
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

export default validatePcMiniSelection;
