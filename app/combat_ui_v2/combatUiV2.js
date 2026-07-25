import "../combat_ui_take2/combatUi.js";
import { createCombatGame } from "../combat/api.js";
import { createActionIconImage } from "./actionIconRegistry.js";
import { installEquipmentDrawer } from "./equipmentDrawer.js";
import { getWeaponById } from "../data/weapons.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";

const scenarioId = new URLSearchParams(window.location.search).get("scenario");
if (!scenarioId) throw new Error("Combat UI v2 requires combat scenario state.");
const presentationGame = createCombatGame({ scenarioId });
const presentationActor = presentationGame.snapshot.actors.find((actor) => actor.team === "heroes");
if (!presentationActor) throw new Error("Combat UI v2 requires an active player or companion.");

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
const quickbarTooltip = document.querySelector(".combat-quickbar-tooltip");
let bannerTimer = null;
let routedQuickbarSlot = null;
let activeDisplaySchema = "laptop";
let activeInventoryQuickChoice = null;
let quickbarDragSourceSlot = null;
const equipmentDragChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`dndt-equipment:${presentationActor.id}`) : null;

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
  const action = presentationActor.actions?.find((candidate) => candidate.itemId === itemId || candidate.id === itemId);
  if (!action) return drag?.source === "equipment" ? quickWeaponChoice(itemId) : null;
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

function showQuickbarDescription(slot) {
  if (!slot?.dataset.choice) return;
  const choice = JSON.parse(slot.dataset.choice);
  const displayName = choice.secondaryChoiceName ? `${choice.name} — ${choice.secondaryChoiceName}` : choice.name;
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
  for (const [economy, count] of [["action", 6], ["bonus", 4]]) {
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
}

function populateQuickbarSlot(slot, choice, economy) {
  slot.dataset.choiceId = choice.id;
  slot.dataset.choice = JSON.stringify(choice);
  const displayName = choice.secondaryChoiceName ? `${choice.name} — ${choice.secondaryChoiceName}` : choice.name;
  slot.title = displayName;
  slot.setAttribute("aria-label", `${displayName}, ${economy === "bonus" ? "Bonus Action" : "Action"} quick slot ${slot.dataset.slotNumber}`);
  slot.draggable = true;
  slot.classList.add("is-populated");
  slot.classList.toggle("is-unavailable", choice.available === false);
  slot.replaceChildren(createActionIconImage(choice, "combat-quick-icon-art"));
}

function clearQuickbarSlot(slot) {
  delete slot.dataset.choiceId;
  delete slot.dataset.choice;
  slot.removeAttribute("title");
  slot.draggable = false;
  slot.classList.remove("is-populated", "is-unavailable", "is-being-dragged");
  const economy = slot.closest("[data-quickbar]")?.dataset.quickbar || "action";
  slot.setAttribute("aria-label", `${economy === "bonus" ? "Bonus Action" : "Action"} quick slot ${slot.dataset.slotNumber}, empty`);
  slot.replaceChildren();
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
  const expanded = activeDisplaySchema !== "laptop";
  expandedControls.hidden = !expanded;
  document.body.classList.toggle("has-action-options", expanded);
}

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
window.api?.onCombatActionOptionsVisibility?.(setActionOptionsVisible);
window.api?.onCombatPaneState?.((state) => {
  for (const input of paneVisibilityInputs) input.checked = state?.[input.dataset.paneId]?.visible === true;
  setActionOptionsVisible(state?.["action-options"]?.visible === true);
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
    else if (!displayOnboarding.open) displayOnboarding.showModal();
  }
});

renderQuickbar();
syncCentralPresentation();
new MutationObserver(updateColourContext).observe(contextOptions, { childList: true, subtree: true });
new MutationObserver(announceLatestOutcome).observe(logList, { childList: true, subtree: true });
updateColourContext();
