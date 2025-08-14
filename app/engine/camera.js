// app/engine/camera.js
import { state } from '../state/stateStore.js';

/** Return a COPY of the current camera */
export function getCamera(){
  const cam = state?.explore?.camera || { x:0, y:0, w:21, h:13 };
  return { ...cam };
}

/** Merge cam props into the stored camera */
export function setCamera(cam){
  state.explore = state.explore || {};
  state.explore.camera = { ...(state.explore.camera||{}), ...cam };
}

/** Center the camera on (px,py) while staying inside the world */
export function centerOn(px, py, worldW, worldH){
  const cam = getCamera();
  cam.x = Math.max(0, Math.min(worldW - cam.w, px - Math.floor(cam.w/2)));
  cam.y = Math.max(0, Math.min(worldH - cam.h, py - Math.floor(cam.h/2)));
  setCamera(cam);
  return cam;
}

/**
 * NEW: Set the viewport size (in cells) and clamp position to remain valid.
 * Call this once after measuring the center pane (e.g., in ExplorationScene.start())
 */
export function setViewportSize(w, h, worldW, worldH){
  const W = worldW|0, H = worldH|0;
  const cam = getCamera();
  // clamp the requested size to the world
  cam.w = Math.max(1, Math.min((w|0)||cam.w, W || (w|0) || cam.w));
  cam.h = Math.max(1, Math.min((h|0)||cam.h, H || (h|0) || cam.h));
  // keep position legal for the new size
  const maxX = Math.max(0, (W||cam.w) - cam.w);
  const maxY = Math.max(0, (H||cam.h) - cam.h);
  cam.x = Math.max(0, Math.min(maxX, cam.x|0));
  cam.y = Math.max(0, Math.min(maxY, cam.y|0));
  setCamera(cam);
  return cam;
}
