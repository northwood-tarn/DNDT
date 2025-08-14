// app/renderer/minimapRenderer.js
import { shell } from './shellMount.js';
import { state } from '../state/stateStore.js';

function ensureMini(){
  let el = shell.minimap;
  if (!el || !document.body.contains(el)){
    el = document.createElement('canvas');
    el.id = 'minimap';
    el.width = 128; el.height = 128;
    el.style.display = 'block';
    el.style.imageRendering = 'pixelated';
    el.style.border = '1px solid #999'; // thin border
    shell.right.innerHTML = '';
    shell.right.appendChild(el);
    shell.minimap = el;
  }
  return el;
}

export function renderMinimap(){
  if (!state?.explore?.minimap?.enabled) return;
  const grid = state?.explore?.tileGrid;
  const el = ensureMini();
  const ctx = el.getContext('2d');
  ctx.clearRect(0,0,el.width,el.height);
  if (!grid) return;

  const H = grid[0].length, W = grid.length;
  const scale = Math.max(1, Math.floor(Math.min(el.width/W, el.height/H)));
  const offX = Math.floor((el.width - W*scale)/2);
  const offY = Math.floor((el.height - H*scale)/2);

  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const t = grid[x][y];
      if (!t.seen) continue;
      if (t.isVisible === 'bright'){ ctx.fillStyle = '#ddd'; }
      else if (t.isVisible === 'dim'){ ctx.fillStyle = '#777'; }
      else { ctx.fillStyle = '#333'; }
      ctx.fillRect(offX + x*scale, offY + y*scale, scale, scale);
    }
  }
  // Player pip - now white
  const px = state?.player?.x|0, py = state?.player?.y|0;
  ctx.fillStyle = '#fff';
  ctx.fillRect(offX + px*scale, offY + py*scale, Math.max(1,scale), Math.max(1,scale));
}