import { getSpellById, listSpellsByClass } from "../data/spells.js";
import { createActionIconImage } from "../combat_ui_v2/actionIconRegistry.js";
import { createItemIconImage } from "./itemIconRegistry.js";
import { getArmorById } from "../data/armor.js";
import { getFootwearById } from "../data/footwear.js";
import { getHeadwearById } from "../data/headwear.js";
import { getRingById } from "../data/rings.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { getWeaponById } from "../data/weapons.js";

const EMBER_MODAL_ID = "dndt-ember-modal";

const titleCase = (value) => String(value || "").replace(/(^|_)([a-z])/g, (_match, _space, letter) => `${_space ? " " : ""}${letter.toUpperCase()}`);

function spellIcon(spell) {
  return createActionIconImage({ id: spell.id, sourceSpellId: spell.id, kind: "spell", iconCategory: "spell" }, "ember-spell-icon-art");
}

export function installEmberModal() {
  if (document.getElementById(EMBER_MODAL_ID)) return;

  const modal = document.createElement("dialog");
  modal.id = EMBER_MODAL_ID;
  modal.className = "ember-modal";
  modal.setAttribute("aria-label", "Ember");
  modal.innerHTML = `
    <div class="ember-modal__fog ember-modal__fog--one" aria-hidden="true"></div>
    <div class="ember-modal__fog ember-modal__fog--two" aria-hidden="true"></div>
    <div class="ember-modal__fog ember-modal__fog--three" aria-hidden="true"></div>
    <header class="ember-modal__heading">Ember <span aria-hidden="true">○</span> Deep Library</header>
    <nav class="ember-modal__radial-menu" aria-label="Ember options">
      <button type="button" data-ember-action="party-check-in"><span>Check in with your party</span></button>
      <button type="button" data-ember-action="spell-selections"><span>Change spell selections</span></button>
      <button type="button" data-ember-action="party-equipment"><span>Adjust your party's equipment</span></button>
      <button type="button" data-ember-action="long-rest"><span>Take a long rest</span></button>
      <button class="ember-modal__departure is-level-up-available" type="button" data-ember-action="level-up" data-ember-departure><span>Level Up!</span></button>
    </nav>
    <section class="ember-modal__spell-workflow" aria-label="Change spell selections" hidden>
      <nav class="ember-modal__caster-tabs" aria-label="Party spellcasters"></nav>
      <div class="ember-modal__spell-levels"></div>
    </section>
    <section class="ember-modal__equipment-workflow" aria-label="Adjust your party's equipment" hidden>
      <nav class="ember-modal__equipment-tabs" aria-label="Party members"></nav>
      <div class="ember-modal__equipment-layout">
        <div class="ember-modal__equipment-rig" aria-label="Equipped items"></div>
        <div class="ember-modal__party-inventory" aria-label="Party inventory"></div>
      </div>
    </section>
    <div class="ember-modal__spell-hover" aria-live="polite">
      <div class="ember-modal__spell-hover-name"></div>
      <p class="ember-modal__spell-hover-description"></p>
    </div>
  `;
  document.body.append(modal);

  const radialButtons = [...modal.querySelectorAll("[data-ember-action]")];
  const departureButton = modal.querySelector("[data-ember-departure]");
  const spellWorkflow = modal.querySelector(".ember-modal__spell-workflow");
  const casterTabs = modal.querySelector(".ember-modal__caster-tabs");
  const spellLevels = modal.querySelector(".ember-modal__spell-levels");
  const spellHover = modal.querySelector(".ember-modal__spell-hover");
  const spellHoverName = modal.querySelector(".ember-modal__spell-hover-name");
  const spellHoverDescription = modal.querySelector(".ember-modal__spell-hover-description");
  const equipmentWorkflow = modal.querySelector(".ember-modal__equipment-workflow");
  const equipmentTabs = modal.querySelector(".ember-modal__equipment-tabs");
  const equipmentRig = modal.querySelector(".ember-modal__equipment-rig");
  const partyInventoryPanel = modal.querySelector(".ember-modal__party-inventory");
  let partyMembers = [];
  let spellcasters = [];
  let activeCasterId = null;
  let activeEquipmentActorId = null;
  let activeEquipmentDrag = null;
  let partyInventory = [];
  const selectionsByCaster = new Map();
  const openLevelByCaster = new Map();
  const spellOrderChannels = new Map();

  const EQUIPMENT_CATEGORIES = [
    ["armor", "Armor"],
    ["shields", "Shields"],
    ["rings", "Rings"],
    ["weapons", "Weapons"],
    ["casting-gear", "Casting Gear"],
    ["footwear", "Footwear"],
    ["headwear", "Headwear"],
  ];

  const resolveEquippable = (id) => getArmorById(id)
    || getRingById(id)
    || getWeaponById(id)
    || getSpellcastingFocusById(id)
    || getFootwearById(id)
    || getHeadwearById(id);

  const equipmentCategory = (item) => {
    const armor = getArmorById(item?.id);
    if (armor?.type === "shield") return "shields";
    if (armor) return "armor";
    if (getRingById(item?.id)) return "rings";
    if (getWeaponById(item?.id)) return "weapons";
    if (getSpellcastingFocusById(item?.id)) return "casting-gear";
    if (getFootwearById(item?.id)) return "footwear";
    if (getHeadwearById(item?.id)) return "headwear";
    return null;
  };

  const collectPartyInventory = () => {
    const quantities = new Map();
    for (const actor of partyMembers) {
      for (const entry of actor.inventory || []) {
        const item = resolveEquippable(entry.id);
        if (!item) continue;
        quantities.set(entry.id, (quantities.get(entry.id) || 0) + Math.max(1, Number(entry.quantity) || 1));
      }
    }
    return [...quantities].map(([id, quantity]) => ({ item: resolveEquippable(id), quantity }));
  };

  const addPartyItem = (itemId) => {
    const existing = partyInventory.find((entry) => entry.item.id === itemId);
    if (existing) existing.quantity += 1;
    else partyInventory.push({ item: resolveEquippable(itemId), quantity: 1 });
  };

  const removePartyItem = (itemId) => {
    const existing = partyInventory.find((entry) => entry.item.id === itemId);
    if (!existing) return false;
    existing.quantity -= 1;
    if (existing.quantity <= 0) partyInventory = partyInventory.filter((entry) => entry !== existing);
    return true;
  };

  const ensureWeaponSets = (actor) => {
    actor.equipment ??= {};
    if (!Array.isArray(actor.equipment.weaponSetIds)) {
      const weapons = actor.equipment.weaponIds || [];
      actor.equipment.weaponSetIds = [[weapons[0] || null, actor.equipment.shieldId || weapons[1] || null], [weapons[2] || null, weapons[3] || null]];
    }
    while (actor.equipment.weaponSetIds.length < 2) actor.equipment.weaponSetIds.push([null, null]);
    for (const set of actor.equipment.weaponSetIds) while (set.length < 2) set.push(null);
  };

  const equippedItemId = (actor, slotId) => {
    ensureWeaponSets(actor);
    if (slotId === "headwear") return actor.equipment.headwearId || null;
    if (slotId === "ring1") return actor.equipment.ringIds?.[0] || null;
    if (slotId === "ring2") return actor.equipment.ringIds?.[1] || null;
    if (slotId === "armor") return actor.equipment.armorId || null;
    if (slotId === "footwear") return actor.equipment.footwearId || null;
    const hand = { weapon1a: [0, 0], weapon1b: [0, 1], weapon2a: [1, 0], weapon2b: [1, 1] }[slotId];
    return hand ? actor.equipment.weaponSetIds[hand[0]][hand[1]] || null : null;
  };

  const setEquippedItem = (actor, slotId, itemId) => {
    ensureWeaponSets(actor);
    if (slotId === "headwear") actor.equipment.headwearId = itemId;
    else if (slotId === "ring1" || slotId === "ring2") {
      const rings = [actor.equipment.ringIds?.[0] || null, actor.equipment.ringIds?.[1] || null];
      rings[slotId === "ring1" ? 0 : 1] = itemId;
      actor.equipment.ringIds = rings;
    } else if (slotId === "armor") actor.equipment.armorId = itemId;
    else if (slotId === "footwear") actor.equipment.footwearId = itemId;
    else {
      const hand = { weapon1a: [0, 0], weapon1b: [0, 1], weapon2a: [1, 0], weapon2b: [1, 1] }[slotId];
      if (hand) actor.equipment.weaponSetIds[hand[0]][hand[1]] = itemId;
    }
    const hands = actor.equipment.weaponSetIds.flat().filter(Boolean);
    actor.equipment.shieldId = hands.find((id) => getArmorById(id)?.type === "shield") || null;
    actor.equipment.weaponIds = [...new Set(hands.filter((id) => getArmorById(id)?.type !== "shield"))];
  };

  const slotAcceptsItem = (slotId, item) => {
    const category = equipmentCategory(item);
    if (slotId === "headwear") return category === "headwear";
    if (slotId === "ring1" || slotId === "ring2") return category === "rings";
    if (slotId === "armor") return category === "armor";
    if (slotId === "footwear") return category === "footwear";
    if (slotId === "weapon1b" || slotId === "weapon2b") return ["weapons", "shields", "casting-gear"].includes(category);
    return slotId.startsWith("weapon") && ["weapons", "casting-gear"].includes(category);
  };

  const showEquipmentDropTargets = (itemId) => {
    const item = resolveEquippable(itemId);
    for (const slot of equipmentRig.querySelectorAll("[data-equipment-slot]")) {
      slot.classList.toggle("is-viable-drop", slotAcceptsItem(slot.dataset.equipmentSlot, item));
    }
  };

  const clearEquipmentDropTargets = () => {
    for (const slot of equipmentRig.querySelectorAll(".is-viable-drop")) slot.classList.remove("is-viable-drop");
  };

  const equipmentSlotsFor = (actor) => {
    const equipment = actor.equipment || {};
    const sets = equipment.weaponSetIds || [];
    const weapons = equipment.weaponIds || [];
    return [
      ["Head", equipment.headwearId, "body-head", "headwear"],
      ["Ring I", equipment.ringIds?.[0], "body-ring-left", "ring1"],
      ["Main\nHand I", sets[0]?.[0] || weapons[0], "body-hand-left", "weapon1a"],
      ["Armor", equipment.armorId, "body-armor", "armor"],
      ["Off\nHand I", sets[0]?.[1] || equipment.shieldId || weapons[1], "body-hand-right", "weapon1b"],
      ["Ring II", equipment.ringIds?.[1], "body-ring-right", "ring2"],
      ["Main\nHand II", sets[1]?.[0] || weapons[2], "body-set-two-left", "weapon2a"],
      ["Off\nHand II", sets[1]?.[1] || weapons[3], "body-set-two-right", "weapon2b"],
      ["Footwear", equipment.footwearId, "body-feet", "footwear"],
    ];
  };

  const renderEquipmentWorkflow = () => {
    equipmentTabs.replaceChildren();
    equipmentTabs.style.setProperty("--ember-equipment-count", String(Math.max(1, partyMembers.length)));
    for (const actor of partyMembers) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ember-equipment-tab";
      tab.textContent = String(actor.name || "").split(",", 1)[0];
      tab.classList.toggle("is-active", actor.id === activeEquipmentActorId);
      tab.addEventListener("click", () => {
        activeEquipmentActorId = actor.id;
        renderEquipmentWorkflow();
      });
      equipmentTabs.append(tab);
    }

    const actor = partyMembers.find((candidate) => candidate.id === activeEquipmentActorId) || partyMembers[0];
    equipmentRig.replaceChildren();
    if (actor) {
      for (const [label, itemId, layoutClass, slotId] of equipmentSlotsFor(actor)) {
        const slot = document.createElement("div");
        slot.className = `ember-equipment-slot ${layoutClass}`;
        slot.dataset.equipmentSlot = slotId;
        const item = resolveEquippable(itemId);
        const icon = item && createItemIconImage(item, "ember-equipment-item-art");
        if (icon) slot.append(icon);
        if (item) {
          bindItemHover(slot, item);
          slot.draggable = true;
          slot.addEventListener("dragstart", (event) => {
            activeEquipmentDrag = { source: "equipment", actorId: actor.id, slotId, itemId: item.id };
            event.dataTransfer.setData("text/plain", JSON.stringify(activeEquipmentDrag));
            showEquipmentDropTargets(item.id);
          });
          slot.addEventListener("dragend", () => {
            activeEquipmentDrag = null;
            clearEquipmentDropTargets();
          });
        }
        slot.addEventListener("dragover", (event) => {
          let drag = activeEquipmentDrag;
          try { drag ||= JSON.parse(event.dataTransfer.getData("text/plain") || "null"); } catch (_error) { return; }
          if (slotAcceptsItem(slotId, resolveEquippable(drag?.itemId))) event.preventDefault();
        });
        slot.addEventListener("drop", (event) => {
          event.preventDefault();
          let drag;
          try { drag = JSON.parse(event.dataTransfer.getData("text/plain") || "null"); } catch (_error) { return; }
          const droppedItem = resolveEquippable(drag?.itemId);
          if (!droppedItem || !slotAcceptsItem(slotId, droppedItem)) return;
          if (drag.source === "equipment" && drag.actorId === actor.id && drag.slotId === slotId) return;
          if (drag.source === "inventory" && !removePartyItem(drag.itemId)) return;
          if (drag.source === "equipment") {
            const sourceActor = partyMembers.find((candidate) => candidate.id === drag.actorId);
            if (!sourceActor || equippedItemId(sourceActor, drag.slotId) !== drag.itemId) return;
            setEquippedItem(sourceActor, drag.slotId, null);
          }
          const displaced = equippedItemId(actor, slotId);
          if (displaced) addPartyItem(displaced);
          setEquippedItem(actor, slotId, drag.itemId);
          clearEquipmentDropTargets();
          renderEquipmentWorkflow();
        });
        const caption = document.createElement("span");
        caption.textContent = label;
        if (!item) slot.append(caption);
        equipmentRig.append(slot);
      }
    }

    const inventory = partyInventory;
    partyInventoryPanel.replaceChildren();
    partyInventoryPanel.ondragover = (event) => event.preventDefault();
    partyInventoryPanel.ondrop = (event) => {
      event.preventDefault();
      let drag;
      try { drag = JSON.parse(event.dataTransfer.getData("text/plain") || "null"); } catch (_error) { return; }
      if (drag?.source !== "equipment") return;
      const sourceActor = partyMembers.find((candidate) => candidate.id === drag.actorId);
      if (!sourceActor || equippedItemId(sourceActor, drag.slotId) !== drag.itemId) return;
      setEquippedItem(sourceActor, drag.slotId, null);
      addPartyItem(drag.itemId);
      clearEquipmentDropTargets();
      renderEquipmentWorkflow();
    };
    for (const [categoryId, label] of EQUIPMENT_CATEGORIES) {
      const section = document.createElement("details");
      section.className = "ember-inventory-category";
      const items = inventory.filter((entry) => equipmentCategory(entry.item) === categoryId)
        .sort((left, right) => left.item.name.localeCompare(right.item.name));
      const summary = document.createElement("summary");
      summary.textContent = `${label}  ${items.reduce((total, entry) => total + entry.quantity, 0)}`;
      const contents = document.createElement("div");
      contents.className = "ember-inventory-category__items";
      for (const entry of items) {
        const tile = document.createElement("div");
        tile.className = "ember-inventory-item";
        bindItemHover(tile, entry.item);
        tile.draggable = true;
        tile.addEventListener("dragstart", (event) => {
          activeEquipmentDrag = { source: "inventory", itemId: entry.item.id };
          event.dataTransfer.setData("text/plain", JSON.stringify(activeEquipmentDrag));
          showEquipmentDropTargets(entry.item.id);
        });
        tile.addEventListener("dragend", () => {
          activeEquipmentDrag = null;
          clearEquipmentDropTargets();
        });
        const icon = createItemIconImage(entry.item, "ember-inventory-item-art");
        if (icon) tile.append(icon);
        const name = document.createElement("span");
        name.textContent = entry.item.name;
        tile.append(name);
        if (entry.quantity > 1) {
          const quantity = document.createElement("small");
          quantity.textContent = `×${entry.quantity}`;
          tile.append(quantity);
        }
        contents.append(tile);
      }
      section.append(summary, contents);
      partyInventoryPanel.append(section);
    }
  };

  const publishSpellOrder = (caster, selections) => {
    const levels = Object.fromEntries([...selections].map(([level, spellIds]) => [level, [...spellIds]]));
    const payload = { casterId: caster.id, levels };
    try { localStorage.setItem(`dndt.spellOrder:${caster.id}`, JSON.stringify(levels)); } catch (_error) { /* Persistence is optional. */ }
    if (typeof BroadcastChannel !== "function") return;
    if (!spellOrderChannels.has(caster.id)) spellOrderChannels.set(caster.id, new BroadcastChannel(`dndt-spell-order:${caster.id}`));
    spellOrderChannels.get(caster.id).postMessage(payload);
  };

  const showSpellName = (spell) => {
    const markers = [];
    if (spell?.concentration) markers.push("C");
    if (spell?.components?.m) {
      markers.push(spell.components.costGp > 0 && spell.components.material
        ? `M: ${spell.components.material}`
        : "M");
    }
    spellHoverName.textContent = spell
      ? `${spell.name}${markers.length ? ` (${markers.join(", ")})` : ""}`
      : "";
    spellHoverDescription.textContent = spell?.text || "";
    spellHover.classList.toggle("is-visible", Boolean(spell));
  };

  const showItemDescription = (item) => {
    spellHoverName.textContent = item?.name || "";
    spellHoverDescription.textContent = item?.description || "";
    spellHover.classList.toggle("is-visible", Boolean(item));
  };

  const bindItemHover = (element, item) => {
    element.addEventListener("pointerenter", () => showItemDescription(item));
    element.addEventListener("pointerleave", () => showItemDescription(null));
    element.addEventListener("focus", () => showItemDescription(item));
    element.addEventListener("blur", () => showItemDescription(null));
  };

  const bindSpellHover = (element, spell) => {
    element.addEventListener("pointerenter", () => showSpellName(spell));
    element.addEventListener("pointerleave", () => showSpellName(null));
    element.addEventListener("focus", () => showSpellName(spell));
    element.addEventListener("blur", () => showSpellName(null));
  };

  const casterSelections = (caster) => {
    if (selectionsByCaster.has(caster.id)) return selectionsByCaster.get(caster.id);
    const selections = new Map();
    const baseSpellIds = [...new Set((caster.actions || [])
      .filter((action) => action.tags?.spell && !String(action.id).includes(":"))
      .map((action) => action.sourceSpellId || action.id)
      .filter((id) => getSpellById(id)))];
    for (const spellId of baseSpellIds) {
      const spell = getSpellById(spellId);
      if (!selections.has(spell.level)) selections.set(spell.level, []);
      selections.get(spell.level).push(spellId);
    }
    try {
      const stored = JSON.parse(localStorage.getItem(`dndt.spellOrder:${caster.id}`) || "null");
      if (stored && typeof stored === "object") {
        for (const [level, spellIds] of Object.entries(stored)) {
          if (Array.isArray(spellIds)) selections.set(Number(level), spellIds.map((id) => id && getSpellById(id) ? id : null));
        }
      }
    } catch (_error) { /* Persistence is optional. */ }
    selectionsByCaster.set(caster.id, selections);
    publishSpellOrder(caster, selections);
    return selections;
  };

  const slotCapacity = (caster, level, selected) => Math.max(Number(caster.spellSlots?.[level]?.max) || 0, selected.filter(Boolean).length);

  const renderSpellLevels = (caster) => {
    spellLevels.replaceChildren();
    const selections = casterSelections(caster);
    const availableLevels = [...new Set([
      ...selections.keys(),
      ...Object.keys(caster.spellSlots || {}).map(Number),
    ])].filter((level) => Number.isFinite(level) && level > 0).sort((a, b) => a - b);
    const classSpells = listSpellsByClass(titleCase(caster.role)).filter((spell) => spell.level > 0);
    const openLevel = openLevelByCaster.get(caster.id) ?? null;

    for (const level of availableLevels) {
      const currentSelection = selections.get(level) || [];
      const capacity = slotCapacity(caster, level, currentSelection);
      const selected = [...currentSelection, ...Array(Math.max(0, capacity - currentSelection.length)).fill(null)];
      selections.set(level, selected);
      const row = document.createElement("details");
      row.className = "ember-spell-level";
      row.open = level === openLevel;
      row.addEventListener("toggle", () => {
        if (row.open) {
          openLevelByCaster.set(caster.id, level);
          spellLevels.querySelectorAll(".ember-spell-level[open]").forEach((candidate) => {
            if (candidate !== row) candidate.open = false;
          });
        }
      });
      const summary = document.createElement("summary");
      summary.textContent = `Level ${level}`;
      if (selected.filter(Boolean).length < capacity) summary.classList.add("needs-attention");
      const body = document.createElement("div");
      body.className = "ember-spell-level__body";
      const prepared = document.createElement("div");
      prepared.className = "ember-spell-prepared";
      const library = document.createElement("div");
      library.className = "ember-spell-library";
      const fillSlot = (spellId) => {
        if (selected.includes(spellId)) return;
        const emptyIndex = selected.findIndex((candidate) => !candidate);
        if (emptyIndex < 0) return;
        selected[emptyIndex] = spellId;
        selections.set(level, selected);
        publishSpellOrder(caster, selections);
        renderSpellLevels(caster);
      };

      for (let index = 0; index < capacity; index += 1) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "ember-spell-slot";
        slot.dataset.slotIndex = String(index);
        const spell = getSpellById(selected[index]);
        if (spell) {
          slot.append(spellIcon(spell));
          slot.setAttribute("aria-label", spell.name);
          bindSpellHover(slot, spell);
        } else {
          slot.classList.add("is-empty");
          slot.setAttribute("aria-label", "Empty spell selection");
        }
        slot.addEventListener("click", () => {
          if (!spell) return;
          selected[index] = null;
          selections.set(level, selected);
          publishSpellOrder(caster, selections);
          showSpellName(null);
          renderSpellLevels(caster);
        });
        slot.addEventListener("dragover", (event) => event.preventDefault());
        slot.addEventListener("drop", (event) => {
          event.preventDefault();
          const droppedSpellId = event.dataTransfer.getData("text/plain");
          if (!selected[index] && droppedSpellId && !selected.includes(droppedSpellId)) {
            selected[index] = droppedSpellId;
            selections.set(level, selected);
            publishSpellOrder(caster, selections);
            renderSpellLevels(caster);
          }
        });
        prepared.append(slot);
      }

      for (const spell of classSpells
        .filter((candidate) => candidate.level === level)
        .sort((left, right) => left.name.localeCompare(right.name))) {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = "ember-spell-choice";
        choice.draggable = true;
        choice.setAttribute("aria-label", spell.name);
        choice.classList.toggle("is-selected", selected.includes(spell.id));
        choice.append(spellIcon(spell));
        bindSpellHover(choice, spell);
        choice.addEventListener("click", () => fillSlot(spell.id));
        choice.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", spell.id));
        library.append(choice);
      }

      body.append(prepared, library);
      row.append(summary, body);
      spellLevels.append(row);
    }
  };

  const renderCasters = () => {
    casterTabs.replaceChildren();
    casterTabs.style.setProperty("--ember-caster-count", String(Math.max(1, spellcasters.length)));
    for (const caster of spellcasters) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = String(caster.name || "").split(",", 1)[0];
      tab.className = "ember-caster-tab";
      tab.classList.toggle("is-active", caster.id === activeCasterId);
      tab.addEventListener("click", () => {
        activeCasterId = caster.id;
        renderCasters();
        renderSpellLevels(caster);
      });
      casterTabs.append(tab);
    }
    const activeCaster = spellcasters.find((caster) => caster.id === activeCasterId) || spellcasters[0];
    if (activeCaster) renderSpellLevels(activeCaster);
  };

  window.addEventListener("ember:party-state", (event) => {
    partyMembers = event.detail?.actors || [];
    partyInventory = collectPartyInventory();
    spellcasters = partyMembers.filter((actor) => (actor.actions || []).some((action) => action.tags?.spell));
    activeCasterId = spellcasters.some((caster) => caster.id === activeCasterId) ? activeCasterId : spellcasters[0]?.id || null;
    activeEquipmentActorId = partyMembers.some((actor) => actor.id === activeEquipmentActorId) ? activeEquipmentActorId : partyMembers[0]?.id || null;
    renderCasters();
    renderEquipmentWorkflow();
  });
  radialButtons.forEach((button) => {
    button.addEventListener("click", () => {
      radialButtons.forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
      spellWorkflow.hidden = button.dataset.emberAction !== "spell-selections";
      equipmentWorkflow.hidden = button.dataset.emberAction !== "party-equipment";
      showSpellName(null);
      if (!spellWorkflow.hidden) renderCasters();
      if (!equipmentWorkflow.hidden) renderEquipmentWorkflow();
      modal.dispatchEvent(new CustomEvent("ember:action-selected", {
        bubbles: true,
        detail: { action: button.dataset.emberAction },
      }));
    });
  });

  window.addEventListener("ember:level-up-availability", (event) => {
    const available = event.detail?.available === true;
    departureButton.classList.toggle("is-level-up-available", available);
    departureButton.dataset.emberAction = available ? "level-up" : "venture-forth";
    departureButton.querySelector("span").textContent = available
      ? "Level Up!"
      : "Gather your party and venture forth";
  });

  const setOpen = (open) => {
    if (open && !modal.open) modal.showModal();
    if (!open && modal.open) modal.close();
    document.body.classList.toggle("is-ember-modal-open", open);
    window.api?.setEmberScreenOpen?.(open);
  };

  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.repeat) return;
    if (event.key !== "=" && event.code !== "Equal") return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(!modal.open);
  }, { capture: true });

  modal.addEventListener("close", () => {
    document.body.classList.remove("is-ember-modal-open");
    window.api?.setEmberScreenOpen?.(false);
  });
}
