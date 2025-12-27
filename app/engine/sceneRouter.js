// engine/sceneRouter.js
// Central routing layer for scene transitions.
//
// This module serves two roles:
// 1) A simple registry + currentScene holder (backwards compatible).
// 2) A RouteDescriptor-aware router that can respond to `game:exit`
//    events and move between scenes in a predictable way.

import SaveManager from "../scenes/SaveManager.js";
import { getState, setState } from "../state/stateStore.js";

/**
 * @typedef {"mainMenu" | "dialogue" | "exploration" | "combat" | "gameOver" | "systemCutscene"} SceneName
 */

/**
 * @typedef {Object} RouteDescriptor
 * @property {SceneName} toScene                    - Target scene identifier.
 * @property {SceneName} [fromScene]                - Scene we are coming from.
 * @property {string}    [reason]                   - Reason for the transition (e.g. "start_combat", "exit_area").
 *
 * @property {string}    [areaId]                   - Logical area identifier for dialogue/exploration scenes.
 * @property {string}    [entryKnot]                - Ink knot to begin at for dialogue scenes.
 * @property {"dialogue" | "interior"} [mode]       - Dialogue mode hint for DialogueScene.
 *
 * @property {string}    [encounterId]              - Encounter key for combat scenes.
 * @property {{ scene: SceneName, areaId?: string, entryKnot?: string }} [returnTo]
 *                                                - Where to go after combat / cutscene.
 *
 * @property {number}    [saveSlot]                 - Save slot index when loading/saving.
 */

// ---------------------------------------------------------------------------
// Legacy registry + current scene handling (kept for compatibility)
// ---------------------------------------------------------------------------

let currentScene = null;
let currentSceneName = null;
const registry = new Map();

/**
 * Register a scene instance or factory under a logical name.
 * The name should match a SceneName where possible.
 */
export function registerScene(name, sceneObj) {
  registry.set(name, sceneObj);
}

/**
 * Low-level scene change. This preserves the original API used elsewhere:
 * changeScene(nameOrObj, data)
 *
 * - If nameOrObj is a string, it is looked up in the registry.
 * - If it is an object, it is treated as a scene instance.
 *
 * Scenes receive `data` as their start() argument. In the new routing
 * model, this `data` will commonly be a RouteDescriptor.
 */
export function changeScene(nameOrObj, data) {
  console.info("[sceneRouter] changeScene requested:", nameOrObj, "with data:", data);

  let scene =
    typeof nameOrObj === "string" ? registry.get(nameOrObj) : nameOrObj;

  if (!scene) {
    console.warn("[sceneRouter] changeScene called with unknown scene:", nameOrObj);
    return currentScene;
  }

  // If the registry entry is a constructor (class/function) whose prototype
  // has a start() method, treat it as a scene *class* and instantiate it.
  if (typeof scene === "function") {
    const Ctor = scene;
    if (Ctor.prototype && typeof Ctor.prototype.start === "function") {
      console.info("[sceneRouter] Detected constructor scene for", nameOrObj, "– instantiating.");
      try {
        // We don't currently pass a formal `game` object; scenes that need
        // one can retrieve what they need from the DOM or state modules.
        scene = new Ctor(undefined, data || {});
      } catch (e) {
        console.warn("[sceneRouter] Error instantiating scene constructor:", e);
      }
    }
  }

  // Cleanup previous scene if it exposes a cleanup hook
  if (currentScene && typeof currentScene.cleanup === "function") {
    try {
      currentScene.cleanup();
    } catch (e) {
      console.warn("[sceneRouter] Error during scene cleanup:", e);
    }
  }

  currentScene = scene;
  currentSceneName = typeof nameOrObj === "string" ? nameOrObj : currentSceneName;

  // Debug: inspect prototype of the scene being started
  const proto = Object.getPrototypeOf(currentScene);
  if (proto) {
    try {
      const methods = Object.getOwnPropertyNames(proto);
      console.info(
        "[sceneRouter] Scene prototype for",
        currentSceneName,
        "has methods:",
        methods
      );
    } catch (e) {
      console.warn("[sceneRouter] Failed to inspect scene prototype:", e);
    }
  }

  console.info("[sceneRouter] Starting scene:", currentSceneName, "with payload:", data || {});

  if (currentScene && typeof currentScene.start === "function") {
    try {
      currentScene.start(data || {});
    } catch (e) {
      console.warn("[sceneRouter] Error during scene start:", e);
    }
  } else {
    console.warn("[sceneRouter] Scene has no start() method:", currentSceneName, currentScene);
  }

  return currentScene;
}

/**
 * Get the currently active scene instance.
 */
export function getCurrentScene() {
  return currentScene;
}

/**
 * Get the name key of the currently active scene (if it was changed
 * via changeScene(name, data)).
 */
export function getCurrentSceneName() {
  return currentSceneName;
}

// ---------------------------------------------------------------------------
// RouteDescriptor-aware routing
// ---------------------------------------------------------------------------

/**
 * Normalise and lightly validate a RouteDescriptor.
 * Ensures we always have a toScene and fills fromScene if possible.
 *
 * @param {RouteDescriptor} raw
 * @returns {RouteDescriptor | null}
 */
function normalizeRoute(raw) {
  if (!raw || typeof raw !== "object") {
    console.warn("[sceneRouter] normalizeRoute called with invalid route:", raw);
    return null;
  }

  const route = { ...raw };

  if (!route.toScene) {
    console.warn("[sceneRouter] RouteDescriptor missing toScene:", raw);
    return null;
  }

  if (!route.fromScene && currentSceneName) {
    route.fromScene = currentSceneName;
  }

  return route;
}

/**
 * Resolve a RouteDescriptor into a concrete scene name and payload,
 * then delegate to changeScene.
 *
 * For now we keep this simple:
 * - We expect the registry to be keyed by SceneName strings.
 * - We pass the entire RouteDescriptor into scene.start(route).
 *
 * As the game grows, this is where we could consult area/encounter
 * registries, load Ink JSON, etc, before passing richer data to the
 * scenes.
 *
 * @param {RouteDescriptor} routeDescriptor
 */
export function routeTo(routeDescriptor) {
  console.info("[sceneRouter] routeTo called with descriptor:", routeDescriptor);

  const route = normalizeRoute(routeDescriptor);

  // Hydrate runtime state from save if a saveId is provided
  if (route.saveId) {
    try {
      const save = SaveManager.getSave(route.saveId);
      if (save && save.payload) {
        if (save.payload.player) setState({ player: save.payload.player });
        if (save.payload.flags) setState({ flags: save.payload.flags });
        if (save.payload.location) {
          route.areaId = save.payload.location.areaId || route.areaId;
          route.entryKnot = save.payload.location.entryKnot || route.entryKnot;
        }
        console.info("[sceneRouter] Hydrated state from save:", route.saveId);
      } else {
        console.warn("[sceneRouter] saveId provided but no payload found:", route.saveId);
      }
    } catch (e) {
      console.warn("[sceneRouter] Failed to hydrate state from save:", e);
    }
  }

  if (!route) return;

  // Minimap progress: mark the destination area as visited when routing into an area-driven scene.
  // This keeps visited state canonical at the router level (single source of transitions).
  if ((route.toScene === "dialogue" || route.toScene === "exploration") && route.areaId) {
    try {
      const s = getState();
      const player = s?.player || {};
      const map = player?.map || {};
      const visitedAreas = map?.visitedAreas || {};

      if (!visitedAreas[route.areaId]) {
        setState({
          player: {
            ...player,
            map: {
              ...map,
              visitedAreas: {
                ...visitedAreas,
                [route.areaId]: true,
              },
            },
          },
        });
      }
    } catch (e) {
      console.warn("[sceneRouter] Failed to mark visited area for minimap:", e);
    }
  }

  console.info("[sceneRouter] Normalized route:", route);

  const targetName = route.toScene;

  console.info("[sceneRouter] Routing to target scene:", targetName);

  if (!registry.has(targetName)) {
    console.warn("[sceneRouter] No scene registered under name:", targetName, "for route:", route);
    return;
  }

  changeScene(targetName, route);
}

// ---------------------------------------------------------------------------
// Global event wiring for `game:exit`
// ---------------------------------------------------------------------------

let exitListenerAttached = false;

/**
 * Attach a single global listener for `game:exit` events.
 * Scenes can dispatch:
 *
 *   window.dispatchEvent(new CustomEvent("game:exit", { detail: { toScene: "dialogue", areaId: "dockside" } }));
 *
 * and this router will translate that into a call to routeTo().
 */
export function attachExitListener() {
  if (exitListenerAttached) return;
  if (typeof window === "undefined" || !window.addEventListener) return;

  console.info("[sceneRouter] attachExitListener: registering global game:exit listener");

  window.addEventListener("game:exit", (evt) => {
    console.info("[sceneRouter] game:exit event received with detail:", evt.detail);
    const detail = evt.detail || {};
    routeTo(detail);
  });

  exitListenerAttached = true;
}
