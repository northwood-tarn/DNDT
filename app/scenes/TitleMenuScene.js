// app/scenes/TitleMenuScene.js
import { mountRight, mountCenter, setTop } from "../renderer/shellMount.js";
import CharacterSelect from "./CharacterSelect.js";
import { sceneManager } from "../engine/sceneManager.js";

let introAudio = null;

function makeMenu() {
  const box = document.createElement('div');
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '10px';
  box.style.alignItems = 'center';
  box.className = 'main-menu';

  const mk = (label, handler) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = 'btn btn-narrow';
    b.onclick = handler;
    return b;
  };

const btnNew = mk('New Game', () => {
  try { if (introAudio) introAudio.pause(); } catch {}
  console.log('[TitleMenu] New Game clicked', { CharacterSelect });
  if (!CharacterSelect || typeof CharacterSelect.start !== 'function') {
    console.error('[TitleMenu] CharacterSelect missing/invalid', CharacterSelect);
    alert('Character creation scene failed to load. Check app/scenes/CharacterSelect.js (default export with start).');
    return;
  }
  sceneManager.replace(CharacterSelect);
});

  const btnLoad = mk('Load Game', async () => {
    try {
      const saves = await window.api?.listSaves?.();
      if (!saves?.length) return alert('No saves found.');
      alert('Saves:\n' + saves.map(s => `${s.slot} — ${s.size} bytes`).join('\n'));
    } catch {
      alert('Load system not available.');
    }
  });

  const btnSettings = mk('Settings', () => {
    alert('Settings coming soon.');
  });

  const btnExit = mk('Exit', async () => {
    if (window.api?.quit) await window.api.quit();
    else window.close();
  });

  box.appendChild(btnNew);
  box.appendChild(btnLoad);
  box.appendChild(btnSettings);
  box.appendChild(btnExit);

  // Hide buttons during fade
  [btnNew, btnLoad, btnSettings, btnExit].forEach(btn => {
    btn.style.visibility = 'hidden';
    btn.tabIndex = -1;
  });

  return box;
}

function makeCenter() {
  const wrap = document.createElement('div');
  wrap.className = 'title-wrap';
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'center';
  wrap.style.alignItems = 'center';
  wrap.style.height = '100%';
  wrap.style.position = 'relative';

  const img = document.createElement('img');
  img.src = '../assets/mainscreen.png';
  img.alt = 'Main Screen';
  img.style.maxWidth = '100%';
  img.style.maxHeight = '100%';
  img.style.opacity = '0';
  img.style.transition = 'opacity 5s ease-in-out';
  wrap.appendChild(img);

  const startFade = () => {
    requestAnimationFrame(() => {
      try {
        introAudio = new Audio('../assets/intro_theme.mp3');
        introAudio.currentTime = 0;
        introAudio.volume = 0.9;
        introAudio.play().catch(() => {});
      } catch {}
      img.style.opacity = '1';
    });
  };
  if (img.complete) startFade();
  else img.addEventListener('load', startFade);

  const reveal = () => {
    document.querySelectorAll('.main-menu button').forEach(btn => {
      btn.style.visibility = 'visible';
      btn.tabIndex = 0;
    });
  };
  img.addEventListener('transitionend', reveal);
  setTimeout(reveal, 5200);

  return wrap;
}

export default {
  start() {
    setTop('');
    mountCenter(makeCenter());
    mountRight(makeMenu());
  },
  cleanup() {
    if (introAudio) {
      try { introAudio.pause(); } catch {}
      introAudio = null;
    }
  }
};
