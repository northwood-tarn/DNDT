// dialogueEngine.js
// Logic-only orchestration layer for dialogue & interior exploration.
// This module parses Ink tags into structured actions and provides
// helpers for skill checks and choice gating. It does NOT touch the DOM
// or scenes directly.

// NOTE: keep this file UI-free. DialogueScene (or any other scene)
// should import these helpers and decide how to render / transition.

import { getState } from "../state/stateStore.js";

/**
 * Parsed tag/action shape examples:
 *   { type: "short_rest" }
 *   { type: "start_combat", encounterId: "dockside_thugs" }
 *   { type: "exit_area", areaId: "lightwell" }
 *   { type: "set_flag", key: "heard_dock_rumours", value: true }
 *   { type: "pc_delta", stat: "hp", amount: -3 }
 *   { type: "skill_check", skill: "Perception", dc: 15 }
 *   REQ_ITEM itemId [qty]
 */

// ---------------------------------------------------------------------------
// Tag parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single Ink tag string into a structured action object.
 *
 * Tag conventions (first word = command head):
 *   SHORT_REST
 *   START_COMBAT encounterId
 *   EXIT areaId
 *   SET_FLAG flagName [value]
 *   CLEAR_FLAG flagName
 *   PC_DELTA statName amount
 *   SKILL_CHECK skillName dc
 *   REQ_CLASS className
 *   REQ_FLAG flagName
 *   REQ_SKILL skillName minBonus
 *   REQ_ITEM itemId [qty]
 */
export function parseTag(rawTag) {
  if (!rawTag || typeof rawTag !== "string") return null;

  const trimmed = rawTag.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  const head = parts[0].toUpperCase();
  const rest = parts.slice(1);

  switch (head) {
    case "SHORT_REST":
      return { type: "short_rest" };

    case "START_COMBAT":
      return {
        type: "start_combat",
        encounterId: rest[0] || null
      };

    case "EXIT":
      return {
        type: "exit_area",
        areaId: rest[0] || null
      };

    case "SET_FLAG": {
      const key = rest[0];
      const valueStr = rest.slice(1).join(" ");
      let value;
      if (!valueStr) {
        value = true;
      } else if (valueStr === "true") {
        value = true;
      } else if (valueStr === "false") {
        value = false;
      } else if (!Number.isNaN(Number(valueStr))) {
        value = Number(valueStr);
      } else {
        value = valueStr;
      }
      return { type: "set_flag", key, value };
    }

    case "CLEAR_FLAG":
      return { type: "clear_flag", key: rest[0] };

    case "PC_DELTA": {
      const stat = rest[0];
      const amount = Number(rest[1]);
      return { type: "pc_delta", stat, amount: Number.isFinite(amount) ? amount : 0 };
    }

    case "SKILL_CHECK": {
      const skill = rest[0];
      const dc = Number(rest[1]);
      return {
        type: "skill_check",
        skill,
        dc: Number.isFinite(dc) ? dc : null
      };
    }

    case "REQ_CLASS":
      return { type: "req_class", className: rest[0] };

    case "REQ_FLAG":
      return { type: "req_flag", flag: rest[0] };

    case "REQ_SKILL": {
      const skill = rest[0];
      const minBonus = Number(rest[1]);
      return {
        type: "req_skill",
        skill,
        minBonus: Number.isFinite(minBonus) ? minBonus : 0
      };
    }

    case "REQ_ITEM": {
      const itemId = rest[0] || null;
      const qty = Number(rest[1]);
      return {
        type: "req_item",
        itemId,
        qty: Number.isFinite(qty) ? qty : 1
      };
    }

    default:
      // Unknown tag head: keep raw for debugging but don’t crash.
      return { type: "unknown", raw: rawTag };
  }
}

/**
 * Parse an array of Ink tag strings.
 * Returns an array of structured action objects (unknown tags preserved
 * as type: "unknown").
 */
export function parseTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  const out = [];
  for (const tag of rawTags) {
    const parsed = parseTag(tag);
    if (parsed) out.push(parsed);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Choice gating helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a requirement-style action is satisfied for the given
 * player/world state.
 *
 * This is intentionally conservative; it never mutates state.
 *
 * @param {Object} reqAction - e.g. { type: "req_class", className: "Fighter" }
 * @param {Object} state - { player, flags }
 */
export function isRequirementMet(reqAction, state) {
  if (!reqAction) return true;

  const s = state || getState() || {};
  const { player = {}, flags = {} } = s;

  switch (reqAction.type) {
    case "req_class": {
      const pcClass = player.class || player.className;
      if (!pcClass || !reqAction.className) return false;
      return String(pcClass).toLowerCase() === String(reqAction.className).toLowerCase();
    }

    case "req_flag": {
      if (!reqAction.flag) return false;
      return Boolean(flags[reqAction.flag]);
    }

    case "req_skill": {
      const skillKey = reqAction.skill;
      if (!skillKey) return false;
      const skills = player.skills || {};
      const bonus = skills[skillKey] ?? 0;
      return bonus >= (reqAction.minBonus ?? 0);
    }

    case "req_item": {
      const itemId = reqAction.itemId;
      const need = Number(reqAction.qty ?? 1) || 1;
      if (!itemId) return false;

      const inv = player.inventory;

      // Support inventory as an array of entries (recommended), or a map/object.
      if (Array.isArray(inv)) {
        let have = 0;
        for (const e of inv) {
          if (!e) continue;
          if (typeof e === "string") {
            if (e === itemId) have += 1;
          } else if (typeof e === "object") {
            const id = e.id ?? e.itemId;
            if (id !== itemId) continue;
            const q = Number(e.qty ?? e.quantity ?? 1) || 1;
            have += q;
          }
          if (have >= need) return true;
        }
        return have >= need;
      }

      if (inv && typeof inv === "object") {
        const v = inv[itemId];
        const have = Number(v ?? 0) || 0;
        return have >= need;
      }

      return false;
    }

    default:
      return true;
  }
}

/**
 * Given a choice object and its associated tags, determine whether the
 * choice should be available.
 *
 * You pass in the already-parsed actions for that choice, and this will
 * check all requirement-type actions.
 */
export function isChoiceAvailable(parsedActions, state) {
  if (!Array.isArray(parsedActions) || parsedActions.length === 0) return true;

  const s = state || getState() || {};

  for (const action of parsedActions) {
    if (action.type === "req_class" || action.type === "req_flag" || action.type === "req_skill" || action.type === "req_item") {
      if (!isRequirementMet(action, s)) return false;
    }
  }

  return true;
}

/**
 * Extract the first skill_check action from a parsed action list.
 * This does NOT perform the roll and does NOT mutate state.
 * Intended to be used by the scene at choice-click time.
 */
export function getSkillCheckAction(parsedActions) {
  if (!Array.isArray(parsedActions)) return null;
  return parsedActions.find(a => a && a.type === "skill_check") || null;
}

// ---------------------------------------------------------------------------
// Skill check helper (logic only; no UI)
// ---------------------------------------------------------------------------

/**
 * Perform a skill check. This does NOT decide success/failure branching;
 * it just returns the roll result. The caller can compare to DC and
 * choose which Ink choice/knot to follow.
 *
 * The roller function is injected so we don’t hard-wire this module to
 * any particular dice implementation. You can pass in dice.rollD20 or a
 * custom wrapper.
 *
 * @param {Object} params
 *   { skill: string, dc: number, player: object, roller: function }
 */
export function performSkillCheck({ skill, dc, player, roller }) {
  const globalState = getState() || {};
  const pc = player || globalState.player || {};
  const skills = pc.skills || {};

  // Skill bonus lookup: accept exact key or case-insensitive key.
  const skillKey = (skill || "").trim();
  const skillKeyLower = skillKey.toLowerCase();
  const skillsLower = Object.fromEntries(
    Object.entries(skills).map(([k, v]) => [String(k).toLowerCase(), v])
  );
  const bonus = Number(skills[skillKey] ?? skillsLower[skillKeyLower] ?? 0) || 0;

  // Roller should be a function returning a d20 roll; if omitted, we
  // fall back to Math.random.
  const rollFn = typeof roller === "function" ? roller : () => 1 + Math.floor(Math.random() * 20);

  const baseRoll = rollFn();
  const total = baseRoll + bonus;

  return {
    skill,
    dc: dc ?? null,
    roll: baseRoll,
    bonus,
    total,
    success: typeof dc === "number" ? total >= dc : null
  };
}

// ---------------------------------------------------------------------------
// PC/world mutation helpers
// ---------------------------------------------------------------------------

/**
 * Apply a non-requirement action (set_flag, clear_flag, pc_delta, etc.)
 * to the given mutable state.
 */
export function applyAction(action, mutableState) {
  if (!action) return;

  const state = mutableState || getState();
  if (!state) return;

  const player = state.player || (state.player = {});
  const flags = state.flags || (state.flags = {});

  switch (action.type) {
    case "set_flag":
      if (action.key) flags[action.key] = action.value;
      break;

    case "clear_flag":
      if (action.key) delete flags[action.key];
      break;

    case "pc_delta": {
      const stat = action.stat;
      const amount = action.amount ?? 0;
      if (!stat || !Number.isFinite(amount)) break;

      if (stat === "hp") {
        const { current, max } = getHpSnapshot(player);
        const next = (current ?? 0) + amount;
        setHpSnapshot(player, next, max);
      } else {
        const currentVal = Number(player[stat]) || 0;
        player[stat] = currentVal + amount;
      }
      break;
    }

    default:
      // start_combat, exit_area, short_rest, etc. are not applied here;
      // the scene/router should react to them instead.
      break;
  }
}

function getHpSnapshot(player) {
  const current =
    typeof player.hp === "number"
      ? player.hp
      : typeof player.currentHp === "number"
      ? player.currentHp
      : 0;

  const max =
    typeof player.maxHp === "number"
      ? player.maxHp
      : typeof player.hpMax === "number"
      ? player.hpMax
      : typeof player.maxHP === "number"
      ? player.maxHP
      : current;

  return { current, max };
}

function setHpSnapshot(player, newCurrent, max) {
  const clampedMax = Number.isFinite(max) ? max : newCurrent;
  const clampedCurrent = Math.max(0, Math.min(newCurrent, clampedMax));

  if (typeof player.hp === "number") {
    player.hp = clampedCurrent;
  } else if (typeof player.currentHp === "number") {
    player.currentHp = clampedCurrent;
  } else {
    player.hp = clampedCurrent;
  }

  if (typeof player.maxHp !== "number" && typeof player.hpMax !== "number" && typeof player.maxHP !== "number") {
    player.maxHp = clampedMax;
  }
}

// ---------------------------------------------------------------------------
// Aggregate helper
// ---------------------------------------------------------------------------

/**
 * Convenience helper: given raw tag strings and a mutable game state,
 * parse them, apply non-requirement actions, and return the parsed
 * actions for the caller (scene) to further interpret.
 */
export function processTags(rawTags, mutableState) {
  const state = mutableState || getState();
  const actions = parseTags(rawTags);
  for (const action of actions) {
    applyAction(action, state);
  }
  return actions;
}

export default {
  parseTag,
  parseTags,
  isRequirementMet,
  isChoiceAvailable,
  getSkillCheckAction,
  performSkillCheck,
  applyAction,
  processTags
};