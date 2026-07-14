// app/state/playerProfile.js
// Canonical selectors & mutators for the Player. All systems should use this facade.
// Reads/writes `state.player` (populated at boot: aya.json -> save overlay -> derived stats).

import { getState } from "./stateStore.js";
import { getAbilityMod, getProficiencyBonus, computeAC, computeInitiativeMod } from "../systems/derivedStats.js";
import { getConsumableById } from "../data/consumables.js";
import { rollWithDetail } from "../utils/dice.js";

// ---------- Selectors ----------
export function getPlayer() {
  const s = getState();
  return s.player || {};
}

export function getAbility(scoreKey){ const p = getPlayer(); return (p.abilities && p.abilities[scoreKey]) || 10; }
export function getAbilityModSel(scoreKey){ return getAbilityMod(getAbility(scoreKey)); }

export function getLevel(){ const p=getPlayer(); return p.level || 1; }
export function getProfBonus(){ return getProficiencyBonus(getLevel()); }

export function getHP(){ const p=getPlayer(); return { hp: p.vitals?.hp ?? 1, maxHp: p.vitals?.maxHp ?? 1, tempHp: p.vitals?.tempHp ?? 0 }; }

export function getInventory(){ const p=getPlayer(); return Array.isArray(p.inventory) ? p.inventory : []; }
export function getItemQty(id){ return getInventory().find(it => it.id === id)?.quantity || 0; }
export function hasItem(id){ return getItemQty(id) > 0; }

export function getACBreakdown(){
  const p=getPlayer();
  return computeAC(p);
}

export function getInitiativeMod(){
  const p=getPlayer();
  return computeInitiativeMod(p);
}

// ---------- Mutators ----------
export function setPlayer(p){
  const s = getState();
  s.player = p;
  syncCanonicalPlayer(s, p);
}

export function applyDamage(n){
  const p=getPlayer();
  const before = p.vitals.hp;
  const after = Math.max(0, before - Math.max(0,n|0));
  p.vitals.hp = after;
  syncCanonicalPlayer(getState(), p);
  return { before, after };
}

export function heal(n){
  const p=getPlayer();
  const max = p.vitals.maxHp ?? 1;
  const before = p.vitals.hp;
  const after = Math.min(max, before + Math.max(0,n|0));
  p.vitals.hp = after;
  syncCanonicalPlayer(getState(), p);
  return { before, after };
}

export function addItem(id, qty=1, name=null){
  const p = getPlayer();
  const inv = getInventory();
  const i = inv.findIndex(it => it.id === id);
  if (i >= 0){ inv[i].quantity = (inv[i].quantity||0) + qty; }
  else inv.push({ id, name: name || id, quantity: qty });
  syncCanonicalPlayer(getState(), p);
}

export function removeItem(id, qty=1){
  const inv = getInventory();
  const i = inv.findIndex(it => it.id === id);
  if (i < 0) return false;
  inv[i].quantity = Math.max(0, (inv[i].quantity||0) - qty);
  if (inv[i].quantity === 0) inv.splice(i,1);
  syncCanonicalPlayer(getState(), getPlayer());
  return true;
}

// Centralized prototype consumable use; consults the canonical item record.
export function useConsumable(id){
  const p=getPlayer();
  const def = getConsumableById(id);
  if (!def) return { ok:false, reason:"Unknown item" };
  if (def.type !== "usable" || !["combat", "anywhere"].includes(def.availability)){ return { ok:false, reason:"Not usable in combat" }; }

  // effects (prototype: healing potion 2d4+2)
  const healingFormula = def.effects?.find(effect => effect.type === "change-resource" && effect.resource === "health")?.amountFormula;
  if (healingFormula){
    const roll = rollWithDetail(healingFormula);
    const healAmt = roll.total ?? roll.roll;
    const { before, after } = heal(healAmt);
    if (def.consumedOnUse !== false) removeItem(id, 1);
    return { ok:true, type:"heal", amount: healAmt, before, after };
  }

  // default no-op
  if (def.consumedOnUse !== false) removeItem(id, 1);
  return { ok:true, type:"use" };
}

function syncCanonicalPlayer(state, player) {
  const instance = state.actorInstances?.[player?.id];
  if (!instance) return;
  instance.state = {
    ...instance.state,
    hp: player.vitals?.hp ?? instance.state.hp,
    maxHp: player.vitals?.maxHp ?? instance.state.maxHp,
    tempHp: player.vitals?.tempHp ?? instance.state.tempHp,
    inventory: structuredClone(player.inventory || []),
  };
}
