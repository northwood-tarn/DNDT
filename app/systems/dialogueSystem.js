// systems/dialogueSystem.js — patched to support choice.onChoose callbacks
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
  const center = document.getElementById('center');
  if (!center) return;

  // Clear & draw
  center.innerHTML = "";
  const wrap = document.createElement('div');
  wrap.style.whiteSpace = 'pre-wrap';
  wrap.style.lineHeight = '1.4';
  wrap.style.padding = '8px';

  const speaker = document.createElement('div');
  if (line.speaker) {
    speaker.textContent = line.speaker;
    speaker.style.fontWeight = '600';
    speaker.style.marginBottom = '4px';
    wrap.appendChild(speaker);
  }

  const text = document.createElement('div');
  text.textContent = line.text || "";
  text.style.marginBottom = '10px';
  wrap.appendChild(text);

  const options = line.choices || [];
  // Render choices
  options.forEach((opt, i) => {
    const btn = document.createElement('div');
    btn.textContent = `${i+1}. ${opt.text || opt.label || "…"}`;
    btn.style.cursor = 'pointer';
    btn.style.margin = '2px 0';
    btn.addEventListener('click', () => choose(i));
    wrap.appendChild(btn);
  });

  const hint = document.createElement('div');
  hint.style.opacity = '0.7';
  hint.style.marginTop = '8px';
  hint.textContent = "Press 1–number to choose, Q/Esc to exit.";
  wrap.appendChild(hint);

  center.appendChild(wrap);
}

function choose(i){
  const line = tree.lines[idx] || {};
  const options = line.choices || [];
  const choice = options[i];
  if (!choice) return;

  // NEW: support imperative hook for advanced flows (e.g., combat)
  try {
    if (typeof choice.onChoose === 'function') {
      choice.onChoose();
    }
  } catch (e) {
    logSystem("choice.onChoose error: " + (e?.message || e));
  }

  if (choice.go === 'EXIT' || line.end === true) {
    if (onEndCb) onEndCb();
    return;
  }

  if (typeof choice.next === 'number') {
    idx = choice.next;
  } else if (typeof line.next === 'number') {
    idx = line.next;
  } else {
    idx++;
  }
  render();
}

export function startDialogue(newTree, onEnd){
  tree = newTree;
  idx = 0;
  onEndCb = onEnd || null;
  try { if (unsub) unsub(); } catch {}
  unsub = onCommand('dialogue', (num) => {
    const n = Number(num);
    if (Number.isInteger(n) && n > 0) choose(n-1);
  });
  render();
}
