#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPECIES } from "../app/data/species.js";
import {
  MINI_ASSET_STATUS,
  MINI_LAYER_KIND,
  PC_MINI_LAYER_REGISTRIES,
} from "../app/mini_preview/pc_mini_asset_registry.js";
import { DEFAULT_MINI_BASE_SELECTION, MINI_BASE_METALS } from "../app/mini_preview/base_asset_manifest.js";
import { resolvePcMiniLayerPlan } from "../app/mini_preview/pc_mini_compositor.js";
import {
  PC_MINI_ANCHOR_SCHEMA,
  PC_MINI_BODY_TYPES,
  PC_MINI_CLASS_IDS,
  PC_MINI_HEADS,
  PC_MINI_LANTERNA_ATTACHMENTS,
  PC_MINI_OUTFITS,
  PC_MINI_POSTURES,
  PC_MINI_SPECIES_IDS,
  PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
} from "../app/mini_preview/pc_mini_selection_rules.js";
import { readPng } from "./pc-mini-png.js";

const __filename = fileURLToPath(import.meta.url);

const EXPECTED_REGISTRIES = [
  "bases",
  "postures",
  "heads",
  "hair",
  "facialHair",
  "speciesFeatures",
  "outfits",
  "cloaks",
  "weapons",
  "lanterna",
];

const PERMUTATION_WARNING_FIELDS = [
  "classId",
  "speciesId",
  "bodyTypeId",
  "postureId",
  "outfitId",
  "headId",
  "hairId",
  "weaponDisplayId",
  "lanternaAttachmentId",
];

function hasPoint(value) {
  return value && typeof value === "object" && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function validateRecord(errors, registryName, record) {
  const id = record?.id || "<missing>";
  const pathName = `${registryName}.${id}`;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    errors.push(`${registryName}: record must be an object`);
    return;
  }
  if (typeof record.id !== "string" || !record.id.trim()) errors.push(`${pathName}: id is required`);
  if (typeof record.layer !== "string" || !record.layer.trim()) errors.push(`${pathName}: layer is required`);
  if (!Object.values(MINI_ASSET_STATUS).includes(record.status)) errors.push(`${pathName}: invalid status "${record.status}"`);
  if (record.status === MINI_ASSET_STATUS.PRODUCTION) {
    if (!record.asset) {
      errors.push(`${pathName}: production assets require asset`);
    } else {
      const assetPath = path.resolve("app/mini_preview", record.asset);
      if (!fs.existsSync(assetPath)) {
        errors.push(`${pathName}: missing asset ${record.asset}`);
      } else {
        validatePngAsset(errors, pathName, assetPath, record);
      }
    }
    if (!record.sourceKind || !record.provenance) {
      errors.push(`${pathName}: production assets require sourceKind and provenance`);
    }
    if (record.sourceKind === "code_generated_placeholder" || record.generatedStatus === "production_generated_raster") {
      errors.push(`${pathName}: generated-by-code placeholder assets must not be marked production`);
    }
  }
  if (record.status === MINI_ASSET_STATUS.PLACEHOLDER && record.asset && !record.placeholderReason) {
    errors.push(`${pathName}: placeholder assets require placeholderReason`);
  }
  if (record.requiresBaseLessFigure && record.asset && /base|plinth|coin/i.test(record.asset)) {
    errors.push(`${pathName}: base-less figure layer asset path must not imply baked base/plinth/coin`);
  }
  if (record.status === MINI_ASSET_STATUS.PRODUCTION && record.requiresAnchors) {
    validateAnchorMetadata(errors, pathName, record.anchors);
  }
  if (record.status === MINI_ASSET_STATUS.PRODUCTION && /\bwand/i.test(JSON.stringify(record))) {
    errors.push(`${pathName}: forbidden wand text in production metadata`);
  }
  const populatedPermutationFields = PERMUTATION_WARNING_FIELDS.filter((field) => record[field] !== undefined);
  if (populatedPermutationFields.length > 4) {
    errors.push(`${pathName}: looks like a full character permutation, not a reusable layer (${populatedPermutationFields.join(", ")})`);
  }
}

function validatePngAsset(errors, pathName, assetPath, record) {
  if (path.extname(assetPath).toLowerCase() !== ".png") {
    errors.push(`${pathName}: asset must be PNG`);
    return;
  }
  try {
    const png = readPng(assetPath);
    if (record.canvas) {
      if (png.width !== record.canvas.width || png.height !== record.canvas.height) {
        errors.push(`${pathName}: canvas metadata ${record.canvas.width}x${record.canvas.height} does not match PNG ${png.width}x${png.height}`);
      }
    }
    const alphaValues = scanAlpha(png);
    if (record.layer !== MINI_LAYER_KIND.BASE && !alphaValues.hasTransparent) {
      errors.push(`${pathName}: transparent layer PNG must include alpha transparency`);
    }
    if (record.layer !== MINI_LAYER_KIND.BASE && !alphaValues.hasOpaque && !["none", "bald_or_shaved"].includes(record.id)) {
      errors.push(`${pathName}: non-empty transparent layer has no visible pixels`);
    }
  } catch (error) {
    errors.push(`${pathName}: could not read PNG (${error.message})`);
  }
}

function scanAlpha(png) {
  let hasTransparent = false;
  let hasOpaque = false;
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] < 250) hasTransparent = true;
    if (png.data[index] > 8) hasOpaque = true;
    if (hasTransparent && hasOpaque) break;
  }
  return { hasTransparent, hasOpaque };
}

function validateAnchorMetadata(errors, pathName, anchors) {
  if (!anchors || typeof anchors !== "object" || Array.isArray(anchors)) {
    errors.push(`${pathName}: production anchored assets require anchors`);
    return;
  }
  for (const key of PC_MINI_ANCHOR_SCHEMA.required) {
    if (!hasPoint(anchors[key])) errors.push(`${pathName}.anchors.${key}: must be { x: number, y: number }`);
  }
}

export async function validatePcMiniAssets() {
  const errors = [];
  for (const registryName of EXPECTED_REGISTRIES) {
    const registry = PC_MINI_LAYER_REGISTRIES[registryName];
    if (!Array.isArray(registry)) {
      errors.push(`${registryName}: registry must be an array`);
      continue;
    }
    const seen = new Set();
    for (const record of registry) {
      if (record?.id && seen.has(record.id)) errors.push(`${registryName}: duplicate id "${record.id}"`);
      if (record?.id) seen.add(record.id);
      validateRecord(errors, registryName, record);
    }
  }
  for (const registryName of Object.keys(PC_MINI_LAYER_REGISTRIES)) {
    if (!EXPECTED_REGISTRIES.includes(registryName)) errors.push(`unexpected registry "${registryName}"`);
  }
  validateSelectionCoverage(errors);
  return errors;
}

function validateSelectionCoverage(errors) {
  const checks = [];
  for (const speciesId of PC_MINI_SPECIES_IDS) checks.push([`species.${speciesId}`, defaultSelection({ speciesId })]);
  for (const classId of PC_MINI_CLASS_IDS) checks.push([`class.${classId}`, defaultSelection({ classId })]);
  for (const posture of PC_MINI_POSTURES) checks.push([`posture.${posture.id}`, defaultSelection({ postureId: posture.id })]);
  for (const lanterna of PC_MINI_LANTERNA_ATTACHMENTS) checks.push([`lanterna.${lanterna.id}`, defaultSelection({ lanternaAttachmentId: lanterna.id })]);
  checks.push(["base.betrayers_coin", defaultSelection({ base: DEFAULT_MINI_BASE_SELECTION })]);
  for (const [disc, rim] of [
    ["aged-gold", "blackened-iron"],
    ["gunmetal", "dull-silver"],
    ["metallic-green", "tarnished-brass"],
  ]) {
    checks.push([`base.${disc}.${rim}`, defaultSelection({ base: { useUniqueBase: false, disc, rim } })]);
  }

  for (const [name, selection] of checks) {
    const plan = resolvePcMiniLayerPlan(selection);
    if (!plan.ok) {
      errors.push(`layerPlan.${name}: ${plan.errors.join("; ")}`);
      continue;
    }
    const visibleLayers = plan.layers.filter((layer) => !layer.hidden);
    if (!visibleLayers.some((layer) => layer.kind === MINI_LAYER_KIND.BASE && layer.baseSeparated)) {
      errors.push(`layerPlan.${name}: missing separated base layer`);
    }
    for (let index = 1; index < plan.layers.length; index += 1) {
      if (plan.layers[index].z < plan.layers[index - 1].z) errors.push(`layerPlan.${name}: z-order is not sorted`);
    }
    for (const layer of visibleLayers) {
      if (!layer.asset) errors.push(`layerPlan.${name}.${layer.kind}: visible layer missing asset`);
      if (layer.kind !== MINI_LAYER_KIND.BASE && !layer.anchors) errors.push(`layerPlan.${name}.${layer.kind}: visible layer missing anchors`);
      if (layer.record?.status !== MINI_ASSET_STATUS.PRODUCTION) {
        errors.push(`layerPlan.${name}.${layer.kind}: visible layer uses ${layer.record?.status || "missing-status"} asset "${layer.id}" instead of production`);
      }
      if (layer.record?.sourceKind === "code_generated_placeholder") {
        errors.push(`layerPlan.${name}.${layer.kind}: visible layer uses code-generated placeholder "${layer.id}"`);
      }
    }
    if (selection.cloakId === "hood_up" && !plan.layers.some((layer) => layer.kind === MINI_LAYER_KIND.HAIR && layer.hidden && layer.storedSelectionHiddenByHood)) {
      errors.push(`layerPlan.${name}: hood_up must hide hair without deleting selection`);
    }
  }
}

function defaultSelection(overrides = {}) {
  const classId = overrides.classId || "fighter";
  const speciesId = overrides.speciesId || "human";
  const lineageIds = Object.keys(SPECIES[speciesId]?.lineages || {});
  const display = PC_MINI_WEAPON_DISPLAYS_BY_CLASS[classId][0];
  const selection = {
    classId,
    speciesId,
    lineageId: lineageIds[0] || undefined,
    bodyTypeId: PC_MINI_BODY_TYPES[0].id,
    skinToneId: speciesId === "aasimar" ? "aasimar_pale" : "human_brown",
    speciesFeatureIds: speciesId === "tiefling" ? ["horns_tail"] : [],
    postureId: PC_MINI_POSTURES[0].id,
    outfitId: PC_MINI_OUTFITS[0].id,
    cloakId: "none",
    headId: speciesId === "dragonborn" ? "dragonborn_head" : PC_MINI_HEADS.find((head) => head.id !== "dragonborn_head").id,
    hairId: speciesId === "dragonborn" ? null : "short_messy",
    facialHairId: "none",
    weaponSlotId: display.slot,
    weaponDisplayId: display.id,
    lanternaAttachmentId: PC_MINI_LANTERNA_ATTACHMENTS[0].id,
    base: DEFAULT_MINI_BASE_SELECTION,
  };
  if (["dragonborn", "tiefling"].includes(speciesId)) delete selection.skinToneId;
  return { ...selection, ...overrides };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const errors = await validatePcMiniAssets();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("[pc-mini-assets] Validation OK");
  }
}
