// app/engine/flow/CombatTransition.js — orchestrates pre-combat modal -> CombatScene
import { sceneManager } from "../engine/sceneManager.js";
import CombatScene from "../scenes/CombatScene.js";
import { handleOutcome } from "./PostCombatResolver.js";
import { showPreCombatModal } from "../ui/PreCombatModal.js";

export function startCombat(encounter) {
  // encounter: { id, name, flavor, enemies, returnAreaId }
  const encId = encounter?.id || "unknown_encounter";
  const returnAreaId = encounter?.returnAreaId || null;
  const flavor = encounter?.flavor || "You steel yourself for battle.";
  const enemies = Array.isArray(encounter?.enemies) ? encounter.enemies : [];

  // 1) Show modal
  showPreCombatModal({
    title: encounter?.name || "Encounter",
    text: flavor,
    enemies,
    onBegin: () => {
      // 2) Load CombatScene; pass callback for outcome
      sceneManager.replace(CombatScene, {
        encounterId: encId,
        returnAreaId,
        onOutcome: (result) => handleOutcome({ ...result })
      });
    },
    onCancel: () => {
      // do nothing; remain in exploration
    }
  });
}
