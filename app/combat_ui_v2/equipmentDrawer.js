import { getArmorById } from "../data/armor.js";
import { getConsumableById } from "../data/consumables.js";
import { getFootwearById } from "../data/footwear.js";
import { getHeadwearById } from "../data/headwear.js";
import { getRingById } from "../data/rings.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { getWeaponById } from "../data/weapons.js";
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
  const title = drawer.querySelector("[data-gear-drawer-title]");
  const actorName = drawer.querySelector("[data-gear-actor-name]");
  const equipmentPanel = drawer.querySelector('[data-gear-panel="equipment"]');
  const inventoryPanel = drawer.querySelector('[data-gear-panel="inventory"]');
  const tabs = [...drawer.querySelectorAll("[data-gear-tab]")];
  const state = createDrawerState(actor);
  let activePanel = null;

  actorName.textContent = actor.name.split(",", 1)[0];

  const render = () => {
    renderEquipment(equipmentPanel, state, render);
    renderInventory(inventoryPanel, state, render);
  };

  const open = (panelId) => {
    activePanel = panelId;
    title.textContent = panelId === "equipment" ? "Equipment" : "Inventory";
    equipmentPanel.hidden = panelId !== "equipment";
    inventoryPanel.hidden = panelId !== "inventory";
    drawer.dataset.activePanel = panelId;
    for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.gearTab === panelId));
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.querySelector(".gear-drawer-close").setAttribute("aria-label", `Close ${title.textContent.toLowerCase()} pane`);
  };

  const close = () => {
    activePanel = null;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    delete drawer.dataset.activePanel;
  };

  drawer.querySelector(".gear-drawer-close").addEventListener("click", close);
  for (const tab of tabs) {
    tab.addEventListener("click", () => open(tab.dataset.gearTab));
    tab.addEventListener("dragover", (event) => {
      if (!readItemDrag(event) || tab.dataset.gearTab === activePanel) return;
      event.preventDefault();
      open(tab.dataset.gearTab);
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
    const panelId = event.code === "KeyE" ? "equipment" : event.code === "KeyI" ? "inventory" : null;
    if (!panelId) return;
    event.preventDefault();
    if (drawer.classList.contains("is-open") && activePanel === panelId) close();
    else open(panelId);
  });

  render();
}

function createDrawerState(actor) {
  const equipment = actor.equipment || {};
  const weaponIds = [...(equipment.weaponIds || [])];
  const equipped = {
    headwear: equipment.headwearId || null,
    ring1: equipment.ringIds?.[0] || null,
    ring2: equipment.ringIds?.[1] || null,
    armor: equipment.armorId || null,
    footwear: equipment.footwearId || null,
    shield: equipment.shieldId || null,
    weapon1a: weaponIds[0] || null,
    weapon1b: weaponIds[1] || null,
    weapon2a: weaponIds[2] || null,
    weapon2b: weaponIds[3] || null,
  };
  return {
    actor,
    equipped,
    inventory: (actor.inventory || []).map((entry) => ({ id: entry.id, quantity: Math.max(1, Number(entry.quantity) || 1) })),
  };
}

function renderEquipment(panel, state, rerender) {
  const heading = document.createElement("p");
  heading.className = "gear-instruction";
  heading.textContent = "Drag carried equipment into a compatible position.";
  const body = document.createElement("div");
  body.className = "equipment-body-layout";
  body.append(
    equipmentSlot("headwear", "Head", state, rerender, "body-head"),
    equipmentSlot("ring1", "Ring I", state, rerender, "body-ring-left"),
    equipmentSlot("weapon1a", "Set I · Hand", state, rerender, "body-hand-left"),
    equipmentSlot("armor", "Armor", state, rerender, "body-armor"),
    equipmentSlot("weapon1b", "Set I · Off Hand", state, rerender, "body-hand-right"),
    equipmentSlot("ring2", "Ring II", state, rerender, "body-ring-right"),
    equipmentSlot("shield", "Shield", state, rerender, "body-shield"),
    equipmentSlot("weapon2a", "Set II · Hand", state, rerender, "body-set-two-left"),
    equipmentSlot("weapon2b", "Set II · Off Hand", state, rerender, "body-set-two-right"),
    equipmentSlot("footwear", "Footwear", state, rerender, "body-feet"),
  );
  panel.replaceChildren(heading, body);
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
  const item = resolveItem(state.equipped[slotId]);
  if (item) {
    const tile = itemTile(item, 1, { compact: true });
    tile.draggable = true;
    tile.addEventListener("dragstart", (event) => setItemDrag(event, { itemId: item.id, source: "equipment", slotId }));
    well.append(tile);
  } else {
    const empty = document.createElement("span");
    empty.className = "equipment-slot-empty";
    empty.textContent = "Empty";
    well.append(empty);
  }
  well.addEventListener("dragover", (event) => {
    const data = readItemDrag(event);
    if (!data || !slotAccepts(slotId, resolveItem(data.itemId))) return;
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
    if (!data || !slotAccepts(slotId, dropped)) return;
    equipItem(state, slotId, data);
    syncActorEquipment(state);
    rerender();
  });
  slot.append(caption, well);
  return slot;
}

function renderInventory(panel, state, rerender) {
  const heading = document.createElement("p");
  heading.className = "gear-instruction";
  heading.textContent = "Drag equipment to the Equipment pane, or drop equipped items here to carry them.";
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
    state.equipped[data.slotId] = null;
    addInventoryItem(state, data.itemId);
    syncActorEquipment(state);
    rerender();
  });
  const grouped = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  for (const entry of state.inventory) {
    const item = resolveItem(entry.id);
    grouped.get(itemCategory(item))?.push({ item, quantity: entry.quantity });
  }
  for (const categoryId of CATEGORY_ORDER) {
    const section = document.createElement("section");
    section.className = "inventory-category-section";
    const label = document.createElement("h2");
    label.textContent = CATEGORY_LABELS[categoryId];
    const list = document.createElement("div");
    list.className = "inventory-item-list";
    const entries = grouped.get(categoryId);
    if (entries.length) {
      for (const entry of entries.sort((left, right) => left.item.name.localeCompare(right.item.name))) {
        const tile = itemTile(entry.item, entry.quantity);
        tile.draggable = isEquippable(entry.item);
        if (tile.draggable) tile.addEventListener("dragstart", (event) => setItemDrag(event, { itemId: entry.item.id, source: "inventory" }));
        list.append(tile);
      }
    } else {
      const empty = document.createElement("span");
      empty.className = "inventory-empty-category";
      empty.textContent = "None carried";
      list.append(empty);
    }
    section.append(label, list);
    categories.append(section);
  }
  panel.replaceChildren(heading, categories);
}

function itemTile(item, quantity, { compact = false } = {}) {
  const tile = document.createElement("div");
  tile.className = `inventory-item${compact ? " is-compact" : ""}`;
  tile.title = item.description || item.name;
  const icon = document.createElement("span");
  icon.className = "inventory-item-icon";
  const image = createItemIconImage(item);
  if (image) icon.append(image);
  const text = document.createElement("span");
  text.className = "inventory-item-name";
  text.textContent = item.name;
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
  const displaced = state.equipped[slotId];
  if (displaced && displaced !== data.itemId) addInventoryItem(state, displaced);
  if (data.source === "equipment" && data.slotId !== slotId) state.equipped[data.slotId] = null;
  if (data.source === "inventory") removeInventoryItem(state, data.itemId);
  state.equipped[slotId] = data.itemId;
}

function syncActorEquipment(state) {
  const { actor, equipped } = state;
  actor.equipment ??= {};
  actor.equipment.headwearId = equipped.headwear;
  actor.equipment.ringIds = [equipped.ring1, equipped.ring2].filter(Boolean);
  actor.equipment.armorId = equipped.armor;
  actor.equipment.footwearId = equipped.footwear;
  actor.equipment.shieldId = equipped.shield;
  actor.equipment.weaponIds = [equipped.weapon1a, equipped.weapon1b, equipped.weapon2a, equipped.weapon2b].filter(Boolean);
  actor.inventory = state.inventory.map((entry) => ({ ...entry }));
  window.dispatchEvent(new CustomEvent("combat:equipment-changed", { detail: { equipment: structuredClone(actor.equipment), inventory: structuredClone(actor.inventory) } }));
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

function slotAccepts(slotId, item) {
  if (!item) return false;
  if (slotId === "headwear") return item.equipmentKind === "headwear";
  if (slotId === "ring1" || slotId === "ring2") return item.equipmentKind === "ring";
  if (slotId === "armor") return getArmorById(item.id)?.type !== "shield";
  if (slotId === "footwear") return item.equipmentKind === "footwear";
  if (slotId === "shield") return getArmorById(item.id)?.type === "shield";
  return slotId.startsWith("weapon") && Boolean(getWeaponById(item.id) || getSpellcastingFocusById(item.id));
}

function isEquippable(item) {
  return Boolean(item && (getArmorById(item.id) || getWeaponById(item.id) || getSpellcastingFocusById(item.id) || item.equipmentKind));
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

function setItemDrag(event, data) {
  activeItemDrag = data;
  const encoded = JSON.stringify(data);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(ITEM_DRAG_TYPE, encoded);
  event.dataTransfer.setData("text/plain", encoded);
}

function readItemDrag(event) {
  const raw = event.dataTransfer?.getData(ITEM_DRAG_TYPE);
  if (!raw) return activeItemDrag;
  try { return JSON.parse(raw); } catch (_error) { return null; }
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
