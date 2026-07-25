import { FEAT_SOURCES, FEAT_TYPES } from "./constants.js";

const WIZARD_SHIELD_STAFF_NOTE = "Taking this feat also grants Wizards the ability to wield their casting staff with one hand, both to cast spells and as a melee weapon.";

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
  const grantsShieldProficiency = (effects.proficiencies?.armor || []).some((entry) => String(entry).trim().toLowerCase() === "shield");
  const specialNotes = grantsShieldProficiency ? [WIZARD_SHIELD_STAFF_NOTE] : [];
  const completeDescription = specialNotes.length ? `${description} ${WIZARD_SHIELD_STAFF_NOTE}` : description;
  return { id, name, type, source, minLevel, requirements, description: completeDescription, specialNotes, effects, choices, tags };
}
