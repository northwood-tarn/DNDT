import test from "node:test";
import assert from "node:assert/strict";
import { AudioRuntime } from "../../app/audio/AudioRuntime.js";
import { normalizeAudioConfig, validateAudioConfig } from "../../app/audio/audioConfig.js";

class FakeAudio {
  constructor(src) { this.src = src; this.volume = 1; this.loop = false; this.playbackRate = 1; this.paused = true; this.listeners = {}; FakeAudio.all.push(this); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  async play() { this.paused = false; this.playCalls = (this.playCalls || 0) + 1; }
  pause() { this.paused = true; }
  removeAttribute() {}
  load() {}
}
FakeAudio.all = [];

const config = normalizeAudioConfig({
  assets: { M: { path: "assets/audio/m.mp3", category: "music" }, A: { path: "assets/audio/a.mp3", category: "ambience" }, E1: { path: "assets/audio/1.wav" }, E2: { path: "assets/audio/2.wav" }, D: { path: "assets/audio/d.ogg" } },
  areas: {
    one: { type: "exploration", music: { assetId: "M", volume: 0.5, loop: true }, ambience: { assetId: "A", volume: 0.5 }, dialogue: [{ id: "line", assetId: "D", volume: 1, duck: true }] },
    two: { type: "combat", music: { assetId: "M", volume: 0.8, loop: true }, ambience: null, dialogue: [] }
  },
  events: { HIT: { bus: "effects", variants: ["E1", "E2"], volume: 0.5, maxInstances: 1 } },
  mixerDefaults: { master: { volume: 1 }, music: { volume: 0.8 }, ambience: { volume: 1 }, effects: { volume: 1 }, dialogue: { volume: 1 }, ui: { volume: 1 } },
  ducking: { music: 0.25, ambience: 0.5, fadeDownMs: 0, restoreMs: 0 }
});

test("normalization preserves one area type and one ambience track", () => {
  assert.equal(config.areas.one.type, "exploration"); assert.equal(config.areas.two.type, "combat"); assert.equal(config.areas.one.ambience.assetId, "A"); assert.deepEqual(validateAudioConfig(config), []);
});

test("area playback unlocks, avoids duplicates, mixes and transitions", async () => {
  FakeAudio.all.length = 0; const runtime = new AudioRuntime({ AudioCtor: FakeAudio }); runtime.configure(config);
  await runtime.playAreaAudio("one"); assert.equal(FakeAudio.all.length, 2); assert.equal(FakeAudio.all[0].playCalls, undefined);
  runtime.unlock(); await Promise.resolve(); assert.equal(FakeAudio.all[0].playCalls, 1);
  await runtime.playAreaAudio("one"); assert.equal(FakeAudio.all.length, 2);
  runtime.setMasterVolume(0.5); assert.equal(runtime.active.music.element.volume, 0.2);
  await runtime.playAreaAudio("two"); assert.equal(runtime.instances.size, 1); assert.equal(runtime.areaId, "two");
});

test("dialogue ducks and restores active area buses", async () => {
  const runtime = new AudioRuntime({ AudioCtor: FakeAudio }); runtime.configure(config); runtime.unlock(); await runtime.playAreaAudio("one");
  const before = runtime.active.music.element.volume; runtime.playDialogue("line"); assert.equal(runtime.active.music.element.volume, before * 0.25);
  runtime.stopDialogue(); assert.equal(runtime.active.music.element.volume, before);
});

test("events choose variants safely and enforce concurrency", async () => {
  const runtime = new AudioRuntime({ AudioCtor: FakeAudio }); runtime.configure(config); runtime.unlock();
  const first = await runtime.playEvent("HIT"); assert.ok(["E1", "E2"].includes(first.assetId));
  assert.equal(await runtime.playEvent("HIT"), null); assert.equal(await runtime.playEvent("UNKNOWN"), null);
  runtime.stopAllAudio(); assert.equal(runtime.instances.size, 0);
});

test("legacy single-asset events migrate and unsafe asset paths are rejected", () => {
  const migrated = normalizeAudioConfig({ assets: { BAD: { path: "../outside.mp3" } }, events: { OLD: { assetId: "BAD" } } });
  assert.deepEqual(migrated.events.OLD.variants, ["BAD"]);
  assert.ok(validateAudioConfig(migrated).some((error) => error.includes("unsafe asset path")));
});

test("infrequent playback waits 30 to 90 seconds before replaying", async () => {
  const runtime = new AudioRuntime({ AudioCtor: FakeAudio }); runtime.configure(config); runtime.unlock();
  const instance = runtime.createInstance("E1", "effects", 1, { loopMode: "infrequent" });
  await runtime.safePlay(instance);
  const originalSetTimeout = globalThis.setTimeout;
  let delay = 0, replay = null;
  globalThis.setTimeout = (fn, ms) => { replay = fn; delay = ms; return 1; };
  try {
    instance.element.listeners.ended();
    assert.ok(delay >= 30000 && delay <= 90000);
    await replay();
    assert.equal(instance.element.playCalls, 2);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    runtime.stopAllAudio();
  }
});
