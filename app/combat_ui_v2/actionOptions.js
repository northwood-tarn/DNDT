import { createCombatGame } from "../combat/api.js";
import { getSpellById } from "../data/spells.js";

const SPELL_ICON_ALIASES = Object.freeze({
  burning_hands_jester: "burning_hands",
  false_life_jester: "false_life",
  magic_missile_jester: "magic_missile",
  thunderwave_jester: "thunderwave",
});
import { getWeaponMastery } from "../data/weaponMasteries.js";
import { getArmorById } from "../data/armor.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { getWeaponById } from "../data/weapons.js";
import { actionIconCategory, createActionIconImage } from "./actionIconRegistry.js";
import { equipDraggedItem, installCharacterPanel, installEquipmentPanelContent } from "./equipmentDrawer.js";
import { createItemIconImage } from "../ui/itemIconRegistry.js";
import { reconcileEquipmentGrantedActions } from "../combat/equipmentGrantedActions.js";
import { getGreyharbourQuests } from "../data/quests.js";

const scenarioId = new URLSearchParams(window.location.search).get("scenario");
if (!scenarioId) throw new Error("Action Options requires combat scenario state.");
const game = createCombatGame({ scenarioId });
const actor = game.snapshot.actors.find((candidate) => candidate.team === "heroes");
if (!actor) throw new Error("Action Options requires an active player or companion.");
const economyChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`dndt-economy:${actor.id}`) : null;
const equipmentDragChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`dndt-equipment:${actor.id}`) : null;
const spellOrderChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`dndt-spell-order:${actor.id}`) : null;
let curatedSpellOrder = {};
try { curatedSpellOrder = JSON.parse(localStorage.getItem(`dndt.spellOrder:${actor.id}`) || "{}") || {}; } catch (_error) { curatedSpellOrder = {}; }
let activeEquipmentDrag = null;
let equipmentPanelState = null;
let economyState = {
  action: actor.economy?.actionAvailable !== false,
  bonus: actor.economy?.bonusActionAvailable !== false,
};
equipmentDragChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "item-drag-start") activeEquipmentDrag = event.data.drag;
  if (event.data?.type === "item-drag-end") activeEquipmentDrag = null;
});
spellOrderChannel?.addEventListener("message", (event) => {
  if (event.data?.casterId !== actor.id || !event.data?.levels) return;
  curatedSpellOrder = event.data.levels;
  renderActionLibraries();
});
const PANE_LABELS = {
  "action-options": "Action Options",
  inventory: "Inventory",
  equipment: "Equipment",
  character: "Character",
  quests: "Quests",
};
const PANE_KEYS = { "action-options": "O", inventory: "I", equipment: "E", character: "C", quests: "Q" };
const PANE_BY_CODE = { KeyO: "action-options", KeyI: "inventory", KeyE: "equipment", KeyC: "character", KeyQ: "quests" };
const paneQuery = new URLSearchParams(window.location.search);
window.api?.onEmberScreenState?.((open) => {
  document.body.classList.toggle("is-ember-inactive", open);
});
const detachedPaneId = paneQuery.get("panel");
const embeddedPane = paneQuery.get("embedded") === "1";
if (embeddedPane) document.body.classList.add("is-embedded-pane");
const tabList = document.querySelector(".pane-tabs");
const paneTitle = document.querySelector("[data-pane-title]");
const paneSingleTitle = document.querySelector("[data-pane-single-title]");
const ensembleDragSurfaces = [...document.querySelectorAll(".pane-window-drag-surface")];
const panePanels = [...document.querySelectorAll("[data-pane-panel]")];
const descriptionPanel = document.querySelector(".pane-description");
const closeButton = document.querySelector(".pane-close");
const ensembleHandle = document.querySelector(".combat-ensemble-handle");
const titleKeyButton = document.querySelector(".pane-title-key");
let activePaneId = detachedPaneId || "action-options";
let groupedPaneIds = detachedPaneId ? [detachedPaneId] : [];
let paneDock = null;
const routedDescriptionActions = new WeakMap();
let routedDescriptionElement = null;
let ensembleDragPointerId = null;
let ensembleHandlePointerId = null;

ensembleHandle?.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  ensembleHandlePointerId = event.pointerId;
  ensembleHandle.setPointerCapture?.(event.pointerId);
  window.api?.dragConnectedCombatWindows?.("start", { x: event.screenX, y: event.screenY });
});
ensembleHandle?.addEventListener("pointerenter", () => window.api?.suppressCombatHandleResize?.(true));
ensembleHandle?.addEventListener("pointerleave", () => {
  if (ensembleHandlePointerId === null) window.api?.suppressCombatHandleResize?.(false);
});
document.addEventListener("pointermove", (event) => {
  if (event.pointerId === ensembleHandlePointerId) window.api?.dragConnectedCombatWindows?.("move", { x: event.screenX, y: event.screenY });
});
const endConnectedWindowDrag = (event) => {
  if (event.pointerId !== ensembleHandlePointerId) return;
  window.api?.dragConnectedCombatWindows?.("end", { x: event.screenX, y: event.screenY });
  ensembleHandlePointerId = null;
  window.api?.suppressCombatHandleResize?.(false);
};
document.addEventListener("pointerup", endConnectedWindowDrag);
document.addEventListener("pointercancel", endConnectedWindowDrag);
window.api?.onCombatEnsembleHandle?.((state) => {
  if (ensembleHandle) ensembleHandle.hidden = state?.visible !== true;
});

function beginEnsembleDrag(event) {
  if (!detachedPaneId || event.button !== 0) return;
  event.preventDefault();
  ensembleDragPointerId = event.pointerId;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  window.api?.dragCombatEnsemble?.("start", { x: event.screenX, y: event.screenY });
}

function moveEnsembleDrag(event) {
  if (event.pointerId !== ensembleDragPointerId) return;
  window.api?.dragCombatEnsemble?.("move", { x: event.screenX, y: event.screenY });
}

function endEnsembleDrag(event) {
  if (event.pointerId !== ensembleDragPointerId) return;
  window.api?.dragCombatEnsemble?.("end", { x: event.screenX, y: event.screenY });
  ensembleDragPointerId = null;
}

for (const dragSurface of ensembleDragSurfaces) dragSurface.addEventListener("pointerdown", beginEnsembleDrag);
for (const panel of panePanels) {
  panel.addEventListener("pointerdown", (event) => {
    if (event.target === panel) beginEnsembleDrag(event);
  });
}
document.addEventListener("pointermove", moveEnsembleDrag);
document.addEventListener("pointerup", endEnsembleDrag);
document.addEventListener("pointercancel", endEnsembleDrag);
let paneSettings = { offerSpellUpcasting: true };
let currentPaneState = Object.fromEntries(Object.keys(PANE_LABELS).map((paneId) => [paneId, { visible: true, detached: false }]));

function economy(action) {
  if (action.cost === "bonus" || action.cost === "bonus_action") return "bonus";
  return action.cost;
}

function category(action) {
  if (action.tags?.weapon) return Number(action.weaponSet) === 2 ? "Weapon Set 2" : "Weapon Set 1";
  if (action.tags?.spell) return "Spells";
  if (action.tags?.consumable || action.type === "consumable") return "Consumables";
  if (action.secondaryChoice) return "Abilities";
  if (action.type === "consumable" || (action.tags?.device && !action.choiceParentResourceId)) return "Consumables";
  if (action.resourceId === "channel_divinity") return "Channel Divinity";
  if (["dash", "dodge", "hide", "disengage"].includes(action.type) || ["hide", "disengage"].includes(action.actionKind)) return "Tactics";
  return "Abilities";
}

function payload(action, secondaryChoice = null) {
  const availability = availabilityFor(action, secondaryChoice);
  return {
    id: action.id,
    name: action.name,
    economy: economy(action),
    kind: action.tags?.spell ? "spell" : "action",
    iconId: action.iconId || SPELL_ICON_ALIASES[action.sourceSpellId] || action.sourceSpellId || secondaryChoice?.id || action.id,
    iconCategory: actionIconCategory(secondaryChoice || action),
    spellLevel: Number.isFinite(action.spellLevel) ? action.spellLevel : null,
    secondaryChoiceId: secondaryChoice?.id || null,
    secondaryChoiceName: secondaryChoice?.name || null,
    description: descriptionFor(action),
    available: availability.available,
    unavailableReason: availability.reason,
    weaponPair: action.weaponPair || null,
  };
}

function availabilityFor(action, secondaryChoice = null) {
  const actionEconomy = economy(action);
  if (Object.hasOwn(economyState, actionEconomy) && !economyState[actionEconomy]) {
    return { available: false, reason: `${actionEconomy === "bonus" ? "Bonus Action" : "Action"} already used` };
  }
  const itemIds = [action.itemId, secondaryChoice?.itemId].filter(Boolean);
  for (const itemId of itemIds) {
    const quantity = actor.inventory?.find((item) => item.id === itemId)?.quantity || 0;
    if (quantity <= 0) return { available: false, reason: "You currently do not have any of this item to consume" };
  }
  const resourceIds = new Set([
    action.resourceId,
    ...(action.additionalResourceIds || []),
    secondaryChoice?.resourceId,
    ...(secondaryChoice?.additionalResourceIds || []),
  ].filter(Boolean));
  for (const resourceId of resourceIds) {
    const resource = actor.resources?.find((item) => item.id === resourceId);
    if (resource && resource.current <= 0) return { available: false, reason: "You currently do not have any of this item to consume" };
  }
  return { available: true, reason: "" };
}

function syncEconomyState(nextState) {
  economyState = { ...economyState, ...nextState };
  for (const summary of document.querySelectorAll("[data-economy-summary]")) {
    const available = economyState[summary.dataset.economySummary] !== false;
    const section = summary.closest(".economy-section");
    section.classList.toggle("is-spent", !available);
  }
}

economyChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "economy-state") syncEconomyState(event.data.economy);
});
economyChannel?.postMessage({ type: "economy-state-request" });

function setDragData(event, data) {
  const encoded = JSON.stringify(data);
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/x-dndt-action", encoded);
  event.dataTransfer.setData(`application/x-dndt-${data.economy}`, encoded);
  event.dataTransfer.setData("text/plain", encoded);
}

function descriptionFor(action) {
  if (action.description) return action.description;
  if (action.tags?.weapon) {
    const mastery = action.weaponMasteryActive === true ? getWeaponMastery(action.weaponMastery) : null;
    return [`${action.damage} ${action.damageType} damage.`, mastery ? `${mastery.name}: ${mastery.description}` : null].filter(Boolean).join(" ");
  }
  const standardActionDescriptions = {
    dash: "Gain additional movement equal to your Speed for this turn.",
    dodge: "Until your next turn, attacks against you have disadvantage and you gain advantage on Dexterity saves.",
    hide: "Attempt to become hidden from creatures that cannot clearly perceive you.",
    disengage: "Your movement does not provoke opportunity attacks for the rest of the turn.",
  };
  return standardActionDescriptions[action.type] || action.name;
}

let descriptionHideTimer = null;

function spellComponents(spell) {
  const components = [];
  if (spell?.components?.v) components.push("V");
  if (spell?.components?.s) components.push("S");
  if (spell?.components?.m) {
    const costlyMaterial = Number(spell.components.costGp) > 0
      ? `M — ${spell.components.material} (${spell.components.costGp} gp)`
      : "M";
    components.push(costlyMaterial);
  }
  return `[${components.join(", ")}]`;
}

function showActionDescription(action, sourceElement) {
  clearTimeout(descriptionHideTimer);
  descriptionPanel.replaceChildren();
  if (action.tags?.spell) {
    const spell = getSpellById(action.sourceSpellId || action.id);
    const heading = document.createElement("div");
    heading.className = "spell-description-heading";
    const name = document.createElement("strong");
    name.textContent = action.name;
    heading.append(name);
    if (action.concentration) {
      const concentration = document.createElement("b");
      concentration.className = "spell-concentration-mark";
      concentration.textContent = "C";
      concentration.title = "Concentration";
      concentration.setAttribute("aria-label", "Concentration");
      heading.append(concentration);
    }
    const components = document.createElement("span");
    components.className = "spell-components";
    components.textContent = spellComponents(spell);
    heading.append(components);
    const detail = document.createElement("p");
    detail.textContent = descriptionFor(action);
    descriptionPanel.append(heading, detail);
  } else {
    const heading = document.createElement("strong");
    heading.textContent = action.name;
    const detail = document.createElement("p");
    detail.textContent = descriptionFor(action);
    descriptionPanel.append(heading, detail);
  }
  descriptionPanel.hidden = false;
  document.body.classList.add("has-pane-description");
}

function scheduleDescriptionHide() {
  clearTimeout(descriptionHideTimer);
  descriptionHideTimer = setTimeout(() => {
    descriptionPanel.hidden = true;
    descriptionPanel.replaceChildren();
    document.body.classList.remove("has-pane-description");
  }, 100);
}

function registerDescriptionHover(element, action) {
  routedDescriptionActions.set(element, action);
  element.addEventListener("mouseenter", () => showActionDescription(action, element));
  element.addEventListener("focusin", () => showActionDescription(action, element));
  element.addEventListener("focusout", scheduleDescriptionHide);
}

function option(action, options = {}) {
  const element = document.createElement("div");
  element.className = "option-choice";
  const payloadAction = options.payloadAction || action;
  const displayName = options.displayName || action.choiceLabel || action.name;

  const icon = document.createElement("div");
  icon.className = "option-icon";
  icon.draggable = true;
  icon.tabIndex = 0;
  icon.title = displayName;
  icon.setAttribute("aria-label", `Drag ${displayName} to the quick bar`);
  icon.addEventListener("dragstart", (event) => setDragData(event, payload(payloadAction, options.secondaryChoice)));
  icon.append(createActionIconImage(options.secondaryChoice || payloadAction));

  const name = document.createElement("strong");
  name.textContent = displayName;
  const descriptionAction = options.descriptionAction || action;
  registerDescriptionHover(element, descriptionAction);
  element.append(icon, name);
  return element;
}

function choicesForSecondaryAction(action) {
  const choice = action.secondaryChoice;
  if (!choice?.sourceTag) return [];
  return actor.actions.filter((candidate) => {
    if (candidate.tags?.[choice.sourceTag] !== true) return false;
    if (candidate.id === action.id || candidate.secondaryChoice) return false;
    if (choice.baseChoicesOnly && candidate.choiceParentResourceId) return false;
    if (!availabilityFor(action, candidate).available) return false;
    return economy(candidate) === "action" || economy(candidate) === "bonus";
  });
}

function secondaryChoiceHeading({ name, dragPayload, descriptionAction, description }) {
  const heading = document.createElement("summary");
  const icon = document.createElement("span");
  icon.className = "secondary-choice-icon";
  icon.draggable = true;
  icon.tabIndex = 0;
  icon.title = name;
  icon.setAttribute("aria-label", `Drag ${name} to the quick bar`);
  icon.addEventListener("dragstart", (event) => setDragData(event, dragPayload));
  icon.append(createActionIconImage(dragPayload));
  const label = document.createElement("span");
  label.textContent = name;
  heading.append(icon, label);
  const hoverAction = descriptionAction || { name, description };
  registerDescriptionHover(heading, hoverAction);
  return heading;
}

function secondaryAction(action) {
  const section = document.createElement("details");
  section.className = "secondary-choice";
  const heading = secondaryChoiceHeading({
    name: action.name,
    dragPayload: payload(action),
    descriptionAction: action,
  });
  const list = document.createElement("div");
  list.className = "option-list secondary-choice-list";
  list.append(...choicesForSecondaryAction(action).map((choice) => option(choice, {
    payloadAction: action,
    secondaryChoice: choice,
    displayName: choice.name,
    descriptionAction: action,
  })));
  section.append(heading, list);
  return section;
}

function abilityList(actions) {
  const container = document.createElement("div");
  container.className = "option-list";
  const directActions = actions.filter((action) => !action.choiceParentResourceId);
  for (const action of directActions) container.append(action.secondaryChoice ? secondaryAction(action) : option(action));
  const grouped = new Map();
  for (const action of actions.filter((candidate) => candidate.choiceParentResourceId)) {
    if (!grouped.has(action.choiceParentResourceId)) grouped.set(action.choiceParentResourceId, []);
    grouped.get(action.choiceParentResourceId).push(action);
  }
  for (const [resourceId, choices] of grouped) {
    const section = document.createElement("details");
    section.className = "secondary-choice";
    const parentName = choices[0].choiceParentName || actor.resources?.find((resource) => resource.id === resourceId)?.name || resourceId;
    const parentDescription = choices[0].choiceParentDescription || "";
    const parentResource = actor.resources?.find((resource) => resource.id === resourceId);
    const parentAvailable = !parentResource || parentResource.current > 0;
    const heading = secondaryChoiceHeading({
      name: parentName,
      description: parentDescription,
      dragPayload: {
        id: resourceId,
        name: parentName,
        economy: "bonus",
        kind: "choice_parent",
        description: parentDescription,
        choiceParentResourceId: resourceId,
        available: parentAvailable,
        unavailableReason: parentAvailable ? "" : "You currently do not have any of this item to consume",
      },
    });
    const list = document.createElement("div");
    list.className = "option-list secondary-choice-list";
    list.append(...choices.map((choice) => option(choice)));
    section.append(heading, list);
    container.append(section);
  }
  return container;
}

function weaponSlot(action, { twoHandedOccupancy = false, offHand = false, item = null, equipmentSlotId = null } = {}) {
  const slot = document.createElement("div");
  slot.className = `weapon-set-slot${action ? " is-populated" : ""}${twoHandedOccupancy ? " is-two-handed-occupancy" : ""}${offHand ? " is-off-hand" : ""}`;
  if (equipmentSlotId) {
    slot.addEventListener("dragover", (event) => {
      const draggedItem = resolveEquippedHandItem(activeEquipmentDrag?.itemId);
      const acceptsShield = equipmentSlotId.endsWith("b") && isShieldItem(draggedItem);
      if (!activeEquipmentDrag || (!isAttackWeapon(draggedItem) && !acceptsShield)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      slot.classList.add("is-drag-over");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("is-drag-over"));
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("is-drag-over");
      if (equipDraggedItem(equipmentPanelState, equipmentSlotId, activeEquipmentDrag)) activeEquipmentDrag = null;
    });
  }
  if (!action) {
    slot.setAttribute("aria-label", "Empty weapon slot");
    return slot;
  }
  if (twoHandedOccupancy) {
    slot.title = `${action.name} occupies both weapon positions`;
    slot.setAttribute("aria-label", `${action.name}, two-handed weapon occupying this position`);
  } else {
    slot.title = action.name;
    slot.setAttribute("aria-label", action.name);
    if (action.type) {
      slot.draggable = true;
      slot.tabIndex = 0;
      slot.addEventListener("dragstart", (event) => setDragData(event, payload(action)));
      registerDescriptionHover(slot, action);
    }
  }
  const itemImage = item && !action.weaponPair ? createItemIconImage(item, "action-icon-base-layer") : null;
  if (itemImage) {
    const art = document.createElement("div");
    art.className = "action-icon-art";
    art.append(itemImage);
    slot.append(art);
  } else slot.append(createActionIconImage(action));
  if (twoHandedOccupancy) return slot;
  const label = document.createElement("span");
  label.textContent = action.name;
  slot.append(label);
  return slot;
}

function weaponSets(economyName) {
  const container = document.createElement("div");
  container.className = "weapon-sets";
  for (const setNumber of [1, 2]) {
    const set = document.createElement("section");
    set.className = "weapon-set";
    const heading = document.createElement("span");
    heading.className = "weapon-set-heading";
    heading.textContent = `Set ${setNumber}`;
    const equippedSet = actor.equipment?.weaponSetIds?.[setNumber - 1];
    const equippedShieldId = actor.equipment?.shieldId || null;
    const equippedIds = Array.isArray(equippedSet)
      ? [equippedSet[0] || null, equippedSet[1] || equippedShieldId || null]
      : null;
    const actions = actor.actions.filter((action) => economy(action) === economyName && category(action) === `Weapon Set ${setNumber}`);
    const slots = document.createElement("div");
    slots.className = "weapon-set-slots";
    if (equippedIds) {
      const primaryItem = resolveEquippedHandItem(equippedIds[0]);
      const secondaryItem = resolveEquippedHandItem(equippedIds[1]);
      const primaryAction = actionForEquippedItem(equippedIds[0]);
      const secondaryAction = actionForEquippedItem(equippedIds[1]);
      const twoHanded = primaryItem?.hands === 2;
      const presentedPrimaryAction = weaponPairPresentation(
        primaryAction || displayOnlyHandItem(primaryItem),
        primaryItem,
        secondaryItem,
      );
      slots.append(
        weaponSlot(presentedPrimaryAction, { item: primaryItem, equipmentSlotId: `weapon${setNumber}a` }),
        twoHanded
          ? weaponSlot(primaryAction || displayOnlyHandItem(primaryItem), { twoHandedOccupancy: true, item: primaryItem, equipmentSlotId: `weapon${setNumber}b` })
          : weaponSlot(secondaryAction || displayOnlyHandItem(secondaryItem), { offHand: Boolean(secondaryItem), item: secondaryItem, equipmentSlotId: `weapon${setNumber}b` }),
      );
    } else {
      const twoHandedAction = actions.find((action) => action.tags?.two_handed === true);
      const primaryAction = twoHandedAction || actions[0];
      slots.append(
        weaponSlot(primaryAction),
        twoHandedAction ? weaponSlot(primaryAction, { twoHandedOccupancy: true }) : weaponSlot(actions[1], { offHand: Boolean(actions[1]) }),
      );
    }
    set.append(heading, slots);
    container.append(set);
  }
  return container;
}

function resolveEquippedHandItem(itemId) {
  return itemId ? getWeaponById(itemId) || getSpellcastingFocusById(itemId) || getArmorById(itemId) : null;
}

function actionForEquippedItem(itemId) {
  return itemId ? actor.actions.find((action) => action.id === itemId || action.itemId === itemId) || null : null;
}

function weaponPairPresentation(primaryAction, primaryItem, secondaryItem) {
  if (!primaryAction || !isAttackWeapon(primaryItem) || !isAttackWeapon(secondaryItem) || primaryItem.id === secondaryItem.id) return primaryAction;
  const bothLight = [primaryItem, secondaryItem].every((item) => (item.properties || []).includes("light"));
  return {
    ...primaryAction,
    iconId: primaryItem.id,
    weaponPair: {
      mode: bothLight ? "diagonal" : "corner",
      primaryIconId: primaryItem.id,
      primaryName: primaryItem.name,
      secondaryIconId: secondaryItem.id,
      secondaryName: secondaryItem.name,
    },
  };
}

function isAttackWeapon(item) {
  if (!item) return false;
  const weapon = getWeaponById(item.id);
  if (weapon) return true;
  const focus = getSpellcastingFocusById(item.id);
  return Boolean(focus && focus.canMakeWeaponAttack !== false && (focus.damageFormula || focus.functionsAsWeapon));
}

function isShieldItem(item) {
  return Boolean(item && getArmorById(item.id)?.type === "shield");
}

function displayOnlyHandItem(item) {
  return item ? {
    id: item.id,
    itemId: item.id,
    name: item.name,
    type: "weapon_attack",
    cost: "action",
    iconId: item.id,
    iconCategory: "weapon",
    description: item.inspectText || item.description || `Attack with ${item.name}.`,
    tags: { weapon: true },
  } : null;
}

function nativeSpellLevel(action) {
  return Number.isFinite(action.baseSpellLevel) ? action.baseSpellLevel : action.spellLevel;
}

function spellsFor(economyName) {
  const seen = new Set();
  return actor.actions.filter((action) => {
    if (!action.tags?.spell || economy(action) !== economyName) return false;
    if (!paneSettings.offerSpellUpcasting && action.spellLevel !== nativeSpellLevel(action)) return false;
    const baseSpellId = action.sourceSpellId || String(action.id).split(":", 1)[0];
    const baseLevel = nativeSpellLevel(action);
    if (baseLevel > 0 && Object.keys(curatedSpellOrder).length > 0 && !(curatedSpellOrder[baseLevel] || []).includes(baseSpellId)) return false;
    const key = `${action.sourceSpellId || action.name}:${action.spellLevel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => {
    const displayLevelDifference = left.spellLevel - right.spellLevel;
    if (displayLevelDifference) return displayLevelDifference;
    const leftNativeLevel = nativeSpellLevel(left);
    const rightNativeLevel = nativeSpellLevel(right);
    const nativeLevelDifference = leftNativeLevel - rightNativeLevel;
    if (nativeLevelDifference) return nativeLevelDifference;
    const leftId = left.sourceSpellId || String(left.id).split(":", 1)[0];
    const rightId = right.sourceSpellId || String(right.id).split(":", 1)[0];
    const order = curatedSpellOrder[leftNativeLevel] || [];
    const leftIndex = order.indexOf(leftId);
    const rightIndex = order.indexOf(rightId);
    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex < 0) return 1;
      if (rightIndex < 0) return -1;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    }
    return left.name.localeCompare(right.name);
  });
}

function slotPips(level) {
  const slots = actor.spellSlots?.[level];
  const container = document.createElement("span");
  container.className = "spell-level-pips";
  if (!slots) return container;
  for (let index = 0; index < slots.max; index += 1) {
    const pip = document.createElement("span");
    pip.className = `spell-slot-pip${index < slots.current ? " is-available" : ""}`;
    container.append(pip);
  }
  return container;
}

function spellList(economyName) {
  const container = document.createElement("div");
  container.className = "spell-levels";
  const grouped = new Map();
  for (const action of spellsFor(economyName)) {
    if (!grouped.has(action.spellLevel)) grouped.set(action.spellLevel, []);
    grouped.get(action.spellLevel).push(action);
  }
  const spellGroups = [...grouped].sort(([left], [right]) => left - right);
  const highestPopulatedLevel = spellGroups.at(-1)?.[0];
  for (const [level, spells] of spellGroups) {
    const section = document.createElement("details");
    section.className = "spell-level-section";
    section.open = level === highestPopulatedLevel;
    const heading = document.createElement("summary");
    heading.className = "spell-level-heading";
    const label = document.createElement("span");
    label.textContent = level === 0 ? "Cantrips" : `Level ${level}`;
    heading.append(label);
    if (level > 0) heading.append(slotPips(level));
    const nativeSpells = spells.filter((action) => nativeSpellLevel(action) === level);
    const upcastSpells = spells.filter((action) => nativeSpellLevel(action) < level);
    const nativeList = document.createElement("div");
    nativeList.className = "option-list";
    nativeList.append(...nativeSpells.map(option));
    section.append(heading, nativeList);
    if (upcastSpells.length) {
      const upcastHeading = document.createElement("div");
      upcastHeading.className = "upcast-heading";
      upcastHeading.textContent = "Upcast";
      const upcastList = document.createElement("div");
      upcastList.className = "option-list upcast-list";
      upcastList.append(...upcastSpells.map(option));
      section.append(upcastHeading, upcastList);
    }
    container.append(section);
  }
  return container;
}

function spellCategoryHeading() {
  const heading = document.createElement("summary");
  const title = document.createElement("span");
  title.textContent = "Spells";
  const upcasting = document.createElement("label");
  upcasting.className = "spell-upcasting-toggle";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = paneSettings.offerSpellUpcasting;
  checkbox.setAttribute("aria-label", "Show upcasting");
  checkbox.addEventListener("click", (event) => event.stopPropagation());
  checkbox.addEventListener("change", () => {
    paneSettings.offerSpellUpcasting = checkbox.checked;
    window.api?.setCombatPaneSetting?.("offerSpellUpcasting", checkbox.checked);
    renderActionLibraries();
  });
  const text = document.createElement("span");
  text.textContent = "Show upcasting?";
  upcasting.addEventListener("click", (event) => event.stopPropagation());
  upcasting.append(checkbox, text);
  heading.append(title, upcasting);
  return heading;
}

function renderActionLibraries() {
  for (const economyName of ["action", "bonus"]) {
    const destination = document.querySelector(`[data-action-options="${economyName}"]`);
    destination.replaceChildren();
    for (const categoryName of ["Weapon Sets", "Spells", "Channel Divinity", "Tactics", "Abilities", "Consumables"]) {
      if (categoryName === "Weapon Sets") {
        if (economyName !== "action") continue;
        const section = document.createElement("details");
        section.className = "option-category";
        section.dataset.actionCategory = "weapon-sets";
        const heading = document.createElement("summary");
        heading.textContent = "Weapon Sets";
        section.append(heading, weaponSets(economyName));
        destination.append(section);
        continue;
      }
      const actions = actor.actions.filter((action) => {
        if (economy(action) !== economyName || category(action) !== categoryName) return false;
        if (categoryName === "Consumables" && !availabilityFor(action).available) return false;
        return true;
      });
      if (!actions.length) continue;
      const section = document.createElement("details");
      section.className = "option-category";
      section.dataset.actionCategory = categoryName.toLowerCase().replaceAll(" ", "-");
      const heading = categoryName === "Spells" ? spellCategoryHeading() : document.createElement("summary");
      if (categoryName !== "Spells") heading.textContent = categoryName;
      const content = categoryName === "Spells"
        ? spellList(economyName)
        : categoryName === "Abilities"
          ? abilityList(actions)
          : document.createElement("div");
      if (categoryName !== "Spells" && categoryName !== "Abilities") {
        content.className = "option-list";
        content.append(...actions.map(option));
      }
      section.append(heading, content);
      destination.append(section);
    }
  }
  syncEconomyState(economyState);
  if (document.body.classList.contains("is-wide-pane")) {
    for (const section of document.querySelectorAll('[data-pane-panel="action-options"] > .economy-section')) section.open = true;
    for (const section of document.querySelectorAll('[data-pane-panel="action-options"] .option-category')) section.open = true;
  }
}

function questInformation(quest) {
  const content = document.createElement("div");
  content.className = "quest-information";
  const metadata = document.createElement("dl");
  for (const [label, value] of [["Given by", quest.giver], ["Location", quest.location]]) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    metadata.append(term, description);
  }
  const summary = document.createElement("p");
  summary.className = "quest-summary";
  summary.textContent = quest.summary;
  const briefing = document.createElement("p");
  briefing.className = "quest-details";
  briefing.textContent = quest.briefing;
  content.append(metadata, summary, briefing);
  return content;
}

function renderQuests() {
  const panel = document.querySelector('[data-pane-panel="quests"]');
  if (!panel) return;
  const quests = getGreyharbourQuests();
  const vertical = document.createElement("div");
  vertical.className = "quest-vertical-list";
  for (const quest of quests) {
    const entry = document.createElement("details");
    entry.className = "quest-entry";
    const heading = document.createElement("summary");
    heading.textContent = quest.title;
    entry.append(heading, questInformation(quest));
    vertical.append(entry);
  }

  const horizontal = document.createElement("div");
  horizontal.className = "quest-horizontal-layout";
  const titles = document.createElement("nav");
  titles.className = "quest-title-list";
  titles.setAttribute("aria-label", "Quests in journal order");
  const detail = document.createElement("article");
  detail.className = "quest-selected-detail";
  const selectQuest = (quest, button) => {
    for (const candidate of titles.querySelectorAll("button")) candidate.classList.toggle("is-active", candidate === button);
    const heading = document.createElement("h2");
    heading.textContent = quest.title;
    detail.replaceChildren(heading, questInformation(quest));
  };
  quests.forEach((quest, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = quest.title;
    button.addEventListener("click", () => selectQuest(quest, button));
    titles.append(button);
    if (index === 0) selectQuest(quest, button);
  });
  horizontal.append(titles, detail);
  panel.replaceChildren(vertical, horizontal);
}

function showPane(paneId) {
  if (!PANE_LABELS[paneId]) return;
  activePaneId = paneId;
  document.body.classList.toggle("is-action-options-pane", paneId === "action-options");
  if (paneId !== "action-options") {
    descriptionPanel.hidden = true;
    descriptionPanel.replaceChildren();
    document.body.classList.remove("has-pane-description");
  }
  paneTitle.textContent = paneId === "action-options" ? "Action Options" : PANE_LABELS[paneId];
  for (const panel of panePanels) panel.hidden = panel.dataset.panePanel !== paneId;
  for (const tab of tabList.querySelectorAll(".pane-tab")) tab.setAttribute("aria-selected", String(tab.dataset.paneId === paneId));
  closeButton.textContent = PANE_KEYS[paneId] || "";
  closeButton.classList.add("is-pane-key");
  titleKeyButton.textContent = PANE_KEYS[paneId] || "";
  paneSingleTitle.textContent = paneId === "action-options" ? "Action Options" : PANE_LABELS[paneId];
  if (detachedPaneId) window.api?.setCombatPaneGroupActive?.(paneId);
}

function paneTab(paneId) {
  const tab = document.createElement("button");
  tab.className = "pane-tab";
  tab.type = "button";
  tab.draggable = true;
  tab.dataset.paneId = paneId;
  tab.textContent = PANE_LABELS[paneId];
  tab.setAttribute("role", "tab");
  tab.addEventListener("click", () => showPane(paneId));
  tab.addEventListener("dragstart", (event) => {
    tab.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", paneId);
    event.dataTransfer.setData("application/x-dndt-pane-tab", paneId);
  });
  tab.addEventListener("dragend", (event) => {
    tab.classList.remove("is-dragging");
    const edgeTolerance = 16;
    const outsideWindow = event.screenX <= window.screenX + edgeTolerance
      || event.screenY <= window.screenY + edgeTolerance
      || event.screenX >= window.screenX + window.outerWidth - edgeTolerance
      || event.screenY >= window.screenY + window.outerHeight - edgeTolerance
      || event.clientX <= edgeTolerance
      || event.clientY <= edgeTolerance
      || event.clientX >= window.innerWidth - edgeTolerance
      || event.clientY >= window.innerHeight - edgeTolerance;
    if (outsideWindow) window.api?.detachCombatPane?.(paneId, { x: event.screenX, y: event.screenY });
  });
  return tab;
}

function renderPaneState(state = currentPaneState) {
  currentPaneState = state;
  if (detachedPaneId) {
    tabList.hidden = embeddedPane || groupedPaneIds.length < 2;
    document.body.classList.toggle("has-pane-tabs", !tabList.hidden);
    document.body.classList.toggle("has-inline-pane-key", groupedPaneIds.length < 2 && !document.body.classList.contains("is-wide-pane"));
    syncCompactTitlebar();
    if (!tabList.hidden) tabList.replaceChildren(...groupedPaneIds.map(paneTab));
    document.body.classList.add("is-detached-pane");
    if (!groupedPaneIds.includes(activePaneId)) activePaneId = groupedPaneIds[0] || detachedPaneId;
    showPane(activePaneId);
    return;
  }
  const attachedPaneIds = Object.keys(PANE_LABELS).filter((paneId) => state[paneId]?.visible && !state[paneId]?.detached);
  document.body.classList.remove("has-inline-pane-key");
  tabList.hidden = false;
  tabList.replaceChildren(...attachedPaneIds.map(paneTab));
  if (!attachedPaneIds.includes(activePaneId)) activePaneId = attachedPaneIds[0] || "action-options";
  showPane(activePaneId);
}

document.querySelector(".pane-close").addEventListener("click", () => {
  if (embeddedPane) return;
  if (detachedPaneId) window.api?.closeCombatPane?.(activePaneId);
  else window.api?.closeCombatPaneHost?.();
});
titleKeyButton.addEventListener("click", () => {
  if (embeddedPane) return;
  if (detachedPaneId) window.api?.closeCombatPane?.(activePaneId);
  else window.api?.closeCombatPaneHost?.();
});
document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const paneId = PANE_BY_CODE[event.code];
  if (!paneId) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
  event.preventDefault();
  if (embeddedPane) {
    window.parent.postMessage({ type: "combat-pane-shortcut", paneId }, "*");
    return;
  }
  window.api?.requestInternalCombatPane?.(paneId);
}, true);
window.api?.onCombatPaneDragState?.((state) => {
  document.body.classList.toggle("is-pane-drag-target", state?.active === true);
});
descriptionPanel.addEventListener("mouseenter", () => clearTimeout(descriptionHideTimer));
descriptionPanel.addEventListener("mouseleave", scheduleDescriptionHide);
document.querySelector(".pane-scroll").addEventListener("mouseleave", scheduleDescriptionHide);
window.api?.onCombatPaneState?.(renderPaneState);
window.addEventListener("combat:equipment-changed", () => {
  reconcileEquipmentGrantedActions(actor, getSpellcastingFocusById);
  renderActionLibraries();
});
window.api?.onCombatPaneGroup?.((group) => {
  if (!detachedPaneId || !Array.isArray(group?.paneIds)) return;
  groupedPaneIds = group.paneIds.filter((paneId) => PANE_LABELS[paneId]);
  paneDock = group.dock || null;
  if (group.activePaneId && groupedPaneIds.includes(group.activePaneId)) activePaneId = group.activePaneId;
  renderPaneState();
  syncPaneAspect();
});
document.addEventListener("dragover", (event) => {
  if (!detachedPaneId || !event.dataTransfer.types.includes("application/x-dndt-pane-tab")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});
document.addEventListener("drop", (event) => {
  if (!detachedPaneId) return;
  const paneId = event.dataTransfer.getData("application/x-dndt-pane-tab");
  if (!paneId || groupedPaneIds.includes(paneId)) return;
  event.preventDefault();
  window.api?.mergeCombatPaneIntoGroup?.(paneId, activePaneId || detachedPaneId);
});
window.api?.onCombatPaneSettings?.((settings) => {
  paneSettings = { ...paneSettings, ...settings };
  document.body.classList.toggle("hide-pane-resize-cue", settings.displaySchema === "large" || settings.displaySchema === "full");
  renderActionLibraries();
});
window.api?.onCombatPointerPosition?.(({ inside, x, y } = {}) => {
  let element = inside ? document.elementFromPoint(x, y) : null;
  while (element && !routedDescriptionActions.has(element)) element = element.parentElement;
  if (element === routedDescriptionElement) return;
  routedDescriptionElement = element;
  if (element) showActionDescription(routedDescriptionActions.get(element), element);
  else scheduleDescriptionHide();
});
function syncPaneAspect() {
  const isWide = paneDock === "top" || paneDock === "bottom"
    ? true
    : paneDock === "left" || paneDock === "right"
      ? false
      : window.innerWidth >= window.innerHeight * 1.35;
  document.body.classList.toggle("is-wide-pane", isWide);
  if (activePaneId === "action-options") {
    for (const section of document.querySelectorAll('[data-pane-panel="action-options"] > .economy-section')) section.open = isWide;
    for (const section of document.querySelectorAll('[data-pane-panel="action-options"] .option-category')) section.open = isWide;
  }
  document.body.classList.toggle("has-inline-pane-key", Boolean(detachedPaneId && groupedPaneIds.length < 2 && !document.body.classList.contains("is-wide-pane")));
  syncCompactTitlebar();
}
function syncCompactTitlebar() {
  document.body.classList.toggle("has-compact-titlebar", Boolean(detachedPaneId && document.body.classList.contains("is-wide-pane") && groupedPaneIds.length === 1));
}
window.addEventListener("resize", syncPaneAspect);
syncPaneAspect();
renderActionLibraries();
equipmentPanelState = installEquipmentPanelContent(actor, {
  equipmentPanel: document.querySelector('[data-pane-panel="equipment"]'),
  inventoryPanel: document.querySelector('[data-pane-panel="inventory"]'),
});
installCharacterPanel(actor, document.querySelector('[data-pane-panel="character"]'));
renderQuests();
renderPaneState();
