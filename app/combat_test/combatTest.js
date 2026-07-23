import {
  canPlayerAct,
  getActionById,
  getActorEconomyView,
  getCurrentActor,
  getActionLabel,
  getCoverAtSquare,
  getLivingOccupant,
  getOccupantForDisplay,
  getReachableSquareKeys,
  getValidTargetKeys,
  getValidTargets,
  hasAnyUsefulOption,
  isValidTarget,
  canSelectCombatAction,
  actionRequiresTarget,
  getCombatScenarioOptions,
} from "../combat/api.js";
import { createCombatInitiator } from "../combat/combatInitiator.js";
import { collectModifierDetails, getEffectiveAc } from "../combat/modifiers.js";
import { getCondition } from "../data/conditions.js";
import { createCombatLifecycleUi } from "./combatLifecycleUi.js";
import { renderCombatGrid } from "./gridUi.js";
import { renderCombatLog } from "./logUi.js";
import { createReactionPromptUi } from "./reactionPromptUi.js";
import { populateScenarioSelect } from "./scenarioSelectUi.js";
import { createSummaryUi } from "./summaryUi.js";
import { createTargetingUi, isAreaTargetingAction } from "./targetingUi.js";
import { isMultiTargetAction, multiTargetConfirmState, toggleTargetAssignment } from "./targetAssignmentModel.js";
import { initialiseAudio, audioRuntime } from "../audio/index.js";

await initialiseAudio();

const lifecycleUi = createCombatLifecycleUi();
await lifecycleUi.hydrate();
const combatInitiator = createCombatInitiator({
  scenarioOptions: lifecycleUi.scenarioOptions,
});
const controller = combatInitiator.game;
let presentationSettings = combatInitiator.presentationSettings;
lifecycleUi.setController(controller);
const initialScenarioId = new URLSearchParams(window.location.search).get("scenario");
if (initialScenarioId) controller.setScenario(initialScenarioId);

const gridEl = document.querySelector("#grid");
const logEl = document.querySelector("#combatLog");
const turnTitleEl = document.querySelector("#turnTitle");
const rotateBoardLeftEl = document.querySelector("#rotateBoardLeft");
const rotateBoardRightEl = document.querySelector("#rotateBoardRight");
const economyStripEl = document.querySelector("#economyStrip");
const actionButtonsEl = document.querySelector("#actionButtons");
const endTurnButtonEl = document.querySelector("#endTurnButton");
const targetTestPanelEl = document.querySelector("#targetTestPanel");
const targetTestStatusEl = document.querySelector("#targetTestStatus");
const confirmTargetButtonEl = document.querySelector("#confirmTargetButton");
const targetShapeSelectEl = document.querySelector("#targetShapeSelect");
const resetButtonEl = document.querySelector("#resetButton");
const diceToggleEl = document.querySelector("#diceToggle");
const scenarioSelectEl = document.querySelector("#scenarioSelect");
const tiltShiftToggleEl = document.querySelector("#tiltShiftToggle");
const summaryDialogEl = document.querySelector("#summaryDialog");
const summaryBodyEl = document.querySelector("#summaryBody");
const summaryResetEl = document.querySelector("#summaryReset");
const reactionDialogEl = document.querySelector("#reactionDialog");
const reactionTitleEl = document.querySelector("#reactionTitle");
const reactionBodyEl = document.querySelector("#reactionBody");
const reactionAcceptEl = document.querySelector("#reactionAccept");
const reactionDeclineEl = document.querySelector("#reactionDecline");

let selectedActionId = null;
let selectedTargetId = null;
let selectedTargetIds = [];
let selectedDamageType = null;
let aiRunning = false;
let openingHandoffDone = false;
let animation = null;
let targetPulseUntil = 0;
let tabInspectActive = false;
const DEFAULT_BOARD_ROTATION_QUARTER_TURNS = 3;
let boardRotationQuarterTurns = DEFAULT_BOARD_ROTATION_QUARTER_TURNS;
const targetingUi = createTargetingUi({
  controller,
  gridEl,
  panelEl: targetTestPanelEl,
  statusEl: targetTestStatusEl,
  confirmButtonEl: confirmTargetButtonEl,
  shapeSelectEl: targetShapeSelectEl,
  getSelectedActionId: () => selectedActionId,
  clearSelections,
  getAiRunning: () => aiRunning,
  getCurrentActor,
  getActionById,
  canPlayerAct,
  render,
  renderLog,
});
const summaryUi = createSummaryUi({
  controller,
  dialogEl: summaryDialogEl,
  bodyEl: summaryBodyEl,
  resetButtonEl: summaryResetEl,
  reset,
});
const reactionPromptUi = createReactionPromptUi({
  controller,
  dialogEl: reactionDialogEl,
  titleEl: reactionTitleEl,
  bodyEl: reactionBodyEl,
  acceptEl: reactionAcceptEl,
  declineEl: reactionDeclineEl,
  render,
});

initializeScenarioSelect();

function render({ skipAi = false } = {}) {
  syncSelection();
  renderHeader();
  renderGrid();
  renderControls();
  reactionPromptUi.renderPrompt();
  renderLog();
  if (!skipAi && !openingHandoffDone) {
    openingHandoffDone = true;
    advanceOpeningEnemyTurns();
    return;
  }
  if (!skipAi) maybeRunAi();
}

async function advanceOpeningEnemyTurns() {
  for (let attempts = 0; attempts < controller.snapshot.initiative.length; attempts += 1) {
    const actor = getCurrentActor(controller.snapshot);
    if (!actor || actor.team !== "enemies" || controller.snapshot.outcome || controller.pendingReaction) break;
    try {
      await controller.runEnemyTurnIfNeeded();
    } catch (error) {
      console.error("Opening enemy AI turn failed", error);
      break;
    }
  }
  render({ skipAi: true });
}

function syncSelection() {
  const actor = getCurrentActor(controller.snapshot);
  if (!actor) return;

  if (selectedActionId && !getActionById(actor, selectedActionId)) {
    selectedActionId = null;
    selectedTargetId = null;
    selectedTargetIds = [];
    selectedDamageType = null;
    targetingUi.reset();
  }

  const selectedAction = getActionById(actor, selectedActionId);
  targetingUi.syncForAction(selectedAction);

  const valid = selectedActionId && !isAreaTargetingAction(selectedAction)
    ? getValidTargets(controller.snapshot, actor.id, selectedActionId)
    : [];
  if (selectedTargetId && !valid.some((target) => target.id === selectedTargetId)) {
    selectedTargetId = null;
  }
  selectedTargetIds = selectedTargetIds.filter((id) => valid.some((target) => target.id === id));
}

function renderHeader() {
  const actor = getCurrentActor(controller.snapshot);
  const mode = controller.dice.deterministic ? "deterministic" : "live";
  turnTitleEl.textContent = actor
    ? `Round ${controller.snapshot.round}: ${actor.name} (${mode} dice)`
    : "Combat";
  diceToggleEl.textContent = controller.dice.deterministic ? "Deterministic: On" : "Deterministic: Off";
}

function renderGrid() {
  const snapshot = controller.snapshot;
  syncScenarioPresentation(snapshot);
  const actor = getCurrentActor(snapshot);
  const revealMovementGrid = tabInspectActive;
  const reachable = revealMovementGrid && canPlayerAct(snapshot, actor?.id, aiRunning)
    ? getReachableSquareKeys(snapshot, actor.id)
    : new Set();
  const targets = canPlayerAct(snapshot, actor?.id, aiRunning) && selectedActionId
    ? getValidTargetKeys(snapshot, actor.id, selectedActionId)
    : new Set();
  const shouldPulseTargets = Date.now() < targetPulseUntil;

  renderCombatGrid({
    gridEl,
    snapshot,
    actor,
    reachable,
    targets,
    shouldPulseTargets,
    selectedTargetId,
    selectedTargetIds,
    animation,
    tabInspectActive,
    presentationSettings,
    boardRotationQuarterTurns,
    getCoverAtSquare,
    getOccupantForDisplay,
    getConditionLabels,
    getActorHoverLines,
    getActorArmorClass: (item) => getEffectiveAc(snapshot, item),
    classIconClass,
    onCellClick,
  });
}

function syncScenarioPresentation(snapshot) {
  presentationSettings = {
    ...presentationSettings,
    camera: {
      ...presentationSettings.camera,
      ...(snapshot.metadata?.presentation?.camera || {}),
    },
    scenarioPresentation: structuredClone(snapshot.metadata?.presentation || {}),
  };
}

function renderControls() {
  const actor = getCurrentActor(controller.snapshot);
  const playerTurn = canPlayerAct(controller.snapshot, actor?.id, aiRunning);
  const reactionPending = Boolean(controller.pendingReaction);
  const fixedStageProjection = isFixedStageProjection(controller.snapshot);
  actionButtonsEl.innerHTML = "";
  targetTestPanelEl.hidden = true;
  confirmTargetButtonEl.textContent = "Confirm Target";

  try {
    endTurnButtonEl.disabled = !playerTurn || reactionPending;
    endTurnButtonEl.classList.toggle("glow", playerTurn && actor && !hasAnyUsefulOption(controller.snapshot, actor.id));
    diceToggleEl.disabled = aiRunning || reactionPending;
    resetButtonEl.disabled = aiRunning;
    scenarioSelectEl.disabled = aiRunning || reactionPending;
    tiltShiftToggleEl.disabled = aiRunning || reactionPending;
    rotateBoardLeftEl.disabled = aiRunning || reactionPending || fixedStageProjection;
    rotateBoardRightEl.disabled = aiRunning || reactionPending || fixedStageProjection;
  } catch (error) {
    console.error("Combat control state failed", error);
  }

  if (actor && !reactionPending && playerTurn) {
    renderActionGroup(actor, playerTurn, "action", "Action");
    renderActionGroup(actor, playerTurn, "bonus", "Bonus Action");
    renderActionGroup(actor, playerTurn, "free", "Free");
    renderActionGroup(actor, playerTurn, "reaction", "Reaction");
    renderSelectedActionHelp(actor);
  }

  try {
    renderEconomy(actor, playerTurn && !reactionPending);
    targetingUi.renderPanel(actor, playerTurn && !reactionPending);
    renderMultiTargetPanel(actor, playerTurn && !reactionPending);
  } catch (error) {
    console.error("Combat auxiliary controls failed", error);
  }
}

function renderActionGroup(actor, playerTurn, cost, label) {
  const actions = actor.actions.filter((action) => (action.cost || "action") === cost && !action.reactionPolicy);
  if (!actions.length) return;

  const group = document.createElement("div");
  group.className = "control-group";

  const heading = document.createElement("div");
  heading.className = "control-label";
  heading.textContent = label;
  group.appendChild(heading);

  const row = document.createElement("div");
  row.className = "control-row";

  const spellActions = actions.filter((action) => action.type.startsWith("spell_"));
  const directActions = actions.filter((action) => !action.type.startsWith("spell_"));

  for (const action of directActions) {
    row.appendChild(createActionButton(actor, action, playerTurn));
  }
  if (spellActions.length) {
    row.appendChild(createSpellSelect(actor, spellActions, playerTurn, `${label} Spells`));
    const selectedSpellAction = spellActions.find((action) => action.id === selectedActionId);
    if (selectedSpellAction?.damageTypeChoices?.length) {
      row.appendChild(createDamageTypeSelect(selectedSpellAction, playerTurn));
    }
  }

  group.appendChild(row);
  actionButtonsEl.appendChild(group);
}

function createActionButton(actor, action, playerTurn) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option-button";
  if (action.id === selectedActionId) button.classList.add("active");
  button.disabled = !playerTurn || !canSelectCombatAction(controller.snapshot, actor.id, action.id);
  button.textContent = getActionLabel(controller.snapshot, actor.id, action.id);
  button.title = describeAction(action);
  button.setAttribute("aria-label", `${action.name}: ${describeAction(action)}`);
  button.addEventListener("click", () => chooseAction(actor, action));
  return button;
}

function createSpellSelect(actor, spellActions, playerTurn, label) {
  const select = document.createElement("select");
  select.className = "option-select";
  select.disabled = !playerTurn;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = label;
  select.appendChild(placeholder);

  for (const action of spellActions) {
    const option = document.createElement("option");
    option.value = action.id;
    option.textContent = getActionLabel(controller.snapshot, actor.id, action.id);
    option.title = describeAction(action);
    option.disabled = !canSelectCombatAction(controller.snapshot, actor.id, action.id);
    select.appendChild(option);
  }
  const selectedSpell = spellActions.find((action) => action.id === selectedActionId);
  select.title = selectedActionId
    ? describeAction(selectedSpell) || label
    : label;

  select.value = selectedActionId && spellActions.some((action) => action.id === selectedActionId)
    ? selectedActionId
    : "";

  select.addEventListener("change", () => {
    const action = spellActions.find((item) => item.id === select.value);
    if (!action) {
      selectedActionId = null;
      selectedTargetId = null;
      selectedTargetIds = [];
      render();
      return;
    }
    chooseAction(actor, action);
  });
  return select;
}

function createDamageTypeSelect(action, playerTurn) {
  const select = document.createElement("select");
  select.className = "option-select";
  select.disabled = !playerTurn;
  select.replaceChildren(...action.damageTypeChoices.map((type) => new Option(titleCase(type), type)));
  select.value = selectedDamageType || action.damageTypeChoices[0];
  select.title = "Choose the damage type for this action.";
  select.addEventListener("change", () => {
    selectedDamageType = select.value;
  });
  return select;
}

function chooseAction(actor, action) {
  if (selectedActionId === action.id) {
    clearSelections();
    targetingUi.reset();
    render();
    return;
  }
  selectedActionId = action.id;
  selectedTargetId = null;
  selectedTargetIds = [];
  selectedDamageType = action.damageTypeChoices?.[0] || null;
  targetingUi.start(action);
  if (!actionRequiresTarget(controller.snapshot, actor.id, action.id)) {
    controller.action(actor.id, action.id, actionPayload(null));
    selectedActionId = null;
    selectedDamageType = null;
    targetingUi.reset();
    render();
    return;
  }
  targetPulseUntil = Date.now() + 1050;
  render();
}

function renderMultiTargetPanel(actor, playerTurn) {
  const action = getActionById(actor, selectedActionId);
  if (!playerTurn || !isMultiTargetAction(action)) return;
  targetTestPanelEl.hidden = false;
  targetShapeSelectEl.hidden = true;
  const state = multiTargetConfirmState(action, selectedTargetIds);
  confirmTargetButtonEl.disabled = state.disabled;
  confirmTargetButtonEl.textContent = state.text;
  statusElForMulti().textContent = state.status;
}

function statusElForMulti() {
  return targetTestStatusEl;
}

function renderSelectedActionHelp(actor) {
  const action = getActionById(actor, selectedActionId);
  const node = document.createElement("div");
  node.className = "action-help";
  node.textContent = action ? describeAction(action) : "Hover over an ability name for details. Click a selected ability again to cancel it.";
  node.title = node.textContent;
  actionButtonsEl.appendChild(node);
}

function renderEconomy(actor, playerTurn) {
  economyStripEl.innerHTML = "";
  if (!actor || actor.team !== "heroes") return;

  const summary = document.createElement("div");
  summary.className = "actor-turn-summary";
  const title = buildActorSummaryTitle(actor);
  summary.title = title;
  summary.innerHTML = `
    <strong>${actor.name}</strong>
    <span>${buildActorClassLine(actor)}</span>
    <span>${buildAbilityLine(actor)}</span>
  `;
  economyStripEl.appendChild(summary);

  for (const item of getActorEconomyView(controller.snapshot, actor.id)) {
    const node = document.createElement("div");
    node.className = "economy-item";
    if (item.spent || !playerTurn) node.classList.add("spent");
    if (item.idle) node.classList.add("idle");
    node.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    economyStripEl.appendChild(node);
  }
}

function describeAction(action) {
  if (!action) return "";
  return action.description || action.text || action.summary || action.name;
}

function buildActorSummaryTitle(actor) {
  const actions = (actor.actions || [])
    .map((action) => `${action.name}: ${describeAction(action)}`)
    .join("\n");
  return [buildActorClassLine(actor), buildAbilityLine(actor), actions].filter(Boolean).join("\n\n");
}

function buildActorClassLine(actor) {
  const className = actor.className || actor.class || actor.classId || actor.role || "Combatant";
  const level = actor.level ? `Level ${actor.level}` : null;
  return [level, titleCase(String(className).replaceAll("_", " ")), `AC ${getEffectiveAc(controller.snapshot, actor)}`, `HP ${actor.hp}/${actor.maxHp}`]
    .filter(Boolean)
    .join(" • ");
}

function buildAbilityLine(actor) {
  const mods = actor.abilityMods || actor.abilities || actor.saves || {};
  const pairs = [
    ["STR", "str", "strength"],
    ["DEX", "dex", "dexterity"],
    ["CON", "con", "constitution"],
    ["INT", "int", "intelligence"],
    ["WIS", "wis", "wisdom"],
    ["CHA", "cha", "charisma"],
  ];
  return pairs
    .map(([label, shortKey, longKey]) => {
      const value = mods[shortKey] ?? mods[longKey];
      return Number.isFinite(value) ? `${label} ${formatSigned(value)}` : null;
    })
    .filter(Boolean)
    .join("  ");
}

function renderLog() {
  renderCombatLog(logEl, controller.log.events);
}

async function maybeRunAi() {
  const actor = getCurrentActor(controller.snapshot);
  if (!actor || actor.team !== "enemies" || controller.snapshot.outcome || aiRunning || controller.pendingReaction) {
    if (controller.snapshot.outcome) {
      lifecycleUi.syncOutcome();
      summaryUi.show();
    }
    return;
  }

  aiRunning = true;
  setControlsBusy(true);
  try {
    await sleep(320);
    await controller.runEnemyTurnIfNeeded({
      afterStep: async (step) => {
        animation = { kind: step.kind, actorId: step.actorId, targetId: step.targetId || null };
        render({ skipAi: true });
        await sleep(step.kind === "attack" ? 620 : 260);
      },
    });
  } catch (error) {
    console.error("Enemy AI turn failed", error);
  } finally {
    animation = null;
    aiRunning = false;
    setControlsBusy(false);
    render();
  }
}

function setControlsBusy(busy) {
  endTurnButtonEl.disabled = busy || Boolean(controller.pendingReaction);
  resetButtonEl.disabled = busy;
  diceToggleEl.disabled = busy;
  tiltShiftToggleEl.disabled = busy;
  rotateBoardLeftEl.disabled = busy;
  rotateBoardRightEl.disabled = busy;
}

function onCellClick(pos) {
  const actor = getCurrentActor(controller.snapshot);
  if (!canPlayerAct(controller.snapshot, actor?.id, aiRunning)) return;
  const selectedAction = getActionById(actor, selectedActionId);
  if (isAreaTargetingAction(selectedAction)) {
    targetingUi.lock(pos);
    return;
  }
  if (selectedActionId) {
    const occupant = getLivingOccupant(controller.snapshot, pos);
    if (!occupant || !isValidTarget(controller.snapshot, actor.id, selectedActionId, occupant.id)) return;
    const selectedAction = getActionById(actor, selectedActionId);
    if (isMultiTargetAction(selectedAction)) {
      selectedTargetIds = toggleTargetAssignment(selectedTargetIds, occupant.id, selectedAction);
      render();
      return;
    }
    selectedTargetId = occupant.id;
    confirmAction();
    return;
  }
  if (samePosition(actor.position, pos)) return;
  controller.move(actor.id, pos);
  render();
}

function samePosition(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

function confirmAction() {
  const actor = getCurrentActor(controller.snapshot);
  const selectedAction = getActionById(actor, selectedActionId);
  const targetPayload = isMultiTargetAction(selectedAction) ? selectedTargetIds : selectedTargetId;
  if (!canPlayerAct(controller.snapshot, actor?.id, aiRunning) || !selectedActionId || isMissingTargetPayload(targetPayload)) return;
  const resolved = controller.resolveAction(actor.id, selectedActionId, actionPayload(targetPayload));
  if (resolved?.ok) {
    audioRuntime.playEvent(isSpellAction(selectedAction) ? "SPELL_CAST" : "WEAPON_SWING");
    clearSelections();
    targetingUi.reset();
  }
  render();
}

function isSpellAction(action) {
  return action?.source === "spell" || action?.kind === "spell" || action?.tags?.includes?.("spell") || Boolean(action?.spellId);
}

function confirmTargetSelection() {
  const actor = getCurrentActor(controller.snapshot);
  const action = getActionById(actor, selectedActionId);
  if (isMultiTargetAction(action)) {
    confirmAction();
    return;
  }
  targetingUi.confirm();
}

function actionPayload(targetId) {
  const choices = {};
  if (selectedDamageType) choices.damageType = selectedDamageType;
  if (Array.isArray(targetId)) {
    const payload = { targetIds: [...targetId] };
    if (Object.keys(choices).length) payload.choices = choices;
    return payload;
  }
  if (!Object.keys(choices).length) return targetId;
  return { targetId, choices };
}

function isMissingTargetPayload(payload) {
  return Array.isArray(payload) ? payload.length < 1 : !payload;
}

function endTurn() {
  if (aiRunning) return;
  clearSelections();
  targetingUi.reset();
  controller.endTurn();
  render();
}

function reset() {
  if (aiRunning) return;
  resetFromLatestSave();
}

async function resetFromLatestSave() {
  await lifecycleUi.hydrate();
  controller.reset();
  clearTransientUi();
  render();
}

function switchScenario() {
  if (aiRunning) return;
  switchScenarioFromLatestSave();
}

async function switchScenarioFromLatestSave() {
  await lifecycleUi.hydrate();
  controller.setScenario(scenarioSelectEl.value);
  clearTransientUi();
  render();
}

function clearTransientUi() {
  selectedActionId = null;
  selectedTargetId = null;
  selectedTargetIds = [];
  selectedDamageType = null;
  animation = null;
  openingHandoffDone = false;
  boardRotationQuarterTurns = DEFAULT_BOARD_ROTATION_QUARTER_TURNS;
  lifecycleUi.reset();
  targetPulseUntil = 0;
  targetingUi.reset();
  if (summaryDialogEl.open) summaryDialogEl.close();
  if (reactionDialogEl.open) reactionDialogEl.close();
}

function initializeScenarioSelect() {
  populateScenarioSelect(scenarioSelectEl, getCombatScenarioOptions(), controller.scenarioId);
}

function handleKey(event) {
  if (event.key === presentationSettings.tabOverlay.holdKey) {
    event.preventDefault();
    if (!tabInspectActive) {
      tabInspectActive = true;
      render({ skipAi: true });
    }
    return;
  }
  if (controller.pendingReaction) {
    if (event.key === "Enter") {
      event.preventDefault();
      reactionPromptUi.answer(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      reactionPromptUi.answer(false);
    }
    return;
  }
  const actor = getCurrentActor(controller.snapshot);
  if (!canPlayerAct(controller.snapshot, actor?.id, aiRunning)) return;
  const key = event.key.toLowerCase();
  const deltas = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
  };
  if (deltas[key]) {
    event.preventDefault();
    controller.move(actor.id, {
      x: actor.position.x + deltas[key].x,
      y: actor.position.y + deltas[key].y,
    });
    render();
  } else if (key === "enter") {
    event.preventDefault();
    if (selectedTargetId) confirmAction();
    else if (selectedTargetIds.length) confirmAction();
    else endTurn();
  } else if (key === "escape") {
    event.preventDefault();
    if (selectedActionId) {
      clearSelections();
      targetingUi.reset();
      render();
    } else {
      endTurn();
    }
  } else if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    if (actor.actions[index]) {
      chooseAction(actor, actor.actions[index]);
    }
  }
}

function handleKeyUp(event) {
  if (event.key !== presentationSettings.tabOverlay.holdKey) return;
  event.preventDefault();
  clearTabInspect();
}

function clearTabInspect() {
  if (!tabInspectActive) return;
  tabInspectActive = false;
  render({ skipAi: true });
}

function syncPresentationSettings() {
  presentationSettings = {
    ...presentationSettings,
    tiltShift: {
      ...presentationSettings.tiltShift,
      enabled: tiltShiftToggleEl.checked,
    },
  };
  render({ skipAi: true });
}

function rotateBoard(delta) {
  if (isFixedStageProjection(controller.snapshot)) return;
  boardRotationQuarterTurns = (boardRotationQuarterTurns + delta + 4) % 4;
  render({ skipAi: true });
}

function isFixedStageProjection(snapshot) {
  const projection = snapshot?.metadata?.presentation?.gridProjection;
  return projection?.fixedStage === true || projection?.kind === "stage_metadata";
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clearSelections() {
  selectedActionId = null;
  selectedTargetId = null;
  selectedTargetIds = [];
  selectedDamageType = null;
}

function titleCase(value) {
  return String(value || "").split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function getConditionLabels(actor) {
  return (actor.conditions || []).map((condition) => conditionLabel(controller.snapshot, condition));
}

function getActorHoverLines(actor, zoneObjects = []) {
  const snapshot = controller.snapshot;
  const effectiveAc = getEffectiveAc(snapshot, actor);
  const acSources = actor.armorClassSources?.length
    ? actor.armorClassSources.map((source) => `${source.label} ${formatSigned(source.amount)}${source.detail ? ` (${source.detail})` : ""}`)
    : [`Base AC ${actor.ac}`];
  const acModifiers = collectModifierDetails(snapshot, actor, "ac").map(formatModifierDetail);
  const incomingAttackModifiers = collectModifierDetails(snapshot, actor, "incoming_attack_roll").map(formatModifierDetail);
  const speedModifiers = collectModifierDetails(snapshot, actor, "speed").map(formatModifierDetail);
  const conditions = getConditionLabels(actor);
  const lines = [
    `${actor.name} (${actor.role || actor.team})`,
    `HP ${actor.hp}/${actor.maxHp}${actor.tempHp ? ` +${actor.tempHp} temp` : ""}`,
    `AC ${effectiveAc}${effectiveAc !== actor.ac ? ` (base ${actor.ac})` : ""}`,
    `AC sources: ${acSources.join(", ")}`,
  ];
  if (acModifiers.length) lines.push(`AC modifiers: ${acModifiers.join(", ")}`);
  if (incomingAttackModifiers.length) lines.push(`Incoming attacks: ${incomingAttackModifiers.join(", ")}`);
  if (speedModifiers.length) lines.push(`Speed modifiers: ${speedModifiers.join(", ")}`);
  if (conditions.length) lines.push(...conditions);
  if (zoneObjects.length) lines.push(`Zone: ${zoneObjects.map((object) => object.name).join(", ")}`);
  return lines;
}

function formatModifierDetail(detail) {
  const parts = [detail.label || detail.id || detail.stat];
  if (detail.die) parts.push(formatDieModifier(detail));
  if (detail.amount) parts.push(formatSigned(detail.amount));
  if (detail.mode) parts.push(detail.mode);
  return parts.join(" ");
}

function formatDieModifier(detail) {
  const sign = detail.multiplier === -1 ? "-" : "+";
  return `${sign}${detail.die}`;
}

function formatSigned(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function classIconClass(actor) {
  if (actor.role === "wizard") return "class-icon-wizard";
  if (actor.role === "archer") return "class-icon-archer";
  if (actor.role === "swordsman") return "class-icon-swordsman";
  if (actor.role === "fighter") return "class-icon-fighter";
  return actor.team === "heroes" ? "class-icon-hero" : "class-icon-enemy";
}

function conditionLabel(snapshot, condition) {
  const record = getCondition(condition.id);
  const name = record?.name || condition.label || condition.id;
  const source = conditionSourceText(snapshot, condition);
  const effects = record?.effects?.length ? ` ${record.effects.join(" ")}` : "";
  return `${name}${source ? ` from ${source}` : ""}.${effects}`;
}

function conditionSourceText(snapshot, condition) {
  const sourceActor = snapshot.actors.find((actor) => actor.id === condition.sourceActorId);
  const sourceAction = sourceActor?.actions?.find((action) => action.id === condition.sourceActionId);
  if (sourceAction && sourceActor) return `${sourceAction.name} (${sourceActor.name})`;
  const sourceObject = (snapshot.combatObjects || []).find((object) => object.id === condition.sourceActionId || object.id === condition.sourceActorId);
  if (sourceObject) return sourceObject.name;
  return condition.sourceActionId ? condition.sourceActionId.split("_").join(" ") : "";
}

endTurnButtonEl.addEventListener("click", endTurn);
confirmTargetButtonEl.addEventListener("click", confirmTargetSelection);
targetShapeSelectEl.addEventListener("change", targetingUi.onShapeChange);
gridEl.addEventListener("pointermove", targetingUi.onPointerMove);
gridEl.addEventListener("dblclick", targetingUi.onGridDoubleClick);
resetButtonEl.addEventListener("click", reset);
diceToggleEl.addEventListener("click", () => {
  if (aiRunning) return;
  controller.toggleDeterministic();
  render();
});
scenarioSelectEl.addEventListener("change", switchScenario);
tiltShiftToggleEl.addEventListener("change", syncPresentationSettings);
rotateBoardLeftEl.addEventListener("click", () => rotateBoard(-1));
rotateBoardRightEl.addEventListener("click", () => rotateBoard(1));
window.addEventListener("keydown", handleKey);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", clearTabInspect);

render();
