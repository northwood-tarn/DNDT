// app/loaders/tmjLoader.js
export async function loadTMJ(url){
  // Contract: callers must pass the real TMJ path (TMJ is already JSON). Do not append `.json`.
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('loadTMJ(url) requires a non-empty string URL/path.');
  }
  if (/\.tmj\.json(\?|#|$)/i.test(url)) {
    throw new Error(
      `TMJ load contract violated: got "${url}". ` +
      'Pass the .tmj file path from area.assets.tmj (TMJ is already JSON) and do not append .json.'
    );
  }
  const res = await fetch(url);
  if(!res.ok) throw new Error('TMJ fetch failed: '+res.status);
  const tmj = await res.json();

  // Canonical TMJ contract (engine assumptions)
  const CANON_TILE_SIZE = 48;
  const ALLOWED_DIMENSIONS = new Set([
    '40x30', // small exploration
    '60x45', // medium exploration
    '80x60', // large exploration
    '24x18'  // combat
  ]);

  const tw = tmj.tilewidth, th = tmj.tileheight;
  const width = tmj.width, height = tmj.height;

  if (!Number.isInteger(width) || width <= 0) throw new Error('TMJ invalid: width must be a positive integer.');
  if (!Number.isInteger(height) || height <= 0) throw new Error('TMJ invalid: height must be a positive integer.');

  const dimKey = `${width}x${height}`;
  if (!ALLOWED_DIMENSIONS.has(dimKey)) {
    throw new Error(`TMJ invalid: width/height must be one of ${Array.from(ALLOWED_DIMENSIONS).join(', ')} (got ${dimKey}).`);
  }

  if (!Number.isInteger(tw) || !Number.isInteger(th)) {
    throw new Error('TMJ invalid: tilewidth/tileheight must be present and integers.');
  }
  if (tw !== CANON_TILE_SIZE || th !== CANON_TILE_SIZE) {
    throw new Error(`TMJ invalid: tile size must be ${CANON_TILE_SIZE}x${CANON_TILE_SIZE} (got ${tw}x${th}).`);
  }

  if (tmj.infinite) {
    throw new Error('TMJ invalid: infinite maps are not supported.');
  }

  if (tmj.orientation && tmj.orientation !== 'orthogonal') {
    throw new Error(`TMJ invalid: orientation must be orthogonal (got ${tmj.orientation}).`);
  }

  // Internally track blocked tiles as a Set of tile indices (y*width + x).
  // NOTE: Some runtime systems expect `map.blocked` to be an Array, so we convert on return.
  const blockedSet = new Set();

  // Tiled can nest layers inside "group" layers. We need leaf layers + inherited group names/offsets.
  const rootLayers = tmj.layers || [];

  const flattenLayers = (inputLayers, parent = { groups: [], ox: 0, oy: 0 }) => {
    const out = [];
    for (const l of inputLayers || []) {
      if (!l || typeof l !== 'object') continue;

      const name = String(l.name || '');
      const ox = (parent.ox || 0) + (Number(l.offsetx) || 0);
      const oy = (parent.oy || 0) + (Number(l.offsety) || 0);

      if (l.type === 'group' && Array.isArray(l.layers)) {
        out.push(
          ...flattenLayers(l.layers, {
            groups: [...(parent.groups || []), name],
            ox,
            oy,
          })
        );
        continue;
      }

      // Leaf layer: carry inherited groups + absolute offsets.
      out.push({
        ...l,
        __groups: [...(parent.groups || [])],
        __absOffsetX: ox,
        __absOffsetY: oy,
      });
    }
    return out;
  };

  // NOTE: `layers` is now the flattened leaf layer list.
  const layers = flattenLayers(rootLayers);

  const inNamedGroup = (l, re) => Array.isArray(l.__groups) && l.__groups.some(g => re.test(g || ''));
  const isCollisionLayer = (l) => {
    const nm = String(l?.name || '');
    return (/(^|\b)collision(\b|$)/i.test(nm) || inNamedGroup(l, /(\b)collision(\b)/i)) &&
      (l.type === 'objectgroup' || l.type === 'tilelayer');
  };

  const hasCollisionLayer = layers.some(isCollisionLayer);
  if (!hasCollisionLayer) {
    throw new Error('TMJ invalid: missing collision layer (name/group must include "collision" and type must be objectgroup or tilelayer).');
  }

  const obj = layers.find(l => l.type === 'objectgroup' && (/(^|\b)collision(\b|$)/i.test(String(l.name || '')) || inNamedGroup(l, /(\b)collision(\b)/i)));
  if (obj) {
    const lox = Number(obj.__absOffsetX) || 0;
    const loy = Number(obj.__absOffsetY) || 0;
    for (const o of obj.objects || []) {
      // Object coords are pixels in map space; include any group/layer offsets.
      const px = (Number(o.x) || 0) + lox;
      const py = (Number(o.y) || 0) + loy;

      // Tiled "Collision" objects may be rectangles OR polygons (common when tracing art).
      // Rectangles have width/height; polygons have o.polygon[] with points relative to (o.x,o.y).
      const hasPolygon = Array.isArray(o.polygon) && o.polygon.length >= 3;

      // Helper: point-in-polygon (ray casting). Assumes poly is [{x,y},...]
      const pointInPoly = (pt, poly) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, yi = poly[i].y;
          const xj = poly[j].x, yj = poly[j].y;
          const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1e-9) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      };

      if (hasPolygon) {
        // Build absolute polygon points in map pixel space.
        const poly = o.polygon.map(p => ({
          x: px + (Number(p.x) || 0),
          y: py + (Number(p.y) || 0),
        }));

        // Bounding box -> candidate tiles, then test tile centers.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of poly) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }

        const x0 = Math.floor(minX / tw);
        const y0 = Math.floor(minY / th);
        const x1 = Math.ceil(maxX / tw);
        const y1 = Math.ceil(maxY / th);

        const cx0 = Math.max(0, Math.min(width, x0));
        const cy0 = Math.max(0, Math.min(height, y0));
        const cx1 = Math.max(0, Math.min(width, x1));
        const cy1 = Math.max(0, Math.min(height, y1));

        for (let y = cy0; y < cy1; y++) {
          for (let x = cx0; x < cx1; x++) {
            const center = { x: (x + 0.5) * tw, y: (y + 0.5) * th };
            if (pointInPoly(center, poly)) {
              blockedSet.add(y * width + x);
            }
          }
        }
      } else {
        // Rectangle fallback (also covers point objects with 0 width/height)
        const pw = Number(o.width) || tw;
        const ph = Number(o.height) || th;

        const x0 = Math.floor(px / tw);
        const y0 = Math.floor(py / th);
        const x1 = Math.ceil((px + pw) / tw);
        const y1 = Math.ceil((py + ph) / th);

        const cx0 = Math.max(0, Math.min(width, x0));
        const cy0 = Math.max(0, Math.min(height, y0));
        const cx1 = Math.max(0, Math.min(width, x1));
        const cy1 = Math.max(0, Math.min(height, y1));

        for (let y = cy0; y < cy1; y++) {
          for (let x = cx0; x < cx1; x++) {
            blockedSet.add(y * width + x);
          }
        }
      }
    }
  }

  const tl = layers.find(l => l.type === 'tilelayer' && (/(^|\b)collision(\b|$)/i.test(String(l.name || '')) || inNamedGroup(l, /(\b)collision(\b)/i)));
  if (tl && Array.isArray(tl.data)) {
    for (let i = 0; i < tl.data.length; i++) if (tl.data[i]) blockedSet.add(i);
  }

  const isBlocked = (tx,ty) => blockedSet.has(ty*width + tx);
  const pixelWidth = width * tw;
  const pixelHeight = height * th;

  // ---- Collision export shapes ----
  // Internally we track blocked tiles as numeric indices (y*width + x) in `blockedSet`.
  // Different runtime systems want different shapes, so we export BOTH:
  //  - `blocked`: numeric indices (backwards-compatible for older code)
  //  - `blockedTiles`: explicit {x,y} pairs (useful for rendering/debug tooling)
  const blocked = Array.from(blockedSet);
  const blockedTiles = blocked.map((idx) => ({
    x: idx % width,
    y: Math.floor(idx / width),
  }));

  // ---- Rendering helpers (paths/layers) ----
  const baseUrl = (() => {
    try {
      // Support relative paths in Electron/file:// by resolving against current location.
      return new URL(url, window.location.href);
    } catch {
      return null;
    }
  })();

  const resolveRel = (p) => {
    if (!p || typeof p !== 'string') return null;
    try {
      return baseUrl ? new URL(p, baseUrl).toString() : p;
    } catch {
      return p;
    }
  };

  // Prefer an imagelayer named like "Art", otherwise the first imagelayer.
  const imageLayers = layers.filter(l => l && l.type === 'imagelayer' && typeof l.image === 'string');
  const artLayer = imageLayers.find(l => /art/i.test(l.name || '')) || imageLayers[0] || null;
  const image = artLayer ? resolveRel(artLayer.image) : null;

  // Normalize tileset image paths (common for atlas-based tile rendering)
  const tilesets = Array.isArray(tmj.tilesets) ? tmj.tilesets.map(ts => {
    if (!ts || typeof ts !== 'object') return ts;
    if (typeof ts.image === 'string') {
      return { ...ts, image: resolveRel(ts.image) };
    }
    return ts;
  }) : [];

  return {
    // Raw TMJ (keep `tmj` for existing callers; also provide explicit alias)
    tmj,
    raw: tmj,

    // Core dimensions
    width,
    height,
    tilewidth: tw,
    tileheight: th,
    tileSize: tw,
    pixelWidth,
    pixelHeight,

    // Collision
    blocked,
    blockedTiles,
    blockedSet,
    isBlocked,

    // Rendering-relevant fields
    // Keep both: flattened leaf layers for runtime logic, and original tree for tooling/debug.
    layers,
    rawLayers: rootLayers,
    tilesets,
    image,
  };
}
