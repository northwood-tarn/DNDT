import { validateCombatAction } from "./actionSchema.js";
import { normalizeAuras } from "./auras.js";
import { getConditionRules, normalizeActionEffects } from "./effects.js";
import { normalizeMarks } from "./marks.js";
import { getEffectiveSpeed, normalizeActiveEffects } from "./modifiers.js";

export const COMBAT_ACTOR_TEAMS = new Set(["heroes", "enemies"]);
const CONTEXTUAL_ACTION_PREFIX = "context_end_";

export function createTurnEconomy(speed = 6) {
  return {
    movementMax: speed,
    movementUsed: 0,
    actionAvailable: true,
    bonusActionAvailable: true,
    reactionAvailable: true,
  };
}

export function normalizeCombatActor(actor) {
  const speed = actor.speed ?? 6;
  const actions = withUniversalActions(actor);
  const inventory = normalizeInventory(actor.inventory);
  const activeEffects = normalizeActiveEffects(actor.activeEffects);
  const economy = {
    ...createTurnEconomy(speed),
    ...(actor.economy || {}),
  };
  economy.movementMax = speed;
  economy.movementUsed = clamp(economy.movementUsed, 0, speed);

  const normalized = {
    ...actor,
    actions,
    inventory,
    conditions: Array.isArray(actor.conditions) ? structuredClone(actor.conditions) : [],
    marks: normalizeMarks(actor.marks),
    auras: normalizeAuras(actor.auras),
    activeEffects,
    tags: normalizeActorTags(actor),
    resources: Array.isArray(actor.resources) ? structuredClone(actor.resources) : [],
    features: Array.isArray(actor.features) ? structuredClone(actor.features) : [],
    featureHooks: Array.isArray(actor.featureHooks) ? structuredClone(actor.featureHooks) : [],
    luck: normalizeLuck(actor),
    speed,
    economy,
    turnFlags: { ...(actor.turnFlags || {}) },
    combatFlags: { ...(actor.combatFlags || {}) },
    defeated: actor.defeated || actor.hp <= 0,
  };
  syncContextualActions(normalized);
  syncLegacyEconomyFields(normalized);
  return normalized;
}

function normalizeActorTags(actor) {
  const tags = new Set(Array.isArray(actor.tags) ? actor.tags.filter(Boolean) : []);
  if (actor.creatureType) tags.add(actor.creatureType);
  if (actor.undeadRank) tags.add(`undead:${actor.undeadRank}`);
  return [...tags];
}

function normalizeLuck(actor) {
  if (actor.luck && Number.isFinite(actor.luck.points)) {
    return {
      points: actor.luck.points,
      max: actor.luck.max ?? actor.luck.points,
      usedThisCombat: actor.luck.usedThisCombat === true,
      naturalRolls: Array.isArray(actor.luck.naturalRolls) ? [...actor.luck.naturalRolls] : [],
    };
  }
  if (actor.luck && Array.isArray(actor.luck.naturalRolls) && actor.luck.naturalRolls.length) {
    return {
      points: Number.POSITIVE_INFINITY,
      max: Number.POSITIVE_INFINITY,
      usedThisCombat: actor.luck.usedThisCombat === true,
      naturalRolls: [...actor.luck.naturalRolls],
    };
  }
  const luckResource = Array.isArray(actor.resources)
    ? actor.resources.find((item) => item.id === "luck_points")
    : null;
  if (!luckResource || !Number.isFinite(luckResource.current)) return null;
  return {
    points: luckResource.current,
    max: luckResource.max ?? luckResource.current,
    usedThisCombat: false,
    resourceId: "luck_points",
  };
}

export function validateCombatActor(actor) {
  const errors = [];
  if (!actor || typeof actor !== "object") errors.push("actor must be an object");
  if (!actor.id) errors.push("id is required");
  if (!actor.name) errors.push("name is required");
  if (!COMBAT_ACTOR_TEAMS.has(actor.team)) errors.push("team must be heroes or enemies");
  if (!Number.isFinite(actor.hp)) errors.push("hp must be numeric");
  if (!Number.isFinite(actor.maxHp)) errors.push("maxHp must be numeric");
  if (!Number.isFinite(actor.ac)) errors.push("ac must be numeric");
  if (!actor.position || !Number.isFinite(actor.position.x) || !Number.isFinite(actor.position.y)) {
    errors.push("position.x and position.y are required");
  }
  if (!Array.isArray(actor.actions)) errors.push("actions must be an array");
  if (Array.isArray(actor.actions)) {
    for (const action of actor.actions) {
      errors.push(...validateCombatAction(action));
    }
  }
  if (!actor.economy || typeof actor.economy !== "object") errors.push("economy is required");
  return errors;
}

export function resetTurnEconomy(actor, snapshot = null) {
  actor.economy = createTurnEconomy(getEffectiveSpeed(snapshot, actor));
  actor.turnFlags = {};
  syncLegacyEconomyFields(actor);
}

export function getMovementRemaining(actor) {
  if (hasConditionRule(actor, "speedZero")) return 0;
  return Math.max(0, (actor.economy?.movementMax ?? actor.speed ?? 0) - (actor.economy?.movementUsed ?? 0));
}

export function spendMovement(actor, squares = 1) {
  if (!actor.economy) actor.economy = createTurnEconomy(actor.speed);
  actor.economy.movementUsed = clamp((actor.economy.movementUsed || 0) + squares, 0, actor.economy.movementMax ?? actor.speed ?? 0);
  syncLegacyEconomyFields(actor);
}

export function hasAction(actor) {
  if (hasConditionRule(actor, "blocksActions")) return false;
  return actor?.economy?.actionAvailable !== false;
}

export function spendAction(actor) {
  if (!actor.economy) actor.economy = createTurnEconomy(actor.speed);
  actor.economy.actionAvailable = false;
  syncLegacyEconomyFields(actor);
}

export function hasBonusAction(actor) {
  if (hasConditionRule(actor, "blocksBonusActions")) return false;
  return actor?.economy?.bonusActionAvailable !== false;
}

export function spendBonusAction(actor) {
  if (!actor.economy) actor.economy = createTurnEconomy(actor.speed);
  actor.economy.bonusActionAvailable = false;
  syncLegacyEconomyFields(actor);
}

export function canPayActionCost(actor, cost = "action") {
  if (cost === "free") return true;
  if (cost === "movement") return true;
  if (cost === "bonus") return hasBonusAction(actor);
  if (cost === "reaction") return hasReaction(actor);
  return hasAction(actor);
}

export function spendActionCost(actor, cost = "action") {
  if (cost === "free") return;
  if (cost === "movement") return;
  if (cost === "bonus") return spendBonusAction(actor);
  if (cost === "reaction") return spendReaction(actor);
  return spendAction(actor);
}

export function increaseMovementMax(actor, squares) {
  if (!actor.economy) actor.economy = createTurnEconomy(actor.speed);
  actor.economy.movementMax = (actor.economy.movementMax ?? actor.speed ?? 0) + Math.max(0, squares || 0);
  syncLegacyEconomyFields(actor);
}

export function hasReaction(actor) {
  if (hasConditionRule(actor, "blocksReactions")) return false;
  return actor?.economy?.reactionAvailable !== false;
}

export function spendReaction(actor) {
  if (!actor.economy) actor.economy = createTurnEconomy(actor.speed);
  actor.economy.reactionAvailable = false;
  syncLegacyEconomyFields(actor);
}

export function syncLegacyEconomyFields(actor) {
  actor.movementRemaining = getMovementRemaining(actor);
  actor.actionUsed = !hasAction(actor);
}

export function getItemQuantity(actor, itemId) {
  const item = actor?.inventory?.find((entry) => entry.id === itemId);
  return item?.quantity || 0;
}

export function spendItem(actor, itemId, qty = 1) {
  if (!Array.isArray(actor.inventory)) actor.inventory = [];
  const item = actor.inventory.find((entry) => entry.id === itemId);
  if (!item || (item.quantity || 0) < qty) return false;
  item.quantity -= qty;
  if (item.quantity <= 0) actor.inventory = actor.inventory.filter((entry) => entry !== item);
  return true;
}

export function hasCondition(actor, conditionId) {
  return Array.isArray(actor?.conditions) && actor.conditions.some((condition) => condition.id === conditionId);
}

export function addCondition(actor, condition) {
  if (!actor || !condition?.id) return false;
  if (!Array.isArray(actor.conditions)) actor.conditions = [];
  const existing = actor.conditions.find((item) => item.id === condition.id);
  if (existing) {
    Object.assign(existing, condition);
    return false;
  }
  actor.conditions.push({ ...condition });
  return true;
}

export function removeCondition(actor, conditionId) {
  if (!Array.isArray(actor?.conditions)) return false;
  const before = actor.conditions.length;
  actor.conditions = actor.conditions.filter((condition) => condition.id !== conditionId);
  return actor.conditions.length !== before;
}

export function hasConditionRule(actor, ruleName) {
  return Array.isArray(actor?.conditions) && actor.conditions.some((condition) => {
    const id = typeof condition === "string" ? condition : condition.id;
    return Boolean(id && getConditionRules(id)[ruleName]);
  });
}

export function getStandingCost(actor) {
  return Math.ceil((actor?.speed || 0) / 2);
}

export function getActionUses(action) {
  if (!action?.uses) return Infinity;
  return action.uses.remaining ?? action.uses.max ?? 0;
}

export function spendActionUse(action) {
  if (!action?.uses) return;
  action.uses.remaining = Math.max(0, (action.uses.remaining ?? action.uses.max ?? 0) - 1);
}

export function spendResourceUse(actor, resourceId) {
  if (!resourceId || !Array.isArray(actor?.resources)) return false;
  const resource = actor.resources.find((item) => item.id === resourceId);
  if (!resource || !Number.isFinite(resource.current) || resource.current <= 0) return false;
  resource.current -= 1;
  return true;
}

export function syncContextualActions(actor) {
  if (!actor) return [];
  if (!Array.isArray(actor.actions)) actor.actions = [];
  actor.actions = actor.actions.filter((action) => !action.contextual);
  const contextual = [
    ...createContextualEndActions(actor),
    ...createTurnContextualActions(actor),
  ];
  actor.actions.push(...contextual);
  return contextual;
}

function createTurnContextualActions(actor) {
  return (actor.turnFlags?.contextualActions || []).map((action) => ({
    ...structuredClone(action),
    contextual: true,
  }));
}

function createContextualEndActions(actor) {
  const actions = [];
  for (const condition of actor.conditions || []) {
    if (condition.end?.type === "action") {
      actions.push(createEndAction({
        idPart: condition.id,
        end: condition.end,
        conditionId: condition.id,
        labelSource: condition.label || condition.id,
      }));
    }
    for (const effect of condition.ongoingEffects || []) {
      const end = effect.end;
      if (!end || end.type !== "action") continue;
      actions.push(createEndAction({
        idPart: condition.id,
        end,
        conditionId: condition.id,
        labelSource: condition.label || condition.id,
      }));
    }
  }
  for (const effect of actor.activeEffects || []) {
    const end = effect.end;
    if (!end || end.type !== "action") continue;
    actions.push(createEndAction({
      idPart: effect.id,
      end,
      effectId: effect.id,
      labelSource: effect.label || effect.id,
    }));
  }
  return dedupeActions(actions);
}

function createEndAction({ idPart, end, conditionId = null, effectId = null, labelSource }) {
  return {
    id: `${CONTEXTUAL_ACTION_PREFIX}${idPart}_${end.id || "effect"}`,
    name: end.label || defaultEndLabel(labelSource),
    type: "contextual_end_effect",
    cost: end.cost || "action",
    requiresTarget: false,
    contextual: true,
    conditionId,
    effectId,
    endId: end.id || null,
    check: end.check ? structuredClone(end.check) : null,
    description: end.description || `End ${labelSource}.`,
    tags: { harmful: false },
  };
}

function dedupeActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

function defaultEndLabel(id) {
  if (id === "burning") return "Extinguish";
  return `End ${String(id || "Effect").split("_").join(" ")}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function withUniversalActions(actor) {
  const actions = Array.isArray(actor.actions) ? structuredClone(actor.actions) : [];
  for (const action of actions) {
    if (action.uses && action.uses.remaining == null) action.uses.remaining = action.uses.max ?? 0;
    action.effects = normalizeActionEffects(action.effects);
  }
  if (!actions.some((action) => action.id === "dash")) {
    actions.push({
      id: "dash",
      name: "Dash",
      type: "dash",
      cost: "action",
      requiresTarget: false,
    });
  }
  if (!actions.some((action) => action.id === "dodge")) {
    actions.push({
      id: "dodge",
      name: "Dodge",
      type: "dodge",
      cost: "action",
      requiresTarget: false,
    });
  }
  return actions.map((action) => ({
    cost: "action",
    requiresTarget: action.type !== "dash" &&
      action.type !== "dodge" &&
      action.type !== "consumable" &&
      action.type !== "self_heal" &&
      action.type !== "spell_self_heal",
    ...action,
  }));
}

function normalizeInventory(inventory) {
  const entries = Array.isArray(inventory) ? structuredClone(inventory) : [];
  const healingPotion = entries.find((entry) => entry.id === "healing_potion");
  if (healingPotion) {
    healingPotion.quantity = healingPotion.quantity ?? 0;
  }
  return entries.map((entry) => ({
    id: entry.id,
    quantity: entry.quantity ?? 0,
    name: entry.name,
  }));
}
