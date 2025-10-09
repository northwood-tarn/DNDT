// app/boot/start.js
// Boots straight into Dockside with Aya preloaded, and wires the exit router.

import { initExitRouter } from "../flow/ExitRouter.js";
import { startAtArea } from "./startAtArea.js";

function ensureGlobalState(){
  if (!window.state) window.state = {};
  if (!window.state.player) {
    window.state.player = {
      id: "aya",
      name: "Aya",
      class: "Fighter",
      level: 1,
      // Minimal stats (expand as your engine requires)
      hp: 12, maxHp: 12, ac: 16,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      skills: { athletics: 2, perception: 1, sleight_of_hand: 1 },
      inventory: [
        { id: "oil_premium", name: "Premium Lantern Oil", type: "oil", qty: 60 },
        { id: "oil_basilisk", name: "Basilisk Oil", type: "oil", qty: 30 },
        // A few sensible defaults so the UI has something to show
        { id: "longsword", name: "Longsword", type: "weapon", qty: 1 },
        { id: "chain_mail", name: "Chain Mail", type: "armor", qty: 1 }
      ],
      equipment: { mainHand: "longsword", armor: "chain_mail" }
    };
  }
}

async function boot(){
  ensureGlobalState();
  initExitRouter();                 // listen for 'game:exit' events
  await startAtArea("dockside"); // jump straight into Dockside (Night Rain)
}

// Start immediately (works for both module and classic script boots)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
