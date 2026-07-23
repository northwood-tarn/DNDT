import { BUS_NAMES, normalizeAudioConfig } from "./audioConfig.js";

const PLAYER_SETTINGS_KEY = "dndt.settings";
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export class AudioRuntime {
  constructor({ AudioCtor = globalThis.Audio } = {}) {
    this.AudioCtor = AudioCtor;
    this.config = normalizeAudioConfig();
    this.buses = structuredClone(this.config.mixerDefaults);
    this.active = { music: null, ambience: null, dialogue: null };
    this.instances = new Set();
    this.eventInstances = new Map();
    this.eventTimes = new Map();
    this.areaId = null;
    this.unlocked = false;
    this.transitionToken = 0;
    this.duckToken = 0;
    this.duckFactors = { music: 1, ambience: 1 };
    this.warned = new Set();
  }

  configure(config) {
    this.stopAllAudio();
    this.config = normalizeAudioConfig(config);
    this.buses = structuredClone(this.config.mixerDefaults);
    this.applyPlayerSettings();
    this.refreshVolumes();
    return this.config;
  }

  applyPlayerSettings(settings = null) {
    if (!settings && typeof localStorage !== "undefined") {
      try { settings = JSON.parse(localStorage.getItem(PLAYER_SETTINGS_KEY) || "{}"); } catch { settings = {}; }
    }
    settings ||= {};
    for (const bus of BUS_NAMES) {
      const source = settings.audioBuses?.[bus];
      if (source) this.buses[bus] = { volume: clamp(source.volume), muted: source.muted === true };
    }
    // Compatibility with the existing three sliders.
    if (Number.isFinite(settings.master) && !settings.audioBuses?.master) this.buses.master.volume = clamp(settings.master);
    if (Number.isFinite(settings.music) && !settings.audioBuses?.music) this.buses.music.volume = clamp(settings.music);
    if (Number.isFinite(settings.effects)) {
      for (const bus of ["ambience", "effects", "dialogue", "ui"]) if (!settings.audioBuses?.[bus]) this.buses[bus].volume = clamp(settings.effects);
    }
    this.refreshVolumes();
  }

  unlock() {
    this.unlocked = true;
    for (const instance of this.instances) if (instance.pending) this.safePlay(instance);
    return true;
  }

  setBusVolume(bus, value) { if (!this.buses[bus]) return; this.buses[bus].volume = clamp(value); this.refreshVolumes(); }
  setMasterVolume(value) { this.setBusVolume("master", value); }
  muteBus(bus, muted) { if (!this.buses[bus]) return; this.buses[bus].muted = muted === true; this.refreshVolumes(); }
  getMixerState() { return structuredClone(this.buses); }

  async transitionToArea(areaId) { return this.playAreaAudio(areaId); }
  async playAreaAudio(areaId) {
    const profile = this.config.areas[areaId];
    if (!profile) { this.warnOnce(`area:${areaId}`, `Unknown or unassigned audio area: ${areaId}`); return false; }
    if (areaId === this.areaId && this.matchesTrack("music", profile.music) && this.matchesTrack("ambience", profile.ambience)) return true;
    const token = ++this.transitionToken;
    this.areaId = areaId;
    await Promise.all([this.transitionTrack("music", profile.music, token), this.transitionTrack("ambience", profile.ambience, token)]);
    return token === this.transitionToken;
  }

  async stopAreaAudio() {
    ++this.transitionToken; this.areaId = null;
    await Promise.all([this.stopTrack("music"), this.stopTrack("ambience")]);
  }

  async transitionTrack(bus, track, token) {
    if (this.matchesTrack(bus, track)) return;
    const old = this.active[bus];
    const next = track ? this.createInstance(track.assetId, bus, track.volume, { loopMode: track.loopMode, fadeInMs: track.fadeInMs, fadeOutMs: track.fadeOutMs }) : null;
    this.active[bus] = next;

    if (next) {
      next.fadeFactor = next.fadeInMs ? 0 : 1;
      this.refreshInstance(next);
      this.safePlay(next);
    }

    const outgoing = old
      ? this.fade(old, 0, old.fadeOutMs).then(() => this.dispose(old))
      : Promise.resolve();
    const incoming = next?.fadeInMs
      ? this.fade(next, 1, next.fadeInMs)
      : Promise.resolve();

    await Promise.all([outgoing, incoming]);
  }

  matchesTrack(bus, track) { return (!track && !this.active[bus]) || Boolean(track && this.active[bus]?.assetId === track.assetId && !this.active[bus].disposed); }

  async playEvent(eventId, options = {}) {
    const event = this.config.events[eventId];
    if (!event?.variants?.length) { this.warnOnce(`event:${eventId}`, `Audio event has no assigned variants: ${eventId}`); return null; }
    const now = Date.now();
    if (now - (this.eventTimes.get(eventId) || 0) < event.cooldownMs) return null;
    const running = [...(this.eventInstances.get(eventId) || [])].filter((item) => !item.disposed);
    if (running.length >= event.maxInstances) return null;
    const assetId = event.variants[Math.floor(Math.random() * event.variants.length)];
    const instance = this.createInstance(assetId, event.bus, options.volume ?? event.volume, { eventId, loopMode: options.loopMode || event.loopMode });
    if (!instance) return null;
    const min = event.playbackRateMin || 1, max = event.playbackRateMax || min;
    instance.element.playbackRate = min + Math.random() * Math.max(0, max - min);
    this.eventTimes.set(eventId, now);
    this.eventInstances.set(eventId, new Set([...running, instance]));
    this.safePlay(instance);
    return instance;
  }

  playDialogue(dialogueId, options = {}) {
    const profile = this.config.areas[options.areaId || this.areaId];
    const clip = profile?.dialogue?.find((entry) => entry.id === dialogueId);
    if (!clip?.assetId) { this.warnOnce(`dialogue:${dialogueId}`, `Dialogue clip is unassigned: ${dialogueId}`); return null; }
    if ((options.interrupt ?? clip.interrupt) && this.active.dialogue) this.stopDialogue();
    if (this.active.dialogue && !(options.interrupt ?? clip.interrupt)) return null;
    const instance = this.createInstance(clip.assetId, "dialogue", options.volume ?? clip.volume, { dialogue: true, duck: options.duck ?? clip.duck });
    this.active.dialogue = instance;
    if (instance?.duck) this.setDucking(true);
    this.safePlay(instance);
    return instance;
  }

  stopDialogue() { this.dispose(this.active.dialogue); this.active.dialogue = null; this.setDucking(false); }
  stopBus(bus) { for (const item of [...this.instances]) if (item.bus === bus) this.dispose(item); if (this.active[bus]) this.active[bus] = null; }
  stopAllAudio() { ++this.transitionToken; for (const item of [...this.instances]) this.dispose(item); this.active = { music: null, ambience: null, dialogue: null }; this.areaId = null; }

  createInstance(assetId, bus, volume = 1, options = {}) {
    const asset = this.config.assets[assetId];
    if (!asset?.path || !this.AudioCtor) { this.warnOnce(`asset:${assetId}`, `Missing audio asset: ${assetId}`); return null; }
    try {
      const element = new this.AudioCtor(new URL(`../${asset.path}`, import.meta.url).toString());
      const instance = { element, assetId, bus, sourceVolume: clamp(volume), fadeFactor: 1, fadeInMs: options.fadeInMs || 0, fadeOutMs: options.fadeOutMs || 0, eventId: options.eventId, duck: options.duck, loopMode: options.loopMode || "none", replayTimer: null, pending: !this.unlocked, disposed: false, fadeToken: 0 };
      element.loop = instance.loopMode === "loop";
      element.addEventListener?.("ended", () => {
        globalThis.window?.dispatchEvent?.(new CustomEvent("dndt:audio-ended", { detail: { assetId, bus } }));
        if (instance.loopMode === "infrequent" && !instance.disposed) {
          const delay = 30000 + Math.floor(Math.random() * 60001);
          instance.replayTimer = setTimeout(() => {
            if (instance.disposed) return;
            instance.element.currentTime = 0;
            this.safePlay(instance);
          }, delay);
          return;
        }
        this.dispose(instance);
      });
      element.addEventListener?.("error", () => this.warnOnce(`play:${assetId}`, `Unable to play audio asset: ${assetId}`), { once: true });
      this.instances.add(instance); this.refreshInstance(instance); return instance;
    } catch (error) { this.warnOnce(`asset:${assetId}`, `Unable to create audio asset ${assetId}: ${error.message}`); return null; }
  }

  async safePlay(instance) {
    if (!instance || instance.disposed) return false;
    if (!this.unlocked) { instance.pending = true; return false; }
    instance.pending = false;
    try { await instance.element.play(); return true; } catch (error) { this.warnOnce(`play:${instance.assetId}`, `Playback failed for ${instance.assetId}: ${error.message}`); return false; }
  }

  effectiveVolume(instance) {
    const master = this.buses.master, bus = this.buses[instance.bus] || this.buses.effects;
    if (master.muted || bus.muted) return 0;
    let duck = 1;
    if (["music", "ambience"].includes(instance.bus)) duck = this.duckFactors[instance.bus];
    return clamp(instance.sourceVolume * instance.fadeFactor * master.volume * bus.volume * duck);
  }

  refreshVolumes() { for (const item of this.instances) this.refreshInstance(item); }
  refreshInstance(instance) { if (instance && !instance.disposed) instance.element.volume = this.effectiveVolume(instance); }

  fade(instance, target, duration, targetIsSource = false) {
    if (!instance || instance.disposed || !duration) { if (instance) { instance.fadeFactor = targetIsSource ? 1 : target; this.refreshInstance(instance); } return Promise.resolve(); }
    const token = ++instance.fadeToken, start = performance.now(), from = instance.fadeFactor, to = targetIsSource ? 1 : target;
    return new Promise((resolve) => {
      const step = (now) => {
        if (instance.disposed || token !== instance.fadeToken) return resolve();
        const progress = Math.min(1, (now - start) / duration); instance.fadeFactor = from + (to - from) * progress; this.refreshInstance(instance);
        if (progress < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  async stopTrack(bus) { const item = this.active[bus]; if (!item) return; await this.fade(item, 0, item.fadeOutMs); this.dispose(item); if (this.active[bus] === item) this.active[bus] = null; }

  dispose(instance) {
    if (!instance || instance.disposed) return;
    instance.disposed = true; instance.fadeToken++;
    if (instance.replayTimer) clearTimeout(instance.replayTimer);
    try { instance.element.pause(); instance.element.removeAttribute?.("src"); instance.element.load?.(); } catch {}
    this.instances.delete(instance);
    if (instance.eventId) this.eventInstances.get(instance.eventId)?.delete(instance);
    if (this.active.dialogue === instance) { this.active.dialogue = null; this.setDucking(false); }
  }

  setDucking(active) {
    const token = ++this.duckToken;
    const duration = active ? this.config.ducking.fadeDownMs : this.config.ducking.restoreMs;
    const from = { ...this.duckFactors };
    const to = active ? { music: this.config.ducking.music, ambience: this.config.ducking.ambience } : { music: 1, ambience: 1 };
    if (!duration || typeof requestAnimationFrame !== "function") { this.duckFactors = to; this.refreshVolumes(); return; }
    const start = performance.now();
    const step = (now) => {
      if (token !== this.duckToken) return;
      const progress = Math.min(1, (now - start) / duration);
      for (const bus of ["music", "ambience"]) this.duckFactors[bus] = from[bus] + (to[bus] - from[bus]) * progress;
      this.refreshVolumes();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  warnOnce(key, message) { if (this.warned.has(key)) return; this.warned.add(key); console.warn(`[audio] ${message}`); }
}
