const STYLE_ID = "credits-scene-style";

const CREDIT_PAGES = [
  {
    title: "Fight for the Light",
    lines: ["Dungeons & Dragons", "Fight for the Light", "A DNDT production"],
  },
  {
    title: "Direction & Writing",
    lines: ["Creative Director · Elian Voss", "Lead Writer · Mara Bell", "Additional Writing · Rowan Vale", "Script Editor · Isolde March"],
  },
  {
    title: "Game Design",
    lines: ["Systems Design · Tamsin Grey", "Narrative Design · Corren Ash", "Encounter Design · Aster Pike", "Progression Design · Nia Vell"],
  },
  {
    title: "Engineering",
    lines: ["Technical Director · Oren Wren", "Gameplay Engineering · Sel Marr", "Tools & Pipeline · Lio Fen", "Save Systems · Ada Rook"],
  },
  {
    title: "Visual Design",
    lines: ["Art Direction · Seren Holt", "Interface Design · Ilya North", "Environment Art · Thea Moss", "Character Art · Bram Cinder"],
  },
  {
    title: "World & Narrative",
    lines: ["Greyharbour · Mira Low", "The Necropolis · Orrin Chalk", "The Backlands · Fen Ardent", "The Untended Graves · Edda Rain"],
  },
  {
    title: "Music & Sound",
    lines: ["Original Score · Silas Mere", "Sound Design · Anwen Tide", "Field Recording · Cael Storm", "Audio Implementation · Juniper Wake"],
  },
  {
    title: "Quality Assurance",
    lines: ["QA Lead · Rhea Flint", "Systems Testing · Tomas Reed", "Narrative Testing · Linn Shore", "Accessibility Review · Mae Winter"],
  },
  {
    title: "Special Thanks",
    lines: ["Our players and playtesters", "The storytellers who kept the embers lit", "The friends who walked the long road", "And everyone who chose to fight for the light"],
  },
  {
    title: "In Memory",
    lines: ["For those whose voices remain with us", "in rain, in flame, and in the dark between roads.", "", "The light remains."],
  },
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "DNDT Source Sans";
      src: url("./assets/fonts/source_sans_3/SourceSans3-Variable.ttf") format("truetype");
      font-weight: 200 900;
      font-display: block;
    }
    @font-face {
      font-family: "Pixel Takhisis";
      src: url("./assets/fonts/pixel_takhisis/Pixel Takhisis.otf") format("opentype");
      font-display: swap;
    }

    .credits-scene {
      position: absolute;
      inset: 0;
      z-index: 25;
      overflow: hidden;
      color: rgba(182, 202, 198, 0.64);
      background: rgba(1, 13, 15, 0.22);
      font-family: "DNDT Source Sans", var(--font-ui);
      -webkit-app-region: drag;
    }

    .credits-roll {
      width: min(680px, 72vw);
      margin: 0 auto;
      animation: credits-scroll 105s linear 7.5s both;
      will-change: transform;
    }

    @keyframes credits-scroll {
      from { transform: translateY(100vh); }
      to { transform: translateY(-100%); }
    }

    .credits-page {
      height: 55vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .credits-opening {
      position: fixed;
      inset: 0;
      z-index: 2;
      display: grid;
      place-items: center;
      pointer-events: none;
      animation: credits-opening 7.5s ease forwards;
    }
    .credits-opening-title {
      margin: 0;
      color: rgba(137, 174, 168, 0.68);
      font-size: clamp(30px, 3.5vw, 46px);
      font-weight: 300;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    @keyframes credits-opening {
      0%, 66.666% { opacity: 1; }
      100% { opacity: 0; visibility: hidden; }
    }

    .credits-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      width: 100%;
      margin: 0 0 54px;
      color: rgba(137, 174, 168, 0.62);
      font-size: clamp(27px, 3vw, 40px);
      font-weight: 300;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .credits-title::before,
    .credits-title::after {
      content: "";
      width: clamp(54px, 8vw, 112px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(112, 157, 150, 0.42));
    }
    .credits-title::after { transform: scaleX(-1); }

    .credits-line {
      min-height: 1.5em;
      margin: 8px 0;
      font-size: clamp(15px, 1.5vw, 19px);
      font-weight: 330;
      letter-spacing: 0.045em;
      line-height: 1.5;
    }

    .credits-ending {
      position: fixed;
      inset: 0;
      z-index: 3;
      width: 100vw;
      height: 100vh;
      display: grid;
      place-items: center;
      text-align: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 1.6s ease;
    }
    .credits-ending.is-held {
      opacity: 1;
      visibility: visible;
    }
    .credits-ending-message {
      width: min(880px, 82vw);
      margin: 0;
      color: rgba(137, 174, 168, 0.72);
      font: 18px/1.65 "Pixel Takhisis", fantasy;
      letter-spacing: 0.035em;
      text-align: center;
    }

    .credits-confirm {
      position: fixed;
      inset: 0;
      z-index: 31000;
      display: grid;
      place-items: center;
      background: rgba(1, 10, 12, 0.34);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      -webkit-app-region: no-drag;
    }
    .credits-confirm[hidden] { display: none; }
    .credits-confirm-content { text-align: center; }
    .credits-confirm-message {
      margin: 0 0 30px;
      color: rgba(174, 199, 194, 0.72);
      font-size: 18px;
      font-weight: 350;
      letter-spacing: 0.045em;
    }
    .credits-confirm-actions { display: flex; justify-content: center; gap: 30px; }
    .credits-confirm button {
      appearance: none;
      min-width: 74px;
      padding: 7px 12px;
      border: 1px solid transparent;
      border-radius: 0;
      background: transparent;
      color: rgba(137, 174, 168, 0.68);
      font: 14px/1.2 "DNDT Source Sans", var(--font-ui);
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .credits-confirm button:hover,
    .credits-confirm button:focus-visible {
      border-color: rgba(137, 174, 168, 0.68);
      outline: none;
      background: rgba(137, 174, 168, 0.68);
      color: #020809;
    }
  `;
  document.head.appendChild(style);
}

export default class CreditsScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.container = null;
    this.audio = null;
    this._onMenuRequest = null;
  }

  start() {
    ensureStyles();
    this.build();
    this.startMusic();
  }

  build() {
    if (!this.root) return;
    this.container = document.createElement("section");
    this.container.className = "credits-scene";
    this.container.innerHTML = `
      <div class="credits-opening">
        <h1 class="credits-opening-title">Credits</h1>
      </div>
      <div class="credits-roll">
        ${CREDIT_PAGES.map((page) => `
          <article class="credits-page">
            <h1 class="credits-title">${page.title}</h1>
            ${page.lines.map((line) => `<p class="credits-line">${line}</p>`).join("")}
          </article>
        `).join("")}
      </div>
      <section class="credits-ending">
        <p class="credits-ending-message">Thanks for playing Dungeons &amp; Dragons - Fight for the Light. But our heroes will return ...</p>
      </section>
      <div class="credits-confirm" role="dialog" aria-modal="true" aria-label="Exit credits" hidden>
        <div class="credits-confirm-content">
          <p class="credits-confirm-message">Are you sure you want to exit?</p>
          <div class="credits-confirm-actions">
            <button type="button" data-confirm="yes">Yes</button>
            <button type="button" data-confirm="no">No</button>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(this.container);

    const roll = this.container.querySelector(".credits-roll");
    roll?.addEventListener("animationend", (event) => {
      if (event.animationName !== "credits-scroll") return;
      const ending = this.container.querySelector(".credits-ending");
      if (!ending) return;
      ending.classList.add("is-held");
    }, { once: true });

    const confirmation = this.container.querySelector(".credits-confirm");
    const showConfirmation = () => {
      if (!confirmation.hidden) return;
      confirmation.hidden = false;
      window.requestAnimationFrame(() => confirmation.querySelector('[data-confirm="no"]')?.focus());
    };
    const hideConfirmation = () => { confirmation.hidden = true; };

    this._onMenuRequest = (event) => {
      event.preventDefault();
      showConfirmation();
    };
    window.addEventListener("dndt:system-menu-request", this._onMenuRequest);

    confirmation.querySelector('[data-confirm="no"]')?.addEventListener("click", hideConfirmation);
    confirmation.querySelector('[data-confirm="yes"]')?.addEventListener("click", () => {
      hideConfirmation();
      window.dispatchEvent(new CustomEvent("dndt:open-system-menu"));
    });
  }

  startMusic() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 4);
    filter.type = "lowpass";
    filter.frequency.value = 720;
    master.connect(filter).connect(context.destination);

    const chords = [
      { notes: [146.83, 174.61, 220.00], bass: 73.42, melody: [293.66, 261.63] },
      { notes: [116.54, 146.83, 174.61], bass: 58.27, melody: [233.08, 220.00] },
      { notes: [130.81, 164.81, 196.00], bass: 65.41, melody: [261.63, 293.66] },
      { notes: [98.00, 130.81, 164.81], bass: 49.00, melody: [220.00, 196.00] },
    ];
    let chordIndex = 0;

    const playChord = () => {
      if (context.state === "closed") return;
      const now = context.currentTime;
      const chord = chords[chordIndex];
      const padPeak = [0.045, 0.07, 0.052, 0.078][chordIndex];
      for (const frequency of chord.notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(padPeak, now + 2.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 10);
        oscillator.connect(gain).connect(master);
        oscillator.start(now);
        oscillator.stop(now + 10.1);
      }

      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = "triangle";
      bass.frequency.value = chord.bass;
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.065, now + 1.8);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 9.5);
      bass.connect(bassGain).connect(master);
      bass.start(now);
      bass.stop(now + 9.6);

      chord.melody.forEach((frequency, index) => {
        const voice = context.createOscillator();
        const voiceGain = context.createGain();
        const start = now + 2.2 + index * 2.8;
        voice.type = "sine";
        voice.frequency.value = frequency;
        voiceGain.gain.setValueAtTime(0.0001, start);
        voiceGain.gain.exponentialRampToValueAtTime(index === 0 ? 0.04 : 0.06, start + 0.8);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, start + 3.2);
        voice.connect(voiceGain).connect(master);
        voice.start(start);
        voice.stop(start + 3.3);
      });
      chordIndex = (chordIndex + 1) % chords.length;
    };

    playChord();
    const timer = window.setInterval(playChord, 8000);
    const resume = () => context.resume().catch(() => {});
    window.addEventListener("pointerdown", resume, { once: true });
    resume();
    this.audio = { context, master, timer };
  }

  cleanup() {
    if (this._onMenuRequest) window.removeEventListener("dndt:system-menu-request", this._onMenuRequest);
    this._onMenuRequest = null;
    if (this.audio) {
      window.clearInterval(this.audio.timer);
      const context = this.audio.context;
      const now = context.currentTime;
      this.audio.master.gain.cancelScheduledValues(now);
      this.audio.master.gain.setValueAtTime(Math.max(this.audio.master.gain.value, 0.0001), now);
      this.audio.master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      window.setTimeout(() => context.close().catch(() => {}), 1300);
    }
    this.audio = null;
    this.container?.remove();
    this.container = null;
  }

  destroy() { this.cleanup(); }
}
