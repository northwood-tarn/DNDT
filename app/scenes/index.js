import { registerScene } from "../engine/sceneRouter.js";

import MainMenuScene from "./MainMenuScene.js";
import PrologueScene from "./PrologueScene.js";
import CharacterSelectScene from "./CharacterSelectScene.js";
import LoadGameScene from "./LoadGameScene.js";
import DialogueScene from "./DialogueScene.js";
import GameOverScene from "./GameOverScene.js";
import SettingsScene from "./SettingsScene.js";
import CreditsScene from "./CreditsScene.js";
import ExplorationLauncherPreviewScene from "./ExplorationLauncherPreviewScene.js";
import IntroScene from "./IntroScene.js";
import SystemCutsceneScene from "./SystemCutsceneScene.js";
import BootScene from "./BootScene.js";
import PreloadScene from "./PreloadScene.js";
import GrandExplorationScene from "./GrandExplorationScene.js";
import MerchantScene from "./MerchantScene.js";

export const SCENES = {
  mainMenu: "mainMenu",
  characterSelect: "characterSelect",
  prologue: "prologue",
  loadGame: "loadGame",
  boot: "boot",
  preload: "preload",
  dialogue: "dialogue",
  combat: "combat",
  gameOver: "gameOver",
  settings: "settings",
  credits: "credits",
  explorationLauncherPreview: "explorationLauncherPreview",
  intro: "intro",
  systemCutscene: "systemCutscene",
};

// Core scenes
registerScene("mainMenu", MainMenuScene);
registerScene("prologue", PrologueScene);
registerScene("characterSelect", CharacterSelectScene);
registerScene("loadGame", LoadGameScene);
registerScene("boot", BootScene);
registerScene("preload", PreloadScene);

// Core gameplay loops
registerScene("dialogue", DialogueScene);
registerScene("exploration", GrandExplorationScene);
registerScene("service", MerchantScene);

// Edge scenes
registerScene("gameOver", GameOverScene);
registerScene("settings", SettingsScene);
registerScene("credits", CreditsScene);
registerScene("explorationLauncherPreview", ExplorationLauncherPreviewScene);
registerScene("intro", IntroScene);
registerScene("systemCutscene", SystemCutsceneScene);
