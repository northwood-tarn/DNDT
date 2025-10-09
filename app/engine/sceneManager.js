// engine/sceneManager.js — ESM, exported singleton, with `current` alias for overlay
//
// Public API (stable):
//   export const sceneManager = {
//     current,                 // getter alias of currentScene (read/write safe)
//     currentScene,            // the active scene object
//     init(startScene, data?), // optional bootstrap
//     replace(scene, data?),   // cleanup old → start new
//     update(dt?),             // per-tick logic
//     render(alpha?),          // per-frame render
//   };
//
// Notes:
// - Adds a `current` getter/setter so UI/DebugOverlay can read `sceneManager.current`.
// - Narrow try/catch around scene lifecycle to avoid breaking the loop.
// - Best-effort init of ExitRouter; non-fatal if it fails.

export const sceneManager = {
  currentScene: null,

  // convenient alias for consumers that expect `current`
  get current() { return this.currentScene; },
  set current(v) { this.currentScene = v; },

  async init(startScene, data) {
    // Fire up flow routing (non-blocking, best-effort)
    try {
      const mod = await import("../flow/ExitRouter.js");
      if (mod && typeof mod.initExitRouter === "function") {
        mod.initExitRouter();
      }
    } catch (e) {
      console.warn("sceneManager: ExitRouter init failed (non-fatal):", e);
    }
    if (startScene) this.replace(startScene, data);
  },

  replace(sceneModule, data) {
    // cleanup previous scene if present
    if (this.currentScene) {
      try {
        if (typeof this.currentScene.cleanup === "function") {
          this.currentScene.cleanup();
        } else if (typeof this.currentScene.exit === "function") {
          this.currentScene.exit();
        }
      } catch (e) {
        console.warn("scene.cleanup/exit threw:", e);
      }
    }

    // Normalize module → scene (object instance)
    let exported = sceneModule && (sceneModule.default ?? sceneModule);
    let scene = exported;

    // Helper: detect class constructors reliably
    const isClass = (fn) => {
      if (typeof fn !== "function") return false;
      const src = Function.prototype.toString.call(fn);
      return /^\s*class\s/.test(src);
    };

    if (typeof exported === "function") {
      try {
        if (isClass(exported)) {
          // Class-based scene: instantiate (optionally with data)
          try {
            scene = new exported(data);
          } catch {
            scene = new exported();
          }
        } else {
          // Factory function: call to get the scene object
          scene = exported.length > 0 ? exported(data) : exported();
        }
      } catch (e) {
        console.warn("scene factory/class construction threw:", e);
        // fallback: keep original export to surface a clearer error below
        scene = exported;
      }
    }

    this.currentScene = scene;

    // Label for logs
    try {
      const label =
        (scene && (scene.name || scene._label)) ||
        (scene && scene.constructor && scene.constructor.name) ||
        "scene";
      console.log("🌀 sceneManager.replace →", label);
    } catch {}

    // Start lifecycle
    const callMaybeAsync = (fn, arg) => {
      try {
        const r = fn.call(scene, arg);
        if (r && typeof r.then === "function") r.catch((e) => console.error("scene async lifecycle threw:", e));
      } catch (e) {
        console.error("scene lifecycle threw:", e);
      }
    };

    if (scene && typeof scene.start === "function") {
      callMaybeAsync(scene.start, data);
    } else if (scene && (typeof scene.init === "function" || typeof scene.enter === "function")) {
      // Legacy two-phase lifecycle support
      if (typeof scene.init === "function") callMaybeAsync(scene.init, data && (data.ctx ?? data));
      if (typeof scene.enter === "function") callMaybeAsync(scene.enter, data && (data.params ?? data));
    } else {
      console.warn("❌ sceneModule.start is not a function", sceneModule);
    }
  },

  update(dt) {
    const s = this.currentScene;
    if (s && typeof s.update === "function") {
      try { s.update(dt); }
      catch (e) { console.warn("scene.update error:", e); }
    }
  },

  render(alpha) {
    const s = this.currentScene;
    if (s && typeof s.render === "function") {
      try { s.render(alpha); }
      catch (e) { console.warn("scene.render error:", e); }
    }
  }
};
