import "../combat_ui_take2/combatUi.js";
import { createCombatGame } from "../combat/api.js";
import { createActionIconImage } from "./actionIconRegistry.js";
import { installEquipmentDrawer } from "./equipmentDrawer.js";

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
const settingsTabs = [...document.querySelectorAll('[role="tab"]')];
const settingsPanels = [...document.querySelectorAll('[role="tabpanel"]')];
const compactEndTurn = document.querySelector('[data-combat-command="end_turn"]');
const expandedEndTurn = document.querySelector(".combat-expanded-end-turn");
const quickbarTooltip = document.querySelector(".combat-quickbar-tooltip");
let bannerTimer = null;
let routedQuickbarSlot = null;

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
      slot.addEventListener("dragover", (event) => {
        if (!event.dataTransfer.types.includes(`application/x-dndt-${economy}`)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        slot.classList.add("is-drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("is-drag-over"));
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("is-drag-over");
        const raw = event.dataTransfer.getData("application/x-dndt-action") || event.dataTransfer.getData("text/plain");
        try {
          const choice = JSON.parse(raw);
          if (choice.economy !== economy) return;
          slot.dataset.choiceId = choice.id;
          slot.dataset.choice = JSON.stringify(choice);
          const displayName = choice.secondaryChoiceName ? `${choice.name} — ${choice.secondaryChoiceName}` : choice.name;
          slot.title = displayName;
          slot.setAttribute("aria-label", `${displayName}, ${economy === "bonus" ? "Bonus Action" : "Action"} quick slot ${index + 1}`);
          slot.classList.add("is-populated");
          slot.classList.toggle("is-unavailable", choice.available === false);
          slot.replaceChildren(createActionIconImage(choice, "combat-quick-icon-art"));
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

window.api?.onCombatPointerPosition?.(({ inside, x, y } = {}) => {
  const slot = inside ? document.elementFromPoint(x, y)?.closest?.(".combat-quick-slot") : null;
  if (slot === routedQuickbarSlot) return;
  routedQuickbarSlot = slot;
  if (slot) showQuickbarDescription(slot);
  else hideQuickbarDescription();
});

function setExpandedVisible(visible) {
  expandedControls.hidden = !visible;
  document.body.classList.toggle("has-action-options", visible);
  paneToggle.checked = visible;
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
expandedEndTurn.addEventListener("click", () => compactEndTurn.click());
window.api?.onCombatActionOptionsVisibility?.(setExpandedVisible);
window.api?.onCombatPaneState?.((state) => {
  for (const input of paneVisibilityInputs) input.checked = state?.[input.dataset.paneId]?.visible === true;
  setExpandedVisible(state?.["action-options"]?.visible === true);
});
window.api?.onCombatPaneSettings?.((settings) => {
  for (const input of paneSettingInputs) input.checked = settings?.[input.dataset.paneSetting] === true;
  fullscreenToggle.checked = settings?.fullScreen === true;
  fullscreenToggle.disabled = settings?.fullScreenAvailable !== true;
});

renderQuickbar();
setExpandedVisible(true);
new MutationObserver(updateColourContext).observe(contextOptions, { childList: true, subtree: true });
new MutationObserver(announceLatestOutcome).observe(logList, { childList: true, subtree: true });
updateColourContext();
