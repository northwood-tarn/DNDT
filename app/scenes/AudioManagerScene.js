import { audioRuntime } from "../audio/index.js";
import { normalizeAudioConfig, validateAudioConfig } from "../audio/audioConfig.js";
import { routeTo } from "../engine/sceneRouter.js";

const clone = (value) => structuredClone(value);
const SPECIAL_CONTEXTS = new Set(["prologue", "gameOver", "emberStops", "epilogue", "credits", "characterSelect"]);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export default class AudioManagerScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.container = null;
    this.config = null;
    this.tab = "areas";
    this.selectedAreaId = null;
    this.dirty = false;
    this.message = "";
    this.previewAudio = null;
    this.previewAssetId = null;
  }

  start(params = {}) {
    this.params = params;
    this.config = clone(audioRuntime.config);
    this.selectedAreaId = this.areaProfiles()[0]?.id || null;
    this.container = document.createElement("section");
    this.container.className = "simple-audio-manager";
    this.root?.appendChild(this.container);
    this.container.addEventListener("click", (event) => this.onClick(event));
    this.container.addEventListener("change", (event) => this.onChange(event));
    this.container.addEventListener("input", (event) => this.onInput(event));
    this.container.addEventListener("pointerover", (event) => this.onPreviewEnter(event));
    this.container.addEventListener("pointerout", (event) => this.onPreviewLeave(event));
    this.render();
  }

  render() {
    this.stopPreview();
    this.container.innerHTML = `
      <style>${styles}</style>
      <header>
        <h1>Audio</h1>
        <div>
          ${this.dirty ? `<span>Unsaved changes</span>` : ""}
          <button data-action="save" class="primary">Save</button>
          <button data-action="close">Close</button>
        </div>
      </header>
      <nav>
        <button data-tab="areas" class="${this.tab === "areas" ? "active" : ""}">Areas</button>
        <button data-tab="other" class="${this.tab === "other" ? "active" : ""}">Other</button>
        <button data-tab="events" class="${this.tab === "events" ? "active" : ""}">Game-wide SFX</button>
        <button data-tab="mixer" class="${this.tab === "mixer" ? "active" : ""}">Mixer</button>
      </nav>
      <main>${this.tab === "areas" ? this.areasTab() : this.tab === "other" ? this.otherTab() : this.tab === "events" ? this.eventsTab() : this.mixerTab()}</main>
      <footer><output aria-live="polite">${esc(this.message)}</output></footer>`;

  }

  areaProfiles() {
    return Object.values(this.config.areas).filter((area) => area.id !== "mainMenu" && !SPECIAL_CONTEXTS.has(area.id));
  }

  areasTab() {
    const profiles = this.areaProfiles();
    const selected = profiles.find((area) => area.id === this.selectedAreaId) || profiles[0];
    return `<section>
      <h2>Areas</h2>
      <p>Select any exploration or combat area. Audio works the same for both.</p>
      ${profiles.length ? `<label class="area-picker"><span>Area</span><select data-area-select>${profiles.map((area) => `<option value="${esc(area.id)}" ${area.id === selected?.id ? "selected" : ""}>${esc(area.name)}</option>`).join("")}</select></label>${selected ? this.areaEditor(selected) : ""}` : `<p>No areas available.</p>`}
      ${this.assignmentGroups(profiles)}
    </section>`;
  }

  otherTab() {
    const profiles = Object.values(this.config.areas).filter((area) => SPECIAL_CONTEXTS.has(area.id));
    return `<section>
      <h2>Other</h2>
      <p>Music and SFX for fixed game screens and sequences.</p>
      <div class="area-list">${profiles.map((area) => this.areaRow(area, false)).join("")}</div>
    </section>`;
  }

  areaEditor(area) {
    return `<article class="selected-area">
      <h3>${esc(area.name)}</h3>
      <div class="selected-area-fields">
        ${this.uploadField("Music", area.music?.assetId, `area:${area.id}:music`, area.music?.loopMode || (area.music?.loop === false ? "none" : "loop"))}
        ${this.uploadField("SFX", area.ambience?.assetId, `area:${area.id}:ambience`, area.ambience?.loopMode || (area.ambience?.loop === false ? "none" : "loop"))}
      </div>
    </article>`;
  }

  assignmentGroups(profiles) {
    const assigned = profiles.filter((area) => area.music?.assetId || area.ambience?.assetId);
    if (!assigned.length) return "";
    const groups = new Map();
    for (const area of assigned) {
      const act = area.actTitle || area.act || "Act not assigned";
      if (!groups.has(act)) groups.set(act, []);
      groups.get(act).push(area);
    }
    return `<div class="assignments"><h2>Existing assignments</h2><p>Open an Act only when you need to review or edit its audio.</p>${[...groups.entries()].map(([act, areas]) => `<details><summary>${esc(act)} <span>${areas.length}</span></summary><div>${areas.map((area) => `<article class="assignment-row"><div><strong>${esc(area.name)}</strong><span>Music: ${esc(this.assetName(area.music?.assetId))} · SFX: ${esc(this.assetName(area.ambience?.assetId))}</span></div><button data-edit-area="${esc(area.id)}">Edit</button></article>`).join("")}</div></details>`).join("")}</div>`;
  }

  assetName(assetId) {
    return assetId ? this.config.assets[assetId]?.name || "Missing file" : "None";
  }

  eventsTab() {
    return `<section>
      <h2>Game-wide SFX</h2>
      <p>Upload the sound used for each event.</p>
      <div class="sound-list">${Object.values(this.config.events).map((event) => this.soundRow(event)).join("")}</div>
    </section>`;
  }

  mixerTab() {
    const mixer = this.config.mixerDefaults;
    return `<section class="mixer-tab">
      <h2>Game-wide mixer</h2>
      <p>Set the overall balance for the whole game.</p>
      ${this.mixerRow("Master", "master", mixer.master.volume)}
      ${this.mixerRow("Music", "music", mixer.music.volume)}
      ${this.mixerRow("SFX", "sfx", mixer.effects.volume)}
    </section>`;
  }

  mixerRow(label, key, value) {
    return `<label class="mixer-row"><strong>${label}</strong><input data-mixer="${key}" type="range" min="0" max="1" step="0.01" value="${value}"><output data-mixer-output="${key}">${Math.round(value * 100)}%</output></label>`;
  }

  areaRow(area, showType) {
    return `<article class="area-row">
      <div class="area-name"><strong>${esc(area.name)}</strong>${showType ? `<span>${area.type === "combat" ? "Combat" : "Exploration"}</span>` : ""}</div>
      ${this.uploadField("Music", area.music?.assetId, `area:${area.id}:music`, area.music?.loopMode || (area.music?.loop === false ? "none" : "loop"))}
      ${this.uploadField("SFX", area.ambience?.assetId, `area:${area.id}:ambience`, area.ambience?.loopMode || (area.ambience?.loop === false ? "none" : "loop"))}
    </article>`;
  }

  soundRow(event) {
    return `<article class="sound-row">
      <div><strong>${esc(event.name)}</strong></div>
      ${this.uploadField("Sound", event.variants?.[0], `event:${event.id}`, event.loopMode || (event.loop ? "loop" : "none"))}
    </article>`;
  }

  uploadField(label, assetId, target, loopMode) {
    const asset = assetId ? this.config.assets[assetId] : null;
    return `<div class="upload-field">
      <span class="field-label">${label}</span>
      <span class="file-name"${asset ? ` data-preview-asset="${esc(asset.id)}"` : ""}>${asset ? esc(asset.name) : "No file uploaded"}</span>
      <select class="playback-mode" data-playback-mode="${esc(target)}" aria-label="${label} playback"><option value="none" ${loopMode === "none" ? "selected" : ""}>Play once</option><option value="loop" ${loopMode === "loop" ? "selected" : ""}>Loop</option><option value="infrequent" ${loopMode === "infrequent" ? "selected" : ""}>Loop infrequently</option></select>
      <button data-upload="${esc(target)}">${asset ? "Replace" : "Upload"}</button>
      <button class="clear-upload" data-clear-upload="${esc(target)}" aria-label="Clear ${label} file" title="Clear file" ${asset ? "" : "disabled"}>×</button>
    </div>`;
  }

  async onClick(event) {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.tab) {
      this.tab = button.dataset.tab;
      this.render();
      return;
    }
    if (button.dataset.editArea) {
      this.selectedAreaId = button.dataset.editArea;
      this.tab = "areas";
      this.render();
      return;
    }

    if (button.dataset.action === "save") {
      await this.save();
      return;
    }
    if (button.dataset.action === "close") {
      this.close();
      return;
    }
    if (button.dataset.upload) await this.upload(button.dataset.upload);
    if (button.dataset.clearUpload) this.clearUpload(button.dataset.clearUpload);
  }

  onPreviewEnter(event) {
    const filename = event.target.closest?.("[data-preview-asset]");
    if (!filename || filename.contains(event.relatedTarget)) return;
    this.startPreview(filename.dataset.previewAsset);
  }

  onPreviewLeave(event) {
    const filename = event.target.closest?.("[data-preview-asset]");
    if (!filename || filename.contains(event.relatedTarget)) return;
    this.stopPreview();
  }

  startPreview(assetId) {
    if (this.previewAssetId === assetId) return;
    this.stopPreview();
    const asset = this.config.assets[assetId];
    if (!asset?.path) return;

    const preview = new Audio(new URL(`../${asset.path}`, import.meta.url));
    const masterVolume = this.config.mixerDefaults?.master?.volume ?? 1;
    const bus = asset.category === "music" ? "music" : asset.category === "ambience" ? "ambience" : "effects";
    preview.volume = Math.min(1, Math.max(0, masterVolume * (this.config.mixerDefaults?.[bus]?.volume ?? 1)));
    this.previewAudio = preview;
    this.previewAssetId = assetId;
    preview.play().catch(() => {
      if (this.previewAudio === preview) this.stopPreview();
    });
  }

  stopPreview() {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    }
    this.previewAudio = null;
    this.previewAssetId = null;
  }

  onChange(event) {
    if (event.target.matches("[data-area-select]")) {
      this.selectedAreaId = event.target.value;
      this.render();
      return;
    }
    const target = event.target.dataset.playbackMode;
    if (!target) return;
    const parts = target.split(":");
    if (parts[0] === "area") {
      const area = this.config.areas[parts[1]];
      const key = parts[2];
      area[key] ||= { assetId: "", volume: 1, loop: true, loopMode: "loop", fadeInMs: 800, fadeOutMs: 800 };
      area[key].loopMode = event.target.value;
      area[key].loop = event.target.value === "loop";
    } else {
      this.config.events[parts[1]].loopMode = event.target.value;
      this.config.events[parts[1]].loop = event.target.value === "loop";
    }
    this.dirty = true;
    if (!this.container.querySelector("header span")) this.render();
  }

  onInput(event) {
    const key = event.target.dataset.mixer;
    if (!key) return;
    const volume = Number(event.target.value);
    if (key === "sfx") {
      for (const bus of ["ambience", "effects", "dialogue", "ui"]) {
        this.config.mixerDefaults[bus].volume = volume;
        audioRuntime.setBusVolume(bus, volume);
      }
    } else {
      this.config.mixerDefaults[key].volume = volume;
      audioRuntime.setBusVolume(key, volume);
    }
    this.dirty = true;
    const output = this.container.querySelector(`[data-mixer-output="${key}"]`);
    if (output) output.textContent = `${Math.round(volume * 100)}%`;
    if (!this.container.querySelector("header span")) this.render();
  }

  async upload(target) {
    const result = await window.api?.importAudioAsset?.();
    if (!result?.ok) {
      if (!result?.canceled) this.setMessage(result?.error || "Audio upload failed.");
      return;
    }

    const assetId = this.uniqueAssetId(result.name);
    const category = target.endsWith(":music") ? "music" : target.endsWith(":ambience") ? "ambience" : this.eventCategory(target);
    this.config.assets[assetId] = { id: assetId, name: result.name, path: result.path, category };

    const parts = target.split(":");
    if (parts[0] === "area") {
      const area = this.config.areas[parts[1]];
      const key = parts[2];
      area[key] = {
        assetId,
        volume: area[key]?.volume ?? 1,
        loop: area[key]?.loop ?? true,
        loopMode: area[key]?.loopMode || "loop",
        fadeInMs: area[key]?.fadeInMs ?? 800,
        fadeOutMs: area[key]?.fadeOutMs ?? 800
      };
    } else {
      this.config.events[parts[1]].variants = [assetId];
    }

    this.dirty = true;
    this.message = `${result.name} uploaded. Save to keep this assignment.`;
    this.render();
  }

  clearUpload(target) {
    const parts = target.split(":");
    let assetId = "";
    if (parts[0] === "area") {
      const area = this.config.areas[parts[1]];
      const key = parts[2];
      assetId = area?.[key]?.assetId || "";
      if (area?.[key]) area[key].assetId = "";
    } else {
      const event = this.config.events[parts[1]];
      assetId = event?.variants?.[0] || "";
      if (event) event.variants = [];
    }
    if (!assetId) return;
    if (!this.assetIsAssigned(assetId)) delete this.config.assets[assetId];
    this.dirty = true;
    this.message = "Audio assignment cleared. Save to keep this change.";
    this.render();
  }

  assetIsAssigned(assetId) {
    return Object.values(this.config.areas).some((area) =>
      area.music?.assetId === assetId || area.ambience?.assetId === assetId
    ) || Object.values(this.config.events).some((event) => event.variants?.includes(assetId));
  }

  eventCategory(target) {
    const event = this.config.events[target.split(":")[1]];
    return event?.bus || "effects";
  }

  uniqueAssetId(name) {
    const base = String(name || "audio").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase() || "AUDIO";
    let id = base;
    let number = 2;
    while (this.config.assets[id]) id = `${base}_${number++}`;
    return id;
  }

  async save() {
    const normalized = normalizeAudioConfig(this.config);
    const errors = validateAudioConfig(normalized);
    if (errors.length) {
      this.setMessage(errors[0]);
      return;
    }

    const result = await window.api?.saveAudioConfig?.(normalized);
    if (!result?.ok) {
      this.setMessage(result?.error || "Audio settings could not be saved.");
      return;
    }

    this.config = normalized;
    audioRuntime.configure(normalized);
    this.dirty = false;
    this.message = "Audio saved.";
    this.render();
  }

  setMessage(message) {
    this.message = message;
    const output = this.container?.querySelector("footer output");
    if (output) output.textContent = message;
  }

  close() {
    if (this.dirty && !confirm("Discard unsaved audio changes?")) return;
    this.stopPreview();
    if (this.params.standalone) {
      window.close();
      return;
    }
    routeTo({ toScene: this.params.fromScene || "mainMenu", fromScene: "audioManager", reason: "audio_manager_closed" });
  }

  cleanup() {
    this.stopPreview();
    this.container?.remove();
    this.container = null;
  }
}

const styles = `
  .simple-audio-manager { position:absolute; inset:0; z-index:45; display:grid; grid-template-rows:auto auto 1fr auto; background:#071011; color:#b8cfca; font:14px system-ui; }
  .simple-audio-manager * { box-sizing:border-box; }
  .simple-audio-manager header { display:flex; align-items:center; justify-content:space-between; padding:22px 30px; border-bottom:1px solid #29423d; -webkit-app-region:drag; user-select:none; }
  .simple-audio-manager header div { display:flex; align-items:center; gap:10px; }
  .simple-audio-manager header button { -webkit-app-region:no-drag; }
  .simple-audio-manager h1, .simple-audio-manager h2 { margin:0; color:#d9e6e1; }
  .simple-audio-manager h1 { font-size:26px; }
  .simple-audio-manager h2 { font-size:19px; }
  .simple-audio-manager p { margin:7px 0 18px; color:#7f9993; }
  .simple-audio-manager nav { display:flex; gap:8px; padding:0 30px; border-bottom:1px solid #29423d; }
  .simple-audio-manager nav button { border:0; border-bottom:2px solid transparent; background:transparent; padding:12px 14px; }
  .simple-audio-manager nav button.active { border-bottom-color:#7dac9f; color:#fff; }
  .simple-audio-manager main { overflow:auto; padding:28px 30px 60px; }
  .simple-audio-manager .second-heading { margin-top:42px; }
  .simple-audio-manager .area-picker { display:grid; grid-template-columns:70px minmax(260px, 520px); align-items:center; gap:12px; margin:20px 0; }
  .simple-audio-manager select { width:100%; padding:9px 10px; border:1px solid #45645e; background:#0d1a19; color:#d5e5e0; font:inherit; }
  .simple-audio-manager .selected-area { padding:18px; border:1px solid #34514b; background:#0a1615; }
  .simple-audio-manager .selected-area h3 { margin:0 0 16px; color:#d9e6e1; }
  .simple-audio-manager .selected-area-fields { display:grid; grid-template-columns:1fr 1fr; gap:28px; }
  .simple-audio-manager .assignments { margin-top:42px; }
  .simple-audio-manager details { margin-top:10px; border:1px solid #29423d; }
  .simple-audio-manager summary { padding:12px 14px; color:#d3e2dd; cursor:pointer; }
  .simple-audio-manager summary span { margin-left:7px; color:#78918b; }
  .simple-audio-manager .assignment-row { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:12px 14px; border-top:1px solid #29423d; }
  .simple-audio-manager .assignment-row div { display:flex; flex-direction:column; gap:4px; }
  .simple-audio-manager .assignment-row span { color:#78918b; font-size:12px; }
  .simple-audio-manager .mixer-tab { max-width:760px; }
  .simple-audio-manager .mixer-row { display:grid; grid-template-columns:100px minmax(260px, 1fr) 60px; align-items:center; gap:18px; padding:18px 0; border-bottom:1px solid #29423d; }
  .simple-audio-manager .mixer-row input { width:100%; accent-color:#7dac9f; }
  .simple-audio-manager .mixer-row output { text-align:right; color:#d5e5e0; }
  .simple-audio-manager button { padding:8px 13px; border:1px solid #45645e; background:#10201f; color:#d5e5e0; font:inherit; cursor:pointer; }
  .simple-audio-manager button.primary { background:#557f77; color:#05100e; }
  .area-list, .sound-list { border-top:1px solid #29423d; }
  .area-row, .sound-row { display:grid; align-items:center; gap:20px; padding:15px 0; border-bottom:1px solid #29423d; }
  .area-row { grid-template-columns:minmax(180px, 1fr) minmax(280px, 1.3fr) minmax(280px, 1.3fr); }
  .sound-row { grid-template-columns:minmax(240px, .8fr) minmax(360px, 1.5fr); }
  .area-name { display:flex; flex-direction:column; gap:3px; }
  .area-name span { color:#78918b; font-size:12px; }
  .upload-field { display:grid; grid-template-columns:65px minmax(0, 1fr) auto auto 34px; align-items:center; gap:12px; }
  .field-label { color:#8ea7a1; }
  .file-name { overflow:hidden; color:#d0dfda; text-overflow:ellipsis; white-space:nowrap; }
  .playback-mode { min-width:140px; }
  .simple-audio-manager .clear-upload { width:34px; height:34px; padding:0; color:#d9aaa2; font-size:20px; line-height:1; }
  .simple-audio-manager .clear-upload:disabled { opacity:.25; cursor:default; }
  .simple-audio-manager footer { min-height:40px; padding:10px 30px; border-top:1px solid #29423d; color:#d5b78a; }
  @media (max-width:900px) { .area-row { grid-template-columns:1fr; } .sound-row { grid-template-columns:1fr 1.5fr; } .simple-audio-manager .selected-area-fields { grid-template-columns:1fr; } }
`;
