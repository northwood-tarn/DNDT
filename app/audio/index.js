import { AudioRuntime } from "./AudioRuntime.js";
import { loadAudioConfig } from "./audioConfig.js";

export const audioRuntime = new AudioRuntime();

export async function initialiseAudio() {
  audioRuntime.configure(await loadAudioConfig());
  const unlock = () => audioRuntime.unlock();
  document.addEventListener("pointerdown", unlock, { once: true, capture: true });
  document.addEventListener("keydown", unlock, { once: true, capture: true });
  window.addEventListener("dndt:settings-changed", (event) => audioRuntime.applyPlayerSettings(event.detail));
  window.__dndtAudio = audioRuntime;
  return audioRuntime;
}

export default audioRuntime;
