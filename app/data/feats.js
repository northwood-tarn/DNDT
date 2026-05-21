// app/data/feats.js
//
// Public feat data surface. Detailed records live in app/data/feats/* so the
// canonical categories stay small and reviewable.

import { FEAT_SOURCES, FEAT_TYPES } from "./feats/constants.js";
import { ORIGIN_FEATS_BY_ID } from "./feats/originFeats.js";
import { GENERAL_FEATS_BY_ID } from "./feats/generalFeats.js";
import { FIGHTING_STYLE_FEATS_BY_ID } from "./feats/fightingStyleFeats.js";

export { FEAT_SOURCES, FEAT_TYPES };
export { ORIGIN_FEATS_BY_ID } from "./feats/originFeats.js";
export { GENERAL_FEATS_BY_ID } from "./feats/generalFeats.js";
export { FIGHTING_STYLE_FEATS_BY_ID } from "./feats/fightingStyleFeats.js";

export const FEATS_BY_ID = {
  ...ORIGIN_FEATS_BY_ID,
  ...GENERAL_FEATS_BY_ID,
  ...FIGHTING_STYLE_FEATS_BY_ID
};

export const ORIGIN_FEATS = Object.values(ORIGIN_FEATS_BY_ID).map(toLegacyFeat);
export const GENERAL_FEATS = Object.values(GENERAL_FEATS_BY_ID);
export const FIGHTING_STYLE_FEATS = Object.values(FIGHTING_STYLE_FEATS_BY_ID);

export function getFeatById(id) {
  return FEATS_BY_ID[id] || null;
}

export function listOriginFeats() {
  return Object.values(ORIGIN_FEATS_BY_ID);
}

export function listGeneralFeats() {
  return Object.values(GENERAL_FEATS_BY_ID);
}

export function listFightingStyleFeats() {
  return Object.values(FIGHTING_STYLE_FEATS_BY_ID);
}

export function listFeats() {
  return Object.values(FEATS_BY_ID);
}

function toLegacyFeat(feat) {
  return {
    id: feat.id,
    name: `${feat.name}${feat.source === FEAT_SOURCES.PHB_2024_REFERENCE ? " (Origin)" : ""}`,
    description: feat.description,
    normalized: feat,
    apply(player) {
      applyLegacyFeat(player, feat);
    }
  };
}

function applyLegacyFeat(player, feat) {
  player.notes = [...(player.notes || []), `${feat.name}: ${feat.description}`];
  const skills = feat.effects?.proficiencies?.skills || [];
  if (skills.length) {
    player.proficiencies = player.proficiencies || { skills: [] };
    for (const skill of skills) {
      const titleCase = skill.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
      if (!player.proficiencies.skills.includes(titleCase)) player.proficiencies.skills.push(titleCase);
    }
  }
}
