// app/engine/pixi.js
// Centralized Pixi v8 import and application manager.

import * as PIXI from "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.13.2/pixi.min.mjs";

let app = null;

function attachCanvasToDom(app) {
  if (!app) return;

  // Prefer the v8 property name but fall back defensively.
  const canvas = app.canvas || app.view;
  if (!canvas) return;

  // Ensure we only attach once.
  if (canvas.__murkyAttached) return;
  canvas.__murkyAttached = true;

  let container = document.getElementById("pixi-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "pixi-root";
    document.body.prepend(container);
  }

  // Style the container as a full-screen, non-interactive background layer.
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    overflow: "hidden",
    zIndex: "0",
    pointerEvents: "none",
  });

  // Style the canvas to fill the container.
  Object.assign(canvas.style, {
    width: "100%",
    height: "100%",
    display: "block",
  });

  if (!canvas.parentElement) {
    container.appendChild(canvas);
  }
}

export async function getApp({ width = 608, height = 592, resizeTo = window } = {}) {
  if (!app) {
    app = new PIXI.Application();
    await app.init({ width, height, resizeTo, backgroundAlpha: 0, antialias: true });
  }

  // Make sure the PIXI canvas is attached behind the DOM-based UI.
  attachCanvasToDom(app);

  // Dev convenience: expose the singleton for console inspection during scene transitions.
  // This is intentionally harmless in production builds.
  try {
    if (typeof window !== "undefined") window.__PIXI_APP = app;
  } catch {}

  return app;
}

export { PIXI };