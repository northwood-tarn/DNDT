
// loaders/pixiMapAdapter.js
// Reads a Tiled TMJ (imagelayer + objectgroup) and outputs
// { imageURL, spawn:{x,y}, polys:[[{x,y}]], world:{w,h,scale,native:{w,h}} }

export async function loadTMJ(tmjURL, { designScreensHigh = 2.2, viewH = 592 } = {}){
  const tmj = await (await fetch(tmjURL)).json();
  const imgLayer = (tmj.layers||[]).find(l => l.type === 'imagelayer' && l.image);
  if (!imgLayer) throw new Error('TMJ has no image layer');
  const base = tmjURL.replace(/[^/]*$/, '');
  const imageURL = base + imgLayer.image;

  const nativeH = imgLayer.imageheight || tmj.height || 2048;
  const SCALE = (viewH * designScreensHigh) / nativeH;

  // collision + spawn
  const obj = (tmj.layers||[]).find(l => l.type === 'objectgroup');
  const polys = [];
  let spawn = { x: 0, y: 0 };
  if (obj && Array.isArray(obj.objects)){
    for (const o of obj.objects){
      if (o.type === 'collision' && Array.isArray(o.polygon)){
        const bx = o.x||0, by = o.y||0;
        polys.push(o.polygon.map(p => ({ x: (bx+p.x)*SCALE, y: (by+p.y)*SCALE })));
      } else if (o.type === 'spawn'){
        spawn = { x: (o.x||0)*SCALE, y: (o.y||0)*SCALE };
      }
    }
  }

  return {
    imageURL, spawn, polys,
    world: {
      w: Math.round((imgLayer.imagewidth||tmj.width||2048) * SCALE),
      h: Math.round((imgLayer.imageheight||tmj.height||2048) * SCALE),
      scale: SCALE,
      native: { w: imgLayer.imagewidth||tmj.width||0, h: imgLayer.imageheight||tmj.height||0 }
    }
  };
}
