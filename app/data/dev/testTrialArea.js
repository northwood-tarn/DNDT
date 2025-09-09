import { renderDOMMap } from "../domMapRenderer.js";
import { shell } from "../shellMount.js";
import { initExitRouter } from "../engine/flow/ExitRouter.js";

// Minimal shell mount
(function initShell(){
  const center = document.getElementById('center');
  const right = document.getElementById('right');
  shell.center = center;
  shell.right = right;
})();

initExitRouter(); // so combat/dialogue exits work

const info = document.getElementById('info');
const btnReset = document.getElementById('btn-reset');

const MAP_URL = "../data/maps/trial_area.gmp.json";

let gmp = null;
let player = { x: 1, y: 1 };

function within(x,y,w,h){ return x>=0 && y>=0 && x<w && y<h; }
function isBlocked(x,y){
  if (!gmp) return true;
  const { width, height } = gmp.size;
  if (!within(x,y,width,height)) return true;
  return gmp.collision.walk[y][x] === 1;
}

async function load() {
  const res = await fetch(MAP_URL);
  gmp = await res.json();
  // spawn
  if (gmp.markers?.spawn) {
    player.x = gmp.markers.spawn.x;
    player.y = gmp.markers.spawn.y;
  }
  draw();
  bindMouse();
  updateInfo();
}

function draw() {
  renderDOMMap(gmp.size.width, gmp.size.height, player, {
    world: { width: gmp.size.width, height: gmp.size.height },
    renderScale: 3,
    tileSizePx: gmp.tileSize.w,
    debugViewport: false
  });
}

function updateInfo(){
  info.innerHTML = `Player @ <b>(${player.x}, ${player.y})</b><br/>
  Tiles: ${gmp.tileSize.w}×${gmp.tileSize.h} (render ×3)<br/>
  Exits: ${gmp.markers.exits.length}, Entities: ${gmp.entities.length}`;
}

function exitAt(x,y){
  return (gmp.markers.exits || []).find(e => e.x === x && e.y === y);
}

function bindMouse(){
  const host = document.getElementById('asciiMap');
  host.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!t.classList || !t.classList.contains('cell')) return;
    const x = parseInt(t.dataset.wx, 10);
    const y = parseInt(t.dataset.wy, 10);
    // try move one step toward clicked cell if not blocked
    const dx = Math.sign(x - player.x);
    const dy = Math.sign(y - player.y);
    const tx = player.x + dx;
    const ty = player.y + dy;
    if (!isBlocked(tx,ty)) {
      player.x = tx; player.y = ty;
      draw(); updateInfo();
      const ex = exitAt(player.x, player.y);
      if (ex) {
        // dispatch unified exit event (ExitRouter will handle it)
        window.dispatchEvent(new CustomEvent('game:exit', { detail: ex }));
      }
    }
  });
  btnReset.onclick = () => {
    player.x = gmp.markers.spawn.x; player.y = gmp.markers.spawn.y;
    draw(); updateInfo();
  };
}

// Listen to encounter events (for demo)
window.addEventListener('game:encounterWon', (e) => {
  alert('Encounter won: ' + e.detail.encounterId + '\n(Returning to exploration)');
});

load();
