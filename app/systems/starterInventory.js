// app/systems/starterInventory.js
// Pushes class-defined starterInventory items into a player's inventory (idempotent).

import { classes } from "../data/classes.js";
import { consumables } from "../data/consumables.js";

function resolveItem(def) {
  // Try to resolve against consumables registry by id, else fall back to the passed object
  if (!def || !def.id) return def;
  const found = (consumables || []).find(c => c.id === def.id);
  if (!found) return def;
  // Merge registry with the requested qty/name/type overrides
  return { ...found, ...def };
}

// Merge an item into player.inventory, stacking qty for same id when stackable
function pushOrStack(inv, item) {
  if (!item) return;
  const stackable = !!item.stackable || item.type === "consumable";
  if (stackable && item.id) {
    const idx = inv.findIndex(it => it.id === item.id);
    if (idx >= 0) {
      const cur = inv[idx];
      const add = Number(item.qty || 1) || 1;
      cur.qty = Number(cur.qty || 0) + add;
      return;
    }
  }
  inv.push({ ...item });
}

export function applyStarterInventory(player) {
  if (!player) return;
  if (!player.inventory) player.inventory = [];
  // Guard against double-add
  if (player.__starterApplied) return;
  const key = (player.class || player.classId || player.className || "").trim();
  const cls = (classes && classes[key]) || null;
  const list = (cls && Array.isArray(cls.starterInventory)) ? cls.starterInventory : [];
  for (const raw of list) {
    const item = resolveItem(raw);
    pushOrStack(player.inventory, item);
  }
  player.__starterApplied = true;
}
