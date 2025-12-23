// app/scenes/ExplorationScene.js
import { sceneManager } from "../engine/sceneManager.js";
import { getArea, DEFAULT_AREA_ID } from "../areas/index.js";
import { Assets } from "../utils/Assets.js";
import { attachExitListener, routeTo } from "../engine/sceneRouter.js";
import { getState } from "../state/stateStore.js";
import restCounters from "../state/rest_counters.js";

let view = null;
let bgApp = null;

function onShortRestCompleted(evt) {
  const detail = (evt && evt.detail) || {};
  if (!detail.didRest) return;

  const state = getState();
  const key =
    (state && state.meta && state.meta.saveId) ||
    (state && state.player && state.player.id) ||
    "default";

  const hungerInfo = restCounters.beginRestAndUpdateHunger(state, key);
  const shortRestsUsed = restCounters.incrementShortRestsUsed(key);

  console.info("[ExplorationScene] Short rest completed in exploration context:", {
    detail,
    shortRestsUsed,
    hungerInfo,
  });
}

const ExplorationScene = {
  async start({ areaId = DEFAULT_AREA_ID, tmj = null, title = "Exploration" } = {}){
    mountTopBar({
      mode: 'exploration',
      actTitle: 'Act I',
      areaTitle: title,
      timeLabel: 'First Watch',
      weatherLabel: 'Rain',
      getPlayer: () => getState()?.player,
      onLanternToggle: (on)=>{ console.log('Lantern toggled:', on); }
    });

    try { attachExitListener(); } catch {}
    window.addEventListener("rest:short:completed", onShortRestCompleted);

    if (!tmj){
      const area = getArea(areaId);
      if (!area || !area.tmj){
        console.error("[ExplorationScene] Area not found in registry:", areaId, area);
        return;
      } else {
        tmj = area.tmj;
      }
    }

    const host = document.createElement("div");
    host.style.width = "fit-content";
    host.style.height = "fit-content";
    mountCenter(host);

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = 608;
    bgCanvas.height = 592;
    host.appendChild(bgCanvas);

    // PIXI background install with centralized asset
    const PIXI = (await import('../lib/pixi.mjs')).default || await import('../lib/pixi.mjs');
    bgApp = new PIXI.Application();
    await bgApp.init({ width: 608, height: 592, backgroundAlpha: 0, canvas: bgCanvas });
    installBackground(bgApp, bgApp.stage, { imagePath: Assets.path('ui.murky') });

    const viewOpts = {
      width: 608,
      height: 592,
      designScreensHigh: 2.2,
      playerSizePx: 0.027,
      speed: 2.6
    };
    const worldView = createWorldView(viewOpts);
    view = worldView;
    await view.mount(host);
    await view.loadFromTMJ(tmj);

    function triggerCombat(encounterId){
      const route = {
        toScene: "combat",
        reason: "exploration_enemy_spotted",
        encounterId,
        returnTo: {
          scene: "exploration",
          areaId: areaId
        }
      };
      window.dispatchEvent(new CustomEvent("game:exit", { detail: route }));
    }

    setInterval(()=>{
      const playerState = { x: view.playerX, y: view.playerY };
      const enemies = [];
      const lights = [];
      const collisions = [];
      const aware = checkEnemyAwareness(playerState, enemies, lights, collisions);
      if (aware && aware.encounterId){
        triggerCombat(aware.encounterId);
      }
    }, 1000);
  },

  cleanup(){
    try { window.removeEventListener("rest:short:completed", onShortRestCompleted); } catch {}
    try { view?.destroy(); } catch {}
    view = null;
    try { bgApp?.destroy(true, { children: true, texture: true, baseTexture: true }); } catch {}
    bgApp = null;
    try { clearCenter(); } catch {}
  }
};
// --- Lifecycle shim (auto-added by validator prep) ---
let __ctx_Exploration = null;
function init(ctx){ __ctx_Exploration = ctx; }
function enter(params = {}){ /* no-op */ }
function update(dt){ /* no-op */ }
function render(g){ /* no-op */ }
function exit(){ /* no-op */ }
function destroy(){ __ctx_Exploration = null; }

export default { init, enter, update, render, exit, destroy, start: ExplorationScene.start, cleanup: ExplorationScene.cleanup };