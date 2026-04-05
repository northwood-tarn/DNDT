// app/systems/GameOverOverlay.js
// Centered modal: shows sketched half-sun + "YOU DIED", plays theme,
// reveals buttons only after the theme finishes.

import { playThemeAndWait, THEME_MS, wireButtonClickSfx } from '../ui/sfx.js';

function makeSunSketch() {
  const wrap = document.createElement('div');
  wrap.style.display = 'grid';
  wrap.style.placeItems = 'center';

  const px = document.createElement('canvas');
  const W = 96, H = 48;
  px.width = W; px.height = H;
  px.style.width = '288px';
  px.style.height = '144px';
  px.style.imageRendering = 'pixelated';
  const ctx = px.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const cx = W/2, cy = H*1.05, r = H*0.98;
  ctx.fillStyle = '#e6e6e6';
  for (let a = Math.PI; a <= 2*Math.PI; a += Math.PI / 64) {
    if (Math.random() < 0.3) continue;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    ctx.fillRect(x, y, 1, 1);
    if (Math.random() < 0.15) ctx.fillRect(x+1, y, 1, 1);
  }
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + (i / 15) * Math.PI;
    const len = 6 + Math.floor(Math.random() * 6);
    for (let k = 0; k < len; k++) {
      if (k % 2 === 0) continue;
      const rr = r - 3 + k;
      const x = Math.round(cx + Math.cos(a) * rr);
      const y = Math.round(cy + Math.sin(a) * rr);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  wrap.appendChild(px);
  return wrap;
}

export async function showYouDiedModal() {
  // Backdrop
  const bg = document.createElement('div');
  bg.style.position = 'fixed';
  bg.style.inset = '0';
  bg.style.background = 'rgba(0,0,0,0.75)';
  bg.style.zIndex = '10000';
  bg.style.display = 'grid';
  bg.style.placeItems = 'center';

  // Modal
  const modal = document.createElement('div');
  modal.style.width = 'min(560px, 90vw)';
  modal.style.background = 'rgba(8,12,20,0.96)';
  modal.style.border = '2px solid #2d3b5e';
  modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.6)';
  modal.style.padding = '16px';
  modal.style.textAlign = 'center';
  modal.style.color = '#e6e6e6';
  modal.style.fontFamily = 'ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace';

  const sun = makeSunSketch();
  modal.appendChild(sun);

  const h = document.createElement('div');
  h.textContent = 'YOU DIED';
  h.style.marginTop = '8px';
  h.style.fontSize = '28px';
  h.style.fontWeight = '800';
  h.style.letterSpacing = '1px';
  h.style.textTransform = 'uppercase';
  h.style.textShadow = '0 1px 0 #2d3b5e';
  modal.appendChild(h);

  const sub = document.createElement('div');
  sub.textContent = 'The dark is patient.';
  sub.style.opacity = '0.8';
  sub.style.marginTop = '2px';
  sub.style.marginBottom = '8px';
  modal.appendChild(sub);

  const btnWrap = document.createElement('div');
  btnWrap.style.display = 'flex';
  btnWrap.style.flexDirection = 'column';
  btnWrap.style.gap = '8px';
  btnWrap.style.marginTop = '12px';
  btnWrap.style.visibility = 'hidden'; // revealed after theme finishes

  function makeBtn(label, onclick) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = label;
    b.style.width = '100%';
    b.onclick = onclick;
    return b;
  }

  const loadBtn = makeBtn('Load Game', () => {
    document.body.removeChild(bg);
    import('../scenes/loadSystem.js').then(m => m.showLoadMenu());
  });
  const settingsBtn = makeBtn('Settings', () => {
    document.body.removeChild(bg);
    import('./explorationActions.js').then(m => m.showExplorationActions());
  });
  const titleBtn = makeBtn('Return to Main Screen', () => {
    document.body.removeChild(bg);
    import('../scenes/TitleMenuScene.js').then(m => m.default.start());
  });

  btnWrap.appendChild(loadBtn);
  btnWrap.appendChild(settingsBtn);
  btnWrap.appendChild(titleBtn);

  modal.appendChild(btnWrap);
  bg.appendChild(modal);
  document.body.appendChild(bg);

  // Click sfx on these buttons
  wireButtonClickSfx(btnWrap);

  // Play theme and reveal buttons afterwards
  await playThemeAndWait({});
  btnWrap.style.visibility = 'visible';
}
