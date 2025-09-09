// app/loaders/tmjLoader.js
export async function loadTMJ(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('TMJ fetch failed: '+res.status);
  const tmj = await res.json();

  const width = tmj.width, height = tmj.height;
  const tw = tmj.tilewidth || 32, th = tmj.tileheight || 32;
  const blocked = new Set();

  const obj = (tmj.layers||[]).find(l => l.type==='objectgroup' && /collision/i.test(l.name||''));
  if (obj) {
    for (const o of obj.objects||[]) {
      const x0 = Math.floor(o.x / tw);
      const y0 = Math.floor(o.y / th);
      const x1 = Math.floor((o.x + (o.width||tw)) / tw);
      const y1 = Math.floor((o.y + (o.height||th)) / th);
      for (let y=y0; y<y1; y++) for (let x=x0; x<x1; x++) blocked.add(y*width + x);
    }
  }

  const tl = (tmj.layers||[]).find(l => l.type==='tilelayer' && /collision/i.test(l.name||''));
  if (tl && Array.isArray(tl.data)) {
    for (let i=0;i<tl.data.length;i++) if (tl.data[i]) blocked.add(i);
  }

  const isBlocked = (tx,ty) => blocked.has(ty*width + tx);
  return { width, height, tilewidth: tw, tileheight: th, blocked, isBlocked };
}
