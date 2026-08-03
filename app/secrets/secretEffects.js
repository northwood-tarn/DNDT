import { revealDiscovery } from "../state/discoveryState.js";
import { setStoryFlag } from "../state/saveGameState.js";
import { setObjectiveStatus, startQuest } from "../state/questState.js";

export function applyCanonicalSecretEffect(saveGame, effect, context = {}) {
  switch (effect.type) {
    case "reveal.discovery": return revealDiscovery(saveGame, effect.mapId, effect.id, effect.metadata || {});
    case "set.flag": return setStoryFlag(saveGame, effect.id, effect.value ?? true);
    case "start.quest": return startQuest(saveGame, context.quests?.[effect.id] || effect.definition);
    case "quest.objective": return setObjectiveStatus(saveGame, effect.questId, effect.id, effect.status || "active");
    case "enable.dialogue": return setStoryFlag(saveGame, `secret.reference.dialogue.${effect.id}`, true);
    case "enable.encounter": return setStoryFlag(saveGame, `secret.reference.encounter.${effect.id}`, true);
    default: throw new Error(`Unsupported secret effect: ${effect.type}`);
  }
}
