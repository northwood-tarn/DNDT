// app/engine/pixi.js
// Centralized Pixi v8 import and application manager.

import * as PIXI from "../lib/pixi.mjs";

let app = null;
let appInitPromise = null;

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

export function getApp({ width = 608, height = 592, resizeTo = window } = {}) {
  if (!app) {
    app = new PIXI.Application();

    // Kick off async init once, but return the app immediately so callers
    // can safely access `app.stage` without awaiting.
    appInitPromise = app
      .init({ width, height, resizeTo, backgroundAlpha: 0, antialias: true })
      .then(() => {
        attachCanvasToDom(app);

        // Dev convenience: expose the singleton for console inspection during scene transitions.
        try {
          if (typeof window !== "undefined") window.__PIXI_APP = app;
        } catch {}

        return app;
      })
      .catch((err) => {
        console.error("[pixi] Failed to init PIXI.Application", err);
        throw err;
      });
  } else {
    // If init has completed, ensure the canvas is attached.
    // If init is still in-flight, attachment will happen in the init promise.
    if (appInitPromise) {
      // no-op
    } else {
      attachCanvasToDom(app);
    }

    try {
      if (typeof window !== "undefined") window.__PIXI_APP = app;
    } catch {}
  }

  return app;
}

export function getAppReadyPromise() {
  return appInitPromise || Promise.resolve(app);
}

export { PIXI };
