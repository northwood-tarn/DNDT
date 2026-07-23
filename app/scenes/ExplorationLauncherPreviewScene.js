import { getRingById } from "../data/rings.js";
import { getArmorById } from "../data/armor.js";
import { getFootwearById } from "../data/footwear.js";
import { getHeadwearById } from "../data/headwear.js";
import { getWeaponById } from "../data/weapons.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { getState } from "../state/stateStore.js";
import { createItemIconImage } from "../ui/itemIconRegistry.js";

const STYLE_ID = "exploration-launcher-preview-style";
const ICON_ROOT = "./assets/images/ui/exploration_launchers";

const LAUNCHERS = [
  ["Journal", "journal.png"],
  ["Inventory", "inventory.png"],
  ["Equipment", "equipment.png"],
  ["Spells", "spells.png"],
  ["Character", "character.png"],
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "DNDT Source Sans";
      src: url("./assets/fonts/source_sans_3/SourceSans3-Variable.ttf") format("truetype");
      font-weight: 200 900;
      font-display: block;
    }

    .exploration-launcher-preview {
      position: absolute;
      inset: 0;
      z-index: 25;
      overflow: hidden;
      background: rgba(1, 13, 15, 0.12);
      font-family: "DNDT Source Sans", var(--font-ui);
      -webkit-app-region: drag;
    }

    .exploration-preview-flame {
      position: absolute;
      top: 32px;
      left: 50%;
      width: 46px;
      height: auto;
      transform: translateX(-50%);
      opacity: 0.21;
      z-index: 0;
      pointer-events: none;
    }

    .exploration-launcher-preview.map-is-open .exploration-preview-flame {
      z-index: 4;
    }

    .exploration-launchers {
      position: absolute;
      top: 50%;
      right: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transform: translateY(-50%);
      z-index: 3;
      transition: opacity 160ms ease, visibility 0s linear 0s;
      -webkit-app-region: no-drag;
    }

    .exploration-launcher-preview.map-is-open .exploration-launchers {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 160ms ease, visibility 0s linear 160ms;
    }

    .exploration-launcher.exploration-map-launcher {
      position: absolute;
      top: 28px;
      right: 14px;
      z-index: 3;
      -webkit-app-region: no-drag;
    }

    .exploration-map-overlay {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: grid;
      place-items: center;
      width: 100vw;
      height: 100vh;
      background: transparent;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 180ms ease, visibility 0s linear 180ms;
      -webkit-app-region: no-drag;
    }

    .exploration-map-overlay.is-open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transition-delay: 0s;
    }

    .exploration-world-map {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .exploration-panel {
      position: absolute;
      top: 0;
      right: 96px;
      z-index: 1;
      width: calc(33.333333vw - 64px);
      height: 100vh;
      background: rgba(5, 25, 27, 0.94);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateX(18px);
      transition: right 180ms ease, opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms;
      -webkit-app-region: no-drag;
    }

    .exploration-panel.is-open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateX(0);
      transition-delay: 0s;
    }

    .exploration-panel::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 1px;
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(137, 174, 168, 0.15) 12%,
        rgba(137, 174, 168, 0.15) 88%,
        transparent 100%
      );
      pointer-events: none;
    }

    .exploration-panel[data-slot="0"] { right: 96px; }
    .exploration-panel[data-slot="1"] { right: calc(33.333333vw + 32px); }
    .exploration-panel[data-slot="2"] { right: calc(66.666667vw - 32px); }

    .exploration-panel-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      margin: 34px 0 0;
      color: rgba(137, 174, 168, 0.62);
      font-size: clamp(13.5px, 1.5vw, 20px);
      font-weight: 300;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .exploration-panel-title::before,
    .exploration-panel-title::after {
      content: "";
      width: clamp(27px, 4vw, 56px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(112, 157, 150, 0.42));
    }

    .exploration-panel-title::after { transform: scaleX(-1); }

    .equipment-panel-content {
      --equipment-square: clamp(66px, 5vw, 82px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      margin-top: 42px;
      padding: 0 22px 34px;
      overflow-y: auto;
      background:
        radial-gradient(circle at 50% 31%, rgba(111, 151, 143, 0.045), transparent 34%),
        radial-gradient(circle at 50% 78%, rgba(72, 111, 105, 0.035), transparent 30%);
    }

    .equipment-worn-grid {
      display: grid;
      grid-template-columns: repeat(3, var(--equipment-square));
      grid-template-rows: repeat(3, var(--equipment-square));
      gap: 16px;
    }

    .equipment-slot {
      position: relative;
      display: grid;
      place-items: center;
      width: var(--equipment-square);
      height: var(--equipment-square);
      padding: 0;
      border: 1px solid rgba(137, 174, 168, 0.20);
      border-radius: 0;
      background:
        linear-gradient(145deg, rgba(141, 174, 165, 0.045), transparent 38%),
        repeating-linear-gradient(128deg, rgba(142, 172, 164, 0.018) 0 1px, transparent 1px 5px),
        repeating-linear-gradient(42deg, rgba(2, 13, 15, 0.12) 0 1px, transparent 1px 7px),
        rgba(2, 17, 19, 0.34);
      color: rgba(151, 187, 181, 0.48);
      font: inherit;
      box-shadow:
        inset 0 0 24px rgba(0, 7, 9, 0.58),
        inset 0 1px rgba(173, 199, 192, 0.045),
        0 0 0 1px rgba(0, 8, 10, 0.22);
      transition: border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .equipment-slot::before {
      content: "";
      position: absolute;
      inset: 5px;
      border: 1px solid rgba(132, 166, 158, 0.065);
      background:
        linear-gradient(90deg, rgba(159, 189, 181, 0.16), rgba(159, 189, 181, 0.16)) left top / 8px 1px no-repeat,
        linear-gradient(180deg, rgba(159, 189, 181, 0.16), rgba(159, 189, 181, 0.16)) left top / 1px 8px no-repeat,
        linear-gradient(90deg, rgba(159, 189, 181, 0.12), rgba(159, 189, 181, 0.12)) right bottom / 8px 1px no-repeat,
        linear-gradient(180deg, rgba(159, 189, 181, 0.12), rgba(159, 189, 181, 0.12)) right bottom / 1px 8px no-repeat;
      opacity: 0.72;
      pointer-events: none;
    }

    .equipment-slot:hover {
      border-color: rgba(151, 194, 184, 0.34);
      color: rgba(176, 210, 202, 0.72);
      background:
        linear-gradient(145deg, rgba(151, 194, 184, 0.075), transparent 42%),
        repeating-linear-gradient(128deg, rgba(142, 172, 164, 0.026) 0 1px, transparent 1px 5px),
        rgba(3, 21, 23, 0.42);
      box-shadow:
        inset 0 0 24px rgba(0, 7, 9, 0.48),
        0 0 12px rgba(75, 145, 133, 0.07);
    }

    .equipment-slot-label {
      padding: 7px;
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0.10em;
      line-height: 1.2;
      text-align: center;
      text-transform: uppercase;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.72);
      opacity: 0.05;
      pointer-events: none;
      transition: opacity 160ms ease;
    }

    .equipment-slot:hover .equipment-slot-label { opacity: 1; }

    .equipment-slot-hint {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 8px);
      z-index: 3;
      width: max-content;
      max-width: 150px;
      padding: 5px 7px;
      border: 1px solid rgba(137, 174, 168, 0.14);
      background: rgba(2, 17, 19, 0.94);
      color: rgba(176, 210, 202, 0.68);
      font-size: 9px;
      font-weight: 350;
      letter-spacing: 0.06em;
      line-height: 1.35;
      text-align: center;
      text-transform: none;
      opacity: 0;
      pointer-events: none;
      transform: translate(-50%, 3px);
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .equipment-slot:hover .equipment-slot-hint {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    .equipment-slot[data-equipment-slot="headwear"] { grid-column: 2; grid-row: 1; }
    .equipment-slot[data-equipment-slot="ring-1"] { grid-column: 1; grid-row: 2; }
    .equipment-slot[data-equipment-slot="armor"] { grid-column: 2; grid-row: 2; }
    .equipment-slot[data-equipment-slot="ring-2"] { grid-column: 3; grid-row: 2; }
    .equipment-slot[data-equipment-slot="boots"] { grid-column: 2; grid-row: 3; }

    .equipment-weapon-sets {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 29px;
    }

    .equipment-weapon-sets::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      width: calc(var(--equipment-square) + var(--equipment-square) + 16px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(137, 174, 168, 0.18) 18%, rgba(137, 174, 168, 0.18) 82%, transparent);
      transform: translateX(-50%);
    }

    .equipment-weapon-set {
      display: grid;
      grid-template-columns: repeat(2, var(--equipment-square));
      gap: 16px;
    }

    .equipment-consumables {
      position: relative;
      display: grid;
      grid-template-columns: repeat(3, var(--equipment-square));
      gap: 16px;
      padding-top: 29px;
    }

    .equipment-consumables::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      width: calc(var(--equipment-square) + var(--equipment-square) + 16px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(137, 174, 168, 0.18) 18%, rgba(137, 174, 168, 0.18) 82%, transparent);
      transform: translateX(-50%);
    }

    .equipment-slot-item-shadow {
      opacity: 0.24;
      filter: grayscale(1);
      pointer-events: none;
    }

    .equipment-slot-item-art {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }

    .equipment-slot.has-item .equipment-slot-label { opacity: 0; }
    .equipment-slot.has-item:hover .equipment-slot-label { opacity: 1; }

    .equipment-slot.is-off-hand .equipment-slot-item-art { transform: scaleX(-1); }

    .equipment-slot.is-mirrored-pair-hand .equipment-slot-item-art { transform: scaleX(-1); }

    .equipment-slot.is-two-handed-occupancy .equipment-slot-item-art {
      opacity: 0.7;
      transform: rotate(180deg);
    }

    .inventory-panel-content {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin-top: 42px;
      padding: 0 28px 34px;
      overflow-y: auto;
    }

    .inventory-category {
      border-top: 1px solid rgba(137, 174, 168, 0.11);
      border-bottom: 1px solid rgba(2, 12, 14, 0.42);
      background:
        repeating-linear-gradient(128deg, rgba(142, 172, 164, 0.012) 0 1px, transparent 1px 6px),
        rgba(2, 17, 19, 0.18);
    }

    .inventory-category-summary {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 48px;
      padding: 0 38px 0 15px;
      color: rgba(151, 187, 181, 0.50);
      font-size: 12px;
      font-weight: 350;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      cursor: pointer;
      list-style: none;
      transition: color 160ms ease, background 160ms ease;
    }

    .inventory-category-summary::-webkit-details-marker { display: none; }

    .inventory-category-summary::after {
      content: "";
      position: absolute;
      top: 50%;
      right: 16px;
      width: 14px;
      height: 14px;
      box-sizing: border-box;
      border: 1px solid rgba(151, 187, 181, 0.22);
      border-radius: 50%;
      background: linear-gradient(
        90deg,
        rgba(151, 187, 181, 0.34) 0 50%,
        rgba(0, 0, 0, 0.12) 50% 100%
      );
      transform: translateY(-50%);
      transition: border-color 160ms ease, background 160ms ease;
    }

    .inventory-category[open] .inventory-category-summary::after {
      border-color: rgba(151, 187, 181, 0.30);
      background: rgba(151, 187, 181, 0.42);
    }

    .inventory-category-summary:hover {
      color: rgba(176, 210, 202, 0.76);
      background: rgba(137, 174, 168, 0.025);
    }

    .inventory-category-list {
      min-height: 8px;
      margin: 0;
      padding: 2px 15px 14px;
      list-style: none;
    }

    .exploration-launcher {
      appearance: none;
      position: relative;
      display: grid;
      place-items: center;
      width: 68px;
      height: 68px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      cursor: pointer;
    }

    .exploration-launcher-icon {
      display: block;
      width: 56px;
      height: 56px;
      object-fit: contain;
      opacity: 0.15;
      filter: saturate(0.72) brightness(0.82) drop-shadow(0 0 4px rgba(75, 186, 173, 0.12));
      transform: translateX(var(--icon-optical-x, 0));
      transition: opacity 180ms ease, filter 180ms ease, transform 180ms ease;
      pointer-events: none;
    }

    .exploration-map-launcher { --icon-optical-x: -2.84px; }
    .exploration-launcher[data-launcher="Journal"] { --icon-optical-x: -2.74px; }
    .exploration-launcher[data-launcher="Inventory"] { --icon-optical-x: -0.68px; }
    .exploration-launcher[data-launcher="Equipment"] { --icon-optical-x: -2.60px; }
    .exploration-launcher[data-launcher="Spells"] { --icon-optical-x: -0.74px; }
    .exploration-launcher[data-launcher="Character"] { --icon-optical-x: -0.06px; }

    .exploration-launcher:hover,
    .exploration-launcher:focus-visible {
      outline: none;
      background: transparent;
    }

    .exploration-launcher:hover .exploration-launcher-icon,
    .exploration-launcher:focus-visible .exploration-launcher-icon,
    .exploration-launcher.is-active .exploration-launcher-icon {
      opacity: 0.52;
      filter: saturate(0.72) brightness(0.82) drop-shadow(0 0 4px rgba(75, 186, 173, 0.12));
      transform: translateX(var(--icon-optical-x, 0));
    }

    .exploration-launcher-label {
      position: absolute;
      top: 50%;
      right: 76px;
      padding: 5px 8px;
      color: rgba(171, 204, 198, 0.68);
      background: rgba(2, 15, 17, 0.72);
      font-size: 12px;
      font-weight: 400;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
      opacity: 0;
      transform: translate(5px, -50%);
      pointer-events: none;
      transition: opacity 160ms ease, transform 160ms ease;
    }

    .exploration-launcher:hover .exploration-launcher-label,
    .exploration-launcher:focus-visible .exploration-launcher-label {
      opacity: 1;
      transform: translate(0, -50%);
    }
  `;
  document.head.appendChild(style);
}

export default class ExplorationLauncherPreviewScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.container = null;
    this.activePanels = [];
  }

  start() {
    ensureStyles();
    if (!this.root) return;
    this.container = document.createElement("section");
    this.container.className = "exploration-launcher-preview";
    this.container.innerHTML = `
      <img class="exploration-preview-flame" src="./assets/images/effects/flame-black.png" alt="">
      <button class="exploration-launcher exploration-map-launcher" type="button" aria-label="Map" aria-expanded="false"><img class="exploration-launcher-icon" src="${ICON_ROOT}/map.png" alt=""><span class="exploration-launcher-label">Map</span></button>
      <section class="exploration-map-overlay" aria-label="World map" aria-hidden="true">
        <img class="exploration-world-map" src="./assets/maps/world_map.png" alt="World map">
      </section>
      ${LAUNCHERS.map(([label]) => panel(label)).join("")}
      <nav class="exploration-launchers" aria-label="Exploration information">
        ${LAUNCHERS.map(([label, filename]) => launcher(label, filename)).join("")}
      </nav>
    `;
    this.root.appendChild(this.container);
    this.mapLauncher = this.container.querySelector(".exploration-map-launcher");
    this.mapLauncherLabel = this.mapLauncher?.querySelector(".exploration-launcher-label");
    this.mapOverlay = this.container.querySelector(".exploration-map-overlay");
    this.panelLaunchers = [...this.container.querySelectorAll("[data-launcher]")];
    this.panels = new Map(
      [...this.container.querySelectorAll("[data-panel]")].map((element) => [element.dataset.panel, element]),
    );
    this.mapLauncher?.addEventListener("click", this.toggleMap);
    this.panelLaunchers.forEach((button) => button.addEventListener("click", this.togglePanel));
    this.renderEquippedArmor();
    this.renderEquippedHeadwear();
    this.renderEquippedFootwear();
    this.renderEquippedRings();
    this.renderWeaponSets();
  }

  renderEquippedHeadwear() {
    const equipment = getState()?.player?.equipment || {};
    this.renderEquipmentItem("headwear", getHeadwearById(equipment.headwear), "Headwear");
  }

  renderEquippedFootwear() {
    const equipment = getState()?.player?.equipment || {};
    const slot = this.container?.querySelector('[data-equipment-slot="boots"]');
    if (!slot) return;
    slot.querySelector(".equipment-slot-item-art")?.remove();
    slot.classList.remove("has-item");
    const footwear = getFootwearById(equipment.boots || "standard_boots");
    const image = createItemIconImage(footwear, "equipment-slot-item-art");
    if (!footwear || !image) return;
    slot.prepend(image);
    slot.classList.add("has-item");
    slot.setAttribute("aria-label", `Boots: ${footwear.name}`);
    slot.title = `${footwear.name} — ${footwear.description}`;
  }

  renderWeaponSets() {
    const equipment = getState()?.player?.equipment || {};
    const sets = resolveEquipmentWeaponSets(equipment);
    sets.forEach((set, index) => {
      const setNumber = index + 1;
      const primary = resolveHandItem(set.mainHand);
      const resolvedSecondary = resolveHandItem(set.offHand);
      const secondary = hasExclusiveHandConflict(primary, resolvedSecondary) ? null : resolvedSecondary;
      const occupiesBoth = isTwoHandedEquipment(primary);
      const mirroredPair = primary?.mirroredHandPair === true;
      this.renderEquipmentItem(`weapon-set-${setNumber}-hand-1`, primary, `Set ${setNumber} · Hand 1`);
      this.renderEquipmentItem(
        `weapon-set-${setNumber}-hand-2`,
        occupiesBoth ? primary : secondary,
        `Set ${setNumber} · Hand 2`,
        { offHand: !occupiesBoth && secondary?.equipmentKind === "weapon", twoHandedOccupancy: occupiesBoth && !mirroredPair, mirroredPairHand: mirroredPair },
      );
    });
  }

  renderEquipmentItem(slotName, item, emptyLabel, options = {}) {
    const slot = this.container?.querySelector(`[data-equipment-slot="${slotName}"]`);
    if (!slot) return;
    slot.querySelector(".equipment-slot-item-art")?.remove();
    slot.classList.remove("has-item", "is-off-hand", "is-two-handed-occupancy", "is-mirrored-pair-hand");
    slot.setAttribute("aria-label", emptyLabel);
    slot.removeAttribute("title");
    const image = createItemIconImage(item, "equipment-slot-item-art");
    if (!item || !image) return;
    slot.prepend(image);
    slot.classList.add("has-item");
    if (options.offHand) slot.classList.add("is-off-hand");
    if (options.twoHandedOccupancy) slot.classList.add("is-two-handed-occupancy");
    if (options.mirroredPairHand) slot.classList.add("is-mirrored-pair-hand");
    const occupiesPair = options.twoHandedOccupancy || options.mirroredPairHand;
    slot.setAttribute("aria-label", occupiesPair ? `${item.name}, occupying both hands` : `${emptyLabel}: ${item.name}`);
    slot.title = occupiesPair ? `${item.name} occupies both hands` : `${item.name} — ${item.description || item.inspectText || ""}`;
  }

  renderEquippedArmor() {
    const equipment = getState()?.player?.equipment || {};
    const slot = this.container?.querySelector('[data-equipment-slot="armor"]');
    if (!slot) return;
    slot.querySelector(".equipment-slot-item-art")?.remove();
    slot.classList.remove("has-item");
    const armor = getArmorById(equipment.armor);
    const image = createItemIconImage(armor, "equipment-slot-item-art");
    if (!armor || !image) return;
    slot.prepend(image);
    slot.classList.add("has-item");
    slot.setAttribute("aria-label", `Armor: ${armor.name}`);
    slot.title = `${armor.name} — ${armor.description}`;
  }

  renderEquippedRings() {
    const equipment = getState()?.player?.equipment || {};
    this.renderRingSlot("ring-1", equipment.ring1);
    this.renderRingSlot("ring-2", equipment.ring2);
  }

  renderRingSlot(slotName, ringId) {
    const slot = this.container?.querySelector(`[data-equipment-slot="${slotName}"]`);
    if (!slot) return;
    slot.querySelector(".equipment-slot-item-art")?.remove();
    slot.classList.remove("has-item");
    const ring = getRingById(ringId);
    const image = createItemIconImage(ring, "equipment-slot-item-art");
    if (!ring || !image) return;
    slot.prepend(image);
    slot.classList.add("has-item");
    slot.setAttribute("aria-label", `${slotName === "ring-1" ? "Ring 1" : "Ring 2"}: ${ring.name}`);
    slot.title = `${ring.name} — ${ring.description}`;
  }

  toggleMap = () => {
    const opening = !this.mapOverlay?.classList.contains("is-open");
    this.mapOverlay?.classList.toggle("is-open", opening);
    this.container?.classList.toggle("map-is-open", opening);
    this.mapOverlay?.setAttribute("aria-hidden", String(!opening));
    this.mapLauncher?.setAttribute("aria-expanded", String(opening));
    this.mapLauncher?.setAttribute("aria-label", opening ? "Close map" : "Map");
    if (this.mapLauncherLabel) this.mapLauncherLabel.textContent = opening ? "Click to close" : "Map";
  };

  togglePanel = (event) => {
    const label = event.currentTarget?.dataset.launcher;
    if (!label) return;

    const existingIndex = this.activePanels.indexOf(label);
    if (existingIndex >= 0) {
      this.activePanels.splice(existingIndex, 1);
    } else {
      if (this.activePanels.length === 3) this.activePanels.pop();
      this.activePanels.push(label);
    }
    this.renderPanelStack();
  };

  renderPanelStack() {
    this.panels?.forEach((element, label) => {
      const slot = this.activePanels.indexOf(label);
      const opening = slot >= 0;
      element.classList.toggle("is-open", opening);
      element.setAttribute("aria-hidden", String(!opening));
      if (opening) element.dataset.slot = String(slot);
      else delete element.dataset.slot;
    });

    this.panelLaunchers?.forEach((button) => {
      const active = this.activePanels.includes(button.dataset.launcher);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  cleanup() {
    this.mapLauncher?.removeEventListener("click", this.toggleMap);
    this.panelLaunchers?.forEach((button) => button.removeEventListener("click", this.togglePanel));
    this.container?.remove();
    this.container = null;
    this.mapLauncher = null;
    this.mapLauncherLabel = null;
    this.mapOverlay = null;
    this.panelLaunchers = null;
    this.panels = null;
    this.activePanels = [];
  }

  destroy() { this.cleanup(); }
}

function launcher(label, filename) {
  return `<button class="exploration-launcher" data-launcher="${label}" type="button" aria-label="${label}" aria-pressed="false"><img class="exploration-launcher-icon" src="${ICON_ROOT}/${filename}" alt=""><span class="exploration-launcher-label">${label}</span></button>`;
}

function panel(label) {
  const content = label === "Equipment"
    ? equipmentPanelContent()
    : label === "Inventory"
      ? inventoryPanelContent()
      : "";
  return `<section class="exploration-panel" data-panel="${label}" aria-label="${label}" aria-hidden="true"><h1 class="exploration-panel-title">${label}</h1>${content}</section>`;
}

function inventoryPanelContent() {
  return `<div class="inventory-panel-content">
    ${inventoryCategory("equipment", "Equipment")}
    ${inventoryCategory("usable", "Consumables")}
    ${inventoryCategory("tool", "Tools")}
    ${inventoryCategory("quest", "Quest Items")}
  </div>`;
}

function inventoryCategory(type, label) {
  return `<details class="inventory-category" data-inventory-category="${type}"><summary class="inventory-category-summary">${label}</summary><ul class="inventory-category-list" aria-label="${label}"></ul></details>`;
}

function equipmentPanelContent() {
  return `<div class="equipment-panel-content">
    <div class="equipment-worn-grid" aria-label="Worn equipment">
      ${equipmentSlot("headwear", "Headwear")}
      ${equipmentSlot("ring-1", "Ring 1")}
      ${equipmentSlot("armor", "Armor")}
      ${equipmentSlot("ring-2", "Ring 2")}
      ${equipmentSlot("boots", "Boots")}
    </div>
    <div class="equipment-weapon-sets" aria-label="Weapon sets">
      <div class="equipment-weapon-set" data-weapon-set="1">
        ${equipmentSlot("weapon-set-1-hand-1", "Set 1 · Hand 1")}
        ${equipmentSlot("weapon-set-1-hand-2", "Set 1 · Hand 2")}
      </div>
      <div class="equipment-weapon-set" data-weapon-set="2">
        ${equipmentSlot("weapon-set-2-hand-1", "Set 2 · Hand 1")}
        ${equipmentSlot("weapon-set-2-hand-2", "Set 2 · Hand 2")}
      </div>
    </div>
    <div class="equipment-consumables" aria-label="Readied consumables">
      ${equipmentSlot("consumable-1", "Consumable 1", "Up to 3 of any consumable")}
      ${equipmentSlot("consumable-2", "Consumable 2", "Up to 3 of any consumable")}
      ${equipmentSlot("consumable-3", "Consumable 3", "Up to 3 of any consumable")}
    </div>
  </div>`;
}

function equipmentSlot(slot, label, hint = "") {
  const hintMarkup = hint ? `<span class="equipment-slot-hint">${hint}</span>` : "";
  return `<div class="equipment-slot" data-equipment-slot="${slot}" role="group" aria-label="${label}"><span class="equipment-slot-label">${label}</span>${hintMarkup}</div>`;
}

export function resolveEquipmentWeaponSets(equipment = {}) {
  if (Array.isArray(equipment.weaponSets)) {
    return [0, 1].map((index) => normalizeWeaponSet(equipment.weaponSets[index]));
  }
  const weaponIds = equipment.weaponIds || [];
  return [
    {
      mainHand: equipment.mainHand || weaponIds[0] || null,
      offHand: equipment.offHand || equipment.shield || equipment.shieldId || weaponIds[1] || null,
    },
    {
      mainHand: equipment.weaponSet2MainHand || weaponIds[2] || null,
      offHand: equipment.weaponSet2OffHand || weaponIds[3] || null,
    },
  ];
}

function normalizeWeaponSet(set) {
  if (Array.isArray(set)) return { mainHand: set[0] || null, offHand: set[1] || null };
  return {
    mainHand: set?.mainHand || set?.primary || set?.hand1 || null,
    offHand: set?.offHand || set?.secondary || set?.hand2 || null,
  };
}

export function resolveHandItem(id) {
  return getWeaponById(id) || getArmorById(id) || getSpellcastingFocusById(id) || null;
}

export function isTwoHandedEquipment(item) {
  return item?.hands === 2 || item?.properties?.includes("two-handed") === true;
}

export function hasExclusiveHandConflict(primary, secondary) {
  return Boolean(primary?.exclusiveGroup && primary.exclusiveGroup === secondary?.exclusiveGroup);
}
