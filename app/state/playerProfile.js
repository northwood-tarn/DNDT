// app/state/playerProfile.js
// Canonical selectors & mutators for the Player. All systems should use this facade.
// Reads/writes `state.player` (populated at boot: aya.json -> save overlay -> derived stats).

import { state } from "./stateStore.js";
import { getAbilityMod, getProficiencyBonus, computeAC, computeInitiativeMod } from "../systems/derivedStats.js";
import { getConsumableById } from "../data/consumables.js";
import { rollWithDetail } from "../utils/dice.js";
import { ensureTurnEconomy, spendAction, spendBonus } from "../systems/turnEconomy.js";

// ---------- Selectors ----------
export function getPlayer() { return state.player || {}; }

export function getAbility(scoreKey){ const p = getPlayer(); return (p.abilities && p.abilities[scoreKey]) || 10; }
export function getAbilityModSel(scoreKey){ return getAbilityMod(getAbility(scoreKey)); }

export function getLevel(){ const p=getPlayer(); return p.level || 1; }
export function getProfBonus(){ return getProficiencyBonus(getLevel()); }

export function getHP(){ const p=getPlayer(); return { hp: p.vitals?.hp ?? 1, maxHp: p.vitals?.maxHp ?? 1, tempHp: p.vitals?.tempHp ?? 0 }; }

export function getInventory(){ const p=getPlayer(); return Array.isArray(p.inventory) ? p.inventory : []; }
export function getItemQty(id){ return getInventory().find(it => it.id === id)?.qty || 0; }
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
export function setPlayer(p){ state.player = p; }

export function applyDamage(n){
  const p=getPlayer();
  const before = p.vitals.hp;
  const after = Math.max(0, before - Math.max(0,n|0));
  p.vitals.hp = after;
  return { before, after };
}

export function heal(n){
  const p=getPlayer();
  const max = p.vitals.maxHp ?? 1;
  const before = p.vitals.hp;
  const after = Math.min(max, before + Math.max(0,n|0));
  p.vitals.hp = after;
  return { before, after };
}

export function addItem(id, qty=1, name=null){
  const inv = getInventory();
  const i = inv.findIndex(it => it.id === id);
  if (i >= 0){ inv[i].qty = (inv[i].qty||0) + qty; }
  else inv.push({ id, name: name || id, qty });
}

export function removeItem(id, qty=1){
  const inv = getInventory();
  const i = inv.findIndex(it => it.id === id);
  if (i < 0) return false;
  inv[i].qty = Math.max(0, (inv[i].qty||0) - qty);
  if (inv[i].qty === 0) inv.splice(i,1);
  return true;
}

// Centralized consumable use; consults registry for useTime and effect
export function useConsumable(id){
  const p=getPlayer();
  const def = getConsumableById(id);
  if (!def) return { ok:false, reason:"Unknown item" };
  // action economy
  const econ = ensureTurnEconomy(p);
  if (def.useTime === "bonus"){ spendBonus(p); }
  else if (def.useTime === "action"){ spendAction(p); }
  else if (def.useTime === "exploration"){ return { ok:false, reason:"Not usable in combat" }; }

  // effects (prototype: healing potion 2d4+2)
  if (id === "healing_potion"){
    const r1 = rollWithDetail("1d4"); const r2 = rollWithDetail("1d4");
    const healAmt = (r1.total ?? r1.roll) + (r2.total ?? r2.roll) + 2;
    const { before, after } = heal(healAmt);
    removeItem("healing_potion", 1);
    return { ok:true, type:"heal", amount: healAmt, before, after };
  }

  // default no-op
  removeItem(id, 1);
  return { ok:true, type:"use" };
}
