import { normalizeSaveGameState } from "./saveGameState.js";

export const DISCOVERY_STATES = new Set(["hidden", "visible", "visited", "completed", "locked"]);

export function setDiscoveryState(saveGame, mapId, targetId, state, metadata = {}) {
  if (!mapId || !targetId) throw new Error("mapId and targetId are required");
  if (!DISCOVERY_STATES.has(state)) throw new Error(`Invalid discovery state: ${state}`);
  const save = normalizeSaveGameState(saveGame);
  const map = save.world.discovery[mapId] || { targets: {}, journal: [] };
  const previous = map.targets[targetId] || null;
  const record = { id: targetId, state, discoveredAt: previous?.discoveredAt || new Date().toISOString(), metadata: structuredClone(metadata) };
  const journal = previous?.state === state ? map.journal : [...map.journal, {
    mapId, targetId, state, label: metadata.label || null, occurredAt: new Date().toISOString(),
  }];
  const discovery = { ...save.world.discovery, [mapId]: { targets: { ...map.targets, [targetId]: record }, journal } };
  return normalizeSaveGameState({ ...save, world: { ...save.world, discovery } });
}

export function revealDiscovery(saveGame, mapId, targetId, metadata) { return setDiscoveryState(saveGame, mapId, targetId, "visible", metadata); }
export function visitDiscovery(saveGame, mapId, targetId, metadata) { return setDiscoveryState(saveGame, mapId, targetId, "visited", metadata); }
export function completeDiscovery(saveGame, mapId, targetId, metadata) { return setDiscoveryState(saveGame, mapId, targetId, "completed", metadata); }

export function getDiscoveryState(saveGame, mapId, targetId, defaults = {}) {
  return normalizeSaveGameState(saveGame).world.discovery[mapId]?.targets?.[targetId]?.state || defaults.defaultState || "hidden";
}

export function listDiscoveries(saveGame, mapId, options = {}) {
  const records = Object.values(normalizeSaveGameState(saveGame).world.discovery[mapId]?.targets || {});
  return records.filter((record) => !options.state || record.state === options.state).map((record) => structuredClone(record));
}

export function getDiscoveryJournal(saveGame, mapId = null) {
  const discovery = normalizeSaveGameState(saveGame).world.discovery;
  const maps = mapId ? [discovery[mapId]].filter(Boolean) : Object.values(discovery);
  return maps.flatMap((map) => map.journal || []).sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt))).map((entry) => structuredClone(entry));
}
