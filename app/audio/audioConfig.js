export const AUDIO_CONFIG_PATH = "app/data/audio-config.json";
export const BUS_NAMES = Object.freeze(["master", "music", "ambience", "effects", "dialogue", "ui"]);
export const AUDIO_EXTENSIONS = Object.freeze([".mp3", ".ogg", ".wav", ".m4a"]);

const BUS_DEFAULTS = Object.freeze(Object.fromEntries(BUS_NAMES.map((name) => [name, { volume: 1, muted: false }])));
const DUCK_DEFAULTS = Object.freeze({ music: 0.35, ambience: 0.45, fadeDownMs: 180, restoreMs: 350 });

const clamp = (value, fallback = 1) => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : fallback));

export function normalizeAudioConfig(raw = {}) {
  const assets = raw.assets && typeof raw.assets === "object" ? raw.assets : {};
  const areas = raw.areas && typeof raw.areas === "object" ? raw.areas : {};
  const events = raw.events && typeof raw.events === "object" ? raw.events : {};
  const mixerDefaults = {};
  for (const bus of BUS_NAMES) {
    mixerDefaults[bus] = {
      volume: clamp(raw.mixerDefaults?.[bus]?.volume, BUS_DEFAULTS[bus].volume),
      muted: raw.mixerDefaults?.[bus]?.muted === true
    };
  }
  return {
    ...raw,
    audioConfigVersion: 1,
    assets: Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, { id, name: asset?.name || id, path: asset?.path || "", category: asset?.category || "effects" }])),
    areas: Object.fromEntries(Object.entries(areas).map(([id, profile]) => [id, normalizeArea(id, profile)])),
    events: Object.fromEntries(Object.entries(events).map(([id, event]) => [id, normalizeEvent(id, event)])),
    mixerDefaults,
    ducking: {
      music: clamp(raw.ducking?.music, DUCK_DEFAULTS.music), ambience: clamp(raw.ducking?.ambience, DUCK_DEFAULTS.ambience),
      fadeDownMs: Math.max(0, Number(raw.ducking?.fadeDownMs ?? DUCK_DEFAULTS.fadeDownMs)),
      restoreMs: Math.max(0, Number(raw.ducking?.restoreMs ?? DUCK_DEFAULTS.restoreMs))
    }
  };
}

function normalizeTrack(track, loopDefault = true) {
  if (!track?.assetId) return null;
  const loopMode = normalizeLoopMode(track.loopMode, track.loop ?? loopDefault);
  return { assetId: String(track.assetId), volume: clamp(track.volume), loop: loopMode === "loop", loopMode, fadeInMs: Math.max(0, Number(track.fadeInMs) || 0), fadeOutMs: Math.max(0, Number(track.fadeOutMs) || 0) };
}

function normalizeArea(id, profile = {}) {
  return {
    ...profile, id, name: profile.name || id, type: profile.type === "combat" ? "combat" : "exploration", placeholder: profile.placeholder === true,
    music: normalizeTrack(profile.music), ambience: normalizeTrack(profile.ambience),
    dialogue: Array.isArray(profile.dialogue) ? profile.dialogue.map((clip) => ({ ...clip, id: clip.id || "dialogue", name: clip.name || clip.id || "Dialogue", volume: clamp(clip.volume), interrupt: clip.interrupt !== false, duck: clip.duck !== false })) : []
  };
}

function normalizeEvent(id, event = {}) {
  return {
    ...event, id, name: event.name || id, category: event.category || "Custom", bus: BUS_NAMES.includes(event.bus) && event.bus !== "master" ? event.bus : "effects",
    variants: Array.isArray(event.variants) ? event.variants.filter(Boolean) : (event.assetId ? [event.assetId] : []),
    loopMode: normalizeLoopMode(event.loopMode, event.loop === true),
    loop: normalizeLoopMode(event.loopMode, event.loop === true) === "loop",
    volume: clamp(event.volume), playbackRateMin: clampRate(event.playbackRateMin), playbackRateMax: clampRate(event.playbackRateMax),
    cooldownMs: Math.max(0, Number(event.cooldownMs) || 0), maxInstances: Math.max(1, Number(event.maxInstances) || 4)
  };
}

function clampRate(value) { return Math.max(0.5, Math.min(2, Number(value) || 1)); }
function normalizeLoopMode(value, loops) { return ["none", "loop", "infrequent"].includes(value) ? value : loops ? "loop" : "none"; }

export function validateAudioConfig(config) {
  const errors = [];
  for (const [id, asset] of Object.entries(config.assets || {})) {
    const extension = asset.path.slice(asset.path.lastIndexOf(".")).toLowerCase();
    if (!asset.path.startsWith("assets/audio/") || asset.path.includes("..")) errors.push(`${id} has an unsafe asset path`);
    if (!AUDIO_EXTENSIONS.includes(extension)) errors.push(`${id} uses unsupported format ${extension || "(none)"}`);
  }
  for (const [id, area] of Object.entries(config.areas || {})) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) errors.push(`Invalid area ID: ${id}`);
    if (!["exploration", "combat"].includes(area.type)) errors.push(`Invalid area type: ${id}`);
    for (const ref of [area.music?.assetId, area.ambience?.assetId, ...(area.dialogue || []).map((d) => d.assetId)]) if (ref && !config.assets?.[ref]) errors.push(`${id} references missing asset ${ref}`);
  }
  for (const [id, event] of Object.entries(config.events || {})) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(id)) errors.push(`Invalid event ID: ${id}`);
    for (const ref of event.variants || []) if (!config.assets?.[ref]) errors.push(`${id} references missing asset ${ref}`);
  }
  return errors;
}

export async function loadAudioConfig() {
  try {
    const text = window.api?.readTextFile ? await window.api.readTextFile(AUDIO_CONFIG_PATH) : await fetch("./data/audio-config.json").then((response) => response.text());
    return normalizeAudioConfig(JSON.parse(text));
  } catch (error) {
    console.warn("[audio] Failed to load audio configuration:", error);
    return normalizeAudioConfig();
  }
}
