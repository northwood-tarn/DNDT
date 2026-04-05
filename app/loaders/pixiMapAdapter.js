// loaders/pixiMapAdapter.js
// Reads a Tiled TMJ (imagelayer + objectgroup) and outputs a render-friendly payload.
// NOTE: Contract enforcement (tile size, allowed dimensions, collision layer presence)
// is handled by tmjLoader.
//
// Returns:
// {
//   imageURL,
//   spawn: { x, y },          // pixels (native)
//   spawnCell: { x, y },      // tiles (grid)
//   polys: [ [ {x,y}, ... ]], // pixels (native)
//   world: {
//     w, h,                   // pixels (native)
//     scale: 1,
//     native: { w, h },
//     tiles: { w, h, size }
//   },
//   blocked, isBlocked        // from tmjLoader (grid collision)
// }

import { loadTMJ as loadTMJContract } from "./tmjLoader.js";

export async function loadTMJ(tmjURL) {
  // 1) Load/validate contract + collision grid
  const contract = await loadTMJContract(tmjURL);
  const tileSize = contract.tilewidth; // canonical: 48

  // 2) Load raw TMJ for imagelayer + object metadata (spawn/collision polys)
  const tmj = await (await fetch(tmjURL)).json();

  const imgLayer = (tmj.layers || []).find((l) => l.type === "imagelayer" && l.image);
  if (!imgLayer) throw new Error("TMJ invalid: missing image layer (imagelayer with image).");

  // Resolve image URL relative to the TMJ file
  const base = tmjURL.replace(/[^/]*$/, "");
  const imageURL = base + imgLayer.image;

  // Validate the image matches the canonical pixel dimensions if the TMJ provides them
  const imgW = imgLayer.imagewidth;
  const imgH = imgLayer.imageheight;
  if (Number.isInteger(imgW) && imgW !== contract.pixelWidth) {
    throw new Error(`TMJ invalid: imagewidth must be ${contract.pixelWidth} (got ${imgW}).`);
  }
  if (Number.isInteger(imgH) && imgH !== contract.pixelHeight) {
    throw new Error(`TMJ invalid: imageheight must be ${contract.pixelHeight} (got ${imgH}).`);
  }

  // 3) Extract spawn + polygon collision metadata (optional)
  const obj = (tmj.layers || []).find((l) => l.type === "objectgroup");

  const polys = [];
  let spawn = { x: 0, y: 0 };

  if (obj && Array.isArray(obj.objects)) {
    for (const o of obj.objects) {
      // Optional polygon collision metadata
      if (o.type === "collision" && Array.isArray(o.polygon)) {
        const bx = o.x || 0;
        const by = o.y || 0;
        polys.push(o.polygon.map((p) => ({ x: bx + p.x, y: by + p.y })));
        continue;
      }

      // Optional spawn marker
      if (o.type === "spawn") {
        spawn = { x: o.x || 0, y: o.y || 0 };
      }
    }
  }

  // Convert spawn to tile coordinates as a convenience
  const spawnCell = {
    x: Math.max(0, Math.min(contract.width - 1, Math.floor(spawn.x / tileSize))),
    y: Math.max(0, Math.min(contract.height - 1, Math.floor(spawn.y / tileSize)))
  };

  return {
    imageURL,
    spawn,
    spawnCell,
    polys,
    world: {
      w: contract.pixelWidth,
      h: contract.pixelHeight,
      scale: 1,
      native: { w: contract.pixelWidth, h: contract.pixelHeight },
      tiles: { w: contract.width, h: contract.height, size: tileSize }
    },

    // Collision grid (canonical)
    blocked: contract.blocked,
    isBlocked: contract.isBlocked
  };
}
