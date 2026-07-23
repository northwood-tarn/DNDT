import { audioRuntime } from "../audio/index.js";
import { routeTo } from "../engine/sceneRouter.js";

export default class AudioTestScene {
  constructor() { this.root = document.getElementById("game-root"); this.container = null; }

  start(params = {}) {
    this.params = params;
    this.container = document.createElement("section");
    this.container.className = "audio-tool";
    this.container.innerHTML = `
      <style>${styles}</style>
      <header><div><h1>Audio Runtime Test</h1><p>Uses the production runtime and current authored configuration.</p></div><button data-action="close">Close</button></header>
      <div class="audio-tool-grid">
        <fieldset><legend>Unlock and areas</legend>
          <button data-action="unlock">Unlock audio</button><button data-area="test_exploration">Test Exploration</button><button data-area="test_combat">Test Combat</button><button data-action="repeat">Repeat current area</button><button data-action="stop-area">Stop area</button>
        </fieldset>
        <fieldset><legend>Playback</legend>
          <button data-event="UI_CONFIRM">UI event</button><button data-action="dialogue">Dialogue</button><button data-action="missing">Missing asset safety</button><button data-action="stop-dialogue">Stop dialogue</button><button data-action="stop-all">Stop all</button>
        </fieldset>
        <fieldset class="mixer"><legend>Mixer</legend>${["master", "music", "ambience", "effects", "dialogue", "ui"].map(busRow).join("")}</fieldset>
      </div><output class="audio-tool-status" aria-live="polite">Ready. Interact once to unlock playback.</output>`;
    this.root?.appendChild(this.container);
    this.bind(); this.sync();
  }

  bind() {
    this.container.addEventListener("click", async (event) => {
      const button = event.target.closest("button"); if (!button) return;
      audioRuntime.unlock();
      if (button.dataset.area) await audioRuntime.transitionToArea(button.dataset.area);
      else if (button.dataset.event) audioRuntime.playEvent(button.dataset.event);
      else if (button.dataset.action === "unlock") this.status("Audio unlocked.");
      else if (button.dataset.action === "repeat") await audioRuntime.transitionToArea(audioRuntime.areaId || "test_exploration");
      else if (button.dataset.action === "stop-area") await audioRuntime.stopAreaAudio();
      else if (button.dataset.action === "dialogue") audioRuntime.playDialogue("test_dialogue");
      else if (button.dataset.action === "missing") audioRuntime.playEvent("MISSING_TEST_EVENT");
      else if (button.dataset.action === "stop-dialogue") audioRuntime.stopDialogue();
      else if (button.dataset.action === "stop-all") audioRuntime.stopAllAudio();
      else if (button.dataset.action === "close") routeTo({ toScene: this.params.fromScene || "mainMenu", fromScene: "audioTest", reason: "audio_test_closed" });
      this.sync();
    });
    this.container.addEventListener("input", (event) => {
      const bus = event.target.dataset.bus; if (!bus) return;
      audioRuntime.setBusVolume(bus, Number(event.target.value) / 100); this.sync();
    });
    this.container.addEventListener("change", (event) => {
      const bus = event.target.dataset.mute; if (!bus) return;
      audioRuntime.muteBus(bus, event.target.checked); this.sync();
    });
  }

  sync() {
    const state = audioRuntime.getMixerState();
    for (const [bus, value] of Object.entries(state)) {
      const range = this.container?.querySelector(`[data-bus="${bus}"]`), output = this.container?.querySelector(`[data-value="${bus}"]`), mute = this.container?.querySelector(`[data-mute="${bus}"]`);
      if (range && document.activeElement !== range) range.value = Math.round(value.volume * 100);
      if (output) output.textContent = `${Math.round(value.volume * 100)}%`;
      if (mute) mute.checked = value.muted;
    }
    this.status(`Unlocked: ${audioRuntime.unlocked ? "yes" : "no"} · Area: ${audioRuntime.areaId || "none"} · Active sounds: ${audioRuntime.instances.size}`);
  }
  status(text) { const output = this.container?.querySelector(".audio-tool-status"); if (output) output.textContent = text; }
  cleanup() { audioRuntime.stopAllAudio(); this.container?.remove(); this.container = null; }
}

function busRow(bus) { return `<div class="mixer-row"><span>${bus}</span><input data-bus="${bus}" type="range" min="0" max="100"><output data-value="${bus}"></output><label class="mute"><input data-mute="${bus}" type="checkbox"> Mute</label></div>`; }
const styles = `.audio-tool{position:absolute;inset:0;z-index:40;padding:48px;background:#071011;color:#b8cfca;font:15px system-ui;overflow:auto}.audio-tool header{display:flex;justify-content:space-between;align-items:start}.audio-tool h1{margin:0;color:#d6e5df}.audio-tool p{opacity:.65}.audio-tool button,.audio-tool input{accent-color:#78a79e}.audio-tool button{margin:5px;padding:8px 12px;border:1px solid #52746e;background:#10201f;color:#cde0db;cursor:pointer}.audio-tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.audio-tool fieldset{border:1px solid #35514c;padding:18px}.audio-tool .mixer{grid-column:1/-1}.audio-tool .mixer-row{display:grid;grid-template-columns:100px 1fr 55px 90px;align-items:center;gap:12px;margin:14px 10px}.audio-tool .mute{display:flex;align-items:center;gap:7px}.audio-tool-status{display:block;margin-top:20px;padding:12px;background:#0d1b1a}`;
