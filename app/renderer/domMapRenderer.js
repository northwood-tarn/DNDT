// app/renderer/domMapRenderer.js
import { shell } from "./shellMount.js";

const BORDER_GLYPH = "\uE800";
const PC_GLYPH = "\uE801";

function ensureHost() {
  let host = shell.map;
  if (!host || !document.body.contains(host)) {
    host = document.createElement("div");
    host.id = "asciiMap";
    shell.center.innerHTML = "";
    shell.center.appendChild(host);
    shell.map = host;
  }
  host.innerHTML = "";
  host.classList.add("dom-map");
  host.style.whiteSpace = "normal";
  return host;
}

export function renderDOMMap(width, height, player, opts = {}) {
  const { brightSet = null, dimSet = null, world = null, view = { x: 0, y: 0 } } = opts;
  const px = player?.x ?? 1;
  const py = player?.y ?? 1;
  const host = ensureHost();

  const frag = document.createDocumentFragment();
  for (let vy = 0; vy < height; vy++) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.whiteSpace = "nowrap";

    for (let vx = 0; vx < width; vx++) {
      const wx = (view?.x ?? 0) + vx;
      const wy = (view?.y ?? 0) + vy;

      const span = document.createElement("span");
      span.className = "cell";
      span.dataset.wx = String(wx);
      span.dataset.wy = String(wy);

      const edge = world
        ? (wx === 0 || wy === 0 || wx === world.width - 1 || wy === world.height - 1)
        : (vx === 0 || vy === 0 || vx === width - 1 || vy === height - 1);

      const isPC = (wx === px && wy === py);

      let litClass = "dark";
      const keyWorld = `${wx},${wy}`;
      // LOCKED: only world keys are honored (prevents ghost light drawn from local keys)
      const isBright = brightSet ? brightSet.has(keyWorld) : false;
      const isDim = !isBright && (dimSet ? dimSet.has(keyWorld) : false);
      if (isBright) litClass = "lit";
      else if (isDim) litClass = "dim";
      span.classList.add(litClass);

      // DEBUG viewport frame
      if (opts?.debugViewport) {
        if (vx === 0 || vy === 0 || vx === (width-1) || vy === (height-1)) {
          span.classList.add('vp-frame');
        }
      }

      if (edge) {
        span.textContent = BORDER_GLYPH;
      } else if (isPC) {
        span.textContent = PC_GLYPH;
        span.classList.add("pc");
      } else {
        span.textContent = " ";
      }

      row.appendChild(span);
    }
    frag.appendChild(row);
  }

  host.innerHTML = "";
  host.appendChild(frag);

  if (!host._hoverBound) {
    host.addEventListener('mousemove', (ev) => {
      const t = ev.target;
      if (t && t.classList && t.classList.contains('cell')) {
        const dx = t.dataset?.wx, dy = t.dataset?.wy;
        if (dx != null && dy != null) {
          const e = new CustomEvent('map:hover', {
            detail: { x: parseInt(dx, 10), y: parseInt(dy, 10) }
          });
          window.dispatchEvent(e);
        }
      }
    });
    host._hoverBound = true;
  }
}

// NOTE: Per your request, this renderer's lighting key policy is now LOCKED.
// Future edits should not reintroduce local (viewport-relative) keys unless you ask explicitly.
