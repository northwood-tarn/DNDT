// app/scenes/DialogExploreScene.js
// Menu-driven interior exploration that *does* advance time/oil: 1 inside-minute per move.
//
// Centralized numeric choice handling via app/ui/choiceHotkeys.js
import { sceneManager } from "../engine/sceneManager.js";
import { logSystem } from "../engine/log.js";
import { loadArea } from "../areas/index.js";
import * as time from "../systems/timeSystem.js";
import { onEnvironmentLightChange, getLanterna, toggleLanterna, pauseLanternaBurn, resumeLanternaBurn } from "../systems/lanternaSystem.js";
import { SetProfileExplorationDialog, mountCenter, mountLeft, clearCenter, clearLeft, setTop, setLanternaChip } from "../renderer/shellMount.js";
import { enableChoiceHotkeys, disableChoiceHotkeys, renderChoiceList, setChoiceScope } from "../ui/choiceHotkeys.js";

let current = { areaId: null, nodeId: null, area: null, graph: null };
let specialKeyHandler = null;

function renderNode(node){
  const box = document.createElement('div');
  box.style.whiteSpace = 'pre-wrap';
  box.style.lineHeight = '1.4';
  box.style.padding = '8px';

  const p = document.createElement('div');
  p.textContent = node.text || '';
  p.style.marginBottom = '10px';
  box.appendChild(p);

  // choices
  const options = (node.options || []).map((opt, i)=> ({
    label: opt.label,
    onSelect: ()=> chooseOption(i)
  }));
  renderChoiceList(box, options);

  const hudHint = document.createElement('div');
  hudHint.style.opacity = '0.7';
  hudHint.style.marginTop = '8px';
  hudHint.textContent = "Press 1–9 to choose; L to toggle Lanterna; Q/Esc to exit.";
  box.appendChild(hudHint);

  mountCenter(box);
  // ensure hotkeys point at the center pane
  setChoiceScope(document.getElementById('center'));
}

function chooseOption(index){
  const node = current.graph.nodes[current.nodeId];
  const opt = (node.options || [])[index];
  if (!opt) return;

  // Moving to another interior node costs 1 inside minute (burns oil if lit).
  // (If your time rules differ for interiors, adjust here.)
  try { time.addMinutes?.(1); } catch {}
  current.nodeId = opt.goto;
  const next = current.graph.nodes[current.nodeId];

  // Per-area env category governs auto on/off; trigger only on initial enter handled in start().
  if (current.graph.env){
    onEnvironmentLightChange(current.graph.env, logSystem);
  }

  if (typeof next?.onEnter === 'function'){
    try { next.onEnter({ area: current.area, nodeId: current.nodeId }); } catch {}
  }
  renderNode(next);
  setLanternaChip(getLanterna());
}

function handleSpecialKeys(e){
  const k = e.key;
  if (k === 'q' || k === 'Q' || k === 'Escape'){
    e.preventDefault();
    // Leaving dialog-explore does NOT auto-advance time; caller controls transition.
    sceneManager.pop && sceneManager.pop(); // if stack exists
    return;
  }
  if (k === 'l' || k === 'L'){
    e.preventDefault();
    toggleLanterna();
    setLanternaChip(getLanterna());
    return;
  }
}

export default {
  start(){
    try { SetProfileExplorationDialog({ title: "Exploration (Interior)" }); } catch {}

    const params = (arguments && arguments[1]) || {};
    current.areaId = params.areaId || 'fields';
    current.area = loadArea(current.areaId);
    current.graph = current.area.dialogExplore || { start: 'start', env: 'bright', nodes: { start: { text: "Empty room.", options: [] } } };
    current.nodeId = params.nodeId || current.graph.start;

    pauseLanternaBurn();

    // Auto on/off fires ONCE on enter for the area's category
    if (current.graph.env){
      onEnvironmentLightChange(current.graph.env, logSystem);
    }

    // Left HUD: minimal Lanterna chip
    setLanternaChip(getLanterna());

    const node = current.graph.nodes[current.nodeId];
    if (typeof node?.onEnter === 'function'){
      try { node.onEnter({ area: current.area, nodeId: current.nodeId }); } catch {}
    }
    renderNode(node);

    // Enable centralized numeric choice handling
    enableChoiceHotkeys({ scopeEl: document.getElementById('center'), onChoose: (n)=> chooseOption(n-1) });

    // Keep L / Q/Esc locally
    specialKeyHandler = handleSpecialKeys;
    window.addEventListener('keydown', specialKeyHandler);
  },
  cleanup(){
    try{ resumeLanternaBurn(); }catch{}
    try { disableChoiceHotkeys(); } catch {}
    try { window.removeEventListener('keydown', specialKeyHandler); } catch {}
    clearCenter();
    clearLeft();
  }
};
