import { getArmorById } from "../data/armor.js";
import { getConsumableById } from "../data/consumables.js";
import { getUniqueById } from "../data/uniques.js";
import { getWeaponById } from "../data/weapons.js";
import { getRingById } from "../data/rings.js";
import { getActiveCharacterRecord, normalizeSaveGameState } from "../state/saveGameState.js";

export const TRADE_BACKGROUNDS = new Set(["artisan", "charlatan", "criminal", "merchant"]);

export function getResaleRate(saveGame) {
  const sheet = getActiveCharacterRecord(saveGame)?.resolvedCharacterSheet;
  const charismaModifier = Number(sheet?.abilities?.charisma?.modifier || 0);
  const persuasionBonus = skillProficiencyBonus(sheet, "persuasion");
  const backgroundBonus = TRADE_BACKGROUNDS.has(sheet?.identity?.backgroundId) ? 4 : 0;
  const percentage = clamp(50 + charismaModifier + persuasionBonus + backgroundBonus, 40, 70);
  return { percentage, charismaModifier, persuasionBonus, backgroundBonus };
}

export function listSellableHoldings(saveGame) {
  const save = normalizeSaveGameState(saveGame);
  const rate = getResaleRate(save);
  return save.inventory.shared.flatMap((holding) => {
    const itemId = holding.id || holding.itemId;
    const item = resolveMerchantItem(itemId);
    const quantity = Math.max(0, Number(holding.quantity) || 0);
    if (!item || item.sellable === false || quantity <= 0 || !Number.isFinite(item.value)) return [];
    return [{ itemId, name: item.name || itemId, quantity, unitValue: item.value, unitPrice: resalePrice(item.value, rate.percentage) }];
  });
}

export function sellHolding(saveGame, itemId, quantity = 1) {
  const save = normalizeSaveGameState(saveGame);
  const item = resolveMerchantItem(itemId);
  if (!item) return failure(save, "unknown_item", `Unknown item: ${itemId}`);
  if (item.sellable === false || !Number.isFinite(item.value)) return failure(save, "unsellable_item", `${item.name || itemId} cannot be sold`);
  if (!Number.isInteger(quantity) || quantity < 1) return failure(save, "invalid_quantity", "Sale quantity must be a positive integer");
  const holding = save.inventory.shared.find((entry) => (entry.id || entry.itemId) === itemId);
  if (!holding || (Number(holding.quantity) || 0) < quantity) return failure(save, "insufficient_quantity", `Not enough ${item.name || itemId} to sell`);
  const rate = getResaleRate(save);
  const unitPrice = resalePrice(item.value, rate.percentage);
  holding.quantity -= quantity;
  save.inventory.shared = save.inventory.shared.filter((entry) => Number(entry.quantity) > 0);
  save.inventory.currency.gold += unitPrice * quantity;
  return { ok: true, saveGame: normalizeSaveGameState(save), itemId, quantity, unitPrice, total: unitPrice * quantity, rate };
}

export function resolveMerchantItem(id) {
  return getConsumableById(id) || getUniqueById(id) || getWeaponById(id) || getArmorById(id) || getRingById(id) || null;
}

function resalePrice(value, percentage) { return Math.max(1, Math.floor(Number(value) * percentage / 100)); }
function skillProficiencyBonus(sheet, skillId) {
  if (!(sheet?.proficiencies?.skills || []).includes(skillId)) return 0;
  const expertise = (sheet?.proficiencies?.expertise || []).some((entry) => (typeof entry === "string" ? entry === skillId : entry.kind === "skill" && entry.id === skillId));
  return Number(sheet?.proficiencyBonus || 0) * (expertise ? 2 : 1);
}
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function failure(saveGame, reason, message) { return { ok: false, saveGame, reason, message }; }
