import { getArmorById } from "../data/armor.js";
import { getConsumableById } from "../data/consumables.js";
import { getFootwearById } from "../data/footwear.js";
import { getHeadwearById } from "../data/headwear.js";
import { getRingById } from "../data/rings.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { getWeaponById, isWeaponProficient } from "../data/weapons.js";
import { createItemIconImage } from "../ui/itemIconRegistry.js";

const ITEM_DRAG_TYPE = "application/x-dndt-item";
let activeItemDrag = null;
const CATEGORY_ORDER = ["armor", "shields", "rings", "weapons", "casting-gear", "footwear", "headwear", "consumables", "other"];
const CATEGORY_LABELS = {
  armor: "Armor",
  shields: "Shields",
  rings: "Rings",
  weapons: "Weapons",
  "casting-gear": "Casting Gear",
  footwear: "Footwear",
  headwear: "Headwear",
  consumables: "Consumables",
  other: "Other",
};

export function installEquipmentDrawer(actor) {
  const drawer = document.querySelector(".gear-drawer");
  if (!drawer || !actor) return;
  const actorNames = [...drawer.querySelectorAll("[data-gear-actor-name]")];
  const equipmentPanel = drawer.querySelector('[data-gear-panel="equipment"]');
  const inventoryPanel = drawer.querySelector('[data-gear-panel="inventory"]');
  const characterPanel = drawer.querySelector('[data-gear-panel="character"]');
  const content = drawer.querySelector(".gear-drawer-content");
  const columns = Object.fromEntries([...drawer.querySelectorAll("[data-gear-column]")].map((column) => [column.dataset.gearColumn, column]));
  const state = installEquipmentPanelContent(actor, { equipmentPanel, inventoryPanel });
  const openOrder = [];
  let externalPanesActive = false;

  const actionFrame = drawer.querySelector("[data-action-options-frame]");
  if (actionFrame) {
    const scenario = new URLSearchParams(window.location.search).get("scenario");
    actionFrame.src = `./action_options.html?panel=action-options&embedded=1${scenario ? `&scenario=${encodeURIComponent(scenario)}` : ""}`;
  }
  const questsFrame = drawer.querySelector("[data-quests-frame]");
  if (questsFrame) {
    const scenario = new URLSearchParams(window.location.search).get("scenario");
    questsFrame.src = `./action_options.html?panel=quests&embedded=1${scenario ? `&scenario=${encodeURIComponent(scenario)}` : ""}`;
  }

  for (const actorName of actorNames) actorName.textContent = actor.name.split(",", 1)[0];
  installCharacterPanel(actor, characterPanel);

  const syncPresentation = () => {
    for (const [panelId, column] of Object.entries(columns)) column.hidden = !openOrder.includes(panelId);
    for (const panelId of openOrder) content.append(columns[panelId]);
    drawer.classList.toggle("has-two-panes", openOrder.length === 2);
    drawer.classList.toggle("has-three-panes", openOrder.length === 3);
    drawer.classList.toggle("has-four-panes", openOrder.length === 4);
    drawer.classList.toggle("is-open", openOrder.length > 0);
    document.body.classList.toggle("has-internal-panes", openOrder.length > 0);
    drawer.setAttribute("aria-hidden", String(openOrder.length === 0));
  };

  const open = (panelId) => {
    if (openOrder.includes(panelId)) return;
    if (openOrder.length >= 4) openOrder.splice(3, 1);
    openOrder.push(panelId);
    syncPresentation();
  };

  const close = (panelId) => {
    const index = openOrder.indexOf(panelId);
    if (index >= 0) openOrder.splice(index, 1);
    syncPresentation();
  };

  const toggle = (panelId) => {
    if (openOrder.includes(panelId)) close(panelId);
    else open(panelId);
  };

  for (const button of drawer.querySelectorAll("[data-close-gear-panel]")) {
    button.addEventListener("click", () => close(button.dataset.closeGearPanel));
  }
  window.api?.onCombatPaneState?.((paneState) => {
    const nextExternalPanesActive = Object.values(paneState || {}).some((entry) => entry?.visible === true);
    if (nextExternalPanesActive && !externalPanesActive && openOrder.length) {
      openOrder.splice(0, openOrder.length);
      syncPresentation();
    }
    externalPanesActive = nextExternalPanesActive;
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
    const panelId = event.code === "KeyO" ? "action-options" : event.code === "KeyE" ? "equipment" : event.code === "KeyI" ? "inventory" : event.code === "KeyC" ? "character" : event.code === "KeyQ" ? "quests" : null;
    if (!panelId) return;
    event.preventDefault();
    if (window.api?.toggleCombatPane && externalPanesActive) {
      window.api.toggleCombatPane(panelId);
      return;
    }
    toggle(panelId);
  }, true);

  for (const column of Object.values(columns)) {
    const handle = column.querySelector(".gear-drawer-header");
    if (!handle) continue;
    const dragSurface = handle.querySelector(":scope > div");
    if (!dragSurface) continue;
    dragSurface.classList.add("gear-pane-drag-source");
    dragSurface.draggable = true;
    dragSurface.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", column.dataset.gearColumn);
      column.classList.add("is-dragging-pane");
      const panelId = column.dataset.gearColumn;
      window.api?.externalizeCombatPane?.(panelId, { x: event.screenX, y: event.screenY });
      close(panelId);
    });
    dragSurface.addEventListener("dragend", () => {
      column.classList.remove("is-dragging-pane");
    });
  }

}

export function installCharacterPanel(actor, panel) {
  if (!panel) return;
  const render = () => renderCharacterPanel(panel, actor);
  window.addEventListener("combat:equipment-changed", render);
  render();
}

function renderCharacterPanel(panel, actor) {
  const sheet = liveCharacterSheet(actor);
  const identity = document.createElement("section");
  identity.className = "character-summary";
  const live = liveDerivedStats(actor, sheet);
  identity.innerHTML = `<div><span>Level</span><strong>${sheet.level ?? actor.level ?? "—"}</strong></div><div><span>Proficiency</span><strong>${formatBonus(sheet.proficiencyBonus ?? actor.proficiencyBonus)}</strong></div><div><span>Armor Class</span><strong>${live.armorClass}</strong></div><div><span>Initiative</span><strong>${formatBonus(live.initiative)}</strong></div><div><span>Speed</span><strong>${live.speedFt} ft</strong></div>`;

  const abilities = characterSection("Abilities");
  abilities.append(characterAbilityList(sheet));

  const skills = characterSection("Skills");
  skills.append(characterStatList(Object.entries(sheet.skills || {}).map(([name, entry]) => [
    `${titleWords(name)}${entry.expertise ? " · Expertise" : entry.proficient ? " · Proficient" : ""}`,
    formatBonus(entry.modifier),
    entry.expertise ? "expertise" : entry.proficient ? "proficient" : "ordinary",
  ])));

  const spellcasting = characterSection("Spellcasting");
  spellcasting.append(characterStatList([
    ["Spell Attack", formatBonus(sheet.spellAttackBonus)],
    ["Spell Save DC", sheet.spellSaveDC || "—"],
  ]));

  const weapons = characterSection("Weapon Attacks");
  const weaponLines = equippedWeaponAttackLines(actor);
  weapons.append(characterStatList(weaponLines.length ? weaponLines : [["None equipped", "—"]], "character-weapon-list"));
  const mainColumn = document.createElement("div");
  mainColumn.className = "character-sheet-column character-sheet-column-main";
  mainColumn.append(identity);
  const combatColumn = document.createElement("div");
  combatColumn.className = "character-sheet-column character-sheet-column-combat";
  combatColumn.append(spellcasting, weapons);
  const abilitiesColumn = document.createElement("div");
  abilitiesColumn.className = "character-sheet-column character-sheet-column-abilities";
  abilitiesColumn.append(abilities);
  const skillsColumn = document.createElement("div");
  skillsColumn.className = "character-sheet-column character-sheet-column-skills";
  skillsColumn.append(skills);
  panel.replaceChildren(mainColumn, combatColumn, abilitiesColumn, skillsColumn);
}

function liveCharacterSheet(actor) {
  const sheet = structuredClone(actor.characterSheet || {});
  const items = equippedActorItems(actor);
  for (const item of items) {
    for (const [ability, minimum] of Object.entries(item.modifiers?.abilityScoreMinimums || {})) {
      const entry = sheet.abilities?.[ability];
      if (!entry || entry.score >= minimum) continue;
      entry.score = minimum;
      entry.modifier = Math.floor((minimum - 10) / 2);
    }
  }
  for (const entry of Object.values(sheet.skills || {})) {
    const abilityModifier = sheet.abilities?.[entry.ability]?.modifier || 0;
    const multiplier = entry.expertise ? 2 : entry.proficient ? 1 : 0;
    entry.modifier = abilityModifier + ((sheet.proficiencyBonus || 0) * multiplier);
  }
  for (const ability of Object.keys(sheet.saves || {})) {
    const proficient = (sheet.savingThrowProficiencies || []).includes(ability);
    sheet.saves[ability] = (sheet.abilities?.[ability]?.modifier || 0) + (proficient ? sheet.proficiencyBonus || 0 : 0);
  }
  const castingAbility = sheet.spellcastingAbility;
  if (castingAbility && actor.characterSheet?.abilities?.[castingAbility]) {
    const modifierDelta = (sheet.abilities?.[castingAbility]?.modifier || 0) - (actor.characterSheet.abilities[castingAbility].modifier || 0);
    sheet.spellAttackBonus += modifierDelta;
    sheet.spellSaveDC += modifierDelta;
  }
  sheet.spellAttackBonus += items.reduce((total, item) => total + (Number(item.modifiers?.spellAttackBonus) || 0), 0);
  sheet.spellSaveDC += items.reduce((total, item) => total + (Number(item.modifiers?.spellSaveDCBonus) || 0), 0);
  return sheet;
}

function liveDerivedStats(actor, sheet = liveCharacterSheet(actor)) {
  const dexterity = sheet.abilities?.dexterity?.modifier || 0;
  const armor = getArmorById(actor.equipment?.armorId);
  const items = equippedActorItems(actor);
  let armorClass = armor
    ? armor.type === "light" ? armor.ac + dexterity
      : armor.type === "medium" ? armor.ac + Math.min(dexterity, armor.dexCap ?? 2)
        : armor.ac
    : 10 + dexterity;
  armorClass += items.reduce((total, item) => total + (Number(item.modifiers?.acBonus) || 0), 0);
  const initiative = (sheet.abilities?.dexterity?.modifier || 0) + items.reduce((total, item) => total + (Number(item.modifiers?.initiativeBonus) || 0), 0);
  const speedFt = (sheet.baseSpeedFt || 30) + items.reduce((total, item) => total + (Number(item.modifiers?.speedBonusFt) || 0) + (Number(item.modifiers?.combatSpeedBonusFt) || 0), 0);
  return { armorClass, initiative, speedFt };
}

function equippedActorItems(actor) {
  return [
    actor.equipment?.armorId,
    actor.equipment?.shieldId,
    ...(actor.equipment?.ringIds || []),
    actor.equipment?.headwearId,
    actor.equipment?.footwearId,
    ...(actor.equipment?.weaponIds || []),
  ].filter(Boolean).map(resolveItem).filter(Boolean);
}

function characterSection(title) {
  const section = document.createElement("section");
  section.className = "character-sheet-section";
  const heading = document.createElement("h2");
  heading.textContent = title;
  section.append(heading);
  return section;
}

function characterStatList(entries, className = "") {
  const list = document.createElement("dl");
  list.className = className;
  for (const [label, value, emphasis = "ordinary"] of entries) {
    const term = document.createElement("dt");
    term.textContent = label;
    const bridge = document.createElement("span");
    bridge.className = `character-stat-bridge is-${emphasis}`;
    bridge.setAttribute("aria-hidden", "true");
    const detail = document.createElement("dd");
    detail.textContent = value;
    list.append(term, bridge, detail);
  }
  return list;
}

function characterAbilityList(sheet) {
  const list = document.createElement("dl");
  list.className = "character-ability-list";
  for (const [ability, entry] of Object.entries(sheet.abilities || {})) {
    const term = document.createElement("dt");
    const name = document.createElement("span");
    name.textContent = ability.slice(0, 3).toUpperCase();
    const score = document.createElement("strong");
    score.textContent = entry.score;
    const modifier = document.createElement("small");
    modifier.textContent = formatBonus(entry.modifier);
    term.append(name, score, modifier);
    const saveProficient = (sheet.savingThrowProficiencies || []).includes(ability);
    const bridge = document.createElement("span");
    bridge.className = `character-stat-bridge is-${saveProficient ? "proficient" : "ordinary"}`;
    bridge.setAttribute("aria-hidden", "true");
    const save = document.createElement("dd");
    save.textContent = `Save ${formatBonus(sheet.saves?.[ability])}`;
    list.append(term, bridge, save);
  }
  return list;
}

function equippedWeaponAttackLines(actor) {
  const seen = new Set();
  const lines = [];
  for (const id of actor.equipment?.weaponIds || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = getWeaponById(id) || getSpellcastingFocusById(id);
    if (!item?.canMakeWeaponAttack && item?.canMakeWeaponAttack !== undefined) continue;
    if (!item) continue;
    const ability = item.attackAbility === "dexterity" || item.properties?.includes("finesse") ? Math.max(actor.abilityMods?.str || 0, actor.abilityMods?.dex || 0) : actor.abilityMods?.str || 0;
    const attack = ability + (actor.proficiencyBonus || 0) + (item.enhancementBonus || 0);
    const damageBonus = ability + (item.enhancementBonus || 0);
    lines.push([item.name, `${formatBonus(attack)} · ${appendFormulaBonus(item.damageFormula, damageBonus)} ${titleWords(item.damageType)}`]);
  }
  return lines;
}

function appendFormulaBonus(formula, bonus) {
  if (!bonus) return formula || "—";
  return `${formula || "—"}${bonus > 0 ? "+" : ""}${bonus}`;
}

function formatBonus(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number >= 0 ? "+" : ""}${number}`;
}

export function installEquipmentPanelContent(actor, { equipmentPanel, inventoryPanel } = {}) {
  if (!actor || !equipmentPanel || !inventoryPanel) return null;
  const state = createDrawerState(actor);
  state.equipmentPanel = equipmentPanel;
  const render = () => {
    renderEquipment(equipmentPanel, state, render);
    renderInventory(inventoryPanel, state, render);
  };
  state.render = render;
  installEquipmentSync(state);
  render();
  return state;
}

function installEquipmentSync(state) {
  if (typeof BroadcastChannel !== "function") return;
  state.syncToken = globalThis.crypto?.randomUUID?.() || String(Math.random());
  state.channel = new BroadcastChannel(`dndt-equipment:${state.actor.id}`);
  state.channel.addEventListener("message", (event) => {
    if (!event.data || event.data.source === state.syncToken) return;
    if (event.data.type === "item-drag-start") {
      activeItemDrag = event.data.drag;
      showViableSlotHighlights(state, event.data.drag?.itemId);
      return;
    }
    if (event.data.type === "item-drag-end") {
      clearViableSlotHighlights(state, false);
      return;
    }
    if (event.data.type === "request-state") {
      state.channel.postMessage({
        type: "equipment-state",
        source: state.syncToken,
        equipped: structuredClone(state.equipped),
        inventory: structuredClone(state.inventory),
      });
      return;
    }
    if (event.data.type && event.data.type !== "equipment-state") return;
    state.equipped = structuredClone(event.data.equipped);
    state.inventory = structuredClone(event.data.inventory);
    writeActorEquipment(state);
    state.render?.();
    window.dispatchEvent(new CustomEvent("combat:equipment-changed", { detail: { equipment: structuredClone(state.actor.equipment), inventory: structuredClone(state.actor.inventory) } }));
  });
  state.channel.postMessage({ type: "request-state", source: state.syncToken });
}

function createDrawerState(actor) {
  const equipment = actor.equipment || {};
  const weaponIds = [...(equipment.weaponIds || [])];
  const storedSets = Array.isArray(equipment.weaponSetIds) ? equipment.weaponSetIds : [];
  const hasStoredHands = storedSets.some((set) => Array.isArray(set) && set.some(Boolean));
  const handIds = hasStoredHands
    ? [
        storedSets[0]?.[0] || null,
        storedSets[0]?.[1] || null,
        storedSets[1]?.[0] || null,
        storedSets[1]?.[1] || null,
      ]
    : [weaponIds[0] || null, weaponIds[1] || null, weaponIds[2] || null, weaponIds[3] || null];
  for (const [mainIndex, offHandIndex] of [[0, 1], [2, 3]]) {
    const mainHandItem = resolveItem(handIds[mainIndex]);
    if (handIds[mainIndex] && !handIds[offHandIndex] && effectiveHands(mainHandItem, actor) === 2) {
      handIds[offHandIndex] = handIds[mainIndex];
    }
  }
  if (equipment.shieldId) {
    const preferredIndex = handIds[1] ? handIds.findIndex((id) => !id) : 1;
    if (preferredIndex >= 0) handIds[preferredIndex] = equipment.shieldId;
  }
  const equipped = {
    headwear: equipment.headwearId || null,
    ring1: equipment.ringIds?.[0] || null,
    ring2: equipment.ringIds?.[1] || null,
    armor: equipment.armorId || null,
    footwear: equipment.footwearId || null,
    weapon1a: handIds[0],
    weapon1b: handIds[1],
    weapon2a: handIds[2],
    weapon2b: handIds[3],
  };
  return {
    actor,
    equipped,
    inventory: (actor.inventory || []).map((entry) => ({ id: entry.id, quantity: Math.max(1, Number(entry.quantity) || 1) })),
  };
}

function renderEquipment(panel, state, rerender) {
  const body = document.createElement("div");
  body.className = "equipment-body-layout";
  body.append(
    equipmentSlot("headwear", "Head", state, rerender, "body-head"),
    equipmentSlot("ring1", "Ring I", state, rerender, "body-ring-left"),
    equipmentSlot("weapon1a", "Set I · Hand", state, rerender, "body-hand-left"),
    equipmentSlot("armor", "Armor", state, rerender, "body-armor"),
    equipmentSlot("weapon1b", "Set I · Off Hand", state, rerender, "body-hand-right"),
    equipmentSlot("ring2", "Ring II", state, rerender, "body-ring-right"),
    equipmentSlot("weapon2a", "Set II · Hand", state, rerender, "body-set-two-left"),
    equipmentSlot("weapon2b", "Set II · Off Hand", state, rerender, "body-set-two-right"),
    equipmentSlot("footwear", "Footwear", state, rerender, "body-feet"),
  );
  panel.replaceChildren(body);
}

function equipmentSlot(slotId, label, state, rerender, layoutClass) {
  const slot = document.createElement("div");
  slot.className = `equipment-slot ${layoutClass}`;
  slot.dataset.equipmentSlot = slotId;
  const caption = document.createElement("span");
  caption.className = "equipment-slot-label";
  caption.textContent = label;
  const well = document.createElement("div");
  well.className = "equipment-slot-well";
  const equippedItemId = state.equipped[slotId];
  const mirroredShieldId = !equippedItemId && slotId.endsWith("b")
    ? handSlotIds().filter((handSlot) => handSlot.endsWith("b") && handSlot !== slotId).map((handSlot) => state.equipped[handSlot]).find((id) => isShield(resolveItem(id)))
    : null;
  const item = resolveItem(equippedItemId || mirroredShieldId);
  if (item) {
    const tile = itemTile(item, 1, { compact: true });
    if (isTwoHandedOccupancy(state, slotId, item)) tile.classList.add("is-two-handed-occupancy");
    if (mirroredShieldId) tile.classList.add("is-shield-occupancy");
    tile.draggable = !mirroredShieldId;
    if (!mirroredShieldId) {
      tile.addEventListener("dragstart", (event) => beginItemDrag(event, { itemId: item.id, source: "equipment", slotId }, state));
      tile.addEventListener("dragend", () => clearViableSlotHighlights(state));
    }
    well.append(tile);
  } else {
    const empty = document.createElement("span");
    empty.className = "equipment-slot-empty";
    empty.textContent = "Empty";
    well.append(empty);
  }
  well.addEventListener("dragover", (event) => {
    const data = readItemDrag(event);
    if (!data || !slotAccepts(slotId, resolveItem(data.itemId), state)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    well.classList.add("is-drag-over");
  });
  well.addEventListener("dragleave", () => well.classList.remove("is-drag-over"));
  well.addEventListener("drop", (event) => {
    event.preventDefault();
    well.classList.remove("is-drag-over");
    const data = readItemDrag(event);
    const dropped = resolveItem(data?.itemId);
    if (!data || !slotAccepts(slotId, dropped, state)) return;
    equipItem(state, slotId, data);
    syncActorEquipment(state);
    rerender();
  });
  slot.append(caption, well);
  return slot;
}

function renderInventory(panel, state, rerender) {
  const categories = document.createElement("div");
  categories.className = "inventory-categories";
  categories.addEventListener("dragover", (event) => {
    const data = readItemDrag(event);
    if (data?.source !== "equipment") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    categories.classList.add("is-drag-over");
  });
  categories.addEventListener("dragleave", () => categories.classList.remove("is-drag-over"));
  categories.addEventListener("drop", (event) => {
    const data = readItemDrag(event);
    if (data?.source !== "equipment") return;
    event.preventDefault();
    unequipHandItem(state, data.slotId, data.itemId);
    syncActorEquipment(state);
    rerender();
  });
  const grouped = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  for (const entry of state.inventory) {
    const item = resolveItem(entry.id);
    grouped.get(itemCategory(item))?.push({ item, quantity: entry.quantity });
  }
  for (const categoryId of CATEGORY_ORDER) {
    const section = document.createElement("details");
    section.className = "inventory-category-section";
    section.dataset.inventoryCategory = categoryId;
    const label = document.createElement("summary");
    const labelText = document.createElement("span");
    labelText.textContent = CATEGORY_LABELS[categoryId];
    const itemCount = document.createElement("small");
    itemCount.textContent = String(grouped.get(categoryId).reduce((total, entry) => total + entry.quantity, 0));
    label.append(labelText, itemCount);
    const list = document.createElement("div");
    list.className = "inventory-item-list";
    fillInventoryList(list, grouped.get(categoryId), categoryId, state);
    section.append(label, list);
    categories.append(section);
  }
  const wideLayout = document.createElement("div");
  wideLayout.className = "inventory-wide-layout";
  const wideMenu = document.createElement("div");
  wideMenu.className = "inventory-wide-menu";
  const wideContent = document.createElement("div");
  wideContent.className = "inventory-wide-content inventory-item-list";
  wideContent.hidden = true;
  for (const categoryId of CATEGORY_ORDER.filter((id) => id !== "other")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inventory-wide-category";
    const name = document.createElement("span");
    name.textContent = CATEGORY_LABELS[categoryId];
    const count = document.createElement("small");
    count.textContent = String(grouped.get(categoryId).reduce((total, entry) => total + entry.quantity, 0));
    button.append(name, count);
    button.addEventListener("click", () => {
      const closing = button.classList.contains("is-active");
      for (const candidate of wideMenu.querySelectorAll(".inventory-wide-category")) candidate.classList.remove("is-active");
      wideContent.replaceChildren();
      wideContent.hidden = closing;
      if (closing) return;
      button.classList.add("is-active");
      fillInventoryList(wideContent, grouped.get(categoryId), categoryId, state);
    });
    wideMenu.append(button);
  }
  installInventoryDropTarget(wideLayout, state, rerender);
  wideLayout.append(wideMenu, wideContent);
  panel.replaceChildren(categories, wideLayout);
}

function fillInventoryList(list, entries, categoryId, state) {
  if (!entries.length) {
    const empty = document.createElement("span");
    empty.className = "inventory-empty-category";
    empty.textContent = "None carried";
    list.append(empty);
    return;
  }
  for (const entry of [...entries].sort((left, right) => compareInventoryEntries(categoryId, left, right))) {
    const tile = itemTile(entry.item, entry.quantity);
    const actorCanEquip = canActorEquipItem(entry.item, state.actor);
    tile.draggable = isEquippable(entry.item) && actorCanEquip;
    tile.classList.toggle("is-not-proficient", isEquippable(entry.item) && !actorCanEquip);
    if (isEquippable(entry.item) && !actorCanEquip) tile.title = `${entry.item.name}: ${state.actor.name} is not proficient with this item.`;
    if (tile.draggable) {
      tile.addEventListener("dragstart", (event) => beginItemDrag(event, { itemId: entry.item.id, source: "inventory" }, state));
      tile.addEventListener("dragend", () => clearViableSlotHighlights(state));
    }
    list.append(tile);
  }
}

function installInventoryDropTarget(target, state, rerender) {
  target.addEventListener("dragover", (event) => {
    const data = readItemDrag(event);
    if (data?.source !== "equipment") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    target.classList.add("is-drag-over");
  });
  target.addEventListener("dragleave", () => target.classList.remove("is-drag-over"));
  target.addEventListener("drop", (event) => {
    const data = readItemDrag(event);
    if (data?.source !== "equipment") return;
    event.preventDefault();
    unequipHandItem(state, data.slotId, data.itemId);
    syncActorEquipment(state);
    rerender();
  });
}

function itemTile(item, quantity, { compact = false } = {}) {
  const tile = document.createElement("div");
  tile.className = `inventory-item${compact ? " is-compact" : ""}`;
  tile.title = `${item.name}\n${itemDescription(item)}`;
  const icon = document.createElement("span");
  icon.className = "inventory-item-icon";
  const image = createItemIconImage(item);
  if (image) icon.append(image);
  const text = document.createElement("span");
  text.className = "inventory-item-copy";
  const name = document.createElement("strong");
  name.className = "inventory-item-name";
  name.textContent = item.name;
  const description = document.createElement("span");
  description.className = "inventory-item-description";
  description.textContent = itemDescription(item);
  text.append(name, description);
  tile.append(icon, text);
  if (quantity > 1) {
    const count = document.createElement("span");
    count.className = "inventory-item-count";
    count.textContent = String(quantity);
    tile.append(count);
  }
  return tile;
}

function equipItem(state, slotId, data) {
  const item = resolveItem(data.itemId);
  clearExclusiveEquipment(state, item, slotId);
  if (isShield(item)) clearOtherShields(state, slotId, data);
  if (slotId.startsWith("weapon") && effectiveHands(item, state.actor) === 2) {
    if (data.source === "equipment" && !handPair(slotId).includes(data.slotId)) unequipHandItem(state, data.slotId, data.itemId, { returnToInventory: false });
    const [first, second] = handPair(slotId);
    clearHandSlot(state, first, data);
    clearHandSlot(state, second, data);
    if (data.source === "inventory") removeInventoryItem(state, data.itemId);
    state.equipped[first] = data.itemId;
    state.equipped[second] = data.itemId;
    return;
  }
  const displaced = state.equipped[slotId];
  if (displaced && displaced !== data.itemId) unequipHandItem(state, slotId, displaced);
  if (data.source === "equipment" && data.slotId !== slotId) unequipHandItem(state, data.slotId, data.itemId, { returnToInventory: false });
  if (data.source === "inventory") removeInventoryItem(state, data.itemId);
  state.equipped[slotId] = data.itemId;
}

function clearOtherShields(state, destinationSlotId, dragData) {
  for (const slotId of handSlotIds()) {
    if (slotId === destinationSlotId || !isShield(resolveItem(state.equipped[slotId]))) continue;
    const shieldId = state.equipped[slotId];
    state.equipped[slotId] = null;
    if (!(dragData.source === "equipment" && dragData.slotId === slotId)) addInventoryItem(state, shieldId);
  }
}

function clearHandSlot(state, slotId, dragData) {
  const itemId = state.equipped[slotId];
  if (!itemId) return;
  state.equipped[slotId] = null;
  const movingSameItem = dragData.source === "equipment" && dragData.itemId === itemId;
  if (!movingSameItem && !handPair(slotId).some((pairedSlot) => state.equipped[pairedSlot] === itemId)) addInventoryItem(state, itemId);
}

function unequipHandItem(state, slotId, itemId, { returnToInventory = true } = {}) {
  if (!slotId?.startsWith("weapon")) {
    state.equipped[slotId] = null;
    if (returnToInventory) addInventoryItem(state, itemId);
    return;
  }
  const item = resolveItem(itemId);
  const slots = effectiveHands(item, state.actor) === 2 ? handPair(slotId) : [slotId];
  for (const handSlot of slots) if (state.equipped[handSlot] === itemId) state.equipped[handSlot] = null;
  if (returnToInventory) addInventoryItem(state, itemId);
}

function handPair(slotId) {
  return slotId.startsWith("weapon2") ? ["weapon2a", "weapon2b"] : ["weapon1a", "weapon1b"];
}

function handSlotIds() {
  return ["weapon1a", "weapon1b", "weapon2a", "weapon2b"];
}

function isShield(item) {
  return Boolean(item && getArmorById(item.id)?.type === "shield");
}

function isTwoHandedOccupancy(state, slotId, item) {
  return effectiveHands(item, state.actor) === 2 && slotId.endsWith("b") && handPair(slotId).every((handSlot) => state.equipped[handSlot] === item.id);
}

function effectiveHands(item, actor) {
  if (item?.focusType === "wizard_staff" && actor.role === "wizard" && hasShieldProficiency(actor)) return 1;
  return item?.hands || 1;
}

function hasShieldProficiency(actor) {
  return (actor.equipmentProficiencies?.armor || []).some((entry) => ["shield", "shields"].includes(String(entry).trim().toLowerCase()));
}

function clearExclusiveEquipment(state, item, destinationSlotId) {
  if (!item?.exclusiveGroup) return;
  for (const [slotId, equippedItemId] of Object.entries(state.equipped)) {
    if (!equippedItemId || slotId === destinationSlotId) continue;
    const equippedItem = resolveItem(equippedItemId);
    if (equippedItem?.exclusiveGroup !== item.exclusiveGroup) continue;
    state.equipped[slotId] = null;
    addInventoryItem(state, equippedItemId);
  }
}

function syncActorEquipment(state) {
  writeActorEquipment(state);
  state.channel?.postMessage({ type: "equipment-state", source: state.syncToken, equipped: structuredClone(state.equipped), inventory: structuredClone(state.inventory) });
  window.dispatchEvent(new CustomEvent("combat:equipment-changed", { detail: { equipment: structuredClone(state.actor.equipment), inventory: structuredClone(state.actor.inventory) } }));
}

function writeActorEquipment(state) {
  const { actor, equipped } = state;
  actor.equipment ??= {};
  actor.equipment.headwearId = equipped.headwear;
  actor.equipment.ringIds = [equipped.ring1, equipped.ring2].filter(Boolean);
  actor.equipment.armorId = equipped.armor;
  actor.equipment.footwearId = equipped.footwear;
  const handItems = handSlotIds().map((slotId) => equipped[slotId]).filter(Boolean);
  actor.equipment.shieldId = handItems.find((id) => isShield(resolveItem(id))) || null;
  actor.equipment.weaponIds = [...new Set(handItems.filter((id) => !isShield(resolveItem(id))))];
  actor.equipment.weaponSetIds = [
    [equipped.weapon1a || null, equipped.weapon1b || null],
    [equipped.weapon2a || null, equipped.weapon2b || null],
  ];
  actor.inventory = state.inventory.map((entry) => ({ ...entry }));
}

function addInventoryItem(state, itemId) {
  const existing = state.inventory.find((entry) => entry.id === itemId);
  if (existing) existing.quantity += 1;
  else state.inventory.push({ id: itemId, quantity: 1 });
}

function removeInventoryItem(state, itemId) {
  const existing = state.inventory.find((entry) => entry.id === itemId);
  if (!existing) return;
  existing.quantity -= 1;
  if (existing.quantity <= 0) state.inventory = state.inventory.filter((entry) => entry !== existing);
}

function slotAccepts(slotId, item, state) {
  if (!item) return false;
  if (slotId === "headwear") return item.equipmentKind === "headwear";
  if (slotId === "ring1" || slotId === "ring2") return item.equipmentKind === "ring";
  if (slotId === "armor") {
    const armor = getArmorById(item.id);
    return Boolean(armor && armor.type !== "shield" && isArmorProficient(armor, state.actor));
  }
  if (slotId === "footwear") return item.equipmentKind === "footwear";
  if (!slotId.startsWith("weapon")) return false;
  if (isShield(item)) {
    const existingShieldSlot = handSlotIds().find((handSlot) => isShield(resolveItem(state.equipped[handSlot])));
    const movingEquippedShield = activeItemDrag?.source === "equipment" && activeItemDrag.itemId === item.id && activeItemDrag.slotId === existingShieldSlot;
    if (existingShieldSlot && !movingEquippedShield) return slotId.endsWith("b") && isArmorProficient(getArmorById(item.id), state.actor);
    return slotId.endsWith("b") && isArmorProficient(getArmorById(item.id), state.actor);
  }
  const focus = getSpellcastingFocusById(item.id);
  if (focus) return focus.spellcastingClass === state.actor.role;
  const weapon = getWeaponById(item.id);
  return Boolean(weapon && isWeaponProficient(weapon, state.actor.equipmentProficiencies?.weapons || []));
}

function isArmorProficient(item, actor) {
  const names = (actor.equipmentProficiencies?.armor || []).map((name) => String(name).trim().toLowerCase());
  if (item?.type === "shield") return names.includes("shields") || names.includes("shield");
  return names.includes(`${item?.type} armor`) || names.includes(item?.type);
}

function compareInventoryEntries(categoryId, left, right) {
  if (categoryId === "armor") {
    const weight = { light: 0, medium: 1, heavy: 2 };
    const leftArmor = getArmorById(left.item.id);
    const rightArmor = getArmorById(right.item.id);
    return (weight[leftArmor?.type] ?? 9) - (weight[rightArmor?.type] ?? 9)
      || (Number(leftArmor?.ac) || 0) - (Number(rightArmor?.ac) || 0)
      || Number(leftArmor?.magical === true) - Number(rightArmor?.magical === true)
      || left.item.name.localeCompare(right.item.name);
  }
  if (categoryId === "shields") {
    return Number(left.item.magical === true) - Number(right.item.magical === true)
      || left.item.name.localeCompare(right.item.name);
  }
  return left.item.name.localeCompare(right.item.name);
}

function isEquippable(item) {
  return Boolean(item && (getArmorById(item.id) || getWeaponById(item.id) || getSpellcastingFocusById(item.id) || item.equipmentKind));
}

function canActorEquipItem(item, actor) {
  const focus = getSpellcastingFocusById(item?.id);
  if (focus) return focus.spellcastingClass === actor.role;
  const weapon = getWeaponById(item?.id);
  if (weapon) return isWeaponProficient(weapon, actor.equipmentProficiencies?.weapons || []);
  const armor = getArmorById(item?.id);
  if (armor) return isArmorProficient(armor, actor);
  return true;
}

function itemCategory(item) {
  if (!item) return "other";
  if (getSpellcastingFocusById(item.id)) return "casting-gear";
  if (getWeaponById(item.id)) return "weapons";
  const armor = getArmorById(item.id);
  if (armor) return armor.type === "shield" ? "shields" : "armor";
  if (item.equipmentKind === "ring") return "rings";
  if (item.equipmentKind === "footwear") return "footwear";
  if (item.equipmentKind === "headwear") return "headwear";
  if (getConsumableById(item.id)) return "consumables";
  return "other";
}

function resolveItem(id) {
  if (!id) return null;
  return getWeaponById(id) || getSpellcastingFocusById(id) || getArmorById(id) || getRingById(id) || getFootwearById(id) || getHeadwearById(id) || getConsumableById(id) || { id, name: id.replaceAll("_", " "), description: "" };
}

function itemDescription(item) {
  if (getWeaponById(item.id)) return weaponRulesText(item);
  const armorRecord = getArmorById(item.id);
  if (armorRecord) return armorRulesText(armorRecord);
  if (item.combatText) {
    const cost = item.combatCost ? ` ${titleWords(item.combatCost)}.` : "";
    const consumed = item.consumedOnUse ? " Consumed on use." : "";
    return `${item.combatText}.${cost}${consumed}`.replace("..", ".");
  }
  if (typeof item.description === "string" && item.description.trim()) return item.description;
  const modifierText = modifiersText(item.modifiers);
  if (modifierText) return modifierText;
  if (typeof item.effect === "string" && item.effect.trim()) return item.effect;
  if (typeof item.inspectText === "string" && item.inspectText.trim()) return item.inspectText;
  return "No mechanical effect.";
}

function weaponRulesText(item) {
  const parts = [`${item.damageFormula || "—"} ${titleWords(item.damageType || "damage")}`];
  if (item.enhancementBonus) parts.push(`+${item.enhancementBonus} to attack and damage rolls`);
  for (const bonus of item.damageBonuses || []) {
    if (bonus.damageFormula) parts.push(`+${bonus.damageFormula} ${titleWords(bonus.damageType || "damage")}`);
    else if (Number.isFinite(bonus.damage)) parts.push(`+${bonus.damage} ${titleWords(bonus.damageType || "damage")}`);
  }
  parts.push(item.hands === 2 ? "Two-handed" : "One-handed");
  if (item.properties?.length) parts.push(item.properties.map(titleWords).join(", "));
  if (item.mastery) parts.push(`Mastery: ${titleWords(item.mastery)}`);
  return `${parts.join(". ")}.`;
}

function armorRulesText(item) {
  const parts = [];
  if (item.type === "shield") {
    const bonus = Number(item.modifiers?.acBonus) || 0;
    parts.push(`${bonus >= 0 ? "+" : ""}${bonus} AC while equipped`);
  } else {
    const dexterity = item.type === "light" ? " + Dexterity modifier" : item.type === "medium" ? ` + Dexterity modifier (maximum ${item.dexCap ?? 2})` : "";
    parts.push(`AC ${item.ac}${dexterity}`);
    if (item.stealthDisadvantage) parts.push("Disadvantage on Stealth checks");
  }
  if (typeof item.effect === "string" && item.effect.trim()) parts.push(item.effect);
  const modifierText = modifiersText(item.modifiers, { omitAc: item.type === "shield" });
  if (modifierText && !parts.some((part) => modifierText.toLowerCase().includes(part.toLowerCase()))) parts.push(modifierText);
  return `${parts.join(". ")}.`;
}

function modifiersText(modifiers = {}, { omitAc = false } = {}) {
  const parts = [];
  if (!omitAc && modifiers.acBonus) parts.push(`${signed(modifiers.acBonus)} AC`);
  if (modifiers.initiativeBonus) parts.push(`${signed(modifiers.initiativeBonus)} Initiative`);
  if (modifiers.speedBonusFt) parts.push(`${signed(modifiers.speedBonusFt)} ft Speed`);
  if (modifiers.combatSpeedBonusFt) parts.push(`${signed(modifiers.combatSpeedBonusFt)} ft Speed in combat`);
  if (modifiers.spellAttackBonus) parts.push(`${signed(modifiers.spellAttackBonus)} spell attack rolls`);
  if (modifiers.spellSaveDCBonus) parts.push(`${signed(modifiers.spellSaveDCBonus)} Spell Save DC`);
  for (const resistance of modifiers.resistances || []) parts.push(`Resistance to ${titleWords(resistance)} damage`);
  for (const skill of modifiers.skillAdvantages || []) parts.push(`Advantage on ${titleWords(skill)} checks`);
  for (const [skill, amount] of Object.entries(modifiers.skillBonuses || {})) parts.push(`${signed(amount)} ${titleWords(skill)} checks`);
  for (const [ability, score] of Object.entries(modifiers.abilityScoreMinimums || {})) parts.push(`${titleWords(ability)} becomes ${score}`);
  return parts.join(". ");
}

function signed(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value)}`;
}

function titleWords(value) {
  return String(value || "").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setItemDrag(event, data) {
  activeItemDrag = data;
  const encoded = JSON.stringify(data);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(ITEM_DRAG_TYPE, encoded);
  event.dataTransfer.setData("text/plain", encoded);
}

function beginItemDrag(event, data, state) {
  setItemDrag(event, data);
  if (data.source === "equipment") {
    const quickbarChoice = quickbarChoiceForEquippedItem(resolveItem(data.itemId));
    if (quickbarChoice) {
      const encodedChoice = JSON.stringify(quickbarChoice);
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("application/x-dndt-action", encodedChoice);
      event.dataTransfer.setData("text/plain", encodedChoice);
    }
  }
  showViableSlotHighlights(state, data.itemId);
  state.channel?.postMessage({ type: "item-drag-start", source: state.syncToken, drag: data });
}

function quickbarChoiceForEquippedItem(item) {
  const weapon = getWeaponById(item?.id);
  const focus = getSpellcastingFocusById(item?.id);
  if (!weapon && (!focus || focus.canMakeWeaponAttack === false || (!focus.damageFormula && !focus.functionsAsWeapon))) return null;
  return {
    id: item.id,
    name: item.name,
    economy: "action",
    kind: "action",
    iconId: item.id,
    iconCategory: "weapon",
    description: itemDescription(item),
    available: true,
    unavailableReason: "",
  };
}

function showViableSlotHighlights(state, itemId) {
  const item = resolveItem(itemId);
  for (const slot of state.equipmentPanel?.querySelectorAll("[data-equipment-slot]") || []) {
    slot.querySelector(".equipment-slot-well")?.classList.toggle("is-viable-drop", slotAccepts(slot.dataset.equipmentSlot, item, state));
  }
}

function clearViableSlotHighlights(state, broadcast = true) {
  activeItemDrag = null;
  for (const well of state.equipmentPanel?.querySelectorAll(".equipment-slot-well.is-viable-drop") || []) well.classList.remove("is-viable-drop");
  if (broadcast) state.channel?.postMessage({ type: "item-drag-end", source: state.syncToken });
}

function readItemDrag(event) {
  const raw = event.dataTransfer?.getData(ITEM_DRAG_TYPE);
  if (!raw) return activeItemDrag;
  try { return JSON.parse(raw); } catch (_error) { return null; }
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
