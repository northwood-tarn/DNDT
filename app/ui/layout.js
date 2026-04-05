// app/ui/layout.js
// DOM layout scaffold for the renderer.
// Keeps UI + PIXI layers predictable across scenes.
//
// Contract:
//   ensureLayout() -> { appEl, pixiRootEl, uiRootEl, logEl, centerEl }
//   mountCenter(node: HTMLElement) -> HTMLElement
//     - pixiRootEl: host for the PIXI canvas
//     - uiRootEl:   host for DOM UI chrome (top bar, overlays)
//     - centerEl:   main scene content container for DOM-driven scenes
//     - logEl:      rolling log/output
//   clearCenter()  -> void
//   clearUiRoot()  -> void

function ensureDiv(id, parent) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    parent.appendChild(el);
  }
  return el;
}

export function ensureLayout() {
  // Prefer an existing #app, otherwise fall back to body.
  const appEl = document.getElementById("app") || document.body;

  const pixiRootEl = ensureDiv("pixi-root", appEl);
  const uiRootEl = ensureDiv("ui-root", appEl);
  const centerEl = ensureDiv("center", appEl);
  const logEl = ensureDiv("game-log", appEl);

  return { appEl, pixiRootEl, uiRootEl, logEl, centerEl };
}

// Replace the center pane contents with the provided node and return the center element.
export function mountCenter(node) {
  if (!(node instanceof HTMLElement)) {
    throw new Error("[layout] mountCenter(node) requires an HTMLElement");
  }

  const { centerEl } = ensureLayout();
  centerEl.innerHTML = "";
  centerEl.appendChild(node);
  return centerEl;
}

export function clearUiRoot() {
  const uiRootEl = document.getElementById("ui-root");
  if (!uiRootEl) return;
  uiRootEl.innerHTML = "";
}

// Clear the main DOM scene container.
export function clearCenter() {
  const centerEl = document.getElementById("center");
  if (!centerEl) return;
  centerEl.innerHTML = "";
}