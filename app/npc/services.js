import { getConsumableById } from "../data/consumables.js";
import { getUniqueById } from "../data/uniques.js";
import { getWeaponById } from "../data/weapons.js";
import { getArmorById } from "../data/armor.js";
import { getRingById } from "../data/rings.js";
import {
  hasStoryFlag,
  normalizeSaveGameState,
  restSaveGame,
  setStoryFlag,
} from "../state/saveGameState.js";

export const NPC_OFFER_KINDS = new Set(["item", "service", "narrative"]);

export function listAvailableNpcOffers(saveGame, npcDefinition, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  return serviceOffers(npcDefinition)
    .map((offer) => describeOffer(normalized, npcDefinition, offer, options))
    .filter((offer) => offer.available || (options.includeUnavailable === true && offer.reason !== "requirements_not_met"));
}

export function executeNpcOffer(saveGame, npcDefinition, offerId, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  const offer = serviceOffers(npcDefinition).find((candidate) => candidate.id === offerId);
  if (!offer) return failure(normalized, "unknown_offer", `Unknown NPC offer: ${offerId}`);
  const availability = describeOffer(normalized, npcDefinition, offer, options);
  if (!availability.available) return failure(normalized, availability.reason, availability.message);

  let next;
  try {
    next = applyOffer(normalized, npcDefinition, offer, options);
  } catch (error) {
    return failure(normalized, "service_failed", error.message);
  }
  next.inventory.currency.gold -= priceOf(offer);
  next = recordOfferUse(next, npcDefinition.id, offer.id);
  return {
    ok: true,
    saveGame: normalizeSaveGameState(next),
    npcId: npcDefinition.id,
    offerId: offer.id,
    kind: offer.kind,
    price: priceOf(offer),
  };
}

export function validateNpcServices(npcDefinition) {
  const errors = [];
  if (!npcDefinition?.id) errors.push("NPC id is required");
  for (const [serviceIndex, service] of (npcDefinition?.services || []).entries()) {
    if (!service?.id) errors.push(`services[${serviceIndex}].id is required`);
    if (!Array.isArray(service?.offers)) {
      errors.push(`services[${serviceIndex}].offers must be an array`);
      continue;
    }
    for (const [offerIndex, offer] of service.offers.entries()) {
      const path = `services[${serviceIndex}].offers[${offerIndex}]`;
      if (!offer?.id) errors.push(`${path}.id is required`);
      if (!NPC_OFFER_KINDS.has(offer?.kind)) errors.push(`${path}.kind must be item, service, or narrative`);
      if (!Number.isFinite(offer?.price) || offer.price < 0) errors.push(`${path}.price must be a non-negative number`);
      if (offer.kind === "item" && !offer.itemId) errors.push(`${path}.itemId is required`);
      if (offer.kind === "service" && !offer.effect?.type) errors.push(`${path}.effect.type is required`);
      if (offer.kind === "narrative" && !offer.effect?.flags) errors.push(`${path}.effect.flags is required`);
      if (offer.stock != null && (!Number.isInteger(offer.stock) || offer.stock < 0)) errors.push(`${path}.stock must be a non-negative integer or null`);
    }
  }
  return errors;
}

function describeOffer(saveGame, npcDefinition, offer, options) {
  const errors = validateNpcServices(npcDefinition);
  if (errors.length) return unavailable(offer, "invalid_service", errors.join("; "));
  if (!requirementsMet(saveGame, offer.requirements)) return unavailable(offer, "requirements_not_met", "Offer requirements are not met");
  if (remainingStock(saveGame, npcDefinition.id, offer) <= 0) return unavailable(offer, "out_of_stock", "Offer is out of stock");
  if (saveGame.inventory.currency.gold < priceOf(offer)) return unavailable(offer, "insufficient_funds", "Not enough gold");
  const item = offer.kind === "item" ? resolveItem(offer.itemId) : null;
  if (offer.kind === "item" && !item) return unavailable(offer, "unknown_item", `Unknown item: ${offer.itemId}`);
  if (item?.worldUnique && saveGame.inventory.shared.some((holding) => (holding.id || holding.itemId) === offer.itemId)) return unavailable(offer, "already_owned", "The game's only instance of this item is already owned");
  if (item?.unique && saveGame.inventory.shared.some((holding) => (holding.id || holding.itemId) === offer.itemId)) return unavailable(offer, "already_owned", "Unique item already owned");
  return { ...structuredClone(offer), name: offer.name || item?.name, available: true, reason: null, message: null, remainingStock: remainingStock(saveGame, npcDefinition.id, offer) };
}

function applyOffer(saveGame, npcDefinition, offer, options) {
  if (offer.kind === "item") return addSharedItem(saveGame, offer.itemId, offer.quantity || 1);
  if (offer.kind === "narrative") return applyNarrativeEffect(saveGame, offer.effect);
  if (offer.effect.type === "long_rest") return restSaveGame(saveGame, {
    restType: "long_rest",
    atEmber: options.atEmber === true,
    sleepingService: true,
  });
  const handler = options.serviceHandlers?.[offer.effect.type];
  if (typeof handler !== "function") throw new Error(`No handler for NPC service effect: ${offer.effect.type}`);
  return handler(saveGame, structuredClone(offer.effect), { npcDefinition, offer });
}

function addSharedItem(saveGame, itemId, quantity) {
  const next = normalizeSaveGameState(saveGame);
  const definition = resolveItem(itemId);
  const existing = next.inventory.shared.find((holding) => (holding.id || holding.itemId) === itemId);
  if (existing) existing.quantity = definition?.worldUnique ? 1 : existing.quantity + quantity;
  else next.inventory.shared.push({ id: itemId, quantity: definition?.worldUnique ? 1 : quantity });
  return next;
}

function applyNarrativeEffect(saveGame, effect = {}) {
  let next = saveGame;
  for (const [flagId, value] of Object.entries(effect.flags || {})) next = setStoryFlag(next, flagId, value);
  return next;
}

function requirementsMet(saveGame, requirements = {}) {
  if ((requirements.requiredFlags || []).some((flagId) => !hasStoryFlag(saveGame, flagId))) return false;
  if ((requirements.forbiddenFlags || []).some((flagId) => hasStoryFlag(saveGame, flagId))) return false;
  return true;
}

function serviceOffers(npcDefinition) {
  return (npcDefinition?.services || []).flatMap((service) => service.offers || []);
}

function recordOfferUse(saveGame, npcId, offerId) {
  const next = normalizeSaveGameState(saveGame);
  next.world.npcServices ??= {};
  next.world.npcServices[npcId] ??= {};
  next.world.npcServices[npcId][offerId] = (next.world.npcServices[npcId][offerId] || 0) + 1;
  return next;
}

function remainingStock(saveGame, npcId, offer) {
  if (offer.stock == null) return Infinity;
  const used = saveGame.world?.npcServices?.[npcId]?.[offer.id] || 0;
  return Math.max(0, offer.stock - used);
}

function priceOf(offer) {
  return Math.max(0, Number(offer.price) || 0);
}

function resolveItem(id) {
  return getConsumableById(id) || getUniqueById(id) || getWeaponById(id) || getArmorById(id) || getRingById(id) || null;
}

function unavailable(offer, reason, message) {
  return { ...structuredClone(offer), available: false, reason, message, remainingStock: 0 };
}

function failure(saveGame, reason, message) {
  return { ok: false, saveGame, reason, message };
}
