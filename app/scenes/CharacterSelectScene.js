// CharacterSelectScene.js
// Scene wrapper around the CharacterSelect UI module.
// Keeps character creation inside the scene lifecycle so sceneManager
// can handle transitions, fades, and cleanup consistently.

import CharacterSelect from "./CharacterSelect.js";

export default class CharacterSelectScene {
  constructor() {
    this._ctx = null;
    this._params = null;
    this._label = "CharacterSelect";
    this._started = false;
  }

  init(ctx) {
    this._ctx = ctx;
    console.info("[Scene:init] CharacterSelectScene");
  }

  enter(params = {}) {
    this._params = params;
    console.info("[Scene:enter] CharacterSelectScene", params);

    // Mount the existing character creation UI into the shell panes.
    // CharacterSelect.start() takes care of building all DOM and wiring events.
    CharacterSelect.start(params);
    this._started = true;
  }

  update(_dt) {
    // No per-frame logic needed; UI is event-driven.
  }

  render(_g) {
    // All visual work is handled by the DOM/UI module.
  }

  exit() {
    console.info("[Scene:exit] CharacterSelectScene");

    // NOTE: CharacterSelect.js currently has no explicit cleanup API.
    // Other scenes that mount into the same panes will naturally overwrite
    // this UI when they enter. If we later add CharacterSelect.cleanup(),
    // call it here.
    this._params = null;
  }

  destroy() {
    console.info("[Scene:destroy] CharacterSelectScene");
    this._ctx = null;
  }
}