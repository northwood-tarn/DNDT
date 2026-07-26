import { spendResourceUse } from "./actor.js";

export const LEGENDARY_RESISTANCE_RESOURCE_ID = "legendary_resistance";

const ENCOUNTER_ENDING_CONDITIONS = new Set([
  "banished",
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
]);

const SERIOUS_CONTROL_CONDITIONS = new Set([
  ...ENCOUNTER_ENDING_CONDITIONS,
  "restrained",
]);

export function legendaryResistanceResource(count) {
  const max = Math.max(0, Math.floor(Number(count) || 0));
  return max > 0
    ? { id: LEGENDARY_RESISTANCE_RESOURCE_ID, name: "Legendary Resistance", max, current: max, recovery: "encounter" }
    : null;
}

export function draftedLegendaryResistanceCount(source = {}) {
  const explicit = source.legendaryResistances ?? source.legendaryResistance;
  if (Number.isFinite(Number(explicit))) return Math.max(0, Math.floor(Number(explicit)));

  const rank = String(source.enemyRank || source.rank || source.importance || "").toLowerCase();
  const act = Number(source.campaignAct ?? source.act ?? 0);
  const progress = Number(source.actProgress ?? source.campaignProgress ?? 0);
  const endgame = source.endgameBoss === true || ["endgame_boss", "final_boss"].includes(rank);
  const seriousBoss = endgame || ["serious_boss", "major_boss"].includes(rank);
  const major = seriousBoss || ["major", "boss"].includes(rank);

  if (endgame || (seriousBoss && act >= 3 && progress >= 0.5)) return 3;
  if (act >= 3 && major) return seriousBoss ? 2 : 1;
  if (act === 2 && progress >= 0.5 && major) return seriousBoss ? 2 : 1;
  return 0;
}

export function ensureLegendaryResistanceResource(resources = [], source = {}) {
  const result = structuredClone(resources || []);
  const count = draftedLegendaryResistanceCount(source);
  const existing = result.find((resource) => resource.id === LEGENDARY_RESISTANCE_RESOURCE_ID);
  if (existing || count <= 0) return result;
  result.push(legendaryResistanceResource(count));
  return result;
}

export function applyLegendaryResistance({ snapshot, target, success, action, effect, log, total, dc }) {
  if (success || !target || target.team !== "enemies") return { success, used: false };
  const resource = (target.resources || []).find((item) => item.id === LEGENDARY_RESISTANCE_RESOURCE_ID);
  const remaining = resource?.current ?? resource?.max ?? 0;
  if (remaining <= 0 || !shouldSpendLegendaryResistance(target, action, effect)) return { success, used: false };
  if (!spendResourceUse(target, LEGENDARY_RESISTANCE_RESOURCE_ID)) return { success, used: false };

  log?.add?.("legendary_resistance.used", {
    round: snapshot?.round ?? null,
    actorId: target.id,
    actorName: target.name,
    actionId: action?.id || action?.sourceSpellId || null,
    actionName: action?.name || effect?.name || null,
    total: Number.isFinite(total) ? total : null,
    dc: Number.isFinite(dc) ? dc : null,
    remaining: resource.current,
    maximum: resource.max,
  });
  return { success: true, used: true };
}

export function shouldSpendLegendaryResistance(target, action = {}, effect = null) {
  const conditions = threatenedConditions(action, effect);
  if (conditions.some((condition) => ENCOUNTER_ENDING_CONDITIONS.has(condition))) return true;
  if (conditions.some((condition) => SERIOUS_CONTROL_CONDITIONS.has(condition))) return true;
  if (isRemovalEffect(action, effect)) return true;

  const expectedDamage = averageDamage(action?.damage || effect?.damage?.dice || effect?.damage);
  if (expectedDamage <= 0) return false;
  const hp = Math.max(0, Number(target.hp) || 0);
  const maxHp = Math.max(hp, Number(target.maxHp) || 0);
  return expectedDamage >= hp || (maxHp > 0 && expectedDamage >= maxHp * 0.5);
}

function threatenedConditions(action, effect) {
  const values = [];
  for (const item of action?.effects || []) {
    if (item?.trigger === "failed_save" && item.condition) values.push(item.condition);
  }
  if (effect?.condition) values.push(effect.condition);
  if (effect?.conditionOnFail) values.push(effect.conditionOnFail);
  return values.map(normalize);
}

function isRemovalEffect(action, effect) {
  const values = [
    action?.type,
    action?.sourceSpellId,
    action?.id,
    action?.name,
    effect?.type,
    effect?.kind,
    effect?.name,
  ].map(normalize).join(" ");
  return /banish|stasis|containment|forcecage|maze/.test(values);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function averageDamage(formula) {
  if (Number.isFinite(Number(formula))) return Number(formula);
  const match = String(formula || "").replace(/\s+/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return 0;
  return Number(match[1]) * (Number(match[2]) + 1) / 2 + Number(match[3] || 0);
}
