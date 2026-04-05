// systems/InventoryUI.js — text-mode
import { logSystem } from "../engine/log.js";
import { onCommand } from "../engine/inputManager.js";
import { state } from "../state/stateStore.js";

function list() {
  const p = state.player;
  if (!p) { logSystem("No player."); return; }
  logSystem("=== Inventory ===");
  p.inventory?.forEach((it, i) => logSystem(`  [${i}] ${it.name} (${it.type})`));
  logSystem("Commands: use <i> | equip <i> | close");
}

export function showInventoryUI(mode = "free", onItemUsed = () => {}) {
  list();
  const off = onCommand((raw) => {
    const [cmd, idxStr] = String(raw).trim().split(/\s+/, 2);
    const p = state.player;
    if (cmd === "use") {
      const i = parseInt(idxStr, 10);
      const item = p.inventory?.[i];
      if (!item || typeof p.useItem !== "function") { logSystem("Can't use."); return; }
      p.useItem(item); onItemUsed(item); list();
    } else if (cmd === "equip") {
      const i = parseInt(idxStr, 10);
      const item = p.inventory?.[i];
      if (!item || typeof p.equipItem !== "function") { logSystem("Can't equip."); return; }
      p.equipItem(item); list();
    } else if (cmd === "close") {
      off(); logSystem("Inventory closed.");
    }
  });
}

export function createInventoryUI() {
  // no-op in text mode
}
export function hideInventoryUI() {
  logSystem("Inventory hidden.");
}
