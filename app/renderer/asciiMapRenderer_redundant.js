// app/renderer/asciiMapRenderer.js
// ASCII map renderer with optional per-tile lighting (bright/dim sets) or simple player-radius fallback.

export function asciiRect(width, height, player = { x: 1, y: 1 }, opts = {}) {
  const {
    border = '#',
    empty = '.',
    marker = '@',
    // Fallback ring radii (if no sets provided)
    visBright = 0,
    visDim = 0,
    // Per-tile lighting (preferred if provided)
    brightSet = null,         // Set<'x,y'>
    dimSet = null,            // Set<'x,y'>
    // Fog memory for daylight
    seenSet = null,           // Set<'x,y'>
    unseenChar = ' ',
    dimFill = ',',            // dim tiles fill
    seenChar = '·',
    markers = [],             // [{x,y,char}]
    dimMarkers = []           // [{x,y}]
  } = opts || {};

  const w = Math.max(3, width|0);
  const h = Math.max(3, height|0);
  const px = player.x|0, py = player.y|0;
  const lines = [];

  const markerMap = new Map();
  for (const m of (markers||[])) {
    if (m && typeof m.x==='number' && typeof m.y==='number' && m.char) {
      markerMap.set(`${m.x},${m.y}`, String(m.char).slice(0,1));
    }
  }
  const dimSpot = new Set((dimMarkers||[]).map(m => `${m.x},${m.y}`));

  function isBright(x,y){
    if (brightSet) return brightSet.has(`${x},${y}`);
    const dx = Math.abs(x - px), dy = Math.abs(y - py);
    return Math.max(dx,dy) <= visBright;
  }
  function isDim(x,y){
    if (dimSet) return dimSet.has(`${x},${y}`);
    const dx = Math.abs(x - px), dy = Math.abs(y - py);
    const d = Math.max(dx,dy);
    return d > visBright && d <= (visBright + visDim);
  }
  function isSeen(x,y){
    if (!seenSet) return false;
    return seenSet.has(`${x},${y}`);
  }

  for (let y=0; y<h; y++){
    let row='';
    for (let x=0; x<w; x++){
      const edge = (x===0 || y===0 || x===w-1 || y===h-1);
      if (edge) { row += border; continue; }
      if (x===px && y===py) { row += marker; continue; }

      const key = `${x},${y}`;
      const bright = isBright(x,y);
      const dim = !bright && isDim(x,y);

      // Markers: real glyph in bright, generic hint in dim
      if (markerMap.has(key)){
        if (bright) { row += markerMap.get(key); continue; }
        if (dim)    { row += '°'; continue; }
      } else if (dim && dimSpot.has(key)) {
        row += '°'; continue;
      }

      if (bright) {
        row += empty;
      } else if (dim) {
        row += dimFill;
      } else if (isSeen(x,y)) {
        row += seenChar;
      } else {
        row += unseenChar;
      }
    }
    lines.push(row);
  }
  return lines.join('\n');
}

export function renderFromState(state, opts = {}) {
  const {
    width = 40, height = 18, border = '#', empty = '.', marker = '@', renderFn
  } = opts;
  const p = state?.player || { x:1, y:1 };
  const text = asciiRect(width, height, { x: p.x ?? 1, y: p.y ?? 1 }, opts);
  if (typeof renderFn === 'function') renderFn(text);
  return text;
}
