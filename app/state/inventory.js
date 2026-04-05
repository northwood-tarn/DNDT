// app/state/inventory.js

import { getState, setState } from "./stateStore.js";
import { getConsumableById } from "../data/consumables.js";
import { getUniqueById } from "../data/uniques.js";
import { getWeaponById } from "../data/weapons.js";
import { getArmorById } from "../data/armor.js";

function resolveItemById(id) {
  return (
    getConsumableById(id) ||
    getUniqueById(id) ||
    getWeaponById(id) ||
    getArmorById(id) ||
    null
  );
}

/**
 * Adds an item to player inventory.
 * Inventory stores { id, quantity } only.
 */
export function addItemToInventory(id, qty = 1) {
  const state = getState();
  const item = resolveItemById(id);

  if (!item) {
    console.warn(`[inventory] Unknown item id: ${id}`);
    return false;
  }

  const inventory = state.player.inventory || [];
  const existing = inventory.find(i => i.id === id);

  if (existing) {
    existing.quantity += qty;
  } else {
    inventory.push({ id, quantity: qty });
  }

  setState({
    player: {
      ...state.player,
      inventory
    }
  });

  return true;
}

export function removeItemFromInventory(id, qty = 1) {
  const state = getState();
  const inventory = state.player.inventory || [];
  const existing = inventory.find(i => i.id === id);

  if (!existing) return false;

  existing.quantity -= qty;

  // If quantity hits 0 or below, delete the entry entirely.
  const nextInventory =
    existing.quantity > 0
      ? inventory
      : inventory.filter(i => i.id !== id);

  setState({
    player: {
      ...state.player,
      inventory: nextInventory
    }
  });

  return true;
}

export function consumeItem(id) {
  const state = getState();
  const inventory = state.player.inventory || [];
  const entry = inventory.find(i => i.id === id);
  const item = resolveItemById(id);

  if (!entry || !item) return false;

  // Some items can be "used" without being consumed
  if (item.consumeOnUse === false) return true;

  // Consumption is a decrement of quantity by 1
  entry.quantity -= 1;

  const nextInventory =
    entry.quantity > 0
      ? inventory
      : inventory.filter(i => i.id !== id);

  setState({
    player: {
      ...state.player,
      inventory: nextInventory
    }
  });

  return true;
}