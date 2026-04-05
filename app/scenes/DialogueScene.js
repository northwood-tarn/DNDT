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
import {
  processTags,
  parseTags,
  isChoiceAvailable,
  performSkillCheck,
  getSkillCheckAction
} from "./dialogueEngine.js";
import renderMiniMap from "../ui/renderMiniMap.js";


import { rollD20 } from "../utils/dice.js";
import { getState, setState, derivePlayerStats } from "../state/stateStore.js";
window.__DNDT_getState = getState;

import restCounters from "../state/rest_counters.js";
import { getArea } from "../areas/registry.generated.js";

// Session-only cache (survives scene re-entry because it lives at module scope)
const SESSION_SEEN_DESC = new Set();

const SESSION_SEEN_SKILL_SCHEMA = new Set();

function _normSkillKey(skill) {
  return String(skill || "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function getPlayerSkillMod(player, skill) {
  const key = _normSkillKey(skill);
  if (!player || !key) return 0;

  // Common shapes:
  //  - player.skills.{investigation}: number | { mod/bonus/total }
  //  - player.skillMods.{investigation}: number
  //  - player.skill_mods.{investigation}: number
  //  - player.stats.skills...
  const candidates = [
    player.skills,
    player.skillMods,
    player.skill_mods,
    player.stats?.skills,
    player.stats?.skillMods,
    player.stats?.skill_mods
  ].filter(Boolean);

  for (const bag of candidates) {
    // direct match
    if (Object.prototype.hasOwnProperty.call(bag, key)) {
      const v = bag[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (v && typeof v === "object") {
        const n = v.mod ?? v.bonus ?? v.total ?? v.value;
        if (typeof n === "number" && Number.isFinite(n)) return n;
      }
    }
    // case-insensitive match if stored as e.g. "Investigation"
    for (const k of Object.keys(bag)) {
      if (_normSkillKey(k) === key) {
        const v = bag[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (v && typeof v === "object") {
          const n = v.mod ?? v.bonus ?? v.total ?? v.value;
          if (typeof n === "number" && Number.isFinite(n)) return n;
        }
      }
    }
  }

  // One-time schema hint per skill so we can adapt without console spam.
  const stamp = key;
  if (!SESSION_SEEN_SKILL_SCHEMA.has(stamp)) {
    SESSION_SEEN_SKILL_SCHEMA.add(stamp);
    try {
      console.info("[DialogueScene][skill] could not resolve modifier; player keys:", {
        skill: key,
        playerKeys: Object.keys(player || {}),
        skillsKeys: Object.keys(player?.skills || {}),
        statsKeys: Object.keys(player?.stats || {})
      });
    } catch {}
  }

  return 0;
}
const isInkVarDeclared = (story, name) => { try { void story?.variablesState?.$(name); return true; } catch { return false; } };

function isDescLine(tags) {
  if (!Array.isArray(tags)) return false;
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const parts = t.trim().split(/\s+/);
    if (!parts.length) continue;
    if (parts[0].toUpperCase() === "STYLE" && String(parts[1] || "").toLowerCase() === "desc") return true;
  }
  return false;
}

function hasOnceDesc(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some(t => typeof t === "string" && t.trim().toUpperCase() === "ONCE_DESC");
}

function setSafeChoiceHTML(targetEl, raw) {
  if (!targetEl) return;

  // Default: plain text
  if (typeof raw !== "string" || raw.indexOf("<") === -1) {
    targetEl.textContent = raw ?? "";
    return;
  }

  // Allow only <span class="dialogue-skill"> and <span class="dialogue-class">.
  // If anything else looks like HTML, fall back to literal text.
  const allowedSpan = /<span\s+class=("|')dialogue-(skill|class)\1>([\s\S]*?)<\/span>/gi;

  // If removing allowed spans still leaves angle brackets, it contains other tags.
  const withoutAllowed = raw.replace(allowedSpan, "");
  if (withoutAllowed.includes("<") || withoutAllowed.includes(">")) {
    targetEl.textContent = raw;
    return;
  }

  // Render the allowed spans.
  targetEl.innerHTML = raw;
}

function plainTextForCompare(raw) {
  if (typeof raw !== "string") return "";
  // Strip inline HTML (we only allow spans, but be robust)
  // and normalise whitespace.
  return raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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

    // this.bg = null;            // MurkyBackground instance
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

    // Choice click lock
    this._choiceLocked = false;
    this._lastChosenChoiceText = null;
    this._pendingExit = false;
  }

  // sceneManager will call this when replacing the scene
  async start({
    script,
    areaId,
    mode = "dialogue",
    entryKnot,
    returnTo = null
  } = {}) {
    if (!script && !areaId) {
      console.warn("[DialogueScene] No script or areaId passed to start()");
      return;
    }

    this.areaId = areaId || "unknown_area";
    this.mode = mode;
    this.entryKnot = entryKnot || null;
    this.returnTo = returnTo;
    this._pendingExit = false;

    // Prefer resolving script path via generated registry when we have an areaId.
    // This prevents stale hardcoded paths like "./areas/00_pier/..." from breaking.
    let resolvedScript = script;
    if (this.areaId) {
      const reg = getArea(this.areaId);
      if (reg && typeof reg.script === "string") {
        // If caller didn't provide a script, or provided an old "./areas/..." path, prefer registry.
        if (reg && typeof reg.script === "string") {
  resolvedScript = reg.script;
        }
      }
    }

    // await this._setupBackground();
    this._setupDom();
    this._updateMinimap();

    // Listen for rest completion events while this scene is active
    window.addEventListener("rest:short:completed", this._onShortRestCompleted);

    // --- Normalise script input ------------------------------------------------
    // We support three cases:
    //  1) script is already a compiled Ink JSON object
    //  2) script is a JSON string
    //  3) script is a relative path to a .json file (e.g. "./areas/00_pier/dockside.ink.json")
    let storySource = resolvedScript;

    try {
      // Case 3: looks like a path to a JSON file
      if (
        typeof storySource === "string" &&
        (storySource.endsWith(".json") || storySource.endsWith(".ink.json")) &&
        (storySource.startsWith("./") || storySource.startsWith("../"))
      ) {
        console.info("[DialogueScene] Loading Ink JSON from path:", storySource);

        // Prefer IPC filesystem read (Electron) to avoid fragile file:// URL resolution.
        if (window.api && typeof window.api.readTextFile === "function") {
          storySource = await window.api.readTextFile(storySource);
        } else {
          // Fallback: fetch (works in dev server setups where the file is actually served)
          const response = await fetch(storySource);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} while fetching ${storySource}`);
          }
          storySource = await response.text();
        }
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

    // Determine entry knot:
    //  - Prefer explicit `entryKnot` passed into start()
    //  - Otherwise, fall back to Ink global tag: `DEFAULT_ENTRY <knot>`
    if (!this.entryKnot && this.story && Array.isArray(this.story.globalTags)) {
      const defaultEntryTag = this.story.globalTags.find(t => t.startsWith("DEFAULT_ENTRY "));
      if (defaultEntryTag) {
        this.entryKnot = defaultEntryTag.substring("DEFAULT_ENTRY ".length).trim() || null;
      }
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

    // No background cleanup required.

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
  // Background setup removed (MurkyBackground no longer used)
  // -------------------------------------------------------------------------

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


    // Capture existing children so we can clear old UI (e.g. main menu)
    const existingChildren = Array.from(center.children);

    // Remove any previous dialogue root without touching other children (like the canvas).
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }

    const root = document.createElement("div");
    root.className = "dialogue-scene";


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
    minimap.id = "minimap";
  
    root.appendChild(header);
    root.appendChild(body);
    root.appendChild(choices);

    // Minimap: shown whenever the scene is active; content depends on layouts + visited state.
    root.appendChild(minimap);

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
  if (!this.minimapEl) return;

  const s = getState();
  const player = s?.player || {};
  const mapState = player?.map || {};

  // Pull adjacency from the generated registry.
  const reg = this.areaId ? getArea(this.areaId) : null;
  const nextAreas = Array.isArray(reg?.nextAreas) ? reg.nextAreas : [];

  renderMiniMap({
    currentAreaId: this.areaId || "unknown_area",
    nextAreas,
    mapState,
    container: this.minimapEl,
    size: 150
  });
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

    while (this.story && this.story.canContinue && !this._pendingExit) {
      const text = (this.story.Continue() || "").trim();
      const tags = this.story.currentTags || [];

      // Let the dialogue engine parse and apply stateful tag effects
      const gameState = getState();
      const actions = processTags(tags, gameState);
      // actions will be used for skill checks, gating, structural behaviour, etc.

      this._handleActions(actions);
      this._handleTags(tags);

      // If an exit fired (scene swap/cleanup), stop immediately.
      if (this._pendingExit || !this.story) return;

      if (text) {
        // Session-only: descriptive prose is one-shot when tagged `STYLE desc` and ONCE_DESC.
        if (isDescLine(tags) && hasOnceDesc(tags)) {
          const path = this.story?.state?.currentPathString || "";
          const key = `${this.areaId || ""}::${path}::${plainTextForCompare(text)}`;
          if (SESSION_SEEN_DESC.has(key)) {
            continue;
          }
          SESSION_SEEN_DESC.add(key);
        }
        lines.push(text);
      }
    }

    // If Ink echoes the last chosen choice as the first line, suppress it once.
    if (this._lastChosenChoiceText && lines.length) {
      const first = plainTextForCompare(lines[0]);
      if (first && first === this._lastChosenChoiceText) {
        lines.shift();
      }
      // Clear after one pass so we don't hide legitimate repeated prose.
      this._lastChosenChoiceText = null;
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
        case "skill_check":
          // Skill checks are executed at choice-click time, not during render.
          break;

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
          this._pendingExit = true;
          const exit = {
            toScene: "dialogue",
            reason: "exit_area",
            areaId: targetArea || "unknown_area",
            fromScene: "dialogue"
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

  _beginChoiceChoreography(selectedRow) {
    if (!this.choicesEl) return;

    const all = this.choicesEl.querySelectorAll(".dialogue-choice");
    all.forEach((el) => {
      if (el === selectedRow) {
        el.classList.add("is-selected");
      } else {
        el.classList.add("is-fading-out");
      }
    });
  }
  

  _renderChoices() {
    if (!this.story || !this.choicesEl) return;

    const choices = this.story.currentChoices || [];
    this.choicesEl.innerHTML = "";
    this._choiceLocked = false;

    if (!choices.length) {
      // No choices and no further content: end of story
      const endRow = document.createElement("div");
      endRow.className = "dialogue-choice";
      endRow.setAttribute("role", "button");
      endRow.tabIndex = 0;

      const prefix = document.createElement("span");
      prefix.className = "choice-prefix";

      const num = document.createElement("span");
      num.className = "choice-num";
      num.textContent = "";

      const dot = document.createElement("span");
      dot.className = "choice-dot";
      dot.textContent = "·";

      prefix.appendChild(num);
      prefix.appendChild(dot);

      const text = document.createElement("span");
      text.className = "choice-text";
      text.textContent = "Continue";

      endRow.appendChild(prefix);
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

      const prefix = document.createElement("span");
      prefix.className = "choice-prefix";

      const num = document.createElement("span");
      num.className = "choice-num";
      num.textContent = String(rendered + 1);

      const dot = document.createElement("span");
      dot.className = "choice-dot";
      dot.textContent = "·";

      prefix.appendChild(num);
      prefix.appendChild(dot);

      const text = document.createElement("span");
      text.className = "choice-text";
      setSafeChoiceHTML(text, choice.text);
      // Append skill check label if present
      const skillAction = getSkillCheckAction(actions);
      if (skillAction && skillAction.skill) {
        const skillSpan = document.createElement("span");
        skillSpan.className = "dialogue-skill";
        skillSpan.textContent = ` ${skillAction.skill.replace(/_/g, " ")}`;
        text.appendChild(skillSpan);
      }

      row.appendChild(prefix);
      row.appendChild(text);

      const activate = () => {
        if (this._choiceLocked) return;
        this._choiceLocked = true;

        // IMPORTANT: Do NOT echo the selected choice text into the prose.
        // (Ink already advances the narrative; UI should not duplicate the user's click.)

        // Fade out the non-selected options first.
        this._beginChoiceChoreography(row);
        this._lastChosenChoiceText = plainTextForCompare(choice.text);

        // Run skill check once, at click time
        const skillAction = getSkillCheckAction(actions);
        if (skillAction) console.log("[DialogueScene][skillAction]", skillAction);
        if (skillAction) {
          const roll = (rollD20()?.total ?? 0);
          // --- Modified block: calculate mod with derived equipment bonus ---
          const baseMod = getPlayerSkillMod(player, skillAction.skill);
          const derived = derivePlayerStats(getState());
          const skillKey = _normSkillKey(skillAction.skill);
          const equipBonus = Number(derived?.skillBonuses?.[skillKey] ?? 0) || 0;
          const ac = Number(derived?.ac ?? 0) || 0;
          const mod = baseMod + equipBonus;
          // --- End modified block ---
          const dc = Number(skillAction.dc ?? 0);
          const total = roll + mod;
          const success = total >= dc;
          const result = {
            skill: skillAction.skill,
            dc,
            roll,
            mod,
            total,
            success,
            ac
          };
          console.info("[DialogueScene][skill]", {
            skill: result.skill,
            dc: result.dc,
            roll: result.roll,
            mod: result.mod,
            total: result.total,
            success: result.success
          });

          this.lastSkillCheckResult = result;
          // Annotate the chosen choice with success/failure styling
          if (result && result.success === true) {
            row.classList.add("skill-success");
          } else if (result && result.success === false) {
            row.classList.add("skill-failure");
          }

          const vars = this.story?.variablesState;
          if (vars) {
            // Write vars opportunistically. Ink throws if the VAR wasn't declared in the story.
            try { vars.$("last_skill_success", result.success === true); } catch {}
            try { vars["last_skill_total"] = result.total; } catch {}
            try { vars["last_skill_dc"] = result.dc ?? 0; } catch {}
            try { vars["last_skill_name"] = result.skill || ""; } catch {}
          }
        }

        // Advance after a short beat so the player sees the chosen option alone.
        window.setTimeout(() => {
          try {
            this.story.ChooseChoiceIndex(choice.index);
          } catch (e) {
            console.warn("[DialogueScene] Failed to choose choice:", e);
            this._choiceLocked = false;
            this._lastChosenChoiceText = null;
            return;
          }
          this._advanceAndRender();
        }, 500);
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

      const prefix = document.createElement("span");
      prefix.className = "choice-prefix";

      const num = document.createElement("span");
      num.className = "choice-num";
      num.textContent = "";

      const dot = document.createElement("span");
      dot.className = "choice-dot";
      dot.textContent = "·";

      prefix.appendChild(num);
      prefix.appendChild(dot);

      const text = document.createElement("span");
      text.className = "choice-text";
      text.textContent = "(No valid options)";

      dead.appendChild(prefix);
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
        case "EXIT_ZONE": {
          const zoneId = parts[1];
          if (zoneId) {
            this.currentZoneId = zoneId;
            this.visitedZones.add(zoneId);
            this._updateMinimap();
          }
          break;
        }
        // --- Flow control / exits ---
        case "EXIT_AREA": {
          const targetArea = parts[1] || this.areaId;
          this._pendingExit = true;
          const exit = {
            toScene: "dialogue",
            reason: "exit_area_legacy",
            areaId: targetArea || "unknown_area",
            fromScene: "dialogue"
          };
          window.dispatchEvent(new CustomEvent("game:exit", { detail: exit }));
          return;
        }
        case "START_COMBAT": {
          this._pendingExit = true;
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
          // These will be interpreted at the choice level or via a shared tag interpreter.
          // For now we just log them; engine-side wiring comes next.
          // console.debug("[DialogueScene] Tag (deferred):", tag);
          break;
        case "GIVE_ITEM": {
          const itemId = parts[1];
          const qtyRaw = parts[2];
          const qty = Math.max(1, Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 1);

          if (!itemId) break;

          const s = getState();
          const player = s?.player || {};
          const inv = Array.isArray(player.inventory) ? [...player.inventory] : [];

          // Support a couple of inventory entry shapes.
          const idx = inv.findIndex(e => {
            if (!e) return false;
            if (typeof e === "string") return e === itemId;
            if (typeof e === "object") return e.id === itemId || e.itemId === itemId;
            return false;
          });

          if (idx === -1) {
            inv.push({ id: itemId, qty });
          } else {
            const cur = inv[idx];
            if (typeof cur === "string") {
              // Promote string entry to object.
              inv[idx] = { id: itemId, qty: qty + 1 };
            } else {
              const curQty = Number(cur.qty ?? cur.quantity ?? 0) || 0;
              inv[idx] = { ...cur, id: cur.id ?? cur.itemId ?? itemId, qty: curQty + qty };
            }
          }

          setState({
            ...s,
            player: {
              ...player,
              inventory: inv
            }
          });

          console.info("[DialogueScene][inventory] give item", { itemId, qty });
          break;
        }

        case "REMOVE_ITEM": {
          const itemId = parts[1];
          const qtyRaw = parts[2];
          const qty = Math.max(1, Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 1);

          if (!itemId) break;

          const s = getState();
          const player = s?.player || {};
          const inv = Array.isArray(player.inventory) ? [...player.inventory] : [];

          const idx = inv.findIndex(e => {
            if (!e) return false;
            if (typeof e === "string") return e === itemId;
            if (typeof e === "object") return e.id === itemId || e.itemId === itemId;
            return false;
          });

          if (idx === -1) {
            // Nothing to remove.
            break;
          }

          const cur = inv[idx];
          if (typeof cur === "string") {
            // If strings are used, they represent 1 unit.
            inv.splice(idx, 1);
          } else {
            const curQty = Number(cur.qty ?? cur.quantity ?? 0) || 0;
            const nextQty = curQty - qty;
            if (nextQty > 0) {
              inv[idx] = { ...cur, id: cur.id ?? cur.itemId ?? itemId, qty: nextQty };
            } else {
              inv.splice(idx, 1);
            }
          }

          setState({
            ...s,
            player: {
              ...player,
              inventory: inv
            }
          });

          console.info("[DialogueScene][inventory] remove item", { itemId, qty });
          break;
        }

        case "GIVE_GOLD": {
          const amountRaw = parts[1];
          const amount = Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : 0;
          if (!amount) break;

          const s = getState();
          const player = s?.player || {};
          const curGold = Number(player.gold ?? 0) || 0;

          setState({
            ...s,
            player: {
              ...player,
              gold: curGold + amount
            }
          });

          console.info("[DialogueScene][inventory] give gold", { amount, gold: curGold + amount });
          break;
        }
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