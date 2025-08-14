// app/scenes/DocksideIntro.js
// Dialogue–Exploration micro-scene: rainy docks with four nodes.
// Keys: 1–N choose options; Q/Escape returns to map (ExplorationScene).
// Left pane title: "Dockside (Night Rain)" + HUD chips "Rain" and "Torch OFF".

import { mountCenter, mountLeft, clearCenter, clearLeft, setTop } from "../renderer/shellMount.js";
import { sceneManager } from "../engine/sceneManager.js";
import ExplorationScene from "./ExplorationScene.js";
import { logSystem } from "../engine/log.js";
import { enableChoiceHotkeys, disableChoiceHotkeys, renderChoiceList, setChoiceScope } from "../ui/choiceHotkeys.js";

function d20(){ return Math.floor(Math.random()*20)+1; }

function formatLockpick(totalRoll, bonus, dc){
  const out = `Sleight of Hand check: d20(${totalRoll - bonus}) +${bonus} = ${totalRoll} vs DC ${dc} → ${totalRoll>=dc ? "SUCCESS" : "FAIL"}`;
  logSystem(out);
}

function hudLeft(){
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '8px';

  const title = document.createElement('div');
  title.textContent = "Dockside (Night Rain)";
  title.style.fontWeight = '600';
  title.style.paddingBottom = '6px';
  title.style.borderBottom = '1px solid var(--line, #333)';

  const chips = document.createElement('div');
  chips.style.display = 'flex';
  chips.style.flexWrap = 'wrap';
  chips.style.gap = '6px';

  const mkChip = (label) => {
    const c = document.createElement('span');
    c.textContent = label;
    c.style.padding = '2px 8px';
    c.style.border = '1px solid var(--line, #333)';
    c.style.borderRadius = '999px';
    c.style.fontSize = '12px';
    return c;
  };
  chips.appendChild(mkChip("Rain"));
  chips.appendChild(mkChip("Torch OFF"));

  wrap.appendChild(title);
  wrap.appendChild(chips);
  return wrap;
}

function centerBox(text, options=[]) {
  const box = document.createElement('div');
  box.style.whiteSpace = 'pre-wrap';
  box.style.lineHeight = '1.4';
  box.style.padding = '8px';

  const p = document.createElement('div');
  p.textContent = text;
  p.style.marginBottom = '10px';
  box.appendChild(p);

  // Render standardized choice list
  renderChoiceList(box, options);

  const hint = document.createElement('div');
  hint.style.opacity = '0.7';
  hint.style.marginTop = '8px';
  hint.textContent = "Press 1–number to choose, Q/Esc to return to map.";
  box.appendChild(hint);
  return box;
}

function showEndOfPier() {
  const text = [
    "Fog and rain stitch the black water to the pier.",
    "Ropes groan. Lanterns rattle against their hooks.",
    "Your cloak drinks the night. Somewhere, a gull laughs once."
  ].join(" ");

  const options = [
    { label: "Peer into the water", onSelect: () => showWater() },
    { label: "Try the dock office door (locked)", onSelect: () => showOffice(false) },
    { label: "Rummage through the fish baskets", onSelect: () => showBaskets() },
    { label: "Depart to the Fields", onSelect: () => departToFields() }
  ];

  const box = centerBox(text, options);
  mountCenter(box);
  // Ensure hotkeys aim at the center pane
  setChoiceScope(document.getElementById('center'));
}

let basketsTaken = false;

function departToFields(){
  sceneManager.replace(ExplorationScene, { areaId: 'fields' });
}

function showWater(){
  const text = [
    "You lean over the slick rail. Rain beads the surface into a single moving mirror.",
    "Below: ladders descending into a throat. Nothing stirs but the tide."
  ].join(" ");
  const box = centerBox(text, [
    { label: "Back to the end of the pier", onSelect: showEndOfPier },
  ]);
  mountCenter(box);
  setChoiceScope(document.getElementById('center'));
}

function abilityBonusFromPlayer(){
  const st = (window.state && window.state.player) ? window.state.player : (typeof state !== 'undefined' ? state.player : null);
  const player = st || window.player || {};
  const skillBonus = (player.skills && (player.skills["Sleight of Hand"] ?? player.skills.SleightOfHand ?? player.skills.sleightOfHand));
  if (typeof skillBonus === 'number') return skillBonus;

  const dex = (player.DEX ?? player.dex ?? (player.abilities && (player.abilities.DEX || player.abilities.Dexterity))) || 16;
  const mod = Math.floor((dex - 10) / 2);
  const prof = 2;
  const cls = (player.class || player.classId || "").toLowerCase();
  const hasProf = cls.includes('rogue') || (player.tools && (player.tools.includes("Thieves' tools")));
  return mod + (hasProf ? prof : 0);
}

function showOffice(fromFailure=false){
  const dc = 18;
  const bonus = abilityBonusFromPlayer();
  const roll = d20();
  const total = roll + bonus;
  formatLockpick(total, bonus, dc);

  if (total >= dc) {
    const text = [
      "The pick whispers. The rain keeps time.",
      "Tumblers surrender, and the door eases inward on a smell of old rope and wet ink.",
      "Inside: ledgers swollen with damp, a cold stove, a single stool—nothing to take but the quiet."
    ].join(" ");
    const box = centerBox(text, [
      { label: "Step back into the rain", onSelect: showEndOfPier },
    ]);
    mountCenter(box);
    setChoiceScope(document.getElementById('center'));
  } else {
    const text = [
      "The ward bites back. The pick skates.",
      "You feel the cold deepen with the hour; your fingers go wooden.",
      "The dock office remains shut."
    ].join(" ");
    const box = centerBox(text, [
      { label: "Back to the end of the pier", onSelect: showEndOfPier },
    ]);
    mountCenter(box);
    setChoiceScope(document.getElementById('center'));
  }
}

function showBaskets(){
  let text;
  if (!basketsTaken) {
    basketsTaken = true;
    text = [
      "Wicker mounds huddle against the wall, gleaming with rain.",
      "You lift a crust of net and find a small brass tally token stamped with a gull.",
      "Someone will miss it; someone else will not."
    ].join(" ");
    logSystem("You found: Brass Tally Token (gull-stamped).");
  } else {
    text = [
      "Only broken shells and cold scales remain.",
      "Whatever was worth taking is gone."
    ].join(" ");
  }
  const box = centerBox(text, [
    { label: "Back to the end of the pier", onSelect: showEndOfPier },
  ]);
  mountCenter(box);
  setChoiceScope(document.getElementById('center'));
}

export default {
  start(){
    setTop("…the black water breathes…");
    mountLeft(hudLeft());
    showEndOfPier();

    // Enable global numeric hotkeys for this scene (scoped to center pane)
    enableChoiceHotkeys({ scopeEl: document.getElementById('center') });

    // Local quit keys: Q/Esc -> back to map
    window.addEventListener('keydown', this._quitHandler = (e)=>{
      const k = e.key;
      if (k === 'q' || k === 'Q' || k === 'Escape') {
        e.preventDefault();
        this.cleanup();
        sceneManager.replace(ExplorationScene);
      }
    });
  },
  cleanup(){
    try { disableChoiceHotkeys(); } catch {}
    try { window.removeEventListener('keydown', this._quitHandler); } catch {}
    clearCenter();
    clearLeft();
  }
};
