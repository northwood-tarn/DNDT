import { ABILITY_IDS } from "./characterDraft.js";

export const STANDARD_ABILITY_ARRAY = [8, 10, 11, 12, 13, 14];

export function assignStandardAbilityScore(draft, abilityId, score) {
  if (!draft?.abilities || !ABILITY_IDS.includes(abilityId)) return draft;
  const nextScore = Number(score);
  if (!STANDARD_ABILITY_ARRAY.includes(nextScore)) return draft;

  const currentScore = draft.abilities[abilityId];
  const swapAbility = ABILITY_IDS.find((id) => id !== abilityId && draft.abilities[id] === nextScore);
  draft.abilities[abilityId] = nextScore;
  if (swapAbility) draft.abilities[swapAbility] = currentScore;
  return draft;
}

export function hasStandardAbilityArray(abilities = {}) {
  const values = ABILITY_IDS.map((ability) => abilities[ability]).sort((a, b) => a - b);
  return values.length === STANDARD_ABILITY_ARRAY.length &&
    values.every((value, index) => value === STANDARD_ABILITY_ARRAY[index]);
}

export function assignBackgroundAbilityBonus(draft, abilityId, bonus) {
  if (!draft?.choices || !ABILITY_IDS.includes(abilityId) || ![1, 2].includes(bonus)) return draft;
  const current = normalizeBackgroundAbilityScores(draft.choices.backgroundAbilityScores);
  const existing = current.find((entry) => entry.ability === abilityId);
  const swap = current.find((entry) => entry.bonus === bonus);

  if (existing && swap) {
    swap.bonus = existing.bonus;
    existing.bonus = bonus;
  } else if (existing) {
    existing.bonus = bonus;
  } else if (swap) {
    swap.ability = abilityId;
  } else {
    current.push({ ability: abilityId, bonus });
  }

  draft.choices.backgroundAbilityScores = current
    .filter((entry) => ABILITY_IDS.includes(entry.ability) && [1, 2].includes(entry.bonus))
    .slice(0, 2);
  return draft;
}

export function normalizeBackgroundAbilityScores(values = []) {
  const out = [];
  const seenAbilities = new Set();
  const seenBonuses = new Set();
  for (const entry of values || []) {
    if (!entry || typeof entry !== "object") continue;
    if (!ABILITY_IDS.includes(entry.ability) || ![1, 2].includes(entry.bonus)) continue;
    if (seenAbilities.has(entry.ability) || seenBonuses.has(entry.bonus)) continue;
    seenAbilities.add(entry.ability);
    seenBonuses.add(entry.bonus);
    out.push({ ability: entry.ability, bonus: entry.bonus });
  }
  return out;
}
