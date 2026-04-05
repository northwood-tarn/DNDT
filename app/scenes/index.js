import { registerScene } from "../engine/sceneRouter.js";

import MainMenuScene from "./MainMenuScene.js";
import CharacterSelectScene from "./CharacterSelectScene.js";
import LoadGameScene from "./LoadGameScene.js";
import DialogueScene from "./DialogueScene.js";
import ExplorationScene from "./ExplorationScene.js";
import CombatScene from "./CombatScene.js";
import GameOverScene from "./GameOverScene.js";
import SettingsScene from "./SettingsScene.js";
import IntroScene from "./IntroScene.js";
import SystemCutsceneScene from "./SystemCutsceneScene.js";
import BootScene from "./BootScene.js";
import PreloadScene from "./PreloadScene.js";

export const SCENES = {
  mainMenu: "mainMenu",
  characterSelect: "characterSelect",
  loadGame: "loadGame",
  boot: "boot",
  preload: "preload",
  dialogue: "dialogue",
  exploration: "exploration",
  combat: "combat",
  gameOver: "gameOver",
  settings: "settings",
  intro: "intro",
  systemCutscene: "systemCutscene",
};

// Core scenes
registerScene("mainMenu", MainMenuScene);
registerScene("characterSelect", CharacterSelectScene);
registerScene("loadGame", LoadGameScene);
registerScene("boot", BootScene);
registerScene("preload", PreloadScene);

// Core gameplay loops
registerScene("dialogue", DialogueScene);
registerScene("exploration", ExplorationScene);
registerScene("combat", CombatScene);

// Edge scenes
registerScene("gameOver", GameOverScene);
registerScene("settings", SettingsScene);
registerScene("intro", IntroScene);
registerScene("systemCutscene", SystemCutsceneScene);