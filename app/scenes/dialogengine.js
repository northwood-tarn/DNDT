// app/scenes/dialogengine.js
// DialogueEngine that mounts FogRoller only during dialogue and fades it out on exit.

export class DialogueEngine {
  constructor(mount, { onExit = () => {}, onCombat = () => {} } = {}) {
    this.mount = mount;
    this.handlers = { onExit, onCombat };
    this.state = { script: null };

    // Dialogue UI root (DOM overlay)
    this.root = document.createElement('div');
    this.root.className = 'dialogue-container';
    this.mount.appendChild(this.root);

    // Fog instance (PIXI side)
    this.fog = null;
  }

  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load dialogue: ${url}`);
    this.state.script = await res.json();
  }

  async start() {
    // Start fog when dialogue begins (behind UI). window.app is your PIXI.Application
    if (window.createFogRoller && window.app) {
      this.fog = window.createFogRoller(window.app, {
        frames: [
          "./assets/images/background/fog_01.png",
          "./assets/images/background/fog_02.png",
          "./assets/images/background/fog_03.png",
          "./assets/images/background/fog_04.png"
        ],
        holdTime: 16,
        fadeTime: 8,
        pingPong: true
      });
      await this.fog.start();
      // Put fog at back of PIXI stage
      window.app.stage.addChildAt(this.fog.container, 0);
    }

    this.render();
  }

  async cleanup() {
    // Fade out fog and remove after fade completes
    if (this.fog) {
      await this.fog.fadeOut(2000);
      if (this.fog.container && this.fog.container.parent) {
        this.fog.container.parent.removeChild(this.fog.container);
      }
      this.fog = null;
    }

    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  render() {
    // Minimal sample render; plug in your real dialogue UI here
    this.root.innerHTML = "";
    const header = document.createElement('div');
    header.className = "dialogue-header";
    header.textContent = this.state?.script?.header?.npc ?? "SPEAKER";
    const text = document.createElement('p');
    text.textContent = this.state?.script?.header?.text ?? "";

    this.root.appendChild(header);
    this.root.appendChild(text);

    const opts = this.state?.script?.options ?? [];
    const list = document.createElement("div");
    list.className = "dialogue-options";
    opts.forEach(o => {
      const line = document.createElement("div");
      line.className = "option";
      const meta = [];
      if (o.tag)   meta.push(`[${o.tag}]`);
      if (o.check) meta.push(`${o.check.skill} (${o.check.mod >= 0 ? "+" : ""}${o.check.mod})`);
      line.textContent = `${o.id} | ${o.text}${meta.length ? " — " + meta.join(" · ") : ""}`;
      line.addEventListener("click", () => this.choose(o));
      list.appendChild(line);
    });
    this.root.appendChild(list);
  }

  choose(opt) {
    if (opt.action === "exit") {
      this.handlers.onExit();
    } else if (opt.action === "combat") {
      this.handlers.onCombat({ encounter: "placeholder" });
    } else {
      console.log("[dialogue] choice:", opt);
    }
  }
}
