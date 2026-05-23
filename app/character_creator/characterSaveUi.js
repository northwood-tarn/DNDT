import { createCharacterRecord } from "../character/index.js";
import { createRendererSaveGameClient } from "../state/saveGameClient.js";
import { DEFAULT_SAVE_GAME_SLOT } from "../state/saveGameState.js";
import { createSaveGameFromCharacterRecord, setSaveGameLocation } from "../state/saveGameState.js";

export function createCharacterSaveUi(options) {
  const client = options.saveClient || createRendererSaveGameClient();
  const slot = options.slot || DEFAULT_SAVE_GAME_SLOT;
  options.button.addEventListener("click", async () => {
    const record = createCharacterRecord(options.getDraft(), {
      slot: "active",
      actorOptions: options.actorOptions,
      resolveOptions: options.resolveOptions,
    });
    const outstanding = countOutstanding(record);
    if (record.status !== "ready") {
      options.status.textContent = `Draft not saved; combat needs ${outstanding} unresolved item${outstanding === 1 ? "" : "s"}.`;
      return;
    }

    const saveGame = setSaveGameLocation(
      createSaveGameFromCharacterRecord(record, { slot: "active" }),
      options.startLocation || { scene: "dialogue", areaId: "dockside", entryKnot: "start" }
    );
    await client.save(saveGame, slot);
    options.status.textContent = record.status === "ready"
      ? `Saved ${record.resolvedCharacterSheet.identity.characterName || "character"} to ${slot}.`
      : `Draft saved, but combat needs ${outstanding} unresolved item${outstanding === 1 ? "" : "s"}.`;
  });
  return client;
}

function countOutstanding(record) {
  return (record.validityReport?.checks || [])
    .filter((check) => check.status === "fail")
    .reduce((count, check) => count + Math.max(1, check.messages.length), 0);
}
