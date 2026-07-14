import { executeNpcOffer, listAvailableNpcOffers } from "../npc/services.js";
import { getResaleRate, listSellableHoldings, sellHolding } from "../npc/merchant.js";
import { getNpcService } from "../npc/serviceRegistry.js";

export default class MerchantScene {
  start(params = {}) {
    this.params = params;
    this.saveGame = params.saveGame;
    const registered = params.serviceId || params.id ? getNpcService(params.serviceId || params.id) : null;
    this.npc = params.npcDefinition || registered?.npcDefinition;
    if (!this.saveGame || !this.npc) throw new Error("Merchant scene requires saveGame and a registered NPC service");
    this.mode = "buy";
    this.render();
  }

  render() {
    this.cleanup();
    const root = document.createElement("section");
    root.className = "merchant-scene";
    const title = document.createElement("h1");
    title.textContent = this.npc.name || "Shop";
    const tabs = document.createElement("div");
    for (const mode of ["buy", "sell"]) {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = mode === "buy" ? "Buy" : "Sell"; button.disabled = this.mode === mode;
      button.addEventListener("click", () => { this.mode = mode; this.render(); });
      tabs.append(button);
    }
    const list = document.createElement("div");
    list.className = "merchant-scene__list";
    if (this.mode === "buy") this.renderBuy(list);
    else this.renderSell(list);
    const close = document.createElement("button");
    close.type = "button"; close.textContent = "Return to conversation";
    close.addEventListener("click", () => this.close());
    root.append(title, tabs, list, close);
    (this.params.mount || document.getElementById("game-root") || document.body).append(root);
    this.root = root;
  }

  renderBuy(container) {
    for (const offer of listAvailableNpcOffers(this.saveGame, this.npc, { includeUnavailable: true })) {
      if (offer.kind !== "item") continue;
      container.append(this.offerButton(offer.name || offer.label || offer.itemId, `${offer.price} gp`, offer.available, () => {
        const result = executeNpcOffer(this.saveGame, this.npc, offer.id);
        if (result.ok) this.commit(result.saveGame);
      }));
    }
  }

  renderSell(container) {
    const rate = getResaleRate(this.saveGame);
    const explanation = document.createElement("p");
    explanation.textContent = `${rate.percentage}% resale value (Charisma ${signed(rate.charismaModifier)}, Persuasion +${rate.persuasionBonus}, background +${rate.backgroundBonus})`;
    container.append(explanation);
    for (const holding of listSellableHoldings(this.saveGame)) {
      container.append(this.offerButton(`${holding.name} ×${holding.quantity}`, `${holding.unitPrice} gp each`, true, () => {
        const result = sellHolding(this.saveGame, holding.itemId, 1);
        if (result.ok) this.commit(result.saveGame);
      }));
    }
  }

  offerButton(label, price, available, action) {
    const button = document.createElement("button");
    button.type = "button"; button.disabled = !available; button.textContent = `${label} — ${price}`; button.addEventListener("click", action);
    return button;
  }

  commit(saveGame) { this.saveGame = saveGame; this.params.onSaveGame?.(saveGame); this.render(); }
  close() {
    if (typeof this.params.onClose === "function") this.params.onClose(this.saveGame);
    else if (this.params.returnTo) window.dispatchEvent(new CustomEvent("game:exit", { detail: { ...this.params.returnTo, saveGame: this.saveGame } }));
  }
  cleanup() { this.root?.remove(); this.root = null; }
}

function signed(value) { return value >= 0 ? `+${value}` : String(value); }
