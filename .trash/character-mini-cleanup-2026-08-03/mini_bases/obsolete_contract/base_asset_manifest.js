export const MINI_BASE_METALS = [
  { id: "aged-gold", label: "Aged gold" },
  { id: "dull-silver", label: "Dull silver" },
  { id: "tarnished-brass", label: "Tarnished brass" },
  { id: "dark-bronze", label: "Dark bronze" },
  { id: "gunmetal", label: "Gunmetal" },
  { id: "metallic-green", label: "Metallic green" },
  { id: "deep-copper", label: "Deep copper" },
  { id: "blackened-iron", label: "Blackened iron" },
  { id: "ember-warmed-steel", label: "Ember-warmed steel" },
];

export const BASE_ASSET_ROOT = "assets/base_combinations";
export const BASE_MATERIAL_TARGET =
  `${BASE_ASSET_ROOT}/material_base_sample_sheet.png`;
export const BASE_MATRIX_REFERENCE =
  `${BASE_ASSET_ROOT}/material_base_matrix_v1.png`;

export function getMiniBaseAssetPath({ disc, rim }) {
  return `${BASE_ASSET_ROOT}/base_disc-${disc}_rim-${rim}.png`;
}

export const MINI_BASE_COMBINATIONS = MINI_BASE_METALS.flatMap((disc) =>
  MINI_BASE_METALS.map((rim) => ({
    id: `disc-${disc.id}_rim-${rim.id}`,
    disc: disc.id,
    rim: rim.id,
    label: `${disc.label} disc / ${rim.label} rim`,
    asset: getMiniBaseAssetPath({ disc: disc.id, rim: rim.id }),
  })),
);

export const UNIQUE_MINI_BASES = [
  {
    id: "betrayers-coin",
    label: "Betrayer's Coin",
    asset: `${BASE_ASSET_ROOT}/betrayers_coin.png`,
    reference: `${BASE_ASSET_ROOT}/betrayers_coin_reference.png`,
    availability: "unique",
    notes:
      "Odd-one-out base: mismatched darkened old silver and blackened gold, asymmetrical tarnish, hairline crack, and worn replaced rim section.",
  },
];

export const DEFAULT_MINI_BASE_SELECTION = {
  useUniqueBase: true,
  uniqueBaseId: "betrayers-coin",
  fallbackCustomBase: {
    disc: "aged-gold",
    rim: "blackened-iron",
    asset: getMiniBaseAssetPath({ disc: "aged-gold", rim: "blackened-iron" }),
  },
};

export const MINI_BASE_RUNTIME_FOOTPRINT = {
  gridDiamond: { width: 128, height: 64 },
  displayWidth: 115,
  sourceCanvas: { width: 192, height: 128 },
  visibleBounds: { left: 16, top: 21, right: 176, bottom: 106 },
  placement: "center visible base bounds inside the occupied 128x64 grid diamond",
};

export const MINI_BASE_ASSET_RULES = {
  format: "png",
  source: "authored raster material art",
  geometry: "single-cell isometric miniature plinth",
  runtimeFootprint: MINI_BASE_RUNTIME_FOOTPRINT,
  playerChoices: ["useUniqueBase", "disc", "rim"],
  defaultSelection: DEFAULT_MINI_BASE_SELECTION,
  defaultBehavior:
    "Betrayer's Coin is selected by default. If the player unticks it, show the normal disc/rim metal picker.",
  forbidden: [
    "svg",
    "canvas-drawn base geometry",
    "css shape base geometry",
    "procedural texture overlays",
    "player-facing wear/noise/scratch toggles",
  ],
  materialTarget: BASE_MATERIAL_TARGET,
  matrixReference: BASE_MATRIX_REFERENCE,
};
