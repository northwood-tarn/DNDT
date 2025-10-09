// app/engine/pixi.js
// Centralized Pixi v8 import and application manager.

import * as PIXI from "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.13.2/pixi.min.mjs";

let app = null;

export async function getApp({ width = 608, height = 592, resizeTo = window } = {}) {
  if (app) return app;
  app = new PIXI.Application();
  await app.init({ width, height, resizeTo, backgroundAlpha: 0, antialias: true });
  return app;
}

export { PIXI };