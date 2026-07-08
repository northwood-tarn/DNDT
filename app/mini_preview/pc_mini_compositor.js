import {
  DEFAULT_MINI_BASE_SELECTION,
  getMiniBaseAssetPath,
  MINI_BASE_RUNTIME_FOOTPRINT,
} from "./base_asset_manifest.js";
import {
  findMiniAsset,
  MINI_LAYER_KIND,
  PC_MINI_LAYER_REGISTRIES,
} from "./pc_mini_asset_registry.js";
import { validatePcMiniSelection } from "./pc_mini_selection_validator.js";

const CACHE_KEY_FIELDS = [
  "classId",
  "speciesId",
  "lineageId",
  "bodyTypeId",
  "skinToneId",
  "postureId",
  "outfitId",
  "cloakId",
  "headId",
  "hairId",
  "facialHairId",
  "weaponDisplayId",
  "lanternaAttachmentId",
];

export const PC_MINI_LAYER_ORDER = [
  MINI_LAYER_KIND.BASE,
  MINI_LAYER_KIND.POSTURE,
  MINI_LAYER_KIND.OUTFIT,
  MINI_LAYER_KIND.HEAD,
  MINI_LAYER_KIND.FACIAL_HAIR,
  MINI_LAYER_KIND.HAIR,
  MINI_LAYER_KIND.SPECIES_FEATURE,
  MINI_LAYER_KIND.CLOAK,
  MINI_LAYER_KIND.WEAPON,
  MINI_LAYER_KIND.LANTERNA,
];

export const PC_MINI_TINTS = {
  skin: {
    aasimar_pale: [238, 235, 228],
    human_pale: [224, 184, 146],
    human_brown: [156, 96, 58],
    human_black: [74, 48, 36],
  },
  dragonborn: {
    black: [45, 47, 46],
    blue: [65, 89, 135],
    brass: [177, 143, 72],
    bronze: [111, 96, 61],
    copper: [156, 86, 49],
    gold: [190, 153, 70],
    green: [72, 119, 76],
    red: [132, 49, 42],
    silver: [176, 181, 176],
    white: [210, 214, 206],
  },
  tiefling: {
    abyssal: [114, 69, 124],
    chthonic: [86, 75, 97],
    infernal: [139, 54, 56],
  },
};

export function resolvePcMiniLayerPlan(selection, { validate = true } = {}) {
  const normalized = normalizePcMiniSelection(selection);
  if (validate) {
    const errors = validatePcMiniSelection(normalized);
    if (errors.length) {
      return { ok: false, errors, selection: normalized, layers: [], cacheKey: null };
    }
  }

  const baseLayer = resolveBaseLayer(normalized.base);
  const postureId = `${normalized.speciesId}_${normalized.bodyTypeId}_${normalized.postureId}`;
  const hairHidden = normalized.cloakId === "hood_up";
  const speciesFeatureLayers = normalized.speciesId === "tiefling" && normalized.speciesFeatureIds?.includes("horns_tail")
    ? [{ kind: MINI_LAYER_KIND.SPECIES_FEATURE, record: findMiniAsset("speciesFeatures", "tiefling_horns_tail") }]
    : [];
  const layers = orderLayers([
    layer(MINI_LAYER_KIND.BASE, baseLayer, normalized),
    layer(MINI_LAYER_KIND.POSTURE, findMiniAsset("postures", postureId), normalized),
    layer(MINI_LAYER_KIND.OUTFIT, findMiniAsset("outfits", `${normalized.classId}_${normalized.outfitId}`), normalized),
    layer(MINI_LAYER_KIND.HEAD, findMiniAsset("heads", normalized.headId), normalized),
    layer(MINI_LAYER_KIND.FACIAL_HAIR, findMiniAsset("facialHair", normalized.facialHairId), normalized, {
      hidden: normalized.facialHairId === "none" || hairHidden,
    }),
    layer(MINI_LAYER_KIND.HAIR, normalized.speciesId === "dragonborn" ? null : findMiniAsset("hair", normalized.hairId), normalized, {
      hidden: normalized.speciesId === "dragonborn" || hairHidden,
      storedSelectionHiddenByHood: hairHidden && normalized.speciesId !== "dragonborn",
    }),
    ...speciesFeatureLayers.map((item) => layer(item.kind, item.record, normalized)),
    layer(MINI_LAYER_KIND.CLOAK, findMiniAsset("cloaks", normalized.cloakId), normalized, {
      hidden: normalized.cloakId === "none",
    }),
    layer(MINI_LAYER_KIND.WEAPON, findMiniAsset("weapons", normalized.weaponDisplayId), normalized),
    layer(MINI_LAYER_KIND.LANTERNA, findMiniAsset("lanterna", normalized.lanternaAttachmentId), normalized),
  ]);

  const missing = layers
    .filter((layer) => layer.kind !== MINI_LAYER_KIND.HAIR || normalized.speciesId !== "dragonborn")
    .filter((layer) => !layer.record)
    .map((layer) => layer.kind);

  if (missing.length) {
    return {
      ok: false,
      errors: missing.map((kind) => `layerPlan.${kind}: no registry record resolved`),
      selection: normalized,
      layers,
      cacheKey: null,
    };
  }

  return {
    ok: true,
    errors: [],
    selection: normalized,
    layers,
    render: {
      baseSeparated: true,
      baseRuntimeFootprint: MINI_BASE_RUNTIME_FOOTPRINT,
      speciesScale: PC_MINI_LAYER_REGISTRIES.postures.find((record) => record.id === postureId)?.heightScale ?? 1,
      zOrder: PC_MINI_LAYER_ORDER,
    },
    cacheKey: getPcMiniCacheKey(normalized),
  };
}

export function normalizePcMiniSelection(selection) {
  const merged = {
    facialHairId: "none",
    base: DEFAULT_MINI_BASE_SELECTION,
    ...selection,
  };
  if (merged.speciesId === "dragonborn") {
    merged.hairId = null;
    merged.headId = "dragonborn_head";
  }
  if (merged.speciesId === "aasimar") merged.facialHairId = "none";
  if (merged.cloakId === undefined) merged.cloakId = "none";
  if (!Array.isArray(merged.speciesFeatureIds)) merged.speciesFeatureIds = [];
  return merged;
}

export function getPcMiniCacheKey(selection) {
  const baseKey = selection.base?.useUniqueBase
    ? `base-${selection.base.uniqueBaseId}`
    : `base-disc-${selection.base?.disc}_rim-${selection.base?.rim}`;
  return [
    ...CACHE_KEY_FIELDS.map((field) => `${field}-${selection[field] ?? "none"}`),
    baseKey,
  ].join("__");
}

function resolveBaseLayer(base) {
  if (base?.useUniqueBase) return findMiniAsset("bases", base.uniqueBaseId);
  return findMiniAsset("bases", `disc-${base.disc}_rim-${base.rim}`) || {
    id: `disc-${base.disc}_rim-${base.rim}`,
    layer: MINI_LAYER_KIND.BASE,
    asset: getMiniBaseAssetPath({ disc: base.disc, rim: base.rim }),
    disc: base.disc,
    rim: base.rim,
  };
}

function layer(kind, record, selection, extra = {}) {
  return {
    kind,
    z: PC_MINI_LAYER_ORDER.indexOf(kind),
    record,
    asset: record?.asset || null,
    id: record?.id || null,
    anchors: record?.anchors || null,
    tint: getLayerTint(kind, selection),
    hidden: Boolean(extra.hidden),
    storedSelectionHiddenByHood: Boolean(extra.storedSelectionHiddenByHood),
    baseSeparated: kind === MINI_LAYER_KIND.BASE,
  };
}

function orderLayers(layers) {
  return layers.sort((a, b) => a.z - b.z);
}

function getLayerTint(kind, selection) {
  if (![MINI_LAYER_KIND.POSTURE, MINI_LAYER_KIND.HEAD, MINI_LAYER_KIND.SPECIES_FEATURE].includes(kind)) return null;
  if (selection.speciesId === "dragonborn") return PC_MINI_TINTS.dragonborn[selection.lineageId] || null;
  if (selection.speciesId === "tiefling") return PC_MINI_TINTS.tiefling[selection.lineageId] || null;
  return PC_MINI_TINTS.skin[selection.skinToneId] || null;
}

export { PC_MINI_LAYER_REGISTRIES };
