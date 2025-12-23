// app/scenes/DialogueScene.js
//
// Unified Ink-driven scene for:
//  - Full NPC dialogue
//  - Interior exploration (zones + minimap)
// Includes a PIXI-based murky background that slowly crossfades between PNGs.
//
// Expected to be used via sceneManager.replace(DialogueScene, {
//   script: compiledInkJson,
//   areaId: "dockside_fisherman",
//   mode: "dialogue" | "interior",
//   entryKnot?: "some_knot",
//   returnTo?: { scene: "exploration" | "combat" | "dialogue", areaId?: string }
// });
//
// NOTE: You may need to adjust import paths and asset paths to match your project.
//

import { PIXI, getApp } from "../engine/pixi.js";
// If your ink runtime is imported differently, adjust this:
import { Story } from "../lib/inkjs.mjs";
import RestUI from "../ui/RestUI.js";
import { processTags, parseTags, isChoiceAvailable, performSkillCheck } from "./dialogueEngine.js";


import { rollD20 } from "../utils/dice.js";
import { getState } from "../state/stateStore.js";
import restCounters from "../state/rest_counters.js";

// ---------------------------------------------------------------------------
// MurkyBackground: simple 2-sprite crossfade over a list of PNGs
// ---------------------------------------------------------------------------

class MurkyBackground {
  constructor({
    app = null,
    imagePaths = [],
    fadeDuration = 8,   // seconds to fade A -> B
    holdDuration = 5,   // seconds to hold on a single image
    loop = true,
    textures = null
  } = {}) {
    this.app = app;
    this.imagePaths = imagePaths;
    this.fadeDuration = fadeDuration;
    this.holdDuration = holdDuration;
    this.loop = loop;
    this.textures = textures || null;

    this._container = null;
    this._spriteA = null;
    this._spriteB = null;
    this._currentIndex = 0;
    this._nextIndex = 1;
    this._state = "hold"; // "hold" | "fade"
    this._time = 0;
    this._tickerFn = this._onTick.bind(this);
  }

  attach(ctx) {
    // --- Diagnostics so we stop guessing -----------------------------------
    console.info(
      "[MurkyBackground] attach() called",
      { ctx, existingApp: this.app }
    );

    // ctx may be:
    //   - PIXI.Application
    //   - { app, stage, layers, ... }
    //   - { app }
    let ctxApp = ctx && (ctx.app || ctx);

    // If we already had an app and it's changing, clean up.
    if (this.app && ctxApp && this.app !== ctxApp) {
      console.info("[MurkyBackground] attach(): app changed, destroying old background");
      this.destroy();
    }

    // Establish app: prefer ctx.app / ctx, fall back to getApp()
    if (!this.app && ctxApp) {
      this.app = ctxApp;
    }

    if (!this.app && typeof getApp === "function") {
      const fallbackCtx = getApp();
      console.info("[MurkyBackground] attach(): using getApp() fallback", fallbackCtx);
      if (fallbackCtx) {
        ctx = fallbackCtx;
        this.app = fallbackCtx.app || fallbackCtx;
        ctxApp = this.app;
      }
    }

    if (!this.app) {
      console.warn("[MurkyBackground] No PIXI app available; background disabled.");
      return;
    }

    // --- Stage selection: prefer an explicit ctx.stage (e.g. fog layer),
    // falling back to the app's root stage.
    const stage =
      (ctx && ctx.stage)
        ? ctx.stage
        : (this.app && this.app.stage)
          ? this.app.stage
          : null;

    if (!stage) {
      console.warn(
        "[MurkyBackground] No valid app.stage to attach to; background disabled."
      );
      return;
    }

    // Bail out if no image paths configured
    if (!this.imagePaths || this.imagePaths.length === 0) {
      console.warn("[MurkyBackground] No imagePaths provided; background disabled.");
      return;
    }

    console.info("[MurkyBackground] attach(): using app.stage as background layer");

    // --- Container & sprites -----------------------------------------------
    this._container = new PIXI.Container();

    // Put the fog layer *above* any existing stage content
    // (boot/main-menu backgrounds, etc.).
    stage.addChild(this._container);

    // Create two sprites, preferring preloaded textures when provided
    const texA = (this.textures && this.textures[0])
      ? this.textures[0]
      : PIXI.Texture.from(this.imagePaths[0]);

    const secondIndex = this.imagePaths.length > 1 ? 1 : 0;
    const texB = (this.textures && this.textures[secondIndex])
      ? this.textures[secondIndex]
      : PIXI.Texture.from(this.imagePaths[secondIndex]);

    this._spriteA = new PIXI.Sprite(texA);
    this._spriteB = new PIXI.Sprite(texB);

    this._spriteA.alpha = 1;
    this._spriteB.alpha = 0;

    this._spriteA.anchor.set(0.5);
    this._spriteB.anchor.set(0.5);

    this._container.addChild(this._spriteA);
    this._container.addChild(this._spriteB);

    // Use app renderer dimensions if available; fall back to window size.
    const width = this.app.renderer ? this.app.renderer.width : window.innerWidth;
    const height = this.app.renderer ? this.app.renderer.height : window.innerHeight;
    this.resize(width, height);

    this._currentIndex = 0;
    this._nextIndex = this.imagePaths.length > 1 ? 1 : 0;
    this._state = "hold";
    this._time = 0;
  }

  start() {
    // Ensure we have an app and that attach() has successfully created a container.
    // Prefer a rich context from getApp() (with layers/stage) if available.
    const ctx = (typeof getApp === "function") ? getApp() : this.app;

    if (!this._container || !this.app) {
      // attach() will safely no-op if ctx is invalid
      this.attach(ctx || this.app);
    }

    // If we still don't have a valid app or ticker or container, bail out silently.
    if (!this.app || !this.app.ticker || !this._container) {
      return;
    }

    // PIXI's Ticker doesn't expose a stable listeners() API across versions,
    // so we simply add our tick handler; duplicate adds are harmless.
    this.app.ticker.add(this._tickerFn);
  }

  stop() {
    if (this.app && this.app.ticker) {
      this.app.ticker.remove(this._tickerFn);
    }
  }

  destroy() {
    this.stop();
    if (this._container && this.app) {
      try {
        this.app.stage.removeChild(this._container);
      } catch (_) {}
    }
    if (this._spriteA) this._spriteA.destroy({ texture: false, baseTexture: false });
    if (this._spriteB) this._spriteB.destroy({ texture: false, baseTexture: false });

    this._spriteA = null;
    this._spriteB = null;
    this._container = null;
    this.app = null;
  }

  resize(width, height) {
    if (!this._spriteA || !this._spriteB) return;
    this._spriteA.x = width / 2;
    this._spriteA.y = height / 2;
    this._spriteB.x = width / 2;
    this._spriteB.y = height / 2;

    // Simple scaling to cover the view. You can refine this later.
    const maxDimension = Math.max(width, height);
    this._spriteA.width = maxDimension * 1.2;
    this._spriteA.height = maxDimension * 1.2;
    this._spriteB.width = maxDimension * 1.2;
    this._spriteB.height = maxDimension * 1.2;
  }

  setImages(imagePaths) {
    this.imagePaths = imagePaths || [];
    // You could reload textures here if needed; for now, assume static.
  }

  setSpeed({ fadeDuration, holdDuration }) {
    if (typeof fadeDuration === "number") this.fadeDuration = fadeDuration;
    if (typeof holdDuration === "number") this.holdDuration = holdDuration;
  }

  _onTick() {
    if (!this.app || !this._spriteA || !this._spriteB || this.imagePaths.length === 0) return;
    const dt = (this.app.ticker.deltaMS || 16) / 1000;
    this._time += dt;

    if (this._state === "hold") {
      if (this._time >= this.holdDuration) {
        this._state = "fade";
        this._time = 0;
      }
      return;
    }

    if (this._state === "fade") {
      const t = Math.min(this._time / this.fadeDuration, 1);
      this._spriteA.alpha = 1 - t;
      this._spriteB.alpha = t;

      if (t >= 1) {
        // Swap roles and advance indices
        this._currentIndex = this._nextIndex;
        const next = (this._currentIndex + 1) % this.imagePaths.length;
        this._nextIndex = next;

        // Prepare next texture on the fading-out sprite
        const temp = this._spriteA;
        this._spriteA = this._spriteB;
        this._spriteB = temp;

        this._spriteB.alpha = 0;
        const nextTex = (this.textures && this.textures[this._nextIndex])
          ? this.textures[this._nextIndex]
          : PIXI.Texture.from(this.imagePaths[this._nextIndex]);
        this._spriteB.texture = nextTex;

        this._state = "hold";
        this._time = 0;

        if (!this.loop && this._currentIndex === this.imagePaths.length - 1) {
          this.stop();
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DialogueScene
// ---------------------------------------------------------------------------

export default class DialogueScene {
  constructor() {
    this.story = null;         // inkjs Story instance
    this.areaId = null;
    this.mode = "dialogue";    // "dialogue" | "interior"
    this.entryKnot = null;
    this.returnTo = null;

    this.bg = null;            // MurkyBackground instance
    this.rootEl = null;        // scene root DOM element
    this.headerEl = null;
    this.bodyEl = null;
    this.choicesEl = null;
    this.minimapEl = null;

    this.currentZoneId = null;
    this.currentZoneLabel = null;
    this.visitedZones = new Set();

    // Optional hooks for PC/world state (to be wired into your actual engine)
    this.pc = null;
    this.world = null;
    this.lastSkillCheckResult = null;

    // Bound event handlers
    this._onShortRestCompleted = this._onShortRestCompleted.bind(this);
  }

  // sceneManager will call this when replacing the scene
  async start({
    script,
    areaId,
    mode = "dialogue",
    entryKnot,
    returnTo = null,
    pc = null,
    world = null
  } = {}) {
    if (!script) {
      console.warn("[DialogueScene] No script passed to start()");
      return;
    }

    this.areaId = areaId || "unknown_area";
    this.mode = mode;
    this.entryKnot = entryKnot || null;
    this.returnTo = returnTo;
    this.pc = pc;
    this.world = world;

    await this._setupBackground();
    this._setupDom();

    // Listen for rest completion events while this scene is active
    window.addEventListener("rest:short:completed", this._onShortRestCompleted);

    // --- Normalise script input ------------------------------------------------
    // We support three cases:
    //  1) script is already a compiled Ink JSON object
    //  2) script is a JSON string
    //  3) script is a relative path to a .json file (e.g. "./areas/00_pier/dockside.ink.json")
    let storySource = script;

    try {
      // Case 3: looks like a path to a JSON file
      if (
        typeof storySource === "string" &&
        (storySource.endsWith(".json") || storySource.endsWith(".ink.json")) &&
        (storySource.startsWith("./") || storySource.startsWith("../"))
      ) {
        console.info("[DialogueScene] Loading Ink JSON from path:", storySource);
        const response = await fetch(storySource);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while fetching ${storySource}`);
        }
        storySource = await response.text();
      }

      // Case 2: JSON string -> parse
      if (typeof storySource === "string") {
        try {
          storySource = JSON.parse(storySource);
        } catch (parseErr) {
          console.error(
            "[DialogueScene] Script looked like JSON but failed to parse:",
            parseErr
          );
          throw parseErr;
        }
      }

      // Case 1 (or after parsing): compiled Ink JSON object
      this.story = new Story(storySource);
    } catch (e) {
      console.error("[DialogueScene] Failed to create Ink Story:", e);
      return;
    }

    // Optionally jump to a specific entry knot
    if (this.entryKnot) {
      try {
        this.story.ChoosePathString(this.entryKnot);
      } catch (e) {
        console.warn("[DialogueScene] Invalid entryKnot:", this.entryKnot, e);
      }
    }

    // Apply any global flags/PC state here if needed later
    this._applyInitialTagsFromGlobalMetadata();

    // Prime the view
    this._advanceAndRender();
  }

  // Called every frame by sceneManager; we don't actually need per-frame logic
  update(_dt) {
    // MurkyBackground is driven by PIXI ticker, so nothing needed here
  }

  render(_alpha) {
    // All DOM-driven, no manual render pass needed
  }

  // sceneManager calls this when swapping scenes out
  cleanup() {
    // Detach event listeners
    window.removeEventListener("rest:short:completed", this._onShortRestCompleted);

    if (this.bg) {
      try { this.bg.destroy(); } catch (_) {}
      this.bg = null;
    }

    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
    this.headerEl = null;
    this.bodyEl = null;
    this.choicesEl = null;
    this.minimapEl = null;

    this.story = null;
    this.currentZoneId = null;
    this.currentZoneLabel = null;
    this.visitedZones.clear();
  }

  // -------------------------------------------------------------------------
  // Background setup
  // -------------------------------------------------------------------------

  async _setupBackground() {
    // Background policy (canonical): the global fog layer is initialised once at engine boot
    // (e.g. PreloadScene calling ensureFogLayer(app)). DialogueScene must not create or
    // re-initialise background systems.
    //
    // We keep MurkyBackground in this file for potential future use as an *optional overlay*,
    // but the default behaviour here is to do nothing.

    try {
      const appMaybe = getApp();
      const appCtx = (appMaybe && typeof appMaybe.then === "function")
        ? await appMaybe
        : appMaybe;

      const app = appCtx && (appCtx.app || appCtx);
      if (!app || !app.stage) {
        console.warn("[DialogueScene] No PIXI app found; background disabled.");
        return;
      }

      // No-op: fog is already attached globally.
      // If you later want a Dialogue-specific overlay, re-enable MurkyBackground here,
      // but it should attach to app.stage *above* fog (not replace it).
      this.bg = null;
    } catch (e) {
      console.warn("[DialogueScene] Background init skipped due to error:", e);
    }
  }

  // -------------------------------------------------------------------------
  // DOM setup
  // -------------------------------------------------------------------------

  _setupDom() {
let center =
  document.getElementById("game-root") ||
  document.getElementById("center") ||
  null;

if (!center) {
  console.warn("[DialogueScene] No #game-root or #center found; using document.body but preserving #pixi-root");
  center = document.body;
}

    // Ensure the host container itself is transparent so the canvas shows through.
    // Use !important via setProperty to beat any CSS rule that tries to paint an opaque panel.
    if (center) {
      try {
        center.style.setProperty("background", "transparent", "important");
        center.style.setProperty("background-color", "transparent", "important");
      } catch (_) {}
    }

    // Capture existing children so we can clear old UI (e.g. main menu)
    const existingChildren = Array.from(center.children);

    // Remove any previous dialogue root without touching other children (like the canvas).
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }

    const root = document.createElement("div");
    root.className = "dialogue-scene";

    // Let the PIXI background show through behind the dialogue scene.
    // Force transparency even if CSS uses !important.
    try {
      root.style.setProperty("background", "transparent", "important");
      root.style.setProperty("background-color", "transparent", "important");
    } catch (_) {}

    // Header is the location line (· LOCATION ·)
    const header = document.createElement("div");
    header.className = "dialogue-location";

    // Body holds prose + optional speaker labels
    const body = document.createElement("div");
    body.className = "dialogue-body";

    // Choices container
    const choices = document.createElement("div");
    choices.className = "dialogue-choices";

    const minimap = document.createElement("div");
    minimap.className = "dialogue-minimap";

    // Defensive: these sub-panels sometimes get a solid background via CSS.
    // Keep them transparent so fog stays visible.
    for (const el of [header, body, choices, minimap]) {
      try {
        el.style.setProperty("background", "transparent", "important");
        el.style.setProperty("background-color", "transparent", "important");
      } catch (_) {}
    }

    root.appendChild(header);
    root.appendChild(body);
    root.appendChild(choices);

    // Only show minimap in "interior" mode for now
    if (this.mode === "interior") {
      root.appendChild(minimap);
    }

    // Important: do NOT clear center.innerHTML; just add our overlay on top
    center.appendChild(root);

    // Remove any previous scene DOM (e.g., main menu), but NEVER remove the PIXI mount (#pixi-root).
    for (const child of existingChildren) {
      if (child === root) continue;
      if (child && child.id === "pixi-root") continue;

      try {
        center.removeChild(child);
      } catch (_) {
        // Ignore failures; this is just cleanup
      }
    }

    this.rootEl = root;
    this.headerEl = header;
    this.bodyEl = body;
    this.choicesEl = choices;
    this.minimapEl = minimap;

    this._updateHeaderTitle();
    this._updateMinimap();
  }

  _updateHeaderTitle() {
    if (!this.headerEl) return;

    // Try to get AREA_NAME from global tags
    let title = this.areaId || "Dialogue";
    if (this.story && Array.isArray(this.story.globalTags)) {
      const areaNameTag = this.story.globalTags.find(t => t.startsWith("AREA_NAME "));
      if (areaNameTag) {
        title = areaNameTag.substring("AREA_NAME ".length).trim();
      }
    }

    this.headerEl.textContent = title;
  }

  _updateMinimap() {
    if (!this.minimapEl || this.mode !== "interior") return;

    const label = this.currentZoneLabel || this.currentZoneId || "";
    // Minimal version: just show the current zone label.
    // You can expand this later into a proper block-based map.
    this.minimapEl.textContent = label;
  }

  // -------------------------------------------------------------------------
  // Ink story driving
  // -------------------------------------------------------------------------

  _applyInitialTagsFromGlobalMetadata() {
    if (!this.story || !Array.isArray(this.story.globalTags)) return;

    // Example: you could read AREA_TYPE, LIGHTING_STATE, MUSIC_THEME etc here
    // and notify other systems. For now, we just ensure header title uses AREA_NAME.
    this._updateHeaderTitle();
  }

  _advanceAndRender() {
    if (!this.story) return;

    // Collect all text until we hit choices or story ends
    const lines = [];

    while (this.story.canContinue) {
      const text = (this.story.Continue() || "").trim();
      const tags = this.story.currentTags || [];

      // Let the dialogue engine parse and apply stateful tag effects
      const gameState = getState();
      const actions = processTags(tags, gameState);
      // actions will be used for skill checks, gating, structural behaviour, etc.

      this._handleActions(actions);
      this._handleTags(tags);

      if (text) {
        lines.push(text);
      }
    }

    // Render body
    if (this.bodyEl) {
      this.bodyEl.innerHTML = "";
      for (const line of lines) {
        const p = document.createElement("div");
        p.className = "dialogue-prose";
        p.textContent = line;
        this.bodyEl.appendChild(p);
      }
    }

    // Render choices
    this._renderChoices();
  }

  _handleActions(actions) {
    if (!Array.isArray(actions) || !this.story) return;

    const gameState = getState();
    const player = gameState.player || {};

    for (const action of actions) {
      switch (action.type) {
        case "skill_check": {
          const result = performSkillCheck({
            skill: action.skill,
            dc: action.dc,
            player,
            roller: rollD20
          });

          this.lastSkillCheckResult = result;

          // Expose result to Ink via global variables, if desired.
          try {
            const vars = this.story.variablesState;
            if (vars) {
              vars["last_skill_success"] = result.success === true;
              vars["last_skill_total"] = result.total;
              vars["last_skill_dc"] = result.dc ?? 0;
              vars["last_skill_name"] = result.skill || "";
            }
          } catch (e) {
            console.warn("[DialogueScene] Failed to write skill check vars:", e);
          }
          break;
        }

        case "start_combat": {
          const encounterId = action.encounterId;
          if (!encounterId) {
            console.warn("[DialogueScene] START_COMBAT action without encounterId");
            break;
          }
          const exit = {
            toScene: "combat",
            reason: "start_combat",
            encounterId,
            returnTo: {
              scene: "dialogue",
              areaId: this.areaId || "unknown_area"
            }
          };
          window.dispatchEvent(new CustomEvent("game:exit", { detail: exit }));
          break;
        }

        case "exit_area": {
          const targetArea = action.areaId || this.areaId;
          const exit = {
            toScene: "exploration",
            reason: "exit_area",
            areaId: targetArea || "unknown_area"
          };
          window.dispatchEvent(new CustomEvent("game:exit", { detail: exit }));
          break;
        }

        case "short_rest": {
          RestUI.open({ type: "short" });
          break;
        }

        default:
          // Non-skill actions are handled elsewhere (e.g., _handleTags or scene/router).
          break;
      }
    }
  }

  _renderChoices() {
    if (!this.story || !this.choicesEl) return;

    const choices = this.story.currentChoices || [];
    this.choicesEl.innerHTML = "";

    if (!choices.length) {
      // No choices and no further content: end of story
      const endRow = document.createElement("div");
      endRow.className = "dialogue-choice";
      endRow.setAttribute("role", "button");
      endRow.tabIndex = 0;

      const num = document.createElement("span");
      num.className = "choice-num";
      num.textContent = "";

      const dot = document.createElement("span");
      dot.className = "choice-dot";
      dot.textContent = "·";

      const text = document.createElement("span");
      text.className = "choice-text";
      text.textContent = "Continue";

      endRow.appendChild(num);
      endRow.appendChild(dot);
      endRow.appendChild(text);

      const activate = () => this._handleEndOfStory();
      endRow.addEventListener("click", activate);
      endRow.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });

      this.choicesEl.appendChild(endRow);
      return;
    }

    // Prepare a lightweight state view for gating
    const gameState = getState();
    const player = gameState.player || {};
    const flags = gameState.flags || {};
    const gatingState = { player, flags };

    let rendered = 0;

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];

      // Ink/inkjs exposes tags per choice as choice.tags (if used); otherwise default to empty.
      const rawTags = Array.isArray(choice.tags) ? choice.tags : [];
      const actions = parseTags(rawTags);
      const available = isChoiceAvailable(actions, gatingState);
      if (!available) continue;

      // Determine semantic presentation flags
      const hasSkillCheck = Array.isArray(actions) && actions.some(a => a && a.type === "skill_check");
      const isDesc = Array.isArray(actions) && actions.some(a => a && a.type === "style" && String(a.value || "").toLowerCase() === "desc");

      const row = document.createElement("div");
      row.className = "dialogue-choice" + (hasSkillCheck ? " has-check" : "") + (isDesc ? " is-desc" : "");
      row.setAttribute("role", "button");
      row.tabIndex = 0;

      const num = document.createElement("span");
      num.className = "choice-num";
      num.textContent = String(rendered + 1);

      const dot = document.createElement("span");
      dot.className = "choice-dot";
      dot.textContent = "·";

      const text = document.createElement("span");
      text.className = "choice-text";
      text.textContent = choice.text;

      row.appendChild(num);
      row.appendChild(dot);
      row.appendChild(text);

      const activate = () => {
        try {
          this.story.ChooseChoiceIndex(choice.index);
        } catch (e) {
          console.warn("[DialogueScene] Failed to choose choice:", e);
          return;
        }
        this._advanceAndRender();
      };

      row.addEventListener("click", activate);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });

      this.choicesEl.appendChild(row);
      rendered++;
    }

    // If all choices were filtered out, present a disabled fallback.
    if (!rendered) {
      const dead = document.createElement("div");
      dead.className = "dialogue-choice";
      dead.style.opacity = "0.5";

      const num = document.createElement("span");
      num.className = "choice-num";
      num.textContent = "";

      const dot = document.createElement("span");
      dot.className = "choice-dot";
      dot.textContent = "·";

      const text = document.createElement("span");
      text.className = "choice-text";
      text.textContent = "(No valid options)";

      dead.appendChild(num);
      dead.appendChild(dot);
      dead.appendChild(text);

      this.choicesEl.appendChild(dead);
    }
  }

  _handleEndOfStory() {
    // When Ink story truly ends (no canContinue, no choices),
    // decide what to do next based on returnTo, or emit an exit event.
    if (this.returnTo && this.returnTo.scene === "exploration") {
      const exit = {
        toScene: "exploration",
        reason: "dialogue_end",
        areaId: this.returnTo.areaId || this.areaId || "unknown_area"
      };
      window.dispatchEvent(new CustomEvent("game:exit", { detail: exit }));
      return;
    }

    // Default: emit a generic "return" exit back to exploration
    const exit = {
      toScene: "exploration",
      reason: "dialogue_end",
      areaId: this.areaId || "unknown_area"
    };
    window.dispatchEvent(new CustomEvent("game:exit", { detail: exit }));
  }

  // -------------------------------------------------------------------------
  // Tag handling
  // -------------------------------------------------------------------------

  _handleTags(tags) {
    if (!Array.isArray(tags)) return;

    for (const tag of tags) {
      const parts = tag.split(/\s+/);
      const head = parts[0];

      switch (head) {
        // --- Area / zone metadata ---
        case "ZONE_ID": {
          const zoneId = parts[1];
          if (zoneId) {
            this.currentZoneId = zoneId;
            this.visitedZones.add(zoneId);
            this._updateMinimap();
          }
          break;
        }
        case "ZONE_LABEL": {
          const label = parts.slice(1).join(" ");
          if (label) {
            this.currentZoneLabel = label;
            this._updateMinimap();
          }
          break;
        }

        // --- Flow control / exits ---
        case "EXIT_AREA": {
          const targetArea = parts[1] || this.areaId;
          const exit = {
            toScene: "exploration",
            reason: "exit_area_legacy",
            areaId: targetArea || "unknown_area"
          };
          window.dispatchEvent(new CustomEvent("game:exit", { detail: exit }));
          break;
        }
        case "START_COMBAT": {
          const encounterId = parts[1];
          const exit = {
            toScene: "combat",
            reason: "start_combat_legacy",
            encounterId,
            returnTo: {
              scene: "dialogue",
              areaId: this.areaId || "unknown_area"
            }
          };
          window.dispatchEvent(new CustomEvent("game:exit", { detail: exit }));
          break;
        }
        case "SHORT_REST": {
          RestUI.open({ type: "short" });
          break;
        }

        // --- Checks / gating hooks (to be fully wired into engine) ---
        case "SKILL_CHECK":
        case "REQ_CLASS":
        case "REQ_ABILITY":
        case "REQ_SKILL":
        case "REQ_FLAG":
        case "REQ_NOT_FLAG":
        case "PC_DELTA":
        case "SET_FLAG":
        case "ONCE_FLAG":
        case "GIVE_ITEM":
        case "STYLE":
          // These will be interpreted at the choice level or via a shared tag interpreter.
          // For now we just log them; engine-side wiring comes next.
          // console.debug("[DialogueScene] Tag (deferred):", tag);
          break;

        default:
          // Unknown tags: safe to ignore for now
          // console.debug("[DialogueScene] Unknown tag:", tag);
          break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Choice gating stub
  // -------------------------------------------------------------------------

  _isChoiceAllowed(choice) {
    // Placeholder: engine-side gating based on choice.tags and PC/world state.
    // Example idea:
    //
    // const tags = choice.tags || [];
    // for (const tag of tags) {
    //   const [head, ...rest] = tag.split(/\s+/);
    //   switch (head) {
    //     case "REQ_CLASS": if (this.pc?.class !== rest[0]) return false; break;
    //     // etc...
    //   }
    // }
    //
    // For now, everything is allowed.
    return true;
  }
  _onShortRestCompleted(evt) {
    const detail = (evt && evt.detail) || {};
    if (!detail.didRest) return;

    // Update rest counters and hunger using the shared rest_counters module.
    const state = getState();
    // For now we derive a simple key; later this can be tied to characterId/saveId.
    const key =
      (state && state.meta && state.meta.saveId) ||
      (state && state.player && state.player.id) ||
      "default";

    const hungerInfo = restCounters.beginRestAndUpdateHunger(state, key);
    const shortRestsUsed = restCounters.incrementShortRestsUsed(key);

    console.info("[DialogueScene] Short rest completed in dialogue context:", {
      detail,
      shortRestsUsed,
      hungerInfo,
    });
  }
}