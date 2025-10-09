// app/main.js (ESM)
// Centralized Pixi import
import { PIXI, getApp } from "./engine/pixi.js";
// Initialize routing
import { initExitRouter } from "./flow/ExitRouter.js";

let app;

function routeToDockside(){
  // Clear any title text and overlay UI
  const top = document.getElementById('top'); if (top) top.textContent = '';
  const uiRoot = document.getElementById('ui-root'); if (uiRoot) uiRoot.innerHTML = '';
  // Hand off to ExitRouter to load the dialogue/text area
  window.dispatchEvent(new CustomEvent("game:exit", {
    detail: { toArea: "dockside" }
  }));
}

async function startGame() {
  // Ensure exit routing is listening
  try { initExitRouter(); } catch (e) { console.warn('ExitRouter init failed:', e); }

  // Create/reuse a Pixi v8 app and mount its canvas into #center.
  app = await getApp({ resizeTo: window, backgroundAlpha: 0, antialias: true });
  const center = document.getElementById('center') || document.body;
  if (!app.canvas.isConnected) {
    center.appendChild(app.canvas);
  }

  // --- Title screen (DOM overlay) ---
  const uiRoot = document.getElementById('ui-root');
  if (uiRoot) {
    uiRoot.innerHTML = '';

    const splash = document.createElement('img');
    splash.className = 'splash';
    splash.src = './assets/images/mainscreen.png';
    splash.alt = 'Main Screen';
    uiRoot.appendChild(splash);

    const menu = document.createElement('div');
    menu.className = 'menu';

    const mk = (label, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = onClick;
      return b;
    };

    // NEW GAME -> Dockside (dialogue/text area via ExitRouter)
    menu.appendChild(mk('New Game', routeToDockside));

    menu.appendChild(mk('Load Game', async () => {
      const saves = await (window.api?.listSaves?.() ?? Promise.resolve([]));
      if (!saves || !saves.length) return alert('No saves found.');
      alert('Saves: ' + saves.join(', '));
    }));

    menu.appendChild(mk('Settings', () => alert('Settings coming soon')));
    menu.appendChild(mk('Quit', async () => {
      if (window.api?.quit) await window.api.quit();
      else window.close();
    }));

    uiRoot.appendChild(menu);
  }

  // --- Intro audio ---
  const audio = new Audio('./assets/audio/intro_theme.mp3');
  audio.volume = 0.9;
  try {
    await audio.play();
  } catch {
    const unlock = async () => {
      try { await audio.play(); } finally {
        window.removeEventListener('pointerdown', unlock);
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
  }
}

startGame();
