import { FEAT_SOURCES, FEAT_TYPES } from "./constants.js";

export function originFeat({
  id,
  name,
  source = FEAT_SOURCES.PHB_2024_REFERENCE,
  description,
  effects = {},
  choices = [],
  tags = []
}) {
  return {
    id,
    name,
    type: FEAT_TYPES.ORIGIN,
    source,
    minLevel: 1,
    description,
    effects,
    choices,
    tags
  };
}

export function generalFeat(config) {
  return feat({
    ...config,
    type: FEAT_TYPES.GENERAL,
    minLevel: config.minLevel || 4
  });
}

export function fightingStyleFeat(config) {
  return feat({
    ...config,
    type: FEAT_TYPES.FIGHTING_STYLE,
    minLevel: config.minLevel || 1,
    tags: ["fighting_style", ...(config.tags || [])]
  });
}

export function feat({
  id,
  name,
  type,
  source = FEAT_SOURCES.PHB_2024_REFERENCE,
  minLevel,
  requirements = {},
  description,
  effects = {},
  choices = [],
  tags = []
}) {
  return { id, name, type, source, minLevel, requirements, description, effects, choices, tags };
}
