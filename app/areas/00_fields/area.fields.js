// app/areas/fields/area.fields.js
// Fields area: arrival quadrant, goblin ambush, bridge skill challenge, hermit, cave, tower

import { logSystem } from "../../engine/log.js";
import { startSkillChallenge } from "../../systems/skillChallenge.js";
import { sceneManager } from "../../engine/sceneManager.js";
import DialogueScene from "../../scenes/DialogueScene.js";

export const FIELDS_META = {
  id: "fields",
  title: "The Fields",
  blurb: "Wet grass, low stone walls, and a wind that tastes of iron.",
  width: 90,
  height: 60
};

// Simple in-file dialogue tree for hermit placeholder
const HERMIT_TREE = {
  id: "hermit_intro",
  start: "root",
  nodes: {
    root: {
      text: "A hunched figure under a bent tree: 'Mind the bridge. The wind takes more than hats.'",
      options: [
        { label: "Ask about goblins.", goto: "goblins" },
        { label: "Ask about a tower.", goto: "tower" },
        { label: "Leave.", end: true }
      ]
    },
    goblins: { text: "'Shy till they're not. One dropped something shiny by the hedge.'", options: [{ label: "Back.", goto: "root"}] },
    tower: { text: "'Key split in two. Left half near the fields, right half in the dark hole.'", options: [{ label: "Back.", goto: "root"}] }
  }
};

// Bridge challenge definition (3 stages). Fail = 5 HP + time passage; still reach far side.
function runBridgeChallenge(ctx){
  const def = {
    id: "fields_bridge_crevasse",
    maxFailures: 1,
    stages: [
      { name: "Steady the rope", dc: 12, skills: ["Athletics","Survival"] },
      { name: "Balance across", dc: 12, skills: ["Acrobatics"] },
      { name: "Final heave", dc: 12, skills: ["Athletics","Acrobatics"] }
    ],
    onCompleteSuccess: (c)=>{
      logSystem("You cross the crevasse, boots black with rain.");
      if (c && c.movePlayerTo) c.movePlayerTo({ side: "far" });
    },
    onCompleteFail: (c)=>{
      logSystem("You slip. The world lurches. Impact blooms like iron flowers. (-5 HP)");
      if (c && c.applyDamage) c.applyDamage(5);
      if (c && c.addTime) c.addTime(1);
      if (c && c.movePlayerTo) c.movePlayerTo({ side: "far" });
    }
  };
  return startSkillChallenge(def, ctx);
}

// Coordinate helpers are based on a 40x18 map (same as ExplorationScene defaults)
export function fieldsTriggerAt(x, y, W, H){
  // arrival quadrant ~ top-left; bridge at x ~ 10, y ~ 6; hermit near trees; cave mid-right; tower bottom-right
  // Triggers are coarse for now; exact coordinates can be tuned later.
  // 1) Initial goblin ambush (~3 tiles in)
  if (x === 4 && y === 2){
    return { type: "encounter", id: "goblins_fields_ambush", onResolve: ()=>logSystem("One goblin drops Half-Key A.") };
  }
  // 2) Bridge skill challenge
  if (x === 10 && y === 6){
    return { type: "skill_challenge", id: "bridge_crevasse", run: ()=>runBridgeChallenge({
      // Minimal ctx stubs; scene can pass real ones later
      applyDamage: (hp)=>{ logSystem(`HP -${hp}`); },
      addTime: (t)=>{ logSystem(`Time passes (${t}).`); },
      movePlayerTo: ()=>{ /* no-op in area stub */ }
    }) };
  }
  // 3) Hermit dialogue (near copse)
  if (x === 7 && y === 4){
    return { type: "dialogue", tree: HERMIT_TREE };
  }
  // 4) Cave entrance
  if (x === W-12 && y === 6){
    return { type: "enter_area", areaId: "fields_cave" }; // placeholder
  }
  // 5) Tower (requires both keys — gate later)
  if (x === W-4 && y === H-3){
    return { type: "enter_area", areaId: "fields_tower" }; // placeholder
  }
  // 6) Back to docks
  if (x === 2 && y === 1){
    return { type: "enter_area", areaId: "docks" }; // placeholder
  }
  return null;
}

// === Interactables for adjacency-based interaction ===
export function fieldsInteractables(W=40, H=18){
  // Keep in sync with trigger coords
  return [
    { id: "bridge", name: "Rope Bridge", type: "bridge", x: 10, y: 6 },
    { id: "hermit_hut", name: "Hermit's Hut", type: "hermit", x: 7, y: 4 },
    { id: "cave", name: "Cave Entrance", type: "cave", x: W-12, y: 6 },
    { id: "tower", name: "Wizard's Tower", type: "tower", x: W-4, y: H-3 },
    { id: "ember_creek", name: "Creekside Ember", type: "ember", x: 3, y: 14, emberId: "fields_ember_creekside" },
    { id: "ember_north", name: "North Hedge Ember", type: "ember", x: W-6, y: 3, emberId: "fields_ember_northhedge" },
    { id: "oil_toad", name: "Oil-Drinking Toad", type: "toad", x: 6, y: 3 },
    { id: "oil_fountain", name: "Oil Fountain", type: "fountain", x: 7, y: 3 }
  ];
}

// Mirror the old trigger behavior so ExplorationScene can fetch a trigger by coordinate.
export function getInteractionAt(x, y, W=40, H=18){
  return fieldsTriggerAt(x, y, W, H);
}

// Optional static light sources in the Fields (braziers, hut window, etc.)
// Return array of { x, y, brightTiles, dimTiles }
export function getLightSources(state){
  const W = 40, H = 18;
  const sources = [];
  // Hermit hut window glows: modest light
  sources.push({ x: 7, y: 4, brightTiles: 2, dimTiles: 2 });
  // A brazier near the bridge
  sources.push({ x: 10, y: 6, brightTiles: 3, dimTiles: 3 });
  // Ember stones also emit a faint light even before discovery
  sources.push({ x: 3, y: 14, brightTiles: 2, dimTiles: 2 });
  sources.push({ x: W-6, y: 3, brightTiles: 2, dimTiles: 2 });
  return sources;
}

// Hidden elements in The Fields (for passive checks / fragment reveals)
export function getHiddenList(){
  // Example: one hidden item near the hedge, one hidden cache near the cave, and a buried trap tile near the bridge.
  const list = [];
  // Hidden item: half-key near hedge
  list.push({ id: 'hid_key_half', type: 'item', name: 'a glinting shard', x: 5, y: 2, dc: 12, revealed: false });
  // Hidden item: coin pouch near cave approach
  list.push({ id: 'hid_coin_cache', type: 'item', name: 'a coin pouch', x: 26, y: 6, dc: 13, revealed: false });
  // Hidden trap: snare plate just before bridge
  list.push({ id: 'hid_snare_plate', type: 'trap', name: 'a snare plate', x: 9, y: 6, dc: 12, revealed: false });
  return list;
}
