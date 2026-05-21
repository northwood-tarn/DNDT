import { getBackgroundById } from "../../data/backgrounds.js";
import { ABILITY_IDS } from "../characterDraft.js";
import { abilityModifier } from "./resolverUtils.js";

export function resolveAbilities(sheet, draft) {
  const backgroundBonuses = resolveBackgroundAbilityBonuses(sheet, draft);
  for (const ability of ABILITY_IDS) {
    const baseScore = draft.abilities[ability];
    const bonus = backgroundBonuses[ability] || 0;
    const score = baseScore + bonus;
    sheet.abilities[ability] = {
      score,
      modifier: abilityModifier(score),
      sources: [
        { type: "standard_array", label: "Standard array", value: baseScore },
        ...(bonus ? [{ type: "background", label: "Background ability bonus", value: bonus }] : []),
      ],
    };
  }
}

function resolveBackgroundAbilityBonuses(sheet, draft) {
  const selected = draft.choices?.backgroundAbilityScores || [];
  if (!selected.length) return {};

  const background = getBackgroundById(draft.identity?.backgroundId);
  const allowed = new Set(background?.abilityScoreOptions || []);
  const bonuses = {};
  for (const entry of selected) {
    if (!entry || typeof entry !== "object") continue;
    const ability = entry.ability;
    const bonus = entry.bonus;
    if (!ABILITY_IDS.includes(ability) || !allowed.has(ability) || !Number.isInteger(bonus)) continue;
    bonuses[ability] = (bonuses[ability] || 0) + bonus;
  }
  return bonuses;
}
