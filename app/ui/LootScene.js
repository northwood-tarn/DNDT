// LootScene.js — Loot overlay UI (NOT a scene)
//
// Usage from CombatScene / ExplorationScene, etc.:
//   import LootScene from "./LootScene.js";
//   LootScene.open({
//     gold: { min: 5, max: 20 }, // or a fixed number, or omit for none
//     items: [
//       { id: "potion_healing", name: "Healing Potion", quantity: 2 },
//       { id: "rusty_sword", name: "Rusty Sword" } // quantity defaults to 1
//     ]
//   });
//
// This module assumes a global `window.state.player` object with
// `gold` and `inventory` fields, but will defensively initialise them.

let root = null;

function rollGold(goldSpec) {
  if (typeof goldSpec === "number") return goldSpec || 0;
  if (!goldSpec || typeof goldSpec !== "object") return 0;

  const min = Number.isFinite(goldSpec.min) ? goldSpec.min : 0;
  const max = Number.isFinite(goldSpec.max) ? goldSpec.max : min;

  const low = Math.min(min, max);
  const high = Math.max(min, max);

  const span = high - low + 1;
  const roll = Math.floor(Math.random() * span);
  return low + roll;
}

const LootScene = {
  /**
   * Open the loot overlay.
   *
   * @param {Object} lootBundle
   *   {
   *     gold: number | { min, max },
   *     items: [{ id, name, quantity? }]
   *   }
   */
  open(lootBundle = {}) {
    // Close any previous overlay first
    if (root) {
      this.close();
    }

    const goldAmount = rollGold(lootBundle.gold);
    const items = Array.isArray(lootBundle.items) ? lootBundle.items : [];

    // Full-screen overlay
    const overlay = document.createElement("div");
    overlay.className = "loot-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    });

    // Panel
    const panel = document.createElement("div");
    panel.className = "loot-panel";
    Object.assign(panel.style, {
      background: "#222",
      color: "#eee",
      padding: "20px",
      border: "2px solid #555",
      width: "420px",
      maxHeight: "70%",
      overflowY: "auto",
      boxShadow: "0 0 12px rgba(0,0,0,0.8)"
    });

    const title = document.createElement("h2");
    title.textContent = "Loot Found";
    title.style.marginTop = "0";
    panel.appendChild(title);

    if (goldAmount > 0) {
      const goldP = document.createElement("p");
      goldP.textContent = `Gold: ${goldAmount}`;
      goldP.style.fontWeight = "bold";
      panel.appendChild(goldP);
    }

    if (items.length) {
      const header = document.createElement("h3");
      header.textContent = "Items";
      panel.appendChild(header);

      const list = document.createElement("ul");
      list.style.listStyle = "none";
      list.style.paddingLeft = "0";

      for (const item of items) {
        const li = document.createElement("li");
        li.style.marginBottom = "4px";

        const qty = item.quantity && item.quantity > 1 ? `${item.quantity}x ` : "";
        li.textContent = `${qty}${item.name || item.id || "Unknown Item"}`;
        list.appendChild(li);
      }

      panel.appendChild(list);
    } else if (goldAmount === 0) {
      const none = document.createElement("p");
      none.textContent = "Nothing of value was found.";
      panel.appendChild(none);
    }

    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "loot-buttons";
    buttonsDiv.style.marginTop = "12px";
    buttonsDiv.style.display = "flex";
    buttonsDiv.style.justifyContent = "flex-end";
    buttonsDiv.style.gap = "8px";

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave";
    leaveBtn.addEventListener("click", () => {
      this.close();
    });
    buttonsDiv.appendChild(leaveBtn);

    if (goldAmount > 0) {
      const takeGoldBtn = document.createElement("button");
      takeGoldBtn.textContent = "Take Gold";
      takeGoldBtn.addEventListener("click", () => {
        const g = window.state && window.state.player ? window.state.player : null;
        if (g) {
          if (typeof g.gold !== "number") g.gold = 0;
          g.gold += goldAmount;
        }
        this.close();
      });
      buttonsDiv.appendChild(takeGoldBtn);
    }

    const takeAllBtn = document.createElement("button");
    takeAllBtn.textContent = "Take All";
    takeAllBtn.addEventListener("click", () => {
      const g = window.state && window.state.player ? window.state.player : null;
      if (g) {
        if (typeof g.gold !== "number") g.gold = 0;
        g.gold += goldAmount;

        if (!Array.isArray(g.inventory)) g.inventory = [];

        for (const item of items) {
          const qty = item.quantity && item.quantity > 1 ? item.quantity : 1;
          for (let i = 0; i < qty; i++) {
            g.inventory.push({ ...item, quantity: 1 });
          }
        }
      }
      this.close();
    });
    buttonsDiv.appendChild(takeAllBtn);

    panel.appendChild(buttonsDiv);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    root = overlay;
  },

  close() {
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    root = null;
    // Let callers know the loot UI is done if they care
    window.dispatchEvent(new CustomEvent("loot:closed"));
  }
};

export default LootScene;