import {
  canPlayerAct,
  createCombatGame,
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
import { collectModifierDetails, getEffectiveAc } from "../combat/modifiers.js";
import { getCondition } from "../data/conditions.js";
import { createCombatLifecycleUi } from "./combatLifecycleUi.js";
import { renderCombatGrid } from "./gridUi.js";
import { renderCombatLog } from "./logUi.js";
import { createReactionPromptUi } from "./reactionPromptUi.js";
import { populateScenarioSelect } from "./scenarioSelectUi.js";
import { createSummaryUi } from "./summaryUi.js";
import { createTargetingUi, isAreaTargetingAction } from "./targetingUi.js";

const lifecycleUi = createCombatLifecycleUi();
await lifecycleUi.hydrate();
const controller = createCombatGame({
  scenarioOptions: lifecycleUi.scenarioOptions,
});
lifecycleUi.setController(controller);

const gridEl = document.querySelector("#grid");
const logEl = document.querySelector("#combatLog");
const turnTitleEl = document.querySelector("#turnTitle");
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
let selectedDamageType = null;
let aiRunning = false;
let animation = null;
let targetPulseUntil = 0;
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
  if (!skipAi) maybeRunAi();
}

function syncSelection() {
  const actor = getCurrentActor(controller.snapshot);
  if (!actor) return;

  if (selectedActionId && !getActionById(actor, selectedActionId)) {
    selectedActionId = null;
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
  const actor = getCurrentActor(snapshot);
  const reachable = canPlayerAct(snapshot, actor?.id, aiRunning)
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
    animation,
    getCoverAtSquare,
    getOccupantForDisplay,
    getConditionLabels,
    getActorHoverLines,
    classIconClass,
    onCellClick,
  });
}

function renderControls() {
  const actor = getCurrentActor(controller.snapshot);
  const playerTurn = canPlayerAct(controller.snapshot, actor?.id, aiRunning);
  const reactionPending = Boolean(controller.pendingReaction);
  endTurnButtonEl.disabled = !playerTurn || reactionPending;
  endTurnButtonEl.classList.toggle("glow", playerTurn && actor && !hasAnyUsefulOption(controller.snapshot, actor.id));
  diceToggleEl.disabled = aiRunning || reactionPending;
  resetButtonEl.disabled = aiRunning;
  scenarioSelectEl.disabled = aiRunning || reactionPending;

  renderEconomy(actor, playerTurn && !reactionPending);
  targetingUi.renderPanel(actor, playerTurn && !reactionPending);
  actionButtonsEl.innerHTML = "";

  if (!actor || reactionPending) return;

  renderActionGroup(actor, playerTurn, "action", "Action");
  renderActionGroup(actor, playerTurn, "bonus", "Bonus Action");
  renderActionGroup(actor, playerTurn, "reaction", "Reaction");
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
  button.title = action.description || action.name;
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
    option.title = action.description || action.name;
    option.disabled = !canSelectCombatAction(controller.snapshot, actor.id, action.id);
    select.appendChild(option);
  }
  select.title = selectedActionId
    ? spellActions.find((action) => action.id === selectedActionId)?.description || label
    : label;

  select.value = selectedActionId && spellActions.some((action) => action.id === selectedActionId)
    ? selectedActionId
    : "";

  select.addEventListener("change", () => {
    const action = spellActions.find((item) => item.id === select.value);
    if (!action) {
      selectedActionId = null;
      selectedTargetId = null;
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
  selectedActionId = action.id;
  selectedTargetId = null;
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

function renderEconomy(actor, playerTurn) {
  economyStripEl.innerHTML = "";
  if (!actor || actor.team !== "heroes") return;

  for (const item of getActorEconomyView(controller.snapshot, actor.id)) {
    const node = document.createElement("div");
    node.className = "economy-item";
    if (item.spent || !playerTurn) node.classList.add("spent");
    if (item.idle) node.classList.add("idle");
    node.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    economyStripEl.appendChild(node);
  }
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
  await sleep(320);
  await controller.runEnemyTurnIfNeeded({
    afterStep: async (step) => {
      animation = { kind: step.kind, actorId: step.actorId, targetId: step.targetId || null };
      render({ skipAi: true });
      await sleep(step.kind === "attack" ? 620 : 260);
    },
  });
  animation = null;
  aiRunning = false;
  setControlsBusy(false);
  render();
}

function setControlsBusy(busy) {
  endTurnButtonEl.disabled = busy || Boolean(controller.pendingReaction);
  resetButtonEl.disabled = busy;
  diceToggleEl.disabled = busy;
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
  if (!canPlayerAct(controller.snapshot, actor?.id, aiRunning) || !selectedActionId || !selectedTargetId) return;
  controller.action(actor.id, selectedActionId, actionPayload(selectedTargetId));
  clearSelections();
  targetingUi.reset();
  render();
}

function actionPayload(targetId) {
  const choices = {};
  if (selectedDamageType) choices.damageType = selectedDamageType;
  if (!Object.keys(choices).length) return targetId;
  return { targetId, choices };
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
  selectedDamageType = null;
  animation = null;
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
    else endTurn();
  } else if (key === "tab") {
    event.preventDefault();
    cycleTarget(event.shiftKey ? -1 : 1);
  } else if (key === "escape") {
    event.preventDefault();
    endTurn();
  } else if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    if (actor.actions[index]) {
      chooseAction(actor, actor.actions[index]);
    }
  }
}

function cycleTarget(delta) {
  const actor = getCurrentActor(controller.snapshot);
  if (!actor) return;
  const targets = selectedActionId ? getValidTargets(controller.snapshot, actor.id, selectedActionId) : [];
  if (!targets.length) return;
  const current = targets.findIndex((target) => target.id === selectedTargetId);
  const next = (current + delta + targets.length) % targets.length;
  selectedTargetId = targets[next]?.id || null;
  render();
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clearSelections() {
  selectedActionId = null;
  selectedTargetId = null;
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
confirmTargetButtonEl.addEventListener("click", targetingUi.confirm);
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
window.addEventListener("keydown", handleKey);

render();
