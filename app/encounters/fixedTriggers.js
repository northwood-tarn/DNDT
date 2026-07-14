import { getEncounterById } from "../data/encounters.js";
import {
  hasStoryFlag,
  normalizeSaveGameState,
  setStoryFlag,
} from "../state/saveGameState.js";

export const FIXED_TRIGGER_FREQUENCIES = new Set(["once", "repeat"]);
export const FIXED_TRIGGER_ENTRY_MODES = new Set(["dialogue", "combat"]);
export const FIXED_TRIGGER_OUTCOMES = new Set(["triggered", "success", "failure", "bypassed", "completed"]);

export function createFixedEncounterTrigger(input = {}) {
  return {
    id: input.id || null,
    mapId: input.mapId || null,
    location: structuredClone(input.location || null),
    encounterId: input.encounterId || null,
    frequency: input.frequency || "once",
    entryMode: input.entryMode || "combat",
    dialogueId: input.dialogueId || null,
    requirements: {
      requiredFlags: unique(input.requirements?.requiredFlags || []),
      forbiddenFlags: unique(input.requirements?.forbiddenFlags || []),
    },
    destinations: structuredClone(input.destinations || {}),
    flags: {
      onTriggered: structuredClone(input.flags?.onTriggered || {}),
      onBypassed: structuredClone(input.flags?.onBypassed || {}),
      onCompleted: structuredClone(input.flags?.onCompleted || {}),
    },
  };
}

export function validateFixedEncounterTrigger(input, options = {}) {
  const trigger = createFixedEncounterTrigger(input);
  const errors = [];
  if (!stableId(trigger.id)) errors.push("id must be a stable id");
  if (!stableId(trigger.mapId)) errors.push("mapId must be a stable id");
  if (!FIXED_TRIGGER_FREQUENCIES.has(trigger.frequency)) errors.push("frequency must be once or repeat");
  if (!FIXED_TRIGGER_ENTRY_MODES.has(trigger.entryMode)) errors.push("entryMode must be dialogue or combat");
  if (!stableId(trigger.encounterId)) errors.push("encounterId must be a stable id");
  if (options.requireKnownEncounter !== false && trigger.encounterId && !getEncounterById(trigger.encounterId)) {
    errors.push(`encounterId references unknown encounter: ${trigger.encounterId}`);
  }
  if (trigger.entryMode === "dialogue" && !stableId(trigger.dialogueId)) errors.push("dialogueId is required for dialogue entry");
  errors.push(...validateLocation(trigger.location));
  for (const key of ["success", "failure"]) {
    if (trigger.destinations[key]) errors.push(...validateDestination(trigger.destinations[key], `destinations.${key}`));
  }
  return errors;
}

export function findFixedEncounterTrigger(saveGame, triggers, context = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  return (triggers || [])
    .map(createFixedEncounterTrigger)
    .filter((trigger) => validateFixedEncounterTrigger(trigger).length === 0)
    .filter((trigger) => trigger.mapId === context.mapId)
    .filter((trigger) => locationMatches(trigger.location, context))
    .filter((trigger) => requirementsMet(normalized, trigger.requirements))
    .filter((trigger) => trigger.frequency === "repeat" || triggerState(normalized, trigger.id).firedCount === 0)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] || null;
}

export function resolveFixedEncounterTrigger(saveGame, input, outcome = "triggered") {
  const trigger = createFixedEncounterTrigger(input);
  const errors = validateFixedEncounterTrigger(trigger);
  if (errors.length) throw new Error(`Invalid fixed encounter trigger: ${errors.join("; ")}`);
  if (!FIXED_TRIGGER_OUTCOMES.has(outcome)) throw new Error(`Unsupported fixed encounter outcome: ${outcome}`);
  let next = normalizeSaveGameState(saveGame);
  next.world.fixedEncounterTriggers ??= {};
  const previous = triggerState(next, trigger.id);
  next.world.fixedEncounterTriggers[trigger.id] = {
    ...previous,
    firedCount: previous.firedCount + (outcome === "triggered" ? 1 : 0),
    lastOutcome: outcome,
    bypassed: previous.bypassed || outcome === "bypassed",
    completed: previous.completed || outcome === "completed",
  };
  next = applyOutcomeFlags(next, trigger, outcome);
  return {
    saveGame: normalizeSaveGameState(next),
    trigger,
    outcome,
    destination: destinationFor(trigger, outcome),
  };
}

function destinationFor(trigger, outcome) {
  if (outcome === "success" || outcome === "failure") return structuredClone(trigger.destinations[outcome] || null);
  if (outcome !== "triggered") return null;
  if (trigger.entryMode === "dialogue") {
    return { type: "dialogue", id: trigger.dialogueId, encounterId: trigger.encounterId };
  }
  return { type: "combat", id: trigger.encounterId };
}

function applyOutcomeFlags(saveGame, trigger, outcome) {
  let flags = {};
  if (outcome === "triggered") flags = trigger.flags.onTriggered;
  if (outcome === "bypassed") flags = trigger.flags.onBypassed;
  if (outcome === "completed") flags = trigger.flags.onCompleted;
  let next = saveGame;
  for (const [flagId, value] of Object.entries(flags)) next = setStoryFlag(next, flagId, value);
  return next;
}

function requirementsMet(saveGame, requirements) {
  if (requirements.requiredFlags.some((flagId) => !hasStoryFlag(saveGame, flagId))) return false;
  if (requirements.forbiddenFlags.some((flagId) => hasStoryFlag(saveGame, flagId))) return false;
  return true;
}

function locationMatches(location, context) {
  if (location.type === "tile") {
    return context.position?.column === location.column && context.position?.row === location.row;
  }
  return context.regionId === location.regionId || (context.regionIds || []).includes(location.regionId);
}

function validateLocation(location) {
  if (!location || typeof location !== "object") return ["location is required"];
  if (location.type === "tile") {
    return Number.isInteger(location.column) && location.column >= 0 && Number.isInteger(location.row) && location.row >= 0
      ? [] : ["tile location requires non-negative integer column and row"];
  }
  if (location.type === "region") return stableId(location.regionId) ? [] : ["region location requires regionId"];
  return ["location.type must be tile or region"];
}

function validateDestination(destination, path) {
  if (!destination || typeof destination !== "object") return [`${path} must be an object`];
  if (!["dialogue", "combat", "map", "none"].includes(destination.type)) return [`${path}.type is invalid`];
  if (destination.type !== "none" && !stableId(destination.id)) return [`${path}.id is required`];
  return [];
}

function triggerState(saveGame, triggerId) {
  return saveGame.world?.fixedEncounterTriggers?.[triggerId] || {
    firedCount: 0,
    lastOutcome: null,
    bypassed: false,
    completed: false,
  };
}

function stableId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/.test(value);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
