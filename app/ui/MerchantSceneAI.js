// app/ui/MerchantSceneAI.js
// Merchant UI Overlay (NOT a scene). Opens on top of DialogueScene or ExplorationScene.
// Handles buy/sell, gold adjustments, inventory updates.
// Emits `merchant:closed` on exit.

import { state } from "../gameState.js";
import shopData from "../data/shops.js";   // You create or adjust this file as needed.

class MerchantSceneAI {
  constructor() {
    this.root = null;
    this.activeShopId = null;
  }

  open(shopId) {
    this.activeShopId = shopId;

    const shop = shopData[shopId];
    if (!shop) {
      console.warn("[MerchantSceneAI] Unknown shop:", shopId);
      return;
    }

    this._buildUi(shop);
  }

  close() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.activeShopId = null;

    window.dispatchEvent(new CustomEvent("merchant:closed"));
  }

  _buildUi(shop) {
    // Remove existing overlay if any
    if (this.root) this.close();

    const root = document.createElement("div");
    root.className = "merchant-overlay";
    root.style.position = "absolute";
    root.style.top = 0;
    root.style.left = 0;
    root.style.width = "100%";
    root.style.height = "100%";
    root.style.background = "rgba(0,0,0,0.6)";
    root.style.display = "flex";
    root.style.justifyContent = "center";
    root.style.alignItems = "center";
    root.style.zIndex = 9999;

    const panel = document.createElement("div");
    panel.className = "merchant-panel";
    panel.style.background = "#222";
    panel.style.padding = "20px";
    panel.style.border = "2px solid #555";
    panel.style.width = "420px";
    panel.style.maxHeight = "70%";
    panel.style.overflowY = "auto";

    const title = document.createElement("h2");
    title.textContent = shop.name;
    title.style.marginTop = 0;
    panel.appendChild(title);

    const goldDisplay = document.createElement("p");
    goldDisplay.textContent = `Gold: ${state.player.gold}`;
    goldDisplay.style.fontWeight = "bold";
    panel.appendChild(goldDisplay);

    panel.appendChild(this._createWaresList(shop, goldDisplay));

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Done";
    closeBtn.style.marginTop = "12px";
    closeBtn.addEventListener("click", () => this.close());
    panel.appendChild(closeBtn);

    root.appendChild(panel);
    document.body.appendChild(root);

    this.root = root;
  }

  _createWaresList(shop, goldDisplay) {
    const container = document.createElement("div");

    const header = document.createElement("h3");
    header.textContent = "Wares";
    container.appendChild(header);

    shop.inventory.forEach(item => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.marginBottom = "6px";

      const label = document.createElement("span");
      label.textContent = `${item.name} (${item.price} gp)`;
      row.appendChild(label);

      const buyBtn = document.createElement("button");
      buyBtn.textContent = "Buy";
      buyBtn.addEventListener("click", () => {
        if (state.player.gold < item.price) {
          alert("Not enough gold.");
          return;
        }

        state.player.gold -= item.price;
        state.player.inventory.push({ ...item });
        goldDisplay.textContent = `Gold: ${state.player.gold}`;
      });
      row.appendChild(buyBtn);

      container.appendChild(row);
    });

    return container;
  }
}

export default new MerchantSceneAI();