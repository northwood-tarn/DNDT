import { routeTo } from "../engine/sceneRouter.js";

const STYLE_ID = "prologue-scene-style";
const TEXT_FADE_MS = 1400;

const PAGES = [
  {
    title: "THE LAST LIGHT",
    prose: [
      "Once, the roads between the living lands were marked by a chain of sacred flames.",
      "Now the chain is broken. Beyond Greyharbour's lamps, old paths vanish into rain and darkness—and things long kept distant have begun to draw near."
    ]
  },
  {
    title: "THE CITY OF THE DEAD",
    prose: [
      "Across the water lies the Necropolis, where the dead were given streets, houses and names of their own.",
      "Its gates have not remained quiet. Those who watch from Greyharbour speak softly of disturbed graves, missing travellers and a light moving where no living hand should carry it."
    ]
  },
  {
    title: "THE UNNAMED",
    prose: [
      "The road will pass through harbour fog, among the dead, and at last into the Backlands where the broken chain began.",
      "But every road needs someone willing to take its first step. Before the tale can begin, that traveller must be given a name."
    ]
  }
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "DNDT Source Sans";
      src: url("./assets/fonts/source_sans_3/SourceSans3-Variable.ttf") format("truetype");
      font-style: normal;
      font-weight: 200 900;
      font-display: block;
    }
    @font-face {
      font-family: "DNDT Libre Baskerville";
      src: url("./assets/fonts/libre_baskerville/LibreBaskerville-Italic-Variable.ttf") format("truetype");
      font-style: italic;
      font-weight: 400 700;
      font-display: block;
    }

    .prologue-scene {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: grid;
      align-items: center;
      padding: clamp(56px, 8vw, 120px);
      color: rgba(224, 230, 229, 0.88);
      background: rgba(1, 13, 15, 0.28);
      -webkit-app-region: drag;
    }

    .prologue-lanterna-flame {
      position: absolute;
      top: 32px;
      left: 50%;
      width: 46px;
      height: auto;
      transform: translateX(-50%);
      opacity: 0.2;
      animation: prologue-flame-breathe 9s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes prologue-flame-breathe {
      0%, 100% { opacity: 0.16; }
      50% { opacity: 0.24; }
    }

    .prologue-title-card {
      display: grid;
      place-items: center;
      opacity: 0;
      transition: opacity 1300ms ease;
    }
    .prologue-title-card.is-visible { opacity: 1; }
    .prologue-title-card h1 {
      display: flex;
      align-items: center;
      gap: 30px;
      margin: 0;
      font-family: "DNDT Source Sans", sans-serif;
      color: rgba(221, 230, 228, 0.78);
      font-size: clamp(42px, 5vw, 68px);
      font-weight: 260;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .prologue-title-card h1::before,
    .prologue-title-card h1::after {
      content: "";
      width: clamp(62px, 9vw, 132px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(164, 189, 185, 0.48));
    }
    .prologue-title-card h1::after { transform: scaleX(-1); }

    .prologue-page {
      width: min(680px, 58vw);
      margin-left: clamp(10px, 4vw, 80px);
      opacity: 0;
      transform: translateY(7px);
      transition: opacity ${TEXT_FADE_MS}ms ease, transform ${TEXT_FADE_MS}ms ease;
    }
    .prologue-page.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .prologue-title {
      margin: 0;
      font-family: "DNDT Source Sans", sans-serif;
      color: rgba(233, 238, 237, 0.9);
      font-size: clamp(42px, 5vw, 70px);
      font-weight: 280;
      letter-spacing: 0.025em;
      line-height: 0.98;
    }
    .prologue-copy {
      max-width: 610px;
      margin-top: clamp(58px, 9vh, 100px);
      font-family: "DNDT Libre Baskerville", serif;
      color: rgba(179, 188, 185, 0.72);
      font-size: clamp(19px, 2vw, 27px);
      font-style: italic;
      line-height: 1.72;
    }
    .prologue-copy p { margin: 0 0 1.2em; }

    .prologue-progress {
      --moon-fill: 33.333%;
      position: fixed;
      right: 48px;
      bottom: 38px;
      z-index: 22;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.12);
      opacity: 0.58;
      cursor: pointer;
      -webkit-app-region: no-drag;
    }
    .prologue-progress::before {
      content: "";
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: rgba(150, 170, 170, 0.42);
      clip-path: inset(0 0 0 calc(100% - var(--moon-fill)));
      transition: clip-path 500ms ease;
    }
    .prologue-progress:hover,
    .prologue-progress:focus-visible {
      opacity: 0.8;
      outline: none;
    }
  `;
  document.head.appendChild(style);
}

export default class PrologueScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.container = null;
    this.content = null;
    this.progressButton = null;
    this.pageIndex = 0;
    this.timers = new Set();
    this.audio = null;
    this.leaving = false;
  }

  start() {
    ensureStyles();
    document.body.classList.add("prologue-active");
    this.container = document.createElement("section");
    this.container.className = "prologue-scene";
    const flame = document.createElement("img");
    flame.className = "prologue-lanterna-flame";
    flame.src = "./assets/images/effects/flame-black.png";
    flame.alt = "";
    this.content = document.createElement("div");
    this.content.className = "prologue-content";
    this.container.append(flame, this.content);
    this.root?.appendChild(this.container);
    this.startSoundscape();
    this.showTitleCard();
  }

  later(callback, delay) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
  }

  showTitleCard() {
    if (!this.content) return;
    this.content.innerHTML = `<div class="prologue-title-card"><h1>Prologue</h1></div>`;
    const card = this.content.querySelector(".prologue-title-card");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => card?.classList.add("is-visible")));
    this.later(() => card?.classList.remove("is-visible"), 2850);
    this.later(() => this.renderPage(), 4200);
  }

  renderPage() {
    if (!this.content) return;
    const page = PAGES[this.pageIndex];
    this.content.innerHTML = `
      <article class="prologue-page">
        <h1 class="prologue-title">${page.title}</h1>
        <div class="prologue-copy">
          ${page.prose.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        </div>
      </article>
    `;
    const article = this.content.querySelector(".prologue-page");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => article?.classList.add("is-visible")));
    this.later(() => this.ensureProgressButton(), TEXT_FADE_MS);
  }

  ensureProgressButton() {
    if (!this.container || this.progressButton || this.leaving) return;
    this.progressButton = document.createElement("button");
    this.progressButton.type = "button";
    this.progressButton.className = "prologue-progress";
    this.progressButton.setAttribute("aria-label", "Next prologue page");
    this.progressButton.addEventListener("click", () => this.advance());
    this.container.appendChild(this.progressButton);
    this.updateProgress();
  }

  updateProgress() {
    const fill = ((this.pageIndex + 1) / PAGES.length) * 100;
    this.progressButton?.style.setProperty("--moon-fill", `${fill}%`);
  }

  advance() {
    if (this.leaving) return;
    if (this.pageIndex === PAGES.length - 1) {
      this.beginCharacterCreation();
      return;
    }
    const page = this.content?.querySelector(".prologue-page");
    page?.classList.remove("is-visible");
    this.pageIndex += 1;
    this.updateProgress();
    this.later(() => this.renderPage(), 520);
  }

  startSoundscape() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 2.4);
    master.connect(context.destination);

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;

    const rain = context.createBufferSource();
    const rainFilter = context.createBiquadFilter();
    const rainGain = context.createGain();
    rain.buffer = noiseBuffer;
    rain.loop = true;
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 1600;
    rainGain.gain.value = 0.055;
    rain.connect(rainFilter).connect(rainGain).connect(master);

    const ocean = context.createBufferSource();
    const oceanFilter = context.createBiquadFilter();
    const oceanGain = context.createGain();
    ocean.buffer = noiseBuffer;
    ocean.loop = true;
    oceanFilter.type = "lowpass";
    oceanFilter.frequency.value = 360;
    oceanGain.gain.value = 0.17;
    ocean.connect(oceanFilter).connect(oceanGain).connect(master);

    rain.start();
    ocean.start();
    context.resume().catch(() => {});
    const bellTimer = window.setInterval(() => this.ringBell(), 6200);
    this.audio = { context, master, rain, ocean, bellTimer };
    this.later(() => this.ringBell(), 650);
  }

  ringBell() {
    const { context, master } = this.audio || {};
    if (!context || context.state === "closed") return;
    const now = context.currentTime;
    [220, 440, 660].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16 / (index + 1), now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8 + index * 0.45);
      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + 4.6);
    });
  }

  beginCharacterCreation() {
    this.leaving = true;
    this.progressButton?.setAttribute("disabled", "");
    this.content?.querySelector(".prologue-page")?.classList.remove("is-visible");
    if (this.audio) {
      const { context, master } = this.audio;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), context.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.35);
    }
    this.later(() => routeTo({
      toScene: "characterSelect",
      fromScene: "prologue",
      reason: "prologue_complete"
    }), 1400);
  }

  stopSoundscape() {
    if (!this.audio) return;
    window.clearInterval(this.audio.bellTimer);
    try { this.audio.rain.stop(); } catch {}
    try { this.audio.ocean.stop(); } catch {}
    this.audio.context.close().catch(() => {});
    this.audio = null;
  }

  cleanup() {
    document.body.classList.remove("prologue-active");
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
    this.stopSoundscape();
    this.container?.remove();
    this.container = null;
    this.content = null;
    this.progressButton = null;
  }

  destroy() { this.cleanup(); }
}
