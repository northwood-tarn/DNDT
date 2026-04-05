// app/systems/lightSources.js
// Surgical patch: always start with fresh Sets each frame.

function key(x, y){ return (x|0) + ',' + (y|0); }

function fillCircle(set, cx, cy, r, W, H){
  const R = Math.max(0, r|0);
  for (let dy = -R; dy <= R; dy++){
    for (let dx = -R; dx <= R; dx++){
      const x = (cx|0) + dx, y = (cy|0) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (dx*dx + dy*dy <= R*R) set.add(key(x,y));
    }
  }
}

/**
 * Build bright/dim lighting sets for this frame.
 * cfg: { width, height, player:{x,y}, playerVis:{brightTiles, dimTiles}, sources?:Array }
 */
export function buildLightSets(cfg){
  const W = cfg.width|0, H = cfg.height|0;
  // Fresh sets every call so nothing lingers between frames
  const bright = new Set();
  const dim    = new Set();

  // Player halo
  const bx = Math.max(0, cfg.playerVis?.brightTiles|0);
  const dx = Math.max(0, cfg.playerVis?.dimTiles|0);
  fillCircle(bright, cfg.player.x|0, cfg.player.y|0, bx, W, H);
  fillCircle(dim,    cfg.player.x|0, cfg.player.y|0, bx + dx, W, H);

  // Extra ambient/static sources (already filtered upstream)
  const list = Array.isArray(cfg.sources) ? cfg.sources : [];
  for (const s of list){
    if (!s || s.on === false) continue;
    // ignore any known transients just in case (belt & suspenders)
    if (s.transient === true) continue;
    if (s.kind === 'hover' || s.kind === 'cursor' || s.kind === 'preview' || s.kind === 'player') continue;

    const sb = Math.max(0, s.brightTiles|0);
    const sd = Math.max(0, s.dimTiles|0);
    fillCircle(bright, s.x|0, s.y|0, sb, W, H);
    fillCircle(dim,    s.x|0, s.y|0, sb + sd, W, H);
  }

  return { bright, dim };
}
