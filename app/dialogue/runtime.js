import { applyLootToSaveGame } from "../state/loot.js";
import { clearStoryFlag, hasStoryFlag, normalizeSaveGameState, setActiveEncounterState, setSaveGameLocation, setStoryFlag } from "../state/saveGameState.js";

const ACTS = new Set(["1_Greyharbour", "2_Necropolis", "3_Backlands"]);

export function getDialoguePackagePath(act, sceneId) {
  if (!ACTS.has(act)) throw new Error(`Invalid dialogue Act: ${act}`);
  const match = String(sceneId || "").match(/^scene:([a-z0-9]+(?:\.[a-z0-9]+)*)$/);
  if (!match) throw new Error(`Invalid dialogue scene id: ${sceneId}`);
  return `/data/dialogue/${act}/${match[1]}.json`;
}

export async function loadDialoguePackage({ act, sceneId, fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== "function") throw new Error("A dialogue package fetcher is required");
  const path = getDialoguePackagePath(act, sceneId);
  const response = await fetcher(path);
  if (!response?.ok) throw new Error(`Unable to load dialogue ${sceneId}: HTTP ${response?.status || "unknown"}`);
  const scenePackage = await response.json();
  const errors = validateDialoguePackage(scenePackage);
  if (errors.length) throw new Error(`Invalid compiled dialogue: ${errors.join("; ")}`);
  return scenePackage;
}

export function validateDialoguePackage(input) {
  const errors = [];
  if (input?.formatVersion !== 1) errors.push("formatVersion must be 1");
  if (!ACTS.has(input?.scene?.act)) errors.push("scene.act is invalid");
  if (!/^scene:[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(input?.scene?.id || "")) errors.push("scene.id is invalid");
  if (!["full", "vignette", "emberside"].includes(input?.scene?.type)) errors.push("scene.type is invalid");
  if (!input?.content || !Array.isArray(input.content.options)) errors.push("content.options must be an array");
  return errors;
}

export function isDialogueEligible(scenePackage, saveGame) {
  const requirements = scenePackage?.scene?.requirements || {};
  const save = normalizeSaveGameState(saveGame);
  if ((requirements.requiredFlags || []).some((flag) => !hasStoryFlag(save, flag))) return false;
  if ((requirements.forbiddenFlags || []).some((flag) => hasStoryFlag(save, flag))) return false;
  return true;
}

export function startDialogueSession(scenePackage, saveGame) {
  const errors = validateDialoguePackage(scenePackage);
  if (errors.length) throw new Error(`Invalid compiled dialogue: ${errors.join("; ")}`);
  if (!isDialogueEligible(scenePackage, saveGame)) throw new Error(`Dialogue ${scenePackage.scene.id} is not eligible`);
  const started = applyEffects(normalizeSaveGameState(saveGame), scenePackage.scene.effects?.start || []);
  return {
    scene: structuredClone(scenePackage.scene),
    body: scenePackage.content.body || "",
    options: getDialogueOptions(scenePackage.content.options, started.saveGame),
    saveGame: started.saveGame,
    routes: started.routes,
    pendingChecks: started.pendingChecks,
  };
}

export function chooseDialogueOption(session, optionLabel, resolution = {}) {
  const option = session?.options?.find((candidate) => candidate.label === optionLabel);
  if (!option) throw new Error(`Unknown dialogue option: ${optionLabel}`);
  if (option.available === false) throw new Error(option.unavailableReason || `Dialogue option ${optionLabel} is unavailable`);
  const result = applyEffects(session.saveGame, option.effects || [], resolution);
  if (result.checkResults.length && result.routes.length === 0) {
    const outcome = result.checkResults.at(-1).success ? "success" : "failure";
    const destination = session.scene?.destinations?.[outcome];
    if (destination) result.routes.push(destinationRoute(destination));
  }
  return { ...result, option: structuredClone(option) };
}

export function completeDialogueSession(scenePackage, saveGame) {
  return applyEffects(saveGame, scenePackage?.scene?.effects?.completion || []);
}

export function applyEffects(saveGame, effects = [], resolution = {}) {
  let save = normalizeSaveGameState(saveGame);
  const routes = [];
  const pendingChecks = [];
  const checkResults = [];
  const consequences = [];
  for (const raw of effects) {
    const effect = normalizeEffect(raw);
    switch (effect.effect) {
      case "set.flag": save = setStoryFlag(save, effect.argument, true); break;
      case "clear.flag": save = clearStoryFlag(save, effect.argument); break;
      case "give.item": save = applyLootToSaveGame(save, { items: [{ id: effect.argument, quantity: effect.quantity }] }).saveGame; break;
      case "remove.item": save = removeHolding(save, effect.argument, effect.quantity); break;
      case "change.gold": save = changeGold(save, Number(effect.argument)); break;
      case "go.scene": routes.push({ type: "dialogue", id: effect.argument }); break;
      case "go.map":
        save = setSaveGameLocation(save, { mapId: effect.argument });
        routes.push({ type: "map", id: effect.argument });
        break;
      case "start.combat":
        save = setActiveEncounterState(save, { encounterId: effect.argument });
        routes.push({ type: "combat", id: effect.argument });
        break;
      case "open.service": routes.push({ type: "service", id: effect.argument }); break;
      case "check.skill": {
        const check = parseSkillCheck(effect.argument);
        const resolver = resolution.resolveSkillCheck;
        if (typeof resolver !== "function") {
          pendingChecks.push(check);
          break;
        }
        const result = resolveDialogueSkillCheck(check, resolver(check));
        checkResults.push(result);
        const branch = result.success ? effect.success : effect.failure;
        const branchResult = applyEffects(save, branch || [], resolution);
        save = branchResult.saveGame;
        routes.push(...branchResult.routes);
        pendingChecks.push(...branchResult.pendingChecks);
        checkResults.push(...branchResult.checkResults);
        consequences.push(...branchResult.consequences);
        break;
      }
      default: throw new Error(`Unsupported dialogue effect: ${effect.effect}`);
    }
    if (effect.feedback) consequences.push({ effect: effect.effect, text: effect.feedback });
  }
  return { saveGame: save, routes, pendingChecks, checkResults, consequences };
}

export function resolveDialogueSkillCheck(check, input = {}) {
  if (!check?.skill || !Number.isFinite(check?.dc)) throw new Error("A resolved skill check requires a skill and DC");
  const d20 = Number(input.d20);
  const modifier = Number(input.modifier || 0);
  if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) throw new Error("Skill-check d20 must be an integer from 1 to 20");
  const total = d20 + modifier;
  return { ...check, d20, modifier, total, success: total >= check.dc, performerId: input.performerId || null };
}

export function getDialogueOptions(options = [], saveGame, policy = {}) {
  const unavailable = policy.unavailable || "disabled";
  return options.flatMap((raw) => {
    const option = structuredClone(raw);
    const requirements = option.requirements || {};
    const missing = (requirements.requiredFlags || []).filter((flag) => !hasStoryFlag(saveGame, flag));
    const forbidden = (requirements.forbiddenFlags || []).filter((flag) => hasStoryFlag(saveGame, flag));
    option.available = missing.length === 0 && forbidden.length === 0;
    if (!option.available) option.unavailableReason = option.unavailableReason || "Requirements not met";
    if (!option.available && (option.hidden === true || unavailable === "hidden")) return [];
    return [option];
  });
}

export function describeDialogueCheck(check, options = {}) {
  const skill = String(check?.skill || "check").replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const prefix = options.team === true ? "Team " : "";
  return `${prefix}${skill} — DC ${check?.dc}`;
}

function normalizeEffect(raw) {
  if (raw && typeof raw === "object") return { ...raw, quantity: Math.max(1, Number(raw.quantity) || 1) };
  const [effect, ...rest] = String(raw || "").split("=");
  return { effect, argument: rest.join("="), quantity: 1 };
}

function parseSkillCheck(argument) {
  const match = String(argument || "").match(/^([a-z]+(?:\.[a-z]+)*)\.dc\.(\d+)$/);
  return match ? { skill: match[1], dc: Number(match[2]) } : { id: argument, skill: null, dc: null };
}

function destinationRoute(destination) {
  if (typeof destination === "object") return structuredClone(destination);
  const [kind, ...rest] = String(destination).split(":");
  const id = `${kind}:${rest.join(":")}`;
  if (kind === "scene") return { type: "dialogue", id };
  if (kind === "encounter") return { type: "combat", id };
  if (kind === "map") return { type: "map", id };
  throw new Error(`Unsupported dialogue destination: ${destination}`);
}

function changeGold(saveGame, delta) {
  if (!Number.isFinite(delta)) throw new Error("change.gold requires a numeric argument");
  const save = normalizeSaveGameState(saveGame);
  const gold = save.inventory.currency.gold + delta;
  if (gold < 0) throw new Error("change.gold cannot reduce currency below zero");
  return normalizeSaveGameState({ ...save, inventory: { ...save.inventory, currency: { ...save.inventory.currency, gold } } });
}

function removeHolding(saveGame, itemId, quantity) {
  const save = normalizeSaveGameState(saveGame);
  const holdings = save.inventory.shared.map((entry) => ({ ...entry }));
  const entry = holdings.find((candidate) => (candidate.id || candidate.itemId) === itemId);
  if (!entry || (Number(entry.quantity) || 1) < quantity) throw new Error(`Not enough ${itemId} to remove`);
  entry.quantity = (Number(entry.quantity) || 1) - quantity;
  return normalizeSaveGameState({ ...save, inventory: { ...save.inventory, shared: holdings.filter((candidate) => candidate.quantity > 0) } });
}
