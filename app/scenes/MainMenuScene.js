// app/scenes/MainMenuScene.js

const FOG_STYLE_ID = "main-menu-fog-style";

function ensureFogStyles() {
  if (document.getElementById(FOG_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = FOG_STYLE_ID;
  style.textContent = `
    .main-menu-root {
      --lanterna-line: rgba(205, 252, 244, 0.25);
      --lanterna-glow: rgba(164, 245, 230, 0.12);
      --dnd-title-blue: #08778a;
      --line-weight: 1.5px;
      --outline-glow-filter:
        drop-shadow(0 0 0 var(--lanterna-line))
        drop-shadow(0 0 2px var(--lanterna-line))
        drop-shadow(0 0 18px var(--lanterna-glow));
      background: #050706;
      display: grid;
      place-items: center;
    }

    .splash-stage {
      position: relative;
      display: grid;
      place-items: center;
      width: min(58vw, 430px);
      max-height: 74vh;
      pointer-events: none;
    }

    .main-menu-splash {
      display: block;
      width: 100%;
      height: auto;
      max-height: 74vh;
      object-fit: contain;
      opacity: 0;
      filter: brightness(0.88);
      transition: opacity 520ms ease, filter 900ms ease;
      z-index: 0;
    }

    .main-menu-root.is-splash-image-loaded .main-menu-splash {
      opacity: 1;
    }

    .lanterna-emblem {
      position: absolute;
      left: 50%;
      top: -108px;
      z-index: 2;
      width: 140px;
      height: 140px;
      transform: translateX(-50%);
      overflow: visible;
      pointer-events: none;
    }

    .lanterna-emblem::before,
    .lanterna-emblem::after {
      content: none;
    }

    .lanterna-flame {
      position: absolute;
      left: 50%;
      top: 70px;
      width: 35px;
      height: 50px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      filter: none;
    }

    .lanterna-flame-fill,
    .lanterna-flame-outline {
      position: absolute;
      inset: 0;
    }

    .lanterna-flame-fill {
      z-index: 0;
      opacity: 0;
      background: var(--dnd-title-blue);
      -webkit-mask: url("./assets/images/effects/flame.png") center / contain no-repeat;
      mask: url("./assets/images/effects/flame.png") center / contain no-repeat;
    }

    .main-menu-root.is-lanterna-lit .lanterna-flame-fill {
      animation: lanterna-flame-ignite 760ms cubic-bezier(0.2, 0.9, 0.18, 1) forwards;
    }

    .lanterna-flame-outline {
      z-index: 1;
      opacity: 0.28;
      color: var(--dnd-title-blue);
    }

    .main-menu-root.is-lanterna-lit .lanterna-flame-outline {
      animation: lanterna-outline-ignite 620ms cubic-bezier(0.2, 0.9, 0.18, 1) forwards;
    }

    .main-menu-root.is-lanterna-lit .main-menu-splash {
      filter: brightness(1);
    }

    .lanterna-flame-outline svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    @keyframes lanterna-flame-ignite {
      0% {
        opacity: 0;
        filter: brightness(0.55) blur(5px);
        transform: scale(0.5);
      }
      18% {
        opacity: 1;
        filter: brightness(1.5) blur(1px);
        transform: scale(1.22);
      }
      36% {
        opacity: 0.62;
        filter: brightness(0.92) blur(3px);
        transform: scale(0.9);
      }
      58% {
        opacity: 1;
        filter: brightness(1.18) blur(0.5px);
        transform: scale(1.08);
      }
      100% {
        opacity: 1;
        filter: brightness(1) blur(0);
        transform: scale(1);
      }
    }

    @keyframes lanterna-outline-ignite {
      0% { opacity: 0.28; }
      24% { opacity: 1; }
      42% { opacity: 0.54; }
      100% { opacity: 1; }
    }

  `;
  document.head.appendChild(style);
}

export default class MainMenuScene {
  constructor(game, payload = {}) {
    this.game = game;
    this.payload = payload;
    this.root = document.getElementById("game-root");
    this.container = null;
    this._onIntroMusicFinished = null;
    this._splashImageLoaded = false;
    this._lanternaLit = false;

    console.log("[MainMenuScene] constructed with payload:", payload);
  }

  start() {
    console.log("[MainMenuScene] start()");
    this.teardown();
    this.buildDOM();
  }

  destroy() {
    console.log("[MainMenuScene] destroy()");
    this.teardown();
  }

  buildDOM() {
    if (!this.root) {
      console.error("[MainMenuScene] #game-root not found");
      return;
    }

    ensureFogStyles();

    const el = document.createElement("div");
    el.className = "main-menu-root";
    Object.assign(el.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      WebkitAppRegion: "drag",
      overflow: "hidden"
    });
    const stage = document.createElement("div");
    stage.className = "splash-stage";

    const lanterna = document.createElement("div");
    lanterna.className = "lanterna-emblem";
    lanterna.setAttribute("aria-hidden", "true");
    const flame = document.createElement("div");
    flame.className = "lanterna-flame";
    const flameFill = document.createElement("div");
    flameFill.className = "lanterna-flame-fill";
    const flameOutline = document.createElement("div");
    flameOutline.className = "lanterna-flame-outline";
    flameOutline.innerHTML = `
      <svg viewBox="0 0 70 100" aria-hidden="true" focusable="false">
        <defs>
          <filter id="lanterna-flame-edge" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="outer" />
            <feMorphology in="SourceAlpha" operator="erode" radius="1.1" result="inner" />
            <feComposite in="outer" in2="inner" operator="out" result="edge" />
            <feFlood flood-color="#cdfcf4" flood-opacity="0.02" result="lineColor" />
            <feComposite in="lineColor" in2="edge" operator="in" />
          </filter>
        </defs>
        <image href="./assets/images/effects/flame.png" width="70" height="100" filter="url(#lanterna-flame-edge)" />
      </svg>
    `;
    flame.append(flameFill, flameOutline);
    lanterna.appendChild(flame);

    const splash = document.createElement("img");
    splash.className = "main-menu-splash";
    splash.alt = "";
    splash.decoding = "async";
    const markSplashLoaded = () => {
      this._splashImageLoaded = true;
      el.classList.add("is-splash-image-loaded");
      this.maybeLightLanterna();
    };
    splash.addEventListener("load", markSplashLoaded, { once: true });
    splash.src = "./assets/images/mainscreen.png";
    if (splash.complete) markSplashLoaded();

    stage.append(lanterna, splash);
    el.appendChild(stage);

    this.root.appendChild(el);
    this.container = el;
    this.bindLanternaIgnition();

    console.log("[MainMenuScene] DOM built");
  }

  bindLanternaIgnition() {
    if (!this.container) return;

    if (window.__dndtIntroMusicFinished) {
      window.requestAnimationFrame(() => this.maybeLightLanterna());
      return;
    }

    this._onIntroMusicFinished = () => this.maybeLightLanterna();
    window.addEventListener("dndt:intro-music-finished", this._onIntroMusicFinished, { once: true });
  }

  maybeLightLanterna() {
    if (!this.container) return;
    if (!this._splashImageLoaded || !window.__dndtIntroMusicFinished) return;
    if (this._lanternaLit) return;
    this._lanternaLit = true;
    this.container.classList.add("is-lanterna-lit");
    this.playLanternaIgnitionSound();
  }

  playLanternaIgnitionSound() {
    const audio = new Audio("./assets/audio/lighter.mp3");
    audio.volume = 0.85;
    audio.play().catch(() => {});
  }

  teardown() {
    if (this._onIntroMusicFinished) {
      window.removeEventListener("dndt:intro-music-finished", this._onIntroMusicFinished);
      this._onIntroMusicFinished = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this._splashImageLoaded = false;
    this._lanternaLit = false;
  }
}
