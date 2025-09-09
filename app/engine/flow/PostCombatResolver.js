// app/engine/flow/PostCombatResolver.js — applies win/defeat policy and routes back
import { sceneManager } from "../sceneManager.js";
import { showDefeatModal } from "../../ui/DefeatModal.js";

export function handleOutcome({ outcome, encounterId, returnAreaId }) {
  if (outcome === "defeat") {
    showDefeatModal({
      onLoadGame: () => {
        const ev = new CustomEvent("ui:loadGame", { detail: { source: "defeatModal" } });
        window.dispatchEvent(ev);
      },
      onMainMenu: () => {
        const ev = new CustomEvent("ui:mainMenu", { detail: { source: "defeatModal" } });
        window.dispatchEvent(ev);
      }
    });
    return;
  }

  // Victory: dispatch event for rewards/flags if needed
  try {
    const ev = new CustomEvent("game:encounterWon", { detail: { encounterId } });
    window.dispatchEvent(ev);
  } catch {}

  // Route back to exploration if we have a return point
  if (returnAreaId) {
    try {
      const { default: ExplorationScene } = require("../../scenes/ExplorationScene.js");
      sceneManager.replace(ExplorationScene, { areaId: returnAreaId });
    } catch (e) {
      console.warn("PostCombatResolver: failed to return to exploration:", e);
    }
  }
}
