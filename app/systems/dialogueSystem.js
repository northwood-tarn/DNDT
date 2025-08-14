// systems/dialogueSystem.js — text-mode with optional skill checks
import { onCommand } from "../engine/inputManager.js";
import { logSystem } from "../engine/log.js";
import { state } from "../state/stateStore.js";
import { attemptSkill } from "./skillChallenge.js";

let tree = null;
let idx = 0;
let onEndCb = null;
let unsub = null;

function render() {
  if (!tree || !tree.lines || idx >= tree.lines.length) {
    if (onEndCb) onEndCb();
    return;
  }
  const line = tree.lines[idx];
  if (line.speaker && line.text) {
    logSystem(`${line.speaker}: ${line.text}`);
    const next = tree.lines[idx + 1];
    if (next && next.choices) {
      next.choices.forEach((c, i) => logSystem(`  [${i+1}] ${c.text}`));
      logSystem("Type: choose <number>");
    } else {
      logSystem("Type: next");
    }
  } else if (line.choices) {
    line.choices.forEach((c, i) => logSystem(`  [${i+1}] ${c.text}`));
    logSystem("Type: choose <number>");
  } else if (line.end) {
    logSystem("(End of dialogue) Type: next");
  }
}

export function startDialogue(dialogueTree, onEnd) {
  tree = dialogueTree;
  idx = 0;
  onEndCb = onEnd;
  if (unsub) unsub();
  unsub = onCommand((raw) => {
    const parts = String(raw).trim().split(/\s+/);
    const cmd = parts[0];
    if (cmd === "next") {
      idx++;
      const line = tree.lines[idx];
      if (!line || line.end) { if (onEndCb) onEndCb(); return; }
      render();
    } else if (cmd === "choose") {
      const n = parseInt(parts[1], 10);
      if (!Number.isFinite(n)) { logSystem("Usage: choose <number>"); return; }
      const line = tree.lines[idx];
      const next = tree.lines[idx + 1];
      const choices = (line && line.choices) ? line.choices : (next && next.choices) ? next.choices : null;
      const choice = choices && choices[n-1];
      if (!choice) { logSystem("Invalid choice."); return; }

      // Optional skill check handling on a choice
      if (choice.check && typeof choice.check === 'object') {
        const { skill = "Survival", dc = 10, onSuccess, onFail } = choice.check;
        const res = attemptSkill(state.player, skill, dc);
        if (res.success && typeof onSuccess === 'number') {
          idx = onSuccess;
        } else if (!res.success && typeof onFail === 'number') {
          idx = onFail;
        } else if (typeof choice.next === 'number') {
          idx = choice.next;
        } else {
          idx++;
        }
      } else if (typeof choice.next === 'number') {
        idx = choice.next;
      } else {
        idx++;
      }
      render();
    }
  });
  render();
}
