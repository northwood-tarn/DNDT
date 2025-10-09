import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE } from './constants.js';
import { createBorderLayerCanvas } from './art/borderLayerCanvas.js';

// World container that displays the pre-rendered architect-style border, canyon & bridge.
// Exposes: addDoorway(x,y,w,h) and isBlockedTile(tx,ty).
export function createWorld() {
  const container = new PIXI.Container();

  // Offscreen canvas art layer -> Pixi texture sprite
  const art = createBorderLayerCanvas();
  const texture = PIXI.Texture.from(art.canvas);
  const sprite = new PIXI.Sprite(texture);
  sprite.x = 0; sprite.y = 0;
  container.addChild(sprite);

  // Expose doorway API: draw on canvas and refresh texture
  container.addDoorway = (x, y, w, h) => {
    art.addDoorway(x, y, w, h);
    texture.update(); // refresh Pixi texture from canvas
  };

  // Keep the sample gaps near top-left, same as before (pixel coords)
  // Top edge
  container.addDoorway(96, 6, 80, 16);
  // Left edge
  container.addDoorway(6, 160, 16, 96);

  // Collision query in *tile coordinates*
  container.isBlockedTile = (tx, ty) => {
    return art.isBlockedTile(tx, ty);
  };

  return container;
}
