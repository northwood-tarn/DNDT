// Scene wrapper for the canonical full-screen character creator.

export default class CharacterSelectScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.frame = null;
  }

  start() {
    if (!this.root) {
      console.error("[CharacterSelectScene] #game-root not found");
      return;
    }

    this.frame = document.createElement("iframe");
    this.frame.className = "character-creator-frame";
    this.frame.title = "Character creator";
    this.frame.src = "./character_creator/step_index.html";
    Object.assign(this.frame.style, {
      position: "absolute",
      inset: "0",
      zIndex: "30",
      width: "100%",
      height: "100%",
      border: "0",
      background: "#061719"
    });
    this.root.appendChild(this.frame);
  }

  cleanup() {
    this.frame?.remove();
    this.frame = null;
  }

  destroy() { this.cleanup(); }
}
