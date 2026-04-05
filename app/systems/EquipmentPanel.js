// systems/EquipmentPanel.js — text-mode
import { logSystem } from "../engine/log.js";
import { state } from "../state/stateStore.js";

export function showEquipmentSummary() {
  const p = state.player;
  if (!p) { logSystem("No player."); return; }
  const ac = 10 + (p.dexMod || 0) + (p.equipped?.armor?.ac || 0) + ((p.equipped?.offhand && p.equipped.offhand.acBonus) ? p.equipped.offhand.acBonus : 0);
  const atk = p.attackBonus || 0;
  logSystem(`Equipment — AC: ${ac}, ATK: ${atk}`);
  logSystem(`  Head: ${p.equipped?.head?.name || "—"}`);
  logSystem(`  Chest: ${p.equipped?.armor?.name || "—"}`);
  logSystem(`  Weapon: ${p.equipped?.weapon?.name || "—"}`);
  logSystem(`  Offhand: ${p.equipped?.offhand?.name || "—"}`);
  const att = (p.equipped?.attuned && Array.isArray(p.equipped.attuned)) ? p.equipped.attuned : [];
  att.slice(0,3).forEach((it, i)=> logSystem(`  Attuned ${i+1}: ${it?.name || "—"}`));
}
