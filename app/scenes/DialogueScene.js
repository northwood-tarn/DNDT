// app/scenes/DialogueScene.js
// Self-contained dialogue driver that renders into the center panel
// using the existing choiceHotkeys utilities (renderChoiceList, enableChoiceHotkeys).

import { mountCenter, clearCenter, setTop } from "../renderer/shellMount.js";
import { renderChoiceList, enableChoiceHotkeys, disableChoiceHotkeys, setChoiceScope } from "../ui/choiceHotkeys.js";
import { logSystem } from "../engine/log.js";

function toArray(x){ return Array.isArray(x) ? x : (x ? [x] : []); }

const DialogueScene = {
  start(args = {}) {
    const { tree, onEnd, title = "…" } = args;
    setTop(title);

    let idx = 0;
    const lines = toArray(tree?.lines);
    const centerEl = document.getElementById('center');

    function renderCurrent(){
      if (!lines || idx >= lines.length){
        try { if (onEnd) onEnd(); } catch(e){ logSystem(e?.message || e); }
        return;
      }
      const line = lines[idx] || {};
      const choices = (line.options && line.options.length ? line.options : line.choices) || [];

      const wrap = document.createElement('div');
      wrap.style.whiteSpace = 'pre-wrap';
      wrap.style.lineHeight = '1.4';
      wrap.style.padding = '8px';

      if (line.speaker){
        const h = document.createElement('div');
        h.textContent = line.speaker;
        h.style.fontWeight = '600';
        h.style.marginBottom = '4px';
        wrap.appendChild(h);
      }
      const body = document.createElement('div');
      body.textContent = line.text || "";
      body.style.marginBottom = '10px';
      wrap.appendChild(body);

      // Map tree choices to UI options ({label, onSelect})
      let uiOptions = choices.map((ch, i) => ({
        label: ch.label || ch.text || `Option ${i+1}`,
        onSelect: () => {
          try { if (typeof ch.onChoose === 'function') ch.onChoose(); } catch(e){ logSystem(e?.message || e); }
          if (ch.go === 'EXIT' || line.end === true) {
            try { if (onEnd) onEnd(); } catch(e){}
            return;
          }
          if (typeof ch.next === 'number') {
            idx = ch.next;
          } else if (typeof line.next === 'number') {
            idx = line.next;
          } else {
            idx = Math.min(idx + 1, lines.length);
          }
          render();
        }
      }));

      // If there are no explicit options but we have somewhere to go, add a default Continue
      if (uiOptions.length === 0 && (typeof line.next === 'number' || !line.end)){
        uiOptions = [{
          label: "Continue",
          onSelect: () => {
            if (typeof line.next === 'number') {
              idx = line.next;
            } else {
              idx = Math.min(idx + 1, lines.length);
            }
            render();
          }
        }];
      }

      mountCenter(wrap);
      renderChoiceList(wrap, uiOptions);
      setChoiceScope(document.getElementById('center'));
      try { disableChoiceHotkeys(); } catch {}
      enableChoiceHotkeys({ scopeEl: document.getElementById('center') });

      const hint = document.createElement('div');
      hint.style.opacity = '0.7';
      hint.style.marginTop = '8px';
      hint.textContent = "Press 1–number to choose, Q/Esc to exit.";
      wrap.appendChild(hint);
    }

    function render(){ clearCenter(); renderCurrent(); }
    render();
  },

  cleanup(){
    try { disableChoiceHotkeys(); } catch {}
    try { clearCenter(); } catch {}
  }
};

export default DialogueScene;
try { window.DialogueScene = DialogueScene; } catch {}
