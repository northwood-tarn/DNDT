import { createCombatGame } from "../combat/api.js";
import { getSpellById } from "../data/spells.js";
import { getWeaponMastery } from "../data/weaponMasteries.js";
import { actionIconCategory, createActionIconImage } from "./actionIconRegistry.js";

const scenarioId = new URLSearchParams(window.location.search).get("scenario");
if (!scenarioId) throw new Error("Action Options requires combat scenario state.");
const game = createCombatGame({ scenarioId });
const actor = game.snapshot.actors.find((candidate) => candidate.team === "heroes");
if (!actor) throw new Error("Action Options requires an active player or companion.");
document.querySelector("[data-actor-name]").textContent = actor.name.split(",", 1)[0];
const PANE_LABELS = {
  "action-options": "Actions",
  inventory: "Inventory",
  equipment: "Equipment",
  quests: "Quests",
};
const detachedPaneId = new URLSearchParams(window.location.search).get("panel");
const tabList = document.querySelector(".pane-tabs");
const paneTitle = document.querySelector("[data-pane-title]");
const panePanels = [...document.querySelectorAll("[data-pane-panel]")];
const descriptionPanel = document.querySelector(".pane-description");
let activePaneId = detachedPaneId || "action-options";
const routedDescriptionActions = new WeakMap();
let routedDescriptionElement = null;
let paneSettings = { offerSpellUpcasting: true };
let currentPaneState = Object.fromEntries(Object.keys(PANE_LABELS).map((paneId) => [paneId, { visible: true, detached: false }]));

function economy(action) {
  if (action.cost === "bonus" || action.cost === "bonus_action") return "bonus";
  return action.cost;
}

function category(action) {
  if (action.tags?.weapon) return Number(action.weaponSet) === 2 ? "Weapon Set 2" : "Weapon Set 1";
  if (action.tags?.spell) return "Spells";
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
    iconId: action.sourceSpellId || secondaryChoice?.id || action.id,
    iconCategory: actionIconCategory(secondaryChoice || action),
    spellLevel: Number.isFinite(action.spellLevel) ? action.spellLevel : null,
    secondaryChoiceId: secondaryChoice?.id || null,
    secondaryChoiceName: secondaryChoice?.name || null,
    description: descriptionFor(action),
    available: availability.available,
    unavailableReason: availability.reason,
  };
}

function availabilityFor(action, secondaryChoice = null) {
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
  window.requestAnimationFrame(() => {
    const descriptionHeight = Math.ceil(descriptionPanel.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--pane-description-height", `${descriptionHeight}px`);
    document.body.classList.add("has-pane-description");
    window.requestAnimationFrame(() => sourceElement?.scrollIntoView({ block: "nearest" }));
  });
}

function scheduleDescriptionHide() {
  clearTimeout(descriptionHideTimer);
  descriptionHideTimer = setTimeout(() => {
    descriptionPanel.hidden = true;
    descriptionPanel.replaceChildren();
    document.body.classList.remove("has-pane-description");
    document.documentElement.style.removeProperty("--pane-description-height");
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

function weaponSlot(action, { twoHandedOccupancy = false, offHand = false } = {}) {
  const slot = document.createElement("div");
  slot.className = `weapon-set-slot${action ? " is-populated" : ""}${twoHandedOccupancy ? " is-two-handed-occupancy" : ""}${offHand ? " is-off-hand" : ""}`;
  if (!action) {
    slot.setAttribute("aria-label", "Empty weapon slot");
    return slot;
  }
  if (twoHandedOccupancy) {
    slot.title = `${action.name} occupies both weapon positions`;
    slot.setAttribute("aria-label", `${action.name}, two-handed weapon occupying this position`);
  } else {
    slot.draggable = true;
    slot.tabIndex = 0;
    slot.title = action.name;
    slot.setAttribute("aria-label", action.name);
    slot.addEventListener("dragstart", (event) => setDragData(event, payload(action)));
    registerDescriptionHover(slot, action);
  }
  slot.append(createActionIconImage(action));
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
    const actions = actor.actions.filter((action) => economy(action) === economyName && category(action) === `Weapon Set ${setNumber}`);
    const slots = document.createElement("div");
    slots.className = "weapon-set-slots";
    const twoHandedAction = actions.find((action) => action.tags?.two_handed === true);
    const primaryAction = twoHandedAction || actions[0];
    const occupiesBothPositions = Boolean(twoHandedAction);
    slots.append(
      weaponSlot(primaryAction),
      occupiesBothPositions ? weaponSlot(primaryAction, { twoHandedOccupancy: true }) : weaponSlot(actions[1], { offHand: Boolean(actions[1]) }),
    );
    set.append(heading, slots);
    container.append(set);
  }
  return container;
}

function nativeSpellLevel(action) {
  return Number.isFinite(action.baseSpellLevel) ? action.baseSpellLevel : action.spellLevel;
}

function spellsFor(economyName) {
  const seen = new Set();
  return actor.actions.filter((action) => {
    if (!action.tags?.spell || economy(action) !== economyName) return false;
    if (!paneSettings.offerSpellUpcasting && action.spellLevel !== nativeSpellLevel(action)) return false;
    const key = `${action.sourceSpellId || action.name}:${action.spellLevel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => (left.spellLevel - right.spellLevel) || left.name.localeCompare(right.name));
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
  for (const [level, spells] of [...grouped].sort(([left], [right]) => left - right)) {
    const section = document.createElement("section");
    section.className = "spell-level-section";
    const heading = document.createElement("div");
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

function renderActionLibraries() {
  for (const economyName of ["action", "bonus"]) {
    const destination = document.querySelector(`[data-action-options="${economyName}"]`);
    destination.replaceChildren();
    for (const categoryName of ["Weapon Sets", "Spells", "Channel Divinity", "Tactics", "Abilities", "Consumables"]) {
      if (categoryName === "Weapon Sets") {
        if (economyName !== "action") continue;
        const section = document.createElement("details");
        section.className = "option-category";
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
      const heading = document.createElement("summary");
      heading.textContent = categoryName;
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
}

function showPane(paneId) {
  if (!PANE_LABELS[paneId]) return;
  activePaneId = paneId;
  paneTitle.textContent = paneId === "action-options" ? "Action Options" : PANE_LABELS[paneId];
  for (const panel of panePanels) panel.hidden = panel.dataset.panePanel !== paneId;
  for (const tab of tabList.querySelectorAll(".pane-tab")) tab.setAttribute("aria-selected", String(tab.dataset.paneId === paneId));
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
  });
  tab.addEventListener("dragend", (event) => {
    tab.classList.remove("is-dragging");
    const outsideWindow = event.screenX < window.screenX || event.screenY < window.screenY || event.screenX > window.screenX + window.outerWidth || event.screenY > window.screenY + window.outerHeight;
    if (outsideWindow) window.api?.detachCombatPane?.(paneId, { x: event.screenX, y: event.screenY });
  });
  return tab;
}

function renderPaneState(state = currentPaneState) {
  currentPaneState = state;
  if (detachedPaneId) {
    tabList.hidden = true;
    document.body.classList.add("is-detached-pane");
    showPane(detachedPaneId);
    return;
  }
  const attachedPaneIds = Object.keys(PANE_LABELS).filter((paneId) => state[paneId]?.visible && !state[paneId]?.detached);
  tabList.hidden = false;
  tabList.replaceChildren(...attachedPaneIds.map(paneTab));
  if (!attachedPaneIds.includes(activePaneId)) activePaneId = attachedPaneIds[0] || "action-options";
  showPane(activePaneId);
}

document.querySelector(".pane-close").addEventListener("click", () => {
  if (detachedPaneId) window.api?.closeCombatPane?.(activePaneId);
  else window.api?.closeCombatPaneHost?.();
});
descriptionPanel.addEventListener("mouseenter", () => clearTimeout(descriptionHideTimer));
descriptionPanel.addEventListener("mouseleave", scheduleDescriptionHide);
document.querySelector(".pane-scroll").addEventListener("mouseleave", scheduleDescriptionHide);
window.api?.onCombatPaneState?.(renderPaneState);
window.api?.onCombatPaneSettings?.((settings) => {
  paneSettings = { ...paneSettings, ...settings };
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
renderActionLibraries();
renderPaneState();
