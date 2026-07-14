import { getArmorById } from "../data/armor.js";
import { getConsumableById } from "../data/consumables.js";
import { getUniqueById } from "../data/uniques.js";
import { getWeaponById } from "../data/weapons.js";
import { normalizeSaveGameState } from "./saveGameState.js";

export function normalizeLootBundle(input = {}, options = {}) {
  const random = options.random || Math.random;
  const gold = resolveGold(input.gold, random);
  const items = (input.items || []).map((item) => ({ id: item.id, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) }));
  return { gold, items };
}

export function validateLootBundle(input, options = {}) {
  const loot = normalizeLootBundle(input, { random: () => 0 });
  const errors = [];
  const resolver = options.resolveItem || resolveItem;
  if (loot.gold < 0) errors.push("gold cannot be negative");
  for (const item of loot.items) {
    if (!item.id) errors.push("loot item id is required");
    else if (!resolver(item.id)) errors.push(`unknown loot item: ${item.id}`);
  }
  return errors;
}

export function applyLootToSaveGame(saveGame, input, options = {}) {
  const errors = validateLootBundle(input, options);
  if (errors.length) throw new Error(`Invalid loot: ${errors.join("; ")}`);
  const loot = normalizeLootBundle(input, options);
  const save = normalizeSaveGameState(saveGame);
  const holdings = save.inventory.shared.map((entry) => ({ id: entry.id || entry.itemId, quantity: Number(entry.quantity) || 1 }));
  for (const awarded of loot.items) {
    const definition = (options.resolveItem || resolveItem)(awarded.id);
    const existing = holdings.find((entry) => entry.id === awarded.id);
    if (existing) existing.quantity = definition?.unique || definition?.stackable === false ? 1 : existing.quantity + awarded.quantity;
    else holdings.push({ id: awarded.id, quantity: definition?.unique || definition?.stackable === false ? 1 : awarded.quantity });
  }
  return {
    saveGame: normalizeSaveGameState({ ...save, inventory: {
      shared: holdings,
      currency: { ...save.inventory.currency, gold: save.inventory.currency.gold + loot.gold },
    } }),
    awarded: loot,
  };
}

function resolveGold(spec, random) {
  if (typeof spec === "number") return Math.max(0, Math.floor(spec));
  if (!spec || typeof spec !== "object") return 0;
  const low = Math.max(0, Math.floor(Math.min(Number(spec.min) || 0, Number(spec.max) || Number(spec.min) || 0)));
  const high = Math.max(low, Math.floor(Math.max(Number(spec.min) || 0, Number(spec.max) || 0)));
  return low + Math.floor(random() * (high - low + 1));
}

function resolveItem(id) {
  const legacy = String(id || "").replace(/^item:/, "").replaceAll(".", "_");
  return getConsumableById(id) || getUniqueById(id) || getArmorById(id) || getWeaponById(id) ||
    getConsumableById(legacy) || getUniqueById(legacy) || getArmorById(legacy) || getWeaponById(legacy) || null;
}
