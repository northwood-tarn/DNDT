// app/scenes/DialogueScene.js
import { startDialogue } from "../systems/dialogueSystem.js";
import { SetProfileDialog } from "../renderer/shellMount.js";
import ExplorationScene from "./ExplorationScene.js";
import { sceneManager } from "../engine/sceneManager.js";
import { enableChoiceHotkeys, disableChoiceHotkeys, setChoiceScope } from "../ui/choiceHotkeys.js";

export default {
  start(data = {}) {
    try { SetProfileDialog(data?.profile || {}); } catch {}
    // Route number keys to whatever the dialogue renders in the center pane
    try {
      const center = document.getElementById('center');
      setChoiceScope(center);
      enableChoiceHotkeys({ scopeEl: center });
    } catch {}
    const tree = data.tree || { id: "empty", lines: [{ speaker:"Narrator", text:"...", end:true }] };
    startDialogue(tree, () => {
      try { disableChoiceHotkeys(); } catch {}
      sceneManager.replace(ExplorationScene);
    });
  },
  cleanup(){
    try { disableChoiceHotkeys(); } catch {}
  }
};
