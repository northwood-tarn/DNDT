import { getSecretInventoryGroups } from "./secretState.js";

export function createSecretAwareInventoryView(saveGame, definitions, options = {}) {
  const clueIds = new Set((definitions || []).flatMap((secret) => secret.clues || []).map((clue) => clue.id));
  return {
    items: saveGame.inventory.shared.filter((entry) => !clueIds.has(entry.id || entry.itemId)).map((entry) => structuredClone(entry)),
    clueGroups: getSecretInventoryGroups(saveGame, definitions || [], options),
  };
}

export function renderSecretClueGroups(container, groups) {
  if (!container || typeof document === "undefined") return;
  for (const group of groups || []) {
    const section = document.createElement("section");
    section.className = "inventory-clue-group";
    section.dataset.secretId = group.secretId;
    const heading = document.createElement("h3");
    heading.textContent = group.label;
    section.append(heading);
    container.append(section);
  }
}
