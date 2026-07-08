import {
  getMiniBaseAssetPath,
  MINI_BASE_COMBINATIONS,
  MINI_BASE_RUNTIME_FOOTPRINT,
  UNIQUE_MINI_BASES,
} from "./base_asset_manifest.js";
import { PC_BUILDER_ASSET_RECORDS } from "./pc_builder_asset_manifest.js";
import {
  PC_MINI_BODY_TYPES,
  PC_MINI_CLASS_IDS,
  PC_MINI_CLOAKS,
  PC_MINI_FACIAL_HAIR,
  PC_MINI_HAIR,
  PC_MINI_HAIR_COLORS,
  PC_MINI_HEADS,
  PC_MINI_LANTERNA_ATTACHMENTS,
  PC_MINI_OUTFITS,
  PC_MINI_POSTURES,
  PC_MINI_SPECIES_IDS,
  PC_MINI_SPECIES_SCALE,
  PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
} from "./pc_mini_selection_rules.js";

export const MINI_ASSET_STATUS = {
  PLANNING: "planning",
  PRODUCTION: "production",
  REFERENCE: "reference",
  PLACEHOLDER: "placeholder",
  GENERATED_PENDING_REVIEW: "generated_pending_review",
};

export const MINI_LAYER_KIND = {
  BASE: "base",
  POSTURE: "posture",
  HEAD: "head",
  HAIR: "hair",
  FACIAL_HAIR: "facialHair",
  SPECIES_FEATURE: "speciesFeature",
  OUTFIT: "outfit",
  CLOAK: "cloak",
  WEAPON: "weapon",
  LANTERNA: "lanterna",
};

const productionRecord = (record) => ({
  status: MINI_ASSET_STATUS.PRODUCTION,
  ...record,
});

const planningRecord = (record) => ({
  status: MINI_ASSET_STATUS.PLANNING,
  ...record,
});

export const PC_MINI_BASE_ASSETS = [
  ...UNIQUE_MINI_BASES.map((base) => ({
    id: base.id,
    layer: MINI_LAYER_KIND.BASE,
    status: MINI_ASSET_STATUS.PRODUCTION,
    asset: base.asset,
    reference: base.reference,
    sourceKind: "authored_raster",
    provenance: "Existing authored unique base asset from app/mini_preview/assets/base_combinations.",
    unique: true,
    runtimeFootprint: MINI_BASE_RUNTIME_FOOTPRINT,
  })),
  ...MINI_BASE_COMBINATIONS.map((combo) => ({
    id: combo.id,
    layer: MINI_LAYER_KIND.BASE,
    status: MINI_ASSET_STATUS.PRODUCTION,
    asset: getMiniBaseAssetPath({ disc: combo.disc, rim: combo.rim }),
    sourceKind: "authored_raster",
    provenance: "Existing authored disc/rim base combination asset from app/mini_preview/assets/base_combinations.",
    disc: combo.disc,
    rim: combo.rim,
    runtimeFootprint: MINI_BASE_RUNTIME_FOOTPRINT,
  })),
];

export const PC_MINI_PLANNED_POSTURE_ASSETS = PC_MINI_SPECIES_IDS.flatMap((speciesId) =>
  PC_MINI_BODY_TYPES.flatMap((bodyType) =>
    PC_MINI_POSTURES.map((posture) =>
      planningRecord({
        id: `${speciesId}_${bodyType.id}_${posture.id}`,
        layer: MINI_LAYER_KIND.POSTURE,
        speciesId,
        bodyTypeId: bodyType.id,
        postureId: posture.id,
        heightScale: PC_MINI_SPECIES_SCALE[speciesId]?.heightScale,
        requiresBaseLessFigure: true,
        requiresAnchors: true,
      }),
    ),
  ),
);

export const PC_MINI_PLANNED_HEAD_ASSETS = PC_MINI_HEADS.map((head) =>
  planningRecord({
    ...head,
    layer: MINI_LAYER_KIND.HEAD,
    requiresAnchors: true,
  }),
);

export const PC_MINI_PLANNED_HAIR_ASSETS = PC_MINI_HAIR.map((hair) =>
  planningRecord({
    ...hair,
    layer: MINI_LAYER_KIND.HAIR,
    hiddenByCloakIds: ["hood_up"],
    requiresAnchors: true,
  }),
);

const HAIR_LAYER_ANCHORS = {
  baseCenter: { x: 128, y: 284 },
  groundContactLeft: { x: 110, y: 276 },
  groundContactRight: { x: 145, y: 276 },
  bodyRoot: { x: 128, y: 214 },
  head: { x: 145, y: 114 },
  hair: { x: 145, y: 105 },
  cloak: { x: 125, y: 150 },
  weaponHand: { x: 164, y: 182 },
  offhand: { x: 104, y: 184 },
  staffBottom: { x: 180, y: 272 },
  lanternaDangling: { x: 102, y: 220 },
  lanternaSideAffixed: { x: 99, y: 198 },
  lanternaNeckChain: { x: 136, y: 150 },
};

const HAIR_RUNTIME_FIT_SCALE = {
  short_messy: 0.072,
  scruffy_short: 0.070,
  short_severe: 0.072,
  long_loose: 0.065,
  scruffy_shoulder_length: 0.062,
  long_tied_back: 0.062,
  topknot_bun: 0.068,
  bald_or_shaved: 0.067,
};

export const PC_MINI_GENERATED_HAIR_ASSETS = PC_MINI_HAIR.map((hair) => ({
  ...hair,
  status: MINI_ASSET_STATUS.PRODUCTION,
  layer: MINI_LAYER_KIND.HAIR,
  hiddenByCloakIds: ["hood_up"],
  requiresAnchors: true,
  anchors: HAIR_LAYER_ANCHORS,
  runtimeFitScale: HAIR_RUNTIME_FIT_SCALE[hair.id] || 0.068,
  sourceKind: "image_generated_chroma_key",
  provenance: {
    source: "built-in image generation, chroma-key background, Pillow alpha removal",
    referenceImages: [
      "assets/stress_tests/pc_mini_composition_stress_16_v1.png",
      "assets/species_postures/species_posture_sketch_sheet_v4.png",
    ],
  },
  asset: `assets/pc_builder_production/hair/assets/black/${hair.id}.png`,
  sourceAsset: `assets/pc_builder_production/hair/source/${hair.id}_chroma.png`,
  prompt: `assets/pc_builder_production/hair/prompts/${hair.id}.prompt.txt`,
  anchorMetadata: `assets/pc_builder_production/hair/metadata/${hair.id}_black.anchors.json`,
  variants: PC_MINI_HAIR_COLORS.map((color) => ({
    id: `${hair.id}_${color.id}`,
    hairId: hair.id,
    hairColorId: color.id,
    label: `${hair.label}, ${color.label}`,
    asset: `assets/pc_builder_production/hair/assets/${color.id}/${hair.id}.png`,
    anchorMetadata: `assets/pc_builder_production/hair/metadata/${hair.id}_${color.id}.anchors.json`,
  })),
  validationNotes:
    "Signed off as production raster hair component after review of the 8-style, 4-color contact sheet.",
}));

export const PC_MINI_PLANNED_FACIAL_HAIR_ASSETS = PC_MINI_FACIAL_HAIR.map((facialHair) =>
  planningRecord({
    ...facialHair,
    layer: MINI_LAYER_KIND.FACIAL_HAIR,
    hiddenByCloakIds: ["hood_up"],
    requiresAnchors: facialHair.id !== "none",
  }),
);

export const PC_MINI_PLANNED_OUTFIT_ASSETS = PC_MINI_CLASS_IDS.flatMap((classId) =>
  PC_MINI_OUTFITS.map((outfit) =>
    planningRecord({
      id: `${classId}_${outfit.id}`,
      layer: MINI_LAYER_KIND.OUTFIT,
      classId,
      outfitId: outfit.id,
      requiresBaseLessFigure: true,
    }),
  ),
);

export const PC_MINI_PLANNED_CLOAK_ASSETS = PC_MINI_CLOAKS.map((cloak) =>
  planningRecord({
    id: cloak.id,
    layer: MINI_LAYER_KIND.CLOAK,
    cloakId: cloak.id,
    hidesHair: cloak.id === "hood_up",
    requiresAnchors: cloak.id !== "none",
  }),
);

export const PC_MINI_PLANNED_WEAPON_ASSETS = Object.entries(PC_MINI_WEAPON_DISPLAYS_BY_CLASS).flatMap(
  ([classId, displays]) =>
    displays.map((display) =>
      planningRecord({
        ...display,
        layer: MINI_LAYER_KIND.WEAPON,
        classId,
        weaponDisplayId: display.id,
        requiresAnchors: true,
      }),
    ),
);

export const PC_MINI_PLANNED_LANTERNA_ASSETS = PC_MINI_LANTERNA_ATTACHMENTS.map((attachment) =>
  planningRecord({
    ...attachment,
    layer: MINI_LAYER_KIND.LANTERNA,
    lanternaAttachmentId: attachment.id,
    requiresAnchors: true,
  }),
);

function withLayer(registryName, layer, fallbackRecords) {
  const generated = PC_BUILDER_ASSET_RECORDS[registryName];
  return (generated?.length ? generated : fallbackRecords).map((record) => {
    const isCodeGeneratedPlaceholder = record.generatedStatus === "production_generated_raster"
      || record.asset?.startsWith("assets/pc_builder/");
    return {
      status: isCodeGeneratedPlaceholder ? MINI_ASSET_STATUS.PLACEHOLDER : (record.status || MINI_ASSET_STATUS.PLANNING),
      layer,
      ...record,
      status: isCodeGeneratedPlaceholder ? MINI_ASSET_STATUS.PLACEHOLDER : (record.status || MINI_ASSET_STATUS.PLANNING),
      sourceKind: isCodeGeneratedPlaceholder ? "code_generated_placeholder" : record.sourceKind,
      placeholderReason: isCodeGeneratedPlaceholder
        ? "Generated by code drawing primitives in an earlier failed pass. Useful only for compositor smoke tests; forbidden in production layer plans."
        : record.placeholderReason,
    };
  });
}

export const PC_MINI_POSTURE_ASSETS = withLayer("postures", MINI_LAYER_KIND.POSTURE, PC_MINI_PLANNED_POSTURE_ASSETS);
export const PC_MINI_HEAD_ASSETS = withLayer("heads", MINI_LAYER_KIND.HEAD, PC_MINI_PLANNED_HEAD_ASSETS);
export const PC_MINI_HAIR_ASSETS = PC_MINI_GENERATED_HAIR_ASSETS;
export const PC_MINI_FACIAL_HAIR_ASSETS = withLayer("facialHair", MINI_LAYER_KIND.FACIAL_HAIR, PC_MINI_PLANNED_FACIAL_HAIR_ASSETS);
export const PC_MINI_SPECIES_FEATURE_ASSETS = withLayer("speciesFeatures", MINI_LAYER_KIND.SPECIES_FEATURE, []);
export const PC_MINI_OUTFIT_ASSETS = withLayer("outfits", MINI_LAYER_KIND.OUTFIT, PC_MINI_PLANNED_OUTFIT_ASSETS);
export const PC_MINI_CLOAK_ASSETS = withLayer("cloaks", MINI_LAYER_KIND.CLOAK, PC_MINI_PLANNED_CLOAK_ASSETS);
export const PC_MINI_WEAPON_ASSETS = withLayer("weapons", MINI_LAYER_KIND.WEAPON, PC_MINI_PLANNED_WEAPON_ASSETS);
export const PC_MINI_LANTERNA_ASSETS = withLayer("lanterna", MINI_LAYER_KIND.LANTERNA, PC_MINI_PLANNED_LANTERNA_ASSETS);

export const PC_MINI_LAYER_REGISTRIES = {
  bases: PC_MINI_BASE_ASSETS,
  postures: PC_MINI_POSTURE_ASSETS,
  heads: PC_MINI_HEAD_ASSETS,
  hair: PC_MINI_HAIR_ASSETS,
  facialHair: PC_MINI_FACIAL_HAIR_ASSETS,
  speciesFeatures: PC_MINI_SPECIES_FEATURE_ASSETS,
  outfits: PC_MINI_OUTFIT_ASSETS,
  cloaks: PC_MINI_CLOAK_ASSETS,
  weapons: PC_MINI_WEAPON_ASSETS,
  lanterna: PC_MINI_LANTERNA_ASSETS,
};

export function findMiniAsset(registryName, id) {
  return PC_MINI_LAYER_REGISTRIES[registryName]?.find((record) => record.id === id) || null;
}

export default PC_MINI_LAYER_REGISTRIES;
