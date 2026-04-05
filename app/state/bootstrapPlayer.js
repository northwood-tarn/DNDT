// app/state/bootstrapPlayer.js
// Path fix: aya.json lives under /app/data/characters/, and saves may live under /app/saves or /app/data/saves.
// This loader logs resolved URLs and fetch outcomes so path issues are obvious in-console.

import { getState } from "./stateStore.js";
import { computeAC, computeInitiativeMod, getAbilityMod, getProficiencyBonus } from "../systems/derivedStats.js";

async function loadJSONRelative(relPath){
  const url = new URL(relPath, import.meta.url);
  console.log("[bootstrap] trying to load:", relPath, "→", url.href);
  const res = await fetch(url.href, { cache: "no-cache" });
  if (!res.ok) {
    console.error("[bootstrap] fetch failed:", res.status, res.statusText, "for", url.href);
    throw new Error(`HTTP ${res.status} for ${url.pathname}`);
  }
  const data = await res.json();
  console.log("[bootstrap] loaded OK:", url.pathname, "keys:", Object.keys(data));
  return data;
}

function deepMerge(base, overlay){
  if (overlay == null) return base;
  if (Array.isArray(base) && Array.isArray(overlay)) return overlay.slice();
  if (typeof base === "object" && typeof overlay === "object" && base && overlay){
    const out = { ...base };
    for (const k of Object.keys(overlay)) out[k] = deepMerge(base[k], overlay[k]);
    return out;
  }
  return overlay ?? base;
}

function computeDerived(player){
  const acInfo = computeAC(player);
  const initMod = computeInitiativeMod(player);
  const prof = getProficiencyBonus(player.level || 1);
  return {
    ...player,
    derived: {
      ac: acInfo,
      initiativeMod: initMod,
      proficiencyBonus: prof,
      abilityMods: Object.fromEntries(
        Object.entries(player.abilities || {}).map(([k, v]) => [k, getAbilityMod(v)])
      )
    }
  };
}

/**
 * bootstrapPlayer
 * @param {Object} opts
 * @param {string} [opts.characterId="aya"]
 * @param {string} [opts.saveSlot="slot-001"]
 */
export async function bootstrapPlayer(opts = {}){
  const characterId = opts.characterId || "aya";
  const saveSlot = opts.saveSlot || "slot-001";

  console.log("[bootstrap] starting for character:", characterId, "save slot:", saveSlot);

  // IMPORTANT: This file is /app/state/bootstrapPlayer.js
  // Aya blueprint is /app/data/characters/aya.json
  // => correct relative path is ../data/characters/...
  const blueprint = await loadJSONRelative(`../data/characters/${characterId}.json`);

  let save = null;
  // Try /app/saves first
  try {
    save = await loadJSONRelative(`../saves/${saveSlot}.json`);
  } catch (e1) {
    console.warn("[bootstrap] no /app/saves slot, trying /app/data/saves/", e1?.message || e1);
    try {
      save = await loadJSONRelative(`../data/saves/${saveSlot}.json`);
    } catch (e2) {
      console.warn("[bootstrap] no save file found, starting fresh", e2?.message || e2);
      save = { player: {} };
    }
  }

  const merged = deepMerge(blueprint, save.player || {});
  const playerWithDerived = computeDerived(merged);
  console.log("[bootstrap] finished — state.player set:", playerWithDerived);
  const globalState = getState();
  globalState.player = playerWithDerived;
  return globalState.player;
}

export async function resetToBlueprint(characterId = "aya"){
  console.log("[bootstrap] resetToBlueprint called for", characterId);
  const blueprint = await loadJSONRelative(`../data/characters/${characterId}.json`);
  const globalState = getState();
  globalState.player = computeDerived(blueprint);
  return globalState.player;
}
