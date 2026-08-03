import "../combat_ui_take2/combatUi.js";
import { createCombatGame } from "../combat/api.js";
import { createActionIconImage } from "./actionIconRegistry.js";
import { installEquipmentDrawer } from "./equipmentDrawer.js";
import { getWeaponById } from "../data/weapons.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { getArmorById } from "../data/armor.js";
import { reconcileEquipmentGrantedActions } from "../combat/equipmentGrantedActions.js";
import { installEmberModal } from "../ui/EmberModal.js";
import { TARA_COMPANION_PROFILE } from "../data/companions/tara.js";
import { DANICA_COMPANION_PROFILE } from "../data/companions/danica.js";
import { TAHRONE_COMPANION_PROFILE } from "../data/companions/tahrone.js";

installEmberModal();

const scenarioId = new URLSearchParams(window.location.search).get("scenario");
if (!scenarioId) throw new Error("Combat UI v2 requires combat scenario state.");
const presentationGame = createCombatGame({ scenarioId });
const presentationActor = presentationGame.snapshot.actors.find((actor) => actor.team === "heroes");
if (!presentationActor) throw new Error("Combat UI v2 requires an active player or companion.");
const emberTrialParty = [
  presentationActor,
  TARA_COMPANION_PROFILE.levelSheets[13].combatActor,
  DANICA_COMPANION_PROFILE.levelSheets[13].combatActor,
  TAHRONE_COMPANION_PROFILE.levelSheets[13].combatActor,
];
window.dispatchEvent(new CustomEvent("ember:party-state", { detail: { actors: emberTrialParty } }));

function renderPresentationActor(actor) {
  const name = document.querySelector("#combatCharacterName");
  const portrait = document.querySelector(".combat-ui-portrait");
  name.textContent = actor.name.split(",", 1)[0];
  if (actor.portraitId) {
    portrait.src = new URL(`../${actor.portraitId.replace(/^\.\.\//, "")}`, import.meta.url).href;
    portrait.alt = actor.name.split(",", 1)[0];
    portrait.hidden = false;
  } else {
    portrait.removeAttribute("src");
    portrait.alt = "";
    portrait.hidden = true;
  }
  document.querySelector(".combat-ui-hp-label").textContent = `${actor.hp} / ${actor.maxHp}`;
  document.querySelector(".combat-ui-hp-current").style.width = `${Math.max(0, actor.hp / actor.maxHp) * 100}%`;
  const temporaryHp = document.querySelector(".combat-ui-temp-hp");
  temporaryHp.hidden = !(actor.tempHp > 0);
  temporaryHp.textContent = actor.tempHp > 0 ? `+${actor.tempHp}` : "";
}

renderPresentationActor(presentationActor);
installEquipmentDrawer(presentationActor);

const CATEGORY_ACCENTS = new Map([
  ["Attack", "damage"],
  ["Spells", "spell"],
  ["Channel Divinity", "divine"],
  ["Tactics", "movement"],
  ["Abilities", "feature"],
  ["Consumables", "item"],
  ["A Strange Kit", "device"],
]);

const contextOptions = document.querySelector(".combat-context-options");
const logList = document.querySelector(".combat-ui-log ol");
const outcomeBanner = document.querySelector(".combat-outcome-banner");
const expandedControls = document.querySelector(".combat-expanded-controls");
const settingsDialog = document.querySelector(".combat-settings-dialog");
const settingsClose = document.querySelector(".combat-settings-close");
const paneToggle = document.querySelector('[data-pane-toggle="action-options"]');
const paneVisibilityInputs = [...document.querySelectorAll("[data-pane-id]")];
const paneSettingInputs = [...document.querySelectorAll("[data-pane-setting]")];
const fullscreenToggle = document.querySelector("[data-fullscreen-toggle]");
const displaySchemaSelect = document.querySelector("[data-display-schema]");
const displayOnboarding = document.querySelector(".combat-display-onboarding");
const settingsTabs = [...document.querySelectorAll('[role="tab"]')];
const settingsPanels = [...document.querySelectorAll('[role="tabpanel"]')];
const compactEndTurn = document.querySelector('[data-combat-command="end_turn"]');
const expandedEndTurn = document.querySelector(".combat-expanded-end-turn");
const expandedOptions = document.querySelector(".combat-expanded-options");
const quickbarTooltip = document.querySelector(".combat-quickbar-tooltip");
const movementSummary = document.querySelector("[data-movement-summary]");
const spellSlotsPanel = document.querySelector("[data-spell-slots]");
const spellSlotList = document.querySelector("[data-spell-slot-list]");
const ensembleHandle = document.querySelector(".combat-ensemble-handle");
let ensembleHandlePointerId = null;
ensembleHandle?.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
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
let bannerTimer = null;
let routedQuickbarSlot = null;
let activeDisplaySchema = "laptop";
let hasVisibleExternalPanes = false;
let activeInventoryQuickChoice = null;
let quickbarDragSourceSlot = null;
const QUICKBAR_STORAGE_KEY = `dndt.quickbar:${scenarioId}:${presentationActor.id}`;
const equipmentDragChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`dndt-equipment:${presentationActor.id}`) : null;
const economyChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`dndt-economy:${presentationActor.id}`) : null;
let currentEconomy = {
  action: presentationActor.economy?.actionAvailable !== false,
  bonus: presentationActor.economy?.bonusActionAvailable !== false,
};
economyChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "economy-state-request") syncEconomy();
});

equipmentDragChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "item-drag-start") {
    activeInventoryQuickChoice = quickChoiceForDraggedItem(event.data.drag);
    highlightQuickbarSlots(activeInventoryQuickChoice?.economy);
  }
  if (event.data?.type === "item-drag-end") {
    activeInventoryQuickChoice = null;
    highlightQuickbarSlots(null);
  }
});

function quickChoiceForDraggedItem(drag) {
  const itemId = drag?.itemId;
  const itemIsWeapon = Boolean(getWeaponById(itemId) || quickWeaponChoice(itemId));
  if (itemIsWeapon && (drag?.source !== "equipment" || !isItemEquipped(itemId))) return null;
  const action = presentationActor.actions?.find((candidate) => candidate.itemId === itemId || candidate.id === itemId);
  if (!action) return quickWeaponChoice(itemId);
  const economy = action.cost === "bonus_action" ? "bonus" : action.cost;
  if (!['action', 'bonus'].includes(economy)) return null;
  const carriedQuantity = presentationActor.inventory?.find((entry) => entry.id === itemId)?.quantity || 0;
  const available = drag?.source === "equipment" || carriedQuantity > 0;
  return {
    id: action.id,
    name: action.name,
    economy,
    kind: "action",
    iconId: itemId,
    iconCategory: "item",
    description: action.description || action.name,
    available,
    unavailableReason: available ? "" : "You currently do not have any of this item to consume",
  };
}

function isItemEquipped(itemId) {
  return (presentationActor.equipment?.weaponSetIds || []).flat().filter(Boolean).includes(itemId);
}

function quickWeaponChoice(itemId) {
  const item = getWeaponById(itemId) || getSpellcastingFocusById(itemId);
  if (!item || item.canMakeWeaponAttack === false || (!item.damageFormula && !item.functionsAsWeapon)) return null;
  return {
    id: item.id,
    name: item.name,
    economy: "action",
    kind: "action",
    iconId: item.id,
    iconCategory: "weapon",
    description: item.inspectText || item.description || item.name,
    available: true,
    unavailableReason: "",
  };
}

function syncEquippedWeaponsToQuickbar() {
  const actionSlots = [...document.querySelector('[data-quickbar="action"]').querySelectorAll(".combat-quick-slot")];
  const weaponSets = Array.isArray(presentationActor.equipment?.weaponSetIds)
    ? presentationActor.equipment.weaponSetIds
    : [];
  for (const [setIndex, slotIndex] of [[0, 0], [1, 8]]) {
    const slot = actionSlots[slotIndex];
    if (!slot) continue;
    const equippedIds = (weaponSets[setIndex] || []).filter(Boolean);
    const attackItemId = equippedIds.find((itemId) => getArmorById(itemId)?.type !== "shield" && quickWeaponChoice(itemId));
    const choice = quickWeaponChoice(attackItemId);
    if (choice) populateQuickbarSlot(slot, choice, "action", { persist: false });
    else clearQuickbarSlot(slot, { persist: false });
  }
  saveQuickbar();
}

function grantedActionQuickChoice(action) {
  return {
    id: action.id,
    name: action.name,
    economy: action.cost === "bonus_action" ? "bonus" : action.cost,
    kind: "action",
    iconId: action.iconId || action.id,
    description: action.description || action.name,
    available: true,
    grantedByEquipment: true,
    sourceItemId: action.sourceItemId,
    tags: action.tags,
    type: action.type,
  };
}

function syncEquipmentGrantedActionsToQuickbar() {
  const granted = reconcileEquipmentGrantedActions(presentationActor, getSpellcastingFocusById);
  const grantedIds = new Set(granted.map((action) => action.id));
  for (const group of document.querySelectorAll("[data-quickbar]")) {
    for (const slot of group.querySelectorAll(".combat-quick-slot")) {
      if (!slot.dataset.choice) continue;
      const choice = JSON.parse(slot.dataset.choice);
      if (choice.grantedByEquipment === true && !grantedIds.has(choice.id)) clearQuickbarSlot(slot, { persist: false });
    }
  }
  for (const action of granted) {
    const choice = grantedActionQuickChoice(action);
    const group = document.querySelector(`[data-quickbar="${choice.economy}"]`);
    if (!group || group.querySelector(`[data-choice-id="${CSS.escape(choice.id)}"]`)) continue;
    const emptySlot = [...group.querySelectorAll(".combat-quick-slot")].find((slot, index) => (
      !slot.dataset.choice && (choice.economy !== "action" || ![0, 8].includes(index))
    ));
    if (emptySlot) populateQuickbarSlot(emptySlot, choice, choice.economy, { persist: false });
  }
  saveQuickbar();
}

function syncEquipmentToActionSurfaces() {
  syncEquippedWeaponsToQuickbar();
  syncEquipmentGrantedActionsToQuickbar();
}

function showQuickbarDescription(slot) {
  if (!slot?.dataset.choice) return;
  const choice = JSON.parse(slot.dataset.choice);
  const displayName = quickbarChoiceName(choice);
  const description = choice.available === false
    ? choice.unavailableReason || "You currently do not have any of this item to consume"
    : choice.description || choice.name;
  quickbarTooltip.textContent = `${displayName}: ${description}`;
  quickbarTooltip.hidden = false;
}

function hideQuickbarDescription() {
  quickbarTooltip.hidden = true;
  quickbarTooltip.replaceChildren();
}

function updateColourContext() {
  const firstRow = contextOptions.querySelector(".combat-context-row");
  const categoryButtons = firstRow ? [...firstRow.querySelectorAll("button")] : [];
  for (const button of categoryButtons) {
    const label = button.textContent.replace(/\s*\(.*\)\s*$/, "").trim();
    const accent = CATEGORY_ACCENTS.get(label);
    if (accent) button.dataset.accent = accent;
  }
  const selected = categoryButtons.find((button) => button.classList.contains("is-selected"));
  const selectedLabel = selected?.textContent.replace(/\s*\(.*\)\s*$/, "").trim();
  document.body.dataset.combatAccent = CATEGORY_ACCENTS.get(selectedLabel) || "neutral";
}

function announceLatestOutcome() {
  const latest = logList.lastElementChild?.textContent?.trim();
  if (!latest || latest === outcomeBanner.textContent) return;
  outcomeBanner.textContent = latest;
  outcomeBanner.classList.add("is-visible");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => outcomeBanner.classList.remove("is-visible"), 3600);
}

function renderQuickbar() {
  for (const [economy, count] of [["action", 16], ["bonus", 4]]) {
    const destination = document.querySelector(`[data-quickbar="${economy}"]`);
    const slots = Array.from({ length: count }, (_unused, index) => {
      const slot = document.createElement("div");
      slot.className = "combat-quick-slot";
      slot.dataset.slotNumber = String(index + 1);
      slot.setAttribute("aria-label", `${economy === "bonus" ? "Bonus Action" : "Action"} quick slot ${index + 1}, empty`);
      slot.addEventListener("dragstart", (event) => {
        if (!slot.dataset.choice) return;
        const choice = JSON.parse(slot.dataset.choice);
        quickbarDragSourceSlot = slot;
        slot.classList.add("is-being-dragged");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-dndt-action", JSON.stringify(choice));
        event.dataTransfer.setData(`application/x-dndt-${choice.economy}`, JSON.stringify(choice));
        event.dataTransfer.setData("text/plain", JSON.stringify(choice));
        highlightQuickbarSlots(choice.economy);
      });
      slot.addEventListener("dragend", () => {
        slot.classList.remove("is-being-dragged");
        quickbarDragSourceSlot = null;
        highlightQuickbarSlots(null);
      });
      slot.addEventListener("dragover", (event) => {
        const acceptsAction = event.dataTransfer.types.includes(`application/x-dndt-${economy}`);
        const acceptsInventoryItem = activeInventoryQuickChoice?.economy === economy;
        if (!acceptsAction && !acceptsInventoryItem) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = quickbarDragSourceSlot ? "move" : "copy";
        highlightQuickbarSlots(economy);
        slot.classList.add("is-drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("is-drag-over"));
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("is-drag-over");
        const raw = event.dataTransfer.getData("application/x-dndt-action") || event.dataTransfer.getData("text/plain");
        try {
          const decoded = raw ? JSON.parse(raw) : null;
          const choice = decoded?.economy ? decoded : activeInventoryQuickChoice;
          if (!choice) return;
          if (choice.economy !== economy) return;
          const sourceSlot = quickbarDragSourceSlot;
          populateQuickbarSlot(slot, choice, economy);
          if (sourceSlot && sourceSlot !== slot) clearQuickbarSlot(sourceSlot);
          highlightQuickbarSlots(null);
        } catch (_error) {
          // Pane-tab drags also use text/plain and are intentionally ignored here.
        }
      });
      slot.addEventListener("mouseenter", () => {
        showQuickbarDescription(slot);
      });
      slot.addEventListener("mouseleave", () => {
        hideQuickbarDescription();
      });
      return slot;
    });
    destination.replaceChildren(...slots);
  }
  restoreQuickbar();
}

function populateQuickbarSlot(slot, choice, economy, { persist = true } = {}) {
  slot.dataset.choiceId = choice.id;
  slot.dataset.choice = JSON.stringify(choice);
  const displayName = quickbarChoiceName(choice);
  slot.title = displayName;
  slot.setAttribute("aria-label", `${displayName}, ${economy === "bonus" ? "Bonus Action" : "Action"} quick slot ${slot.dataset.slotNumber}`);
  slot.draggable = true;
  slot.classList.add("is-populated");
  slot.classList.toggle("is-weapon-slot", isWeaponQuickChoice(choice));
  slot.classList.toggle("is-unavailable", choice.available === false);
  const name = document.createElement("span");
  name.className = "combat-quick-slot-name";
  name.textContent = displayName;
  slot.replaceChildren(createActionIconImage(choice, "combat-quick-icon-art"), name);
  if (persist) saveQuickbar();
}

function quickbarChoiceName(choice) {
  if (choice.weaponPair?.secondaryName) return `${choice.name} / ${choice.weaponPair.secondaryName}`;
  return choice.secondaryChoiceName ? `${choice.name} — ${choice.secondaryChoiceName}` : choice.name;
}

function isWeaponQuickChoice(choice) {
  return Boolean(choice?.tags?.weapon || choice?.iconCategory === "weapon" || choice?.type === "weapon_attack" || choice?.kind === "weapon");
}

function clearQuickbarSlot(slot, { persist = true } = {}) {
  delete slot.dataset.choiceId;
  delete slot.dataset.choice;
  slot.removeAttribute("title");
  slot.draggable = false;
  slot.classList.remove("is-populated", "is-unavailable", "is-being-dragged", "is-weapon-slot");
  const economy = slot.closest("[data-quickbar]")?.dataset.quickbar || "action";
  slot.setAttribute("aria-label", `${economy === "bonus" ? "Bonus Action" : "Action"} quick slot ${slot.dataset.slotNumber}, empty`);
  slot.replaceChildren();
  if (persist) saveQuickbar();
}

function saveQuickbar() {
  const state = {};
  for (const group of document.querySelectorAll("[data-quickbar]")) {
    state[group.dataset.quickbar] = [...group.querySelectorAll(".combat-quick-slot")].map((slot) => {
      try { return slot.dataset.choice ? JSON.parse(slot.dataset.choice) : null; }
      catch (_error) { return null; }
    });
  }
  try { localStorage.setItem(QUICKBAR_STORAGE_KEY, JSON.stringify(state)); } catch (_error) { /* Storage is optional. */ }
}

function restoreQuickbar() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(QUICKBAR_STORAGE_KEY) || "null"); } catch (_error) { state = null; }
  if (!state) return;
  for (const group of document.querySelectorAll("[data-quickbar]")) {
    const economy = group.dataset.quickbar;
    const storedChoices = Array.isArray(state[economy]) ? state[economy] : [];
    const choices = economy === "action" ? removeLegacyOffHandReservations(storedChoices) : storedChoices;
    [...group.querySelectorAll(".combat-quick-slot")].forEach((slot, index) => {
      if (choices[index]) populateQuickbarSlot(slot, choices[index], economy, { persist: false });
    });
  }
  saveQuickbar();
}

function removeLegacyOffHandReservations(storedChoices) {
  const normalized = Array(16).fill(null);
  const weapons = storedChoices.filter((choice) => choice && isWeaponQuickChoice(choice)).slice(0, 2);
  const ordinaryActions = storedChoices.filter((choice) => choice && !isWeaponQuickChoice(choice));
  if (weapons[0]) normalized[0] = weapons[0];
  if (weapons[1]) normalized[8] = weapons[1];
  const ordinarySlots = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  ordinaryActions.slice(0, ordinarySlots.length).forEach((choice, index) => {
    normalized[ordinarySlots[index]] = choice;
  });
  return normalized;
}

function highlightQuickbarSlots(economy) {
  for (const group of document.querySelectorAll("[data-quickbar]")) {
    const viable = Boolean(economy && group.dataset.quickbar === economy);
    for (const slot of group.querySelectorAll(".combat-quick-slot")) slot.classList.toggle("is-viable-drop", viable);
  }
}

window.api?.onCombatPointerPosition?.(({ inside, x, y } = {}) => {
  const slot = inside ? document.elementFromPoint(x, y)?.closest?.(".combat-quick-slot") : null;
  if (slot === routedQuickbarSlot) return;
  routedQuickbarSlot = slot;
  if (slot) showQuickbarDescription(slot);
  else hideQuickbarDescription();
});

function setActionOptionsVisible(visible) {
  paneToggle.checked = visible;
}

function syncCentralPresentation() {
  const expanded = hasVisibleExternalPanes;
  expandedControls.hidden = !expanded;
  document.body.classList.toggle("has-action-options", expanded);
}

function alignExpandedControlsToCharacterDivider() {
  const name = document.querySelector("#combatCharacterName");
  const column = name?.closest(".combat-ui-column");
  if (!name || !column) return;
  const textRange = document.createRange();
  textRange.selectNodeContents(name);
  const nameRight = textRange.getBoundingClientRect().right;
  const dividerRight = column.getBoundingClientRect().right + 10;
  const referenceGap = Math.max(0, dividerRight - nameRight);
  expandedControls.style.left = `${Math.round(dividerRight + referenceGap)}px`;
}

function syncMovementDetails({ movementRemaining: nextRemaining, movementMax: nextMaximum } = {}) {
  const speedTiles = Number.isFinite(Number(nextMaximum)) ? Number(nextMaximum) : Number(presentationActor.speed) || 6;
  const remainingTiles = Number.isFinite(Number(nextRemaining))
    ? Number(nextRemaining)
    : Number.isFinite(Number(presentationActor.movementRemaining))
      ? Number(presentationActor.movementRemaining)
      : speedTiles;
  movementSummary.textContent = `Movement (${remainingTiles * 5}/${speedTiles * 5})`;
}

function renderSpellSlots(spellSlots = presentationActor.spellSlots) {
  const availableLevels = Object.entries(spellSlots || {})
    .filter(([level, slots]) => Number(level) > 0 && Number(slots?.max) > 0)
    .sort(([left], [right]) => Number(left) - Number(right));
  spellSlotsPanel.hidden = availableLevels.length === 0;
  spellSlotList.replaceChildren(...availableLevels.map(([level, slots]) => {
    const row = document.createElement("div");
    row.className = "combat-spell-slot-row";
    const label = document.createElement("span");
    label.textContent = `L${level}`;
    const pips = document.createElement("span");
    pips.className = "combat-spell-slot-row-pips";
    for (let index = 0; index < Number(slots.max); index += 1) {
      const pip = document.createElement("i");
      pip.className = "combat-spell-slot-row-pip";
      pip.classList.toggle("is-full", index < Number(slots.current));
      pips.append(pip);
    }
    row.append(label, pips);
    return row;
  }));
}

function syncEconomy(economy = currentEconomy) {
  currentEconomy = { ...currentEconomy, ...economy };
  for (const [modality, available] of Object.entries(currentEconomy)) {
    const pip = document.querySelector(`[data-economy-pip="${modality}"]`);
    if (pip) {
      pip.classList.toggle("is-full", available);
      pip.setAttribute("aria-label", `${modality === "bonus" ? "Bonus Action" : modality[0].toUpperCase() + modality.slice(1)} ${available ? "available" : "used"}`);
    }
    const group = document.querySelector(`[data-quickbar="${modality}"]`)?.closest(".combat-quickbar-group");
    group?.classList.toggle("is-spent", !available);
  }
  economyChannel?.postMessage({ type: "economy-state", economy: currentEconomy });
}

document.addEventListener("combat:economy-changed", (event) => {
  syncMovementDetails(event.detail);
  renderSpellSlots(event.detail.spellSlots);
  syncEconomy({ action: event.detail.action, bonus: event.detail.bonus });
});

function selectSettingsTab(selectedTab) {
  for (const tab of settingsTabs) {
    const selected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of settingsPanels) panel.hidden = panel.getAttribute("aria-labelledby") !== selectedTab.id;
}

document.addEventListener("combat:settings-requested", () => {
  if (!settingsDialog.open) settingsDialog.showModal();
});
settingsClose.addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});
settingsTabs.forEach((tab) => tab.addEventListener("click", () => selectSettingsTab(tab)));
paneVisibilityInputs.forEach((input) => input.addEventListener("change", () => {
  window.api?.setCombatPaneVisible?.(input.dataset.paneId, input.checked);
}));
paneSettingInputs.forEach((input) => input.addEventListener("change", () => {
  window.api?.setCombatPaneSetting?.(input.dataset.paneSetting, input.checked);
}));
fullscreenToggle.addEventListener("change", () => window.api?.setFullscreen?.(fullscreenToggle.checked));
displaySchemaSelect.addEventListener("change", () => {
  localStorage.setItem("dndt.combatDisplaySchema", displaySchemaSelect.value);
  window.api?.setCombatDisplaySchema?.(displaySchemaSelect.value);
});
displayOnboarding.addEventListener("submit", (event) => {
  const selected = new FormData(event.currentTarget).get("display-schema");
  if (!selected) return;
  localStorage.setItem("dndt.combatDisplaySchema", selected);
  displaySchemaSelect.value = selected;
  window.api?.setCombatDisplaySchema?.(selected);
});
expandedEndTurn.addEventListener("click", () => compactEndTurn.click());
expandedOptions.addEventListener("click", () => document.dispatchEvent(new CustomEvent("combat:settings-requested")));
window.api?.onCombatActionOptionsVisibility?.(setActionOptionsVisible);
window.api?.onCombatPaneState?.((state) => {
  document.body.classList.toggle("has-joined-panes", Object.values(state || {}).some((pane) => pane?.visible === true && pane?.detached !== true));
  for (const input of paneVisibilityInputs) input.checked = state?.[input.dataset.paneId]?.visible === true;
  setActionOptionsVisible(state?.["action-options"]?.visible === true);
  hasVisibleExternalPanes = Object.values(state || {}).some((pane) => pane?.visible === true);
  syncCentralPresentation();
  syncEconomy();
});
window.api?.onCombatPaneSettings?.((settings) => {
  for (const input of paneSettingInputs) input.checked = settings?.[input.dataset.paneSetting] === true;
  fullscreenToggle.checked = settings?.fullScreen === true;
  fullscreenToggle.disabled = settings?.fullScreenAvailable !== true;
  if (settings?.displaySchema) {
    activeDisplaySchema = settings.displaySchema;
    syncCentralPresentation();
    displaySchemaSelect.value = settings.displaySchema;
    localStorage.setItem("dndt.combatDisplaySchema", settings.displaySchema);
  } else {
    const storedSchema = localStorage.getItem("dndt.combatDisplaySchema");
    if (storedSchema) window.api?.setCombatDisplaySchema?.(storedSchema);
  }
});
window.addEventListener("combat:equipment-changed", syncEquipmentToActionSurfaces);

renderQuickbar();
syncEquippedWeaponsToQuickbar();
syncEquipmentGrantedActionsToQuickbar();
syncMovementDetails();
renderSpellSlots();
syncEconomy();
syncCentralPresentation();
alignExpandedControlsToCharacterDivider();
window.addEventListener("resize", alignExpandedControlsToCharacterDivider);
new ResizeObserver(alignExpandedControlsToCharacterDivider).observe(document.querySelector("#combatCharacterName"));
new MutationObserver(updateColourContext).observe(contextOptions, { childList: true, subtree: true });
new MutationObserver(announceLatestOutcome).observe(logList, { childList: true, subtree: true });
updateColourContext();
