// app/renderer.js
// Bootstrap the shell and mount TitleMenuScene robustly.

import { sceneManager } from './engine/sceneManager.js';
import TitleMenuScene from './scenes/TitleMenuScene.js';

function wireControls(){
  const cmdEl = document.getElementById('cmd');
  const btnUp = document.getElementById('btnUp');
  const btnDown = document.getElementById('btnDown');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');

  const send = (c) => {
    try { window.dispatchEvent(new CustomEvent('ui:command', { detail: { command: c } })); } catch {}
  };

  btnUp?.addEventListener('click', () => send('up'));
  btnDown?.addEventListener('click', () => send('down'));
  btnLeft?.addEventListener('click', () => send('left'));
  btnRight?.addEventListener('click', () => send('right'));

  cmdEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = cmdEl.value.trim();
      if (v) send(v);
      cmdEl.value = '';
    }
  });
}

async function boot() {
  console.log('[renderer] boot at', location.href);
  wireControls();

  try {
    const mod = await import('./scenes/TitleMenuScene.js');
    console.log('[renderer] TitleMenuScene module loaded:', mod);
    const scene = mod.default || mod.TitleMenuScene || mod;
    window.__TitleMenuScene = scene; // for DevTools inspection
    if (sceneManager?.replace) {
      sceneManager.replace(scene);
      console.log('[renderer] sceneManager.replace(TitleMenuScene) called');
    } else if (typeof scene?.start === 'function') {
      console.warn('[renderer] sceneManager.replace missing; calling TitleMenuScene.start() directly');
      scene.start();
    } else {
      console.error('[renderer] TitleMenuScene not callable:', scene);
    }
  } catch (err) {
    console.error('[renderer] failed to load TitleMenuScene.js', err);
  }
}

window.addEventListener('DOMContentLoaded', boot);
