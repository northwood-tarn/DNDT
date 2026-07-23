import { initialiseAudio } from "../../app/audio/index.js";
import AudioManagerScene from "../../app/scenes/AudioManagerScene.js";

await initialiseAudio();
new AudioManagerScene().start({ standalone: true });
