// app/engine/levelUp.js
// Minimal level-up helpers to surface class feature grants like Extra Attack at 5.

import classFeatures, { hasExtraAttackAt5 } from "../data/classFeatures.js";

export function getClassFeatureGainsForLevel(actor, newLevel) {
  const cls = actor.class;
  const grants = [];
  const map = classFeatures[cls] || {};
  if (map[newLevel]) {
    for (const entry of map[newLevel]) {
      const cond = entry.condition;
      if (!cond) {
        grants.push(entry.feature);
      } else {
        let ok = true;
        if (cond.pact && String(actor.pact || "").toLowerCase() !== String(cond.pact).toLowerCase()) ok = false;
        if (cond.subclass && String(actor.subclass || "").toLowerCase() !== String(cond.subclass).toLowerCase()) ok = false;
        if (ok) grants.push(entry.feature);
      }
    }
  }
  return grants;
}

export function summarizeFeature(feature) {
  if (feature === "Extra Attack") return "Extra Attack: when you take the Attack action, make two attacks.";
  return feature;
}

export default { getClassFeatureGainsForLevel, summarizeFeature, hasExtraAttackAt5 };
