import { normalizeCombatActor, validateCombatActor } from "../combat/actor.js";

export const ACTOR_DEFINITION_VERSION = 1;
export const ACTOR_INSTANCE_VERSION = 1;
export const ACTOR_KINDS = new Set(["player", "companion", "npc", "enemy"]);
export const ACTOR_TEAMS = new Set(["heroes", "enemies", "neutral"]);

export function createActorDefinition(input = {}) {
  return {
    schemaVersion: ACTOR_DEFINITION_VERSION,
    id: input.id || null,
    kind: input.kind || null,
    identity: {
      name: input.identity?.name || input.name || "",
      description: input.identity?.description || "",
      tags: unique(input.identity?.tags || []),
    },
    classification: {
      role: input.classification?.role || null,
      creatureType: input.classification?.creatureType || null,
      size: input.classification?.size || null,
      level: input.classification?.level ?? null,
      classId: input.classification?.classId || null,
      subclassId: input.classification?.subclassId || null,
      factionId: input.classification?.factionId || null,
    },
    presentation: {
      token: input.presentation?.token || null,
      portraitId: input.presentation?.portraitId || null,
      miniatureId: input.presentation?.miniatureId || null,
    },
    mechanics: structuredClone(input.mechanics || {}),
    capabilities: {
      actions: structuredClone(input.capabilities?.actions || []),
      actionRefs: structuredClone(input.capabilities?.actionRefs || []),
      features: structuredClone(input.capabilities?.features || []),
      featureHooks: structuredClone(input.capabilities?.featureHooks || []),
      resources: structuredClone(input.capabilities?.resources || []),
      spellcasting: structuredClone(input.capabilities?.spellcasting || null),
    },
    equipment: structuredClone(input.equipment || {}),
    behavior: structuredClone(input.behavior || {}),
    services: structuredClone(input.services || []),
    rewards: structuredClone(input.rewards || {}),
    narrative: structuredClone(input.narrative || {}),
    extensions: structuredClone(input.extensions || {}),
  };
}

export function createActorInstance(input = {}) {
  return {
    schemaVersion: ACTOR_INSTANCE_VERSION,
    id: input.id || null,
    definitionId: input.definitionId || null,
    team: input.team || defaultTeam(input.kind),
    name: input.name || null,
    position: input.position ? structuredClone(input.position) : null,
    state: {
      hp: input.state?.hp ?? null,
      maxHp: input.state?.maxHp ?? null,
      tempHp: input.state?.tempHp || 0,
      defeated: input.state?.defeated === true,
      spellSlots: structuredClone(input.state?.spellSlots || {}),
      resources: structuredClone(input.state?.resources || []),
      inventory: structuredClone(input.state?.inventory || []),
      conditions: structuredClone(input.state?.conditions || []),
      activeEffects: structuredClone(input.state?.activeEffects || []),
      marks: structuredClone(input.state?.marks || []),
      luck: structuredClone(input.state?.luck || null),
      flags: structuredClone(input.state?.flags || {}),
    },
    overrides: structuredClone(input.overrides || {}),
    metadata: structuredClone(input.metadata || {}),
  };
}

export function validateActorDefinition(definition) {
  const errors = [];
  if (!isObject(definition)) return ["definition must be an object"];
  if (definition.schemaVersion !== ACTOR_DEFINITION_VERSION) errors.push(`schemaVersion must be ${ACTOR_DEFINITION_VERSION}`);
  if (!isId(definition.id)) errors.push("id must be a non-empty stable id");
  if (!ACTOR_KINDS.has(definition.kind)) errors.push("kind must be player, companion, npc, or enemy");
  if (!isNonEmptyString(definition.identity?.name)) errors.push("identity.name is required");
  if (!Array.isArray(definition.identity?.tags)) errors.push("identity.tags must be an array");
  if (!isObject(definition.mechanics)) errors.push("mechanics must be an object");
  for (const key of ["actions", "actionRefs", "features", "featureHooks", "resources"]) {
    if (!Array.isArray(definition.capabilities?.[key])) errors.push(`capabilities.${key} must be an array`);
  }
  if (!Array.isArray(definition.services)) errors.push("services must be an array");
  const maxHp = definition.mechanics?.maxHp;
  if (maxHp != null && (!Number.isFinite(maxHp) || maxHp <= 0)) errors.push("mechanics.maxHp must be a positive number");
  const armorClass = definition.mechanics?.armorClass;
  if (armorClass != null && !Number.isFinite(armorClass)) errors.push("mechanics.armorClass must be numeric");
  const speedSquares = definition.mechanics?.speedSquares;
  if (speedSquares != null && (!Number.isFinite(speedSquares) || speedSquares < 0)) errors.push("mechanics.speedSquares must be non-negative");
  return errors;
}

export function validateActorInstance(instance, options = {}) {
  const errors = [];
  if (!isObject(instance)) return ["instance must be an object"];
  if (instance.schemaVersion !== ACTOR_INSTANCE_VERSION) errors.push(`schemaVersion must be ${ACTOR_INSTANCE_VERSION}`);
  if (!isId(instance.id)) errors.push("id must be a non-empty stable id");
  if (!isId(instance.definitionId)) errors.push("definitionId must be a non-empty stable id");
  if (!ACTOR_TEAMS.has(instance.team)) errors.push("team must be heroes, enemies, or neutral");
  if (instance.position != null && (!Number.isFinite(instance.position.x) || !Number.isFinite(instance.position.y))) {
    errors.push("position must contain numeric x and y");
  }
  for (const key of ["resources", "inventory", "conditions", "activeEffects", "marks"]) {
    if (!Array.isArray(instance.state?.[key])) errors.push(`state.${key} must be an array`);
  }
  if (instance.state?.hp != null && !Number.isFinite(instance.state.hp)) errors.push("state.hp must be numeric or null");
  if (instance.state?.maxHp != null && !Number.isFinite(instance.state.maxHp)) errors.push("state.maxHp must be numeric or null");
  if (options.definition && instance.definitionId !== options.definition.id) errors.push("definitionId does not match definition.id");
  return errors;
}

export function resolveActorToCombatActor(definitionInput, instanceInput, options = {}) {
  const definition = createActorDefinition(definitionInput);
  const instance = createActorInstance(instanceInput);
  const errors = [
    ...validateActorDefinition(definition),
    ...validateActorInstance(instance, { definition }),
  ];
  if (errors.length) throw new Error(`Invalid actor contract:\n${errors.join("\n")}`);

  const base = structuredClone(options.combatActorBase || definition.extensions?.combatActorBase || {});
  const mechanics = definition.mechanics;
  const state = instance.state;
  const actor = {
    ...base,
    ...structuredClone(instance.overrides || {}),
    id: instance.id,
    sourceId: definition.id,
    kind: definition.kind,
    name: instance.name || definition.identity.name,
    team: instance.team === "neutral" ? (options.neutralCombatTeam || "heroes") : instance.team,
    role: definition.classification.role || base.role,
    creatureType: definition.classification.creatureType || base.creatureType,
    size: definition.classification.size || base.size,
    level: definition.classification.level ?? base.level,
    token: definition.presentation.token || base.token,
    hp: state.hp ?? mechanics.maxHp ?? base.hp,
    maxHp: state.maxHp ?? mechanics.maxHp ?? base.maxHp,
    tempHp: state.tempHp ?? base.tempHp ?? 0,
    ac: mechanics.armorClass ?? base.ac,
    speed: mechanics.speedSquares ?? base.speed,
    position: instance.position || base.position || { x: 0, y: 0 },
    abilityMods: structuredClone(mechanics.abilityModifiers || base.abilityMods || {}),
    saves: structuredClone(mechanics.saves || base.saves || {}),
    resistances: structuredClone(mechanics.resistances || base.resistances || []),
    immunities: structuredClone(mechanics.immunities || base.immunities || []),
    conditionImmunities: structuredClone(mechanics.conditionImmunities || base.conditionImmunities || []),
    actions: structuredClone(options.actions || definition.capabilities.actions || base.actions || []),
    features: structuredClone(definition.capabilities.features || base.features || []),
    featureHooks: structuredClone(definition.capabilities.featureHooks || base.featureHooks || []),
    resources: structuredClone(state.resources),
    spellSlots: structuredClone(state.spellSlots),
    inventory: structuredClone(state.inventory),
    conditions: structuredClone(state.conditions || []),
    activeEffects: structuredClone(state.activeEffects),
    marks: structuredClone(state.marks || []),
    luck: structuredClone(state.luck ?? base.luck ?? null),
    defeated: state.defeated === true || (state.hp ?? mechanics.maxHp ?? base.hp) <= 0,
    actorContract: {
      definitionVersion: definition.schemaVersion,
      instanceVersion: instance.schemaVersion,
      definitionId: definition.id,
      kind: definition.kind,
    },
  };
  const normalized = normalizeCombatActor(actor);
  const combatErrors = validateCombatActor(normalized);
  if (combatErrors.length) throw new Error(`Actor contract did not resolve to a valid CombatActor:\n${combatErrors.join("\n")}`);
  return normalized;
}

function defaultTeam(kind) {
  return kind === "enemy" ? "enemies" : kind === "npc" ? "neutral" : "heroes";
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isId(value) {
  return isNonEmptyString(value) && /^[a-zA-Z0-9_.:-]+$/.test(value);
}
