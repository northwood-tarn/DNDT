// app/ui/sfx.js
// WebAudio: melancholic minor intro + subtle low click, with gentle reverb + pad.
// Exports:
//   - playTheme(opts)                 -> always plays (used for Title screen each time)
//   - playThemeOnce(opts)             -> guarded one-shot
//   - playThemeAndWait(opts) : Promise  resolves after THEME_MS (for modals)
//   - resetThemeOnce()                -> clears one-shot guard
//   - wireButtonClickSfx(root)        -> subtle low click on buttons
//   - primeAudio()                    -> resume AudioContext on first gesture
//   - THEME_MS                        -> current theme duration in ms

export const THEME_MS = 5200;

let ctx;
let themePlayed = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function primeAudio() {
  document.addEventListener('pointerdown', resumeOnce, { once: true });
  document.addEventListener('keydown', resumeOnce, { once: true });
}
function resumeOnce() { try { getCtx().resume(); } catch {} }

// --- Small helper DSP ---
function makeReverb(seconds=1.6, decay=2.5, reverse=false) {
  const ac = getCtx();
  const rate = ac.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ac.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
  }
  const convolver = ac.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

function env(gainNode, start, a=0.02, d=0.25, s=0.0005) {
  const g = gainNode.gain;
  g.cancelScheduledValues(0);
  g.setValueAtTime(0.00012, start);
  g.exponentialRampToValueAtTime(0.22, start + a);
  g.exponentialRampToValueAtTime(s, start + a + d);
}

function tone({freq=220, start=0, dur=0.5, type='triangle', vol=0.11, slide=0, sendReverb=true}) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const dry = ac.createGain();
  const wet = ac.createGain();
  const mix = ac.createGain();
  const rev = makeReverb(1.8, 2.2, false);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq*slide), ac.currentTime + start + dur*0.9);
  }

  dry.gain.value = vol;
  wet.gain.value = sendReverb ? vol * 0.35 : 0.0; // subtle reverb
  mix.gain.value = 1.0;

  osc.connect(dry);
  osc.connect(wet);
  wet.connect(rev);
  rev.connect(mix);
  dry.connect(mix);
  mix.connect(ac.destination);

  env(dry, ac.currentTime + start, 0.02, dur*0.85, 0.0004);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.06);
}

function lowClick() {
  // single, subtle, low-frequency tick
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, ac.currentTime);
  gain.gain.value = 0.045; // quiet
  osc.connect(gain).connect(ac.destination);
  const g = gain.gain;
  const t0 = ac.currentTime;
  g.setValueAtTime(0.045, t0);
  g.exponentialRampToValueAtTime(0.00035, t0 + 0.06);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

export function playClick() { lowClick(); }

export function wireButtonClickSfx(root=document) {
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'BUTTON' || t.closest('button'))) {
      playClick();
    }
  });
}

// --- Title motif (≈5.2s), with a quiet pad underneath ---
function scheduleTheme(opts={}) {
  const ac = getCtx();
  const base = 196; // G3 base (G minor)
  function n(semi){ return base * Math.pow(2, semi/12); }
  let t = 0;

  // held pad: root + fifth + minor third, very soft, slight detune
  const padDur = THEME_MS / 1000;
  tone({ freq: base,    start: 0.0, dur: padDur, type: 'triangle', vol: 0.03, sendReverb:true });
  tone({ freq: base*1.5, start: 0.0, dur: padDur, type: 'sine',     vol: 0.025, sendReverb:true });
  tone({ freq: n(3),     start: 0.0, dur: padDur, type: 'triangle', vol: 0.02, sendReverb:true });

  // lead notes (slow, sparse)
  const notes = [
    [n(0), 0.9],  // G
    [n(5), 0.6],  // C
    [n(8), 0.6],  // D#
    [n(7), 0.8],  // D
    [n(3), 0.9],  // A#
  ];
  for (let i=0;i<notes.length;i++) {
    const [f, dur] = notes[i];
    tone({ freq: f, start: t, dur, type: 'triangle', vol: 0.10, sendReverb:true });
    if (i % 2 === 1) {
      // a quiet ornament an octave above, drifting down
      tone({ freq: f*2, start: t+0.03, dur: dur*0.55, type: 'sine', vol: 0.028, slide: 0.5, sendReverb:true });
    }
    t += dur * 0.9;
  }
  // small tail
  tone({ freq: base, start: t, dur: 0.7, type: 'triangle', vol: 0.065, sendReverb:true });
}

export function playTheme(opts={}) { scheduleTheme(opts); }
export function playThemeOnce(opts={}) {
  if (themePlayed) return;
  themePlayed = true;
  scheduleTheme(opts);
}
export function playThemeAndWait(opts={}) {
  scheduleTheme(opts);
  return new Promise(res => setTimeout(res, THEME_MS));
}
export function resetThemeOnce(){ themePlayed = false; }

// global hook for other modules (cog)
try { window.__playUiClick = playClick; } catch {}
primeAudio();
