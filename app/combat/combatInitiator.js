import { createCombatGame } from "./api.js";

export const DEFAULT_COMBAT_PRESENTATION_SETTINGS = Object.freeze({
  visualStyle: "miniature_tilt_shift",
  camera: {
    projection: "orthographic_3_4",
    yawDegrees: 35,
    pitchDegrees: 60,
    allowPan: false,
    rotationStepDegrees: 90,
  },
  tiltShift: {
    enabled: true,
    strength: "medium",
    focusBand: "middle",
  },
  tabOverlay: {
    holdKey: "Tab",
    revealGrid: true,
    revealActorStats: true,
    gridColor: "ghostly_green",
  },
});

export function createCombatInitiator(options = {}) {
  const presentationSettings = normalizeCombatPresentationSettings(options.presentationSettings);
  const game = createCombatGame({
    scenarioId: options.scenarioId,
    scenarioOptions: options.scenarioOptions,
  });

  return {
    game,
    presentationSettings,
    start() {
      return game.startCombat();
    },
  };
}

export function normalizeCombatPresentationSettings(settings = {}) {
  const tiltShift = {
    ...DEFAULT_COMBAT_PRESENTATION_SETTINGS.tiltShift,
    ...(settings.tiltShift || {}),
  };
  const camera = {
    ...DEFAULT_COMBAT_PRESENTATION_SETTINGS.camera,
    ...(settings.camera || {}),
  };
  const tabOverlay = {
    ...DEFAULT_COMBAT_PRESENTATION_SETTINGS.tabOverlay,
    ...(settings.tabOverlay || {}),
  };

  return {
    ...DEFAULT_COMBAT_PRESENTATION_SETTINGS,
    ...settings,
    camera,
    tiltShift,
    tabOverlay,
  };
}
