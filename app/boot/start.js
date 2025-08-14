// app/boot/start.js
// Boot with a DEV_QUICKSTART toggle. When enabled, jump straight to DocksideIntro
// with a pre-generated Fighter (AYA) and a full skills table.

import TitleMenuScene from "../scenes/TitleMenuScene.js";
import DocksideIntro from "../scenes/DocksideIntro.js";
import { dispatch } from "../engine/inputManager.js";
import { sceneManager } from "../engine/sceneManager.js";
import { state } from "../state/stateStore.js";

const DEV_QUICKSTART = true; // flip to false to restore normal Title Menu flow

function wireKeyboard() {
  const map = new Map([
    ["ArrowUp", "up"], ["ArrowDown", "down"], ["ArrowLeft", "left"], ["ArrowRight", "right"],
    ["w", "up"], ["s", "down"], ["a", "left"], ["d", "right"],
    ["W", "up"], ["S", "down"], ["A", "left"], ["D", "right"],
    ["Enter", "confirm"], ["Escape", "back"]
  ]);
  window.addEventListener("keydown", (e) => {
    const cmd = map.get(e.key);
    if (!cmd) return;
    e.preventDefault();
    try { dispatch(cmd); } catch {}
  });
}

function seedAya() {
  // Abilities typical for a level-1 Fighter (point-buy-ish)
  const abilities = { STR: 16, DEX: 14, CON: 14, INT: 8, WIS: 12, CHA: 10 };

  // Full skills table with governing ability and proficiency flag
  const skills = [
    { name: "Athletics",        ability: "STR", proficient: true },
    { name: "Acrobatics",       ability: "DEX", proficient: false },
    { name: "Sleight of Hand",  ability: "DEX", proficient: false },
    { name: "Stealth",          ability: "DEX", proficient: false },
    { name: "Arcana",           ability: "INT", proficient: false },
    { name: "History",          ability: "INT", proficient: false },
    { name: "Investigation",    ability: "INT", proficient: false },
    { name: "Nature",           ability: "INT", proficient: false },
    { name: "Religion",         ability: "INT", proficient: false },
    { name: "Animal Handling",  ability: "WIS", proficient: false },
    { name: "Insight",          ability: "WIS", proficient: false },
    { name: "Medicine",         ability: "WIS", proficient: false },
    { name: "Perception",       ability: "WIS", proficient: true },
    { name: "Survival",         ability: "WIS", proficient: true },
    { name: "Deception",        ability: "CHA", proficient: false },
    { name: "Intimidation",     ability: "CHA", proficient: true },
    { name: "Performance",      ability: "CHA", proficient: false },
    { name: "Persuasion",       ability: "CHA", proficient: false }
  ];

  state.player = {
    name: "AYA",
    class: "Fighter",
    background: "Acolyte",
    feat: "Alert",
    level: 1,
    abilities,
    hp: 12,
    maxHp: 12,
    skills,
    x: 2, y: 2,
    inventory: [{ id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }]
  };

  // Default world (fields) so scenes have dimensions immediately
  state.map = { id: "fields", width: 90, height: 60 };
}

function start() {
  wireKeyboard();

  if (DEV_QUICKSTART) {
    try {
      seedAya();
    } catch (e) {
      console.warn("DEV_QUICKSTART seed failed; falling back to Title Menu", e);
      TitleMenuScene.start();
      return;
    }
    // Jump straight into the intro scene
    try {
      sceneManager.replace(DocksideIntro);
      return;
    } catch (e) {
      console.error("Failed to start DocksideIntro, falling back to Title Menu", e);
      TitleMenuScene.start();
      return;
    }
  }

  // Normal flow: show title menu
  TitleMenuScene.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
