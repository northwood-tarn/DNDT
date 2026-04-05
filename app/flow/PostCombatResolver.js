// app/flow/PostCombatResolver.js — applies win/defeat policy, emits outcome event
import { showDefeatModal } from "../ui/DefeatModal.js";

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

  // Always emit a post-combat outcome event for routing
  const ev2 = new CustomEvent("game:postCombatOutcome", { detail: { outcome, encounterId, returnAreaId } });
  window.dispatchEvent(ev2);
}
