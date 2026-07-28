import { createCombatGame } from "../combat/api.js";
import { canSelectCombatAction, getActionLabel, getCurrentActor, getValidTargets } from "../combat/selectors.js";
import { installSystemMenu } from "../ui/SystemMenu.js";
import { getSpellById } from "../data/spells.js";
import { getWeaponMastery } from "../data/weaponMasteries.js";
import { getCondition } from "../data/conditions.js";
import { createCatastrophicChargeVariant } from "../combat/deviceActions.js";

installSystemMenu({ combat: true });

const combatGame = createCombatGame({
  scenarioId: "combat-ui-lantern-cleric-l13",
  scenarioOptions: { enemyHp: 999, enemyPosition: { x: 2, y: 1 } },
});

const conditions = document.querySelector("#combatConditions");
const column = document.querySelector(".combat-ui-column");

conditions.style.width = "max-content";
const naturalBlockWidth = Math.ceil(conditions.scrollWidth) + 18;
column.style.setProperty("--combat-block-width", `${Math.max(210, Math.round(naturalBlockWidth * 0.9))}px`);
conditions.style.width = "";

const log = document.querySelector(".combat-ui-log");

const logToggle = document.querySelector(".combat-ui-log-toggle");
logToggle.addEventListener("click", () => {
  const collapsed = log.classList.toggle("is-collapsed");
  logToggle.setAttribute("aria-expanded", String(!collapsed));
  logToggle.setAttribute("aria-label", collapsed ? "Open combat log" : "Collapse combat log");
});

const character = document.querySelector(".combat-ui-character");
const characterToggle = document.querySelector(".combat-ui-character-toggle");

characterToggle.addEventListener("click", () => {
  const collapsed = character.classList.toggle("is-collapsed");
  characterToggle.setAttribute("aria-expanded", String(!collapsed));
  characterToggle.setAttribute("aria-label", collapsed ? "Open character information" : "Collapse character information");
});

function appendCondition({ name, kind = "condition", description = "" } = {}) {
  if (!name) return;

  const item = document.createElement("li");
  item.tabIndex = 0;
  item.className = kind === "benefit" ? "is-benefit" : "is-condition";
  const label = document.createElement("span");
  label.textContent = name;
  item.append(label);
  if (description) {
    const tooltip = document.createElement("span");
    tooltip.className = "combat-condition-tooltip";
    tooltip.textContent = description;
    tooltip.setAttribute("role", "tooltip");
    item.append(tooltip);
    item.setAttribute("aria-label", `${name}. ${description}`);
  }

  conditions.append(item);
}

document.addEventListener("combat:condition-applied", (event) => {
  appendCondition(event.detail);
});

const combatActionButtons = [...document.querySelectorAll(".combat-action-menu [data-combat-mode]")];
const combatActionMenu = document.querySelector(".combat-action-menu");
const contextMenu = document.querySelector(".combat-context-menu");
const contextOptions = document.querySelector(".combat-context-options");
const contextBack = document.querySelector(".combat-context-back");
const contextStatus = document.querySelector(".combat-context-status");
const combatLogList = document.querySelector(".combat-ui-log ol");
let selectedCombatMode = "movement";
let selectedCategory = null;
let selectedSpellLevel = null;
let selectedSpellSourceId = null;
let spellRhythmPrompt = false;
let selectedDeviceMode = null;
let layoutFrame = null;
window.addEventListener("resize", scheduleLayoutRefresh);
document.body.dataset.combatActivity = "click_to_travel";
combatActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    combatActionButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });

    const mode = button.dataset.combatMode;
    selectedCombatMode = mode;
    selectedCategory = null;
    selectedSpellLevel = null;
    selectedSpellSourceId = null;
    spellRhythmPrompt = false;
    selectedDeviceMode = null;
    document.body.dataset.combatActivity = mode === "movement" ? "click_to_travel" : `${mode}_selection`;
    if (mode === "movement") closeContextMenu();
    else renderCategoryMenu();
    document.dispatchEvent(new CustomEvent("combat:activity-changed", {
      detail: {
        mode,
        activity: document.body.dataset.combatActivity,
        clearTargeting: mode === "movement",
      },
    }));
  });
});

const combatSettingsButton = document.querySelector(".combat-settings-button");
combatSettingsButton.addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("combat:settings-requested"));
});

const endTurnButton = document.querySelector('[data-combat-command="end_turn"]');
endTurnButton.addEventListener("click", async () => {
  document.dispatchEvent(new CustomEvent("combat:end-turn-requested"));
  const endingActor = heroActor();
  endingActor.actions = endingActor.actions.filter((action) => !action.tags?.spellRhythmFollowup);
  combatGame.endTurn();
  while (getCurrentActor(combatGame.snapshot)?.team === "enemies" && !combatGame.snapshot.outcome) {
    await combatGame.runEnemyTurnIfNeeded();
  }
  selectTopLevelMode("movement");
  renderCharacterState();
  renderCombatLog();
});

contextBack.addEventListener("click", () => {
  goBackOneLevel();
});

function renderCategoryMenu() {
  const actor = heroActor();
  const actions = actionsForSelectedMode(actor);
  const categories = ACTION_CATEGORIES.filter((category) => actions.some(category.matches));
  contextMenu.hidden = false;
  contextBack.hidden = true;
  contextOptions.replaceChildren(menuRow(categories.map((category) => menuButton(categoryMenuLabel(actor, category), () => {
    selectedCategory = category.id;
    selectedSpellLevel = null;
    selectedSpellSourceId = null;
    spellRhythmPrompt = false;
    selectedDeviceMode = null;
    renderActionMenu();
  }, { description: category.description }))));
  contextStatus.textContent = "";
}

function renderActionMenu() {
  const actor = heroActor();
  const category = ACTION_CATEGORIES.find((item) => item.id === selectedCategory);
  const actions = actionsForSelectedMode(actor).filter(category.matches);
  contextMenu.hidden = false;
  contextBack.hidden = false;
  const categoryRow = menuRow(ACTION_CATEGORIES
    .filter((item) => actionsForSelectedMode(actor).some(item.matches))
    .map((item) => menuButton(categoryMenuLabel(actor, item), () => {
      selectedCategory = item.id;
      selectedSpellLevel = null;
      selectedSpellSourceId = null;
      spellRhythmPrompt = false;
      selectedDeviceMode = null;
      renderActionMenu();
    }, { selected: item.id === selectedCategory, description: item.description })));
  if (spellRhythmPrompt) {
    const rhythmCantrips = actions.filter((action) => action.tags?.spellRhythmFollowup);
    contextOptions.replaceChildren(menuRow(rhythmCantrips.map((action) => actionButton(actor, action))));
    contextStatus.textContent = "Choose a cantrip to complete Spell Rhythm.";
    return;
  }
  if (selectedCategory === "devices") {
    renderDeviceRows(actor, actions, categoryRow);
    return;
  }
  if (selectedCategory === "spells") {
    renderSpellRows(actor, actions, categoryRow);
    return;
  }
  const actionRow = menuRow(actions.map((action) => actionButton(actor, action)));
  contextOptions.replaceChildren(categoryRow, actionRow);
  contextStatus.textContent = "";
}

function categoryMenuLabel(actor, category) {
  if (category.id !== "channel_divinity") return category.label;
  const resource = actor.resources?.find((item) => item.id === "channel_divinity");
  return resource ? `${category.label} (${resource.current ?? resource.max}/${resource.max})` : category.label;
}

function renderDeviceRows(actor, actions, categoryRow) {
  const direct = actions.filter((action) => action.id === "catastrophic_charge");
  const quick = actions.filter((action) => action.name.startsWith("Quick Rigging:") && preparedDeviceBaseCost(actor, action) === "action");
  const doubleFirst = actions.filter((action) => action.deviceRig?.mode === "double_first" && preparedDeviceBaseCost(actor, action) === "action");
  const doubleFollowup = actions.filter((action) => action.deviceRig?.mode === "double_followup" && preparedDeviceBaseCost(actor, action) === "action");
  const modeRow = menuRow([
    ...direct.map((action) => menuButton(resourceChoiceLabel(actor, action.name, "catastrophic_charge"), () => {
      selectedDeviceMode = "catastrophic";
      renderActionMenu();
    }, { selected: selectedDeviceMode === "catastrophic", description: resourceChoiceDescription(actor, "catastrophic_charge", actionDescription(action)) })),
    ...(quick.length ? [menuButton(resourceChoiceLabel(actor, "Quick Rigging", "quick_rigging"), () => {
      selectedDeviceMode = "quick";
      renderActionMenu();
    }, { selected: selectedDeviceMode === "quick", description: resourceChoiceDescription(actor, "quick_rigging", "Deploy one action-cost prepared device as a bonus action.") })] : []),
    ...(doubleFirst.length ? [menuButton(resourceChoiceLabel(actor, "Double Rig", "double_rig"), () => {
      selectedDeviceMode = "double_first";
      renderActionMenu();
    }, { selected: ["double_first", "double_followup"].includes(selectedDeviceMode), description: resourceChoiceDescription(actor, "double_rig", "Deploy two different prepared devices in sequence.") })] : []),
  ]);
  const rows = [categoryRow, modeRow];
  const options = selectedDeviceMode === "quick"
    ? quick
    : selectedDeviceMode === "double_first"
      ? doubleFirst
      : selectedDeviceMode === "double_followup"
        ? doubleFollowup
        : selectedDeviceMode === "catastrophic"
          ? preparedActionDevices(actor)
        : [];
  if (options.length) {
    rows.push(menuRow(options.map((action) => selectedDeviceMode === "catastrophic"
      ? catastrophicChargeButton(actor, direct[0], action)
      : actionButton(actor, action, deviceRecipeLabel(action)))));
  }
  contextOptions.replaceChildren(...rows);
  contextStatus.textContent = selectedDeviceMode === "double_followup"
    ? "Choose the second device for Double Rig."
    : "";
}

function resourceChoiceLabel(actor, label, resourceId) {
  const resource = actor.resources?.find((item) => item.id === resourceId);
  const current = resource?.current ?? resource?.max ?? 0;
  const maximum = resource?.max ?? current;
  return `${label} (${current}/${maximum})`;
}

function resourceChoiceDescription(actor, resourceId, description) {
  const recovery = actor.resources?.find((item) => item.id === resourceId)?.recovery;
  const recoveryText = recovery === "long_rest"
    ? "Recovers after a long rest."
    : recovery === "short_rest"
      ? "Recovers after a short rest."
      : recovery === "combat"
        ? "Recovers at the start of combat."
        : "";
  return [description, recoveryText].filter(Boolean).join(" ");
}

function preparedActionDevices(actor) {
  return actor.actions.filter((action) => isPreparedDeviceAction(action) && action.id.startsWith("device_"));
}

function catastrophicChargeButton(actor, charge, device) {
  return menuButton(device.name, () => {
    if (!charge || !canSelectCombatAction(combatGame.snapshot, actor.id, charge.id)) return;
    const variant = createCatastrophicChargeVariant(charge, device);
    actor.actions.push(variant);
    resolveWithoutTargeting(variant);
    actor.actions = actor.actions.filter((action) => action.id !== variant.id);
  }, { description: device.description });
}

function preparedDeviceBaseCost(actor, variant) {
  const recipeId = variant.id
    .replace(/^quick_device_/, "")
    .replace(/^double_rig_followup_/, "")
    .replace(/^double_rig_/, "");
  return actor.actions.find((action) => action.id === `device_${recipeId}`)?.cost || null;
}

function deviceRecipeLabel(action) {
  return action.name.replace(/^(Quick Rigging|Double Rig(?: Follow-up)?):\s*/, "");
}

function renderSpellRows(actor, actions, categoryRow) {
  const levels = [...new Set(actions.map((action) => action.spellLevel || 0))].sort((a, b) => a - b);
  const levelRow = menuRow(levels.map((level) => spellLevelButton(actor, level, () => {
    selectedSpellLevel = level;
    selectedSpellSourceId = null;
    renderActionMenu();
  }, {
    selected: selectedSpellLevel === level,
    description: level === 0 ? "Cantrips require no spell slot." : `Level ${level} spells use the character's level ${level} slots.`,
  })));
  levelRow.classList.add("combat-spell-level-row");
  const rows = [categoryRow, levelRow];
  if (selectedSpellLevel !== null) {
    const atSelectedLevel = actions.filter((action) => (action.spellLevel || 0) === selectedSpellLevel);
    const nativeSpells = atSelectedLevel.filter((action) => (action.baseSpellLevel ?? action.spellLevel ?? 0) === selectedSpellLevel);
    rows.push(menuRow(nativeSpells.map((action) => spellChoiceButton(actor, action, actions))));
    const selectedSpell = nativeSpells.find((action) => action.sourceSpellId === selectedSpellSourceId);
    if (selectedSpell) rows.push(castLevelRow(actor, selectedSpell, actions));
  }
  contextOptions.replaceChildren(...rows);
  contextStatus.textContent = "";
}

function spellChoiceButton(actor, action, actions) {
  const variants = meaningfulCastVariants(actor, action, actions);
  if (variants.length === 1) return actionButton(actor, action);
  return menuButton(actionMenuLabel(actor, action), () => {
    selectedSpellSourceId = action.sourceSpellId;
    renderActionMenu();
  }, {
    selected: selectedSpellSourceId === action.sourceSpellId,
    description: `${actionDescription(action)} Choose the spell-slot level used to cast it.`,
  });
}

function meaningfulCastVariants(actor, nativeAction, actions) {
  return actions
    .filter((candidate) => candidate.sourceSpellId === nativeAction.sourceSpellId)
    .filter((candidate) => candidate.id === nativeAction.id || isMeaningfulUpcast(actor, candidate))
    .sort((left, right) => (left.spellLevel || 0) - (right.spellLevel || 0));
}

function castLevelRow(actor, nativeAction, actions) {
  const row = menuRow(meaningfulCastVariants(actor, nativeAction, actions).map((variant) => (
    actionButton(actor, variant, String(variant.spellLevel))
  )));
  row.classList.add("combat-cast-level-row");
  const label = document.createElement("span");
  label.className = "combat-cast-level-label";
  label.textContent = "Cast at";
  row.prepend(label);
  return row;
}

function isMeaningfulUpcast(actor, action) {
  const baseLevel = action.baseSpellLevel ?? action.spellLevel ?? 0;
  if (baseLevel <= 0 || (action.spellLevel || 0) <= baseLevel) return false;
  const native = nativeSpellAction(actor, action);
  if (!native) return false;
  return UPCAST_MECHANICAL_FIELDS.some((field) => !sameMechanicalValue(native[field], action[field]));
}

function nativeSpellAction(actor, action) {
  return actor.actions.find((candidate) =>
    candidate.tags?.spell === true &&
    candidate.sourceSpellId === action.sourceSpellId &&
    (candidate.spellLevel || 0) === (action.baseSpellLevel || 0));
}

function sameMechanicalValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function upcastMechanicalDescription(actor, action) {
  const native = nativeSpellAction(actor, action);
  if (!native) return "";
  if (!sameMechanicalValue(native.damage, action.damage) && action.damage) return `Damage increases to ${action.damage} from ${native.damage}.`;
  if (!sameMechanicalValue(native.healing, action.healing) && action.healing) return `Healing increases to ${action.healing} from ${native.healing}.`;
  if (!sameMechanicalValue(native.hits, action.hits) && action.hits) return `Attacks increase to ${action.hits} from ${native.hits}.`;
  if (!sameMechanicalValue(native.maxTargets, action.maxTargets) && action.maxTargets) return `Targets increase to ${action.maxTargets} from ${native.maxTargets}.`;
  const nativeObjectDamage = native.object?.effects?.find((effect) => effect.type === "damage")?.damage;
  const upcastObjectDamage = action.object?.effects?.find((effect) => effect.type === "damage")?.damage;
  if (nativeObjectDamage && upcastObjectDamage && nativeObjectDamage !== upcastObjectDamage) return `Damage increases to ${upcastObjectDamage} from ${nativeObjectDamage}.`;
  const nativeHpBonus = native.effects?.find((effect) => effect.type === "max_hp_bonus")?.amount;
  const upcastHpBonus = action.effects?.find((effect) => effect.type === "max_hp_bonus")?.amount;
  if (Number.isFinite(nativeHpBonus) && Number.isFinite(upcastHpBonus) && nativeHpBonus !== upcastHpBonus) return `Current and maximum HP increase by ${upcastHpBonus} instead of ${nativeHpBonus}.`;
  const nativeDispel = native.effects?.find((effect) => effect.type === "dispel_magic")?.maximumAutomaticSpellLevel;
  const upcastDispel = action.effects?.find((effect) => effect.type === "dispel_magic")?.maximumAutomaticSpellLevel;
  if (Number.isFinite(nativeDispel) && Number.isFinite(upcastDispel) && nativeDispel !== upcastDispel) return `Automatically ends spells through level ${upcastDispel} instead of level ${nativeDispel}.`;
  return "";
}

const UPCAST_MECHANICAL_FIELDS = [
  "damage", "healing", "hits", "maxTargets", "effects", "conditionalDamage",
  "temporaryHpFormula", "object", "duration", "repeatAttacks",
];

function spellLevelButton(actor, level, onClick, options = {}) {
  const button = menuButton(spellLevelLabel(actor, level), onClick, options);
  if (level === 0 || actor.combatSpellLevelStyle !== "slot_pips") return button;
  const slots = actor.spellSlots?.[level] || {};
  button.classList.add("is-pipped-spell-level");
  button.textContent = "";
  const label = document.createElement("span");
  label.className = "combat-spell-level-name";
  label.textContent = level;
  const pips = document.createElement("span");
  pips.className = "combat-spell-slot-pips";
  for (let index = 0; index < (slots.max || 0); index += 1) {
    const pip = document.createElement("span");
    pip.className = "combat-spell-slot-pip";
    pip.classList.toggle("is-available", index < (slots.current || 0));
    pips.append(pip);
  }
  button.append(label, pips);
  button.setAttribute("aria-label", `Level ${level}: ${slots.current || 0} of ${slots.max || 0} slots available`);
  return button;
}

function actionButton(actor, action, label = null) {
    const available = canSelectCombatAction(combatGame.snapshot, actor.id, action.id);
    const reason = available ? "" : unavailableActionReason(actor, action);
    const visibleReason = reason === "Unavailable" ? "" : reason;
    const button = menuButton(label || actionMenuLabel(actor, action), () => {
      if (available) resolveWithoutTargeting(action);
    }, { description: [actionDescription(action), visibleReason].filter(Boolean).join(" ") });
    button.classList.toggle("is-disabled", !available);
    button.setAttribute("aria-disabled", String(!available));
    if (visibleReason) button.title = visibleReason;
    return button;
}

function resolveWithoutTargeting(action) {
  const actor = heroActor();
  const targetPayload = automaticTargetPayload(actor, action);
  const logStart = combatGame.log.events.length;
  let result = combatGame.resolveAction(actor.id, action.id, targetPayload);
  if (result.code === "reaction_pending") result = combatGame.answerReaction(true);
  if (result.ok && !combatGame.log.events.slice(logStart).some((event) => ACTION_LOG_EVENT_TYPES.has(event.type))) {
    combatGame.log.add("ui.action", {
      round: combatGame.snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      actionId: action.id,
      actionName: action.name,
    });
  }
  const rhythmBranch = result.ok ? updateSpellRhythmFollowup(actor, action) : null;
  if (rhythmBranch === "spells") {
    selectedCategory = "spells";
    selectedSpellLevel = null;
    selectedSpellSourceId = null;
    spellRhythmPrompt = true;
  } else if (rhythmBranch === "attack") {
    selectedCategory = "attack";
    selectedSpellLevel = null;
    selectedSpellSourceId = null;
    spellRhythmPrompt = false;
  } else if (rhythmBranch === "complete") {
    spellRhythmPrompt = false;
    selectTopLevelMode("movement");
  }
  if (result.ok && action.deviceRig?.mode === "double_first" && actor.turnFlags?.doubleRigFollowupAvailable) {
    selectedCategory = "devices";
    selectedDeviceMode = "double_followup";
  } else if (result.ok && action.deviceRig?.mode === "double_followup") {
    selectedDeviceMode = null;
  }
  contextStatus.textContent = result.ok ? `${action.name} resolved.` : result.reason;
  renderCharacterState();
  renderCombatLog();
  if (selectedCombatMode !== "movement") renderActionMenu();
}

function automaticTargetPayload(actor, action) {
  const enemies = combatGame.snapshot.actors.filter((item) => item.team === "enemies" && item.hp > 0);
  const enemy = enemies[0];
  if (action.type === "spell_teleport") {
    const occupied = new Set(combatGame.snapshot.actors.filter((item) => item.hp > 0).map((item) => `${item.position.x},${item.position.y}`));
    const destination = [
      { x: actor.position.x + 1, y: actor.position.y },
      { x: actor.position.x, y: actor.position.y + 1 },
      { x: actor.position.x - 1, y: actor.position.y },
      { x: actor.position.x, y: actor.position.y - 1 },
    ].find((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < combatGame.snapshot.grid.width && cell.y < combatGame.snapshot.grid.height && !occupied.has(`${cell.x},${cell.y}`));
    return destination || actor.position;
  }
  if (action.targeting?.shape) {
    const anchor = action.tags?.harmful === false ? actor.position : enemy?.position || actor.position;
    return { anchor: { ...anchor }, cells: [{ ...anchor }] };
  }
  const validTargets = getValidTargets(combatGame.snapshot, actor.id, action.id);
  if (action.maxTargets > 1 && validTargets.length) {
    const preferred = validTargets.find((item) => item.team === "enemies") || validTargets[0];
    return { targetIds: Array.from({ length: action.maxTargets }, () => preferred.id) };
  }
  if (action.requiresTarget === false) return null;
  const preferred = action.tags?.harmful
    ? validTargets.find((item) => item.team === "enemies")
    : validTargets.find((item) => item.id === actor.id);
  return (preferred || validTargets[0])?.id || actor.id;
}

function actionsForSelectedMode(actor) {
  const cost = selectedCombatMode === "bonus_action" ? "bonus" : "action";
  return actor.actions.filter((action) => (
    action.cost === cost ||
    (cost === "action" && action.tags?.spellRhythmFollowup) ||
    (action.cost === "free" && action.tags?.device && actor.turnFlags?.doubleRigFollowupAvailable === true)
  ) && action.cost !== "reaction");
}

function updateSpellRhythmFollowup(actor, resolvedAction) {
  actor.actions = actor.actions.filter((action) => !action.tags?.spellRhythmFollowup);
  if (resolvedAction.tags?.spellRhythmFollowup) {
    actor.turnFlags ??= {};
    actor.turnFlags.spellRhythmFollowupUsed = true;
    return "complete";
  }
  const rhythmActive = actor.activeEffects?.some((effect) => effect.spellRhythm === true);
  if (!rhythmActive || actor.turnFlags?.spellRhythmFollowupUsed) return null;
  const wasCantrip = resolvedAction.tags?.spell === true && (resolvedAction.spellLevel || 0) === 0;
  const wasMeleeAttack = resolvedAction.tags?.weapon === true && resolvedAction.tags?.melee === true;
  if (!wasCantrip && !wasMeleeAttack) return null;
  const counterparts = actor.actions.filter((action) => wasCantrip
    ? action.tags?.weapon === true && action.tags?.melee === true
    : action.tags?.spell === true &&
      (action.spellLevel || 0) === 0 &&
      action.tags?.harmful === true &&
      action.requiresTarget !== false &&
      !action.targeting?.shape &&
      (action.maxTargets || 1) === 1);
  actor.actions.push(...counterparts.map((counterpart) => ({
      ...structuredClone(counterpart),
      id: `spell_rhythm_followup:${counterpart.id}`,
      name: `Spell Rhythm: ${counterpart.name}`,
      cost: "free",
      tags: { ...(counterpart.tags || {}), spellRhythmFollowup: true },
    })));
  return counterparts.length ? (wasMeleeAttack ? "spells" : "attack") : null;
}

function menuButton(label, onClick, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  button.classList.toggle("is-selected", options.selected === true);
  button.addEventListener("pointerenter", () => {
    contextStatus.textContent = options.description || "";
  });
  button.addEventListener("focus", () => {
    contextStatus.textContent = options.description || "";
  });
  return button;
}

function menuRow(buttons) {
  const row = document.createElement("div");
  row.className = "combat-context-row";
  row.append(...buttons);
  return row;
}

function actionMenuLabel(actor, action) {
  if (action.resourceId === "channel_divinity") return action.name;
  const label = getActionLabel(combatGame.snapshot, actor.id, action.id);
  return label;
}

function spellLevelLabel(actor, level) {
  if (level === 0) return "Cantrips";
  const slots = actor.spellSlots?.[level];
  return `Level ${level} (${slots?.current || 0}/${slots?.max || 0})`;
}

function actionDescription(action, actor = heroActor()) {
  let description = "";
  if (action.tags?.spell) {
    const spell = getSpellById(action.sourceSpellId || action.id);
    const upcast = action.baseSpellLevel > 0 && action.spellLevel > action.baseSpellLevel
      ? `Cast at level ${action.spellLevel}.`
      : null;
    const increasedEffect = upcast ? upcastMechanicalDescription(actor, action) : null;
    description = [upcast, increasedEffect, mechanicalSpellDescription(action), spell?.text || action.description || `${action.name} spell.`].filter(Boolean).join(" ");
  } else if (action.tags?.weapon) {
    const mastery = action.weaponMasteryActive === true ? getWeaponMastery(action.weaponMastery) : null;
    description = [`${action.damage || "Weapon"} ${action.damageType || ""} damage.`, mastery ? `${mastery.name}: ${mastery.description}` : null]
      .filter(Boolean)
      .join("\n");
  } else if (action.tags?.feature && action.description) {
    description = preciseFeatureActionDescription(action) || action.description;
  } else {
    description = mechanicalActionDescription(action) || action.description || {
      dash: "Gain additional movement equal to your Speed for this turn.",
      dodge: "Until your next turn, attacks against you have disadvantage and you gain advantage on Dexterity saves.",
      hide: "Attempt to become hidden from creatures that cannot clearly perceive you.",
      disengage: "Your movement does not provoke opportunity attacks for the rest of the turn.",
      consumable: `Use ${action.name}.`,
    }[action.type] || action.name;
  }
  return [description, actionRecoveryDescription(actor, action)].filter(Boolean).join(" ");
}

function mechanicalSpellDescription(action) {
  if (action.damage) return `${action.damage} ${action.damageType || ""} damage.`.replace("  ", " ");
  if (action.healing) return `Restore ${action.healing} HP.`;
  const objectDamage = action.object?.effects?.find((effect) => effect.type === "damage");
  if (objectDamage?.damage) return `Creates a persistent area dealing ${objectDamage.damage} ${objectDamage.damageType || ""} damage when triggered.`.replace("  ", " ");
  const light = action.effects?.find((effect) => effect.type === "light_source");
  if (light) return `Sheds bright light for ${light.brightFt} ft and dim light for another ${light.dimFt} ft.`;
  const hpBonus = action.effects?.find((effect) => effect.type === "max_hp_bonus");
  if (hpBonus) return `Increase current and maximum HP by ${hpBonus.amount}.`;
  return "";
}

function preciseFeatureActionDescription(action) {
  if (action.temporaryHpFormula && action.activeEffectOnResolve?.stat === "save") {
    return `Gain ${action.temporaryHpFormula} temporary HP (1 HP per level) and ${formatSignedAmount(action.activeEffectOnResolve.amount)} to saving throws for ${action.duration?.rounds || 10} rounds.`;
  }
  if (action.resourceId !== "channel_divinity") return "";
  const range = Number.isFinite(action.range) && action.range > 0 ? ` within ${action.range * 5} ft` : "";
  const save = action.saveAbility ? `${String(action.saveAbility).toUpperCase()} save` : null;
  const half = action.save?.onSuccess === "half" || action.save?.onSave === "half";
  if (action.damage) {
    return `Enemies${range} make a ${save}; ${action.damage} ${action.damageType} damage on a failed save${half ? ", half on a success" : ""}.`;
  }
  if (action.damageByTargetProperty) {
    const labels = { profane: "Profane", bound: "Bound", sovereign: "Sovereign" };
    const amounts = Object.entries(action.damageByTargetProperty.values || {})
      .map(([key, damage]) => `${labels[key] || key} ${damage}`)
      .join(", ");
    return `Undead${range} make a ${save}; ${amounts} ${action.damageType} damage on a failed save${half ? ", half on a success" : ""}.`;
  }
  return "";
}

function formatSignedAmount(value) {
  const amount = Number(value) || 0;
  return amount >= 0 ? `+${amount}` : `${amount}`;
}

function actionRecoveryDescription(actor, action) {
  if (!action.resourceId) return "";
  const resource = actor.resources?.find((item) => item.id === action.resourceId);
  if (!resource?.recovery || !Number.isFinite(resource.max)) return "";
  const cadence = resource.recovery === "long_rest"
    ? "long rest"
    : resource.recovery === "short_rest"
      ? "short rest"
      : resource.recovery === "combat"
        ? "combat"
        : null;
  if (!cadence) return "";
  return `${resource.max} ${resource.max === 1 ? "use" : "uses"} per ${cadence}.`;
}

function mechanicalActionDescription(action) {
  if (action.healing) return `Restore ${action.healing} HP.`;
  if (action.damage) {
    const range = Number.isFinite(action.range) && action.range > 0 ? ` Range: ${action.range * 5} ft.` : "";
    return `${action.damage} ${action.damageType || "damage"} damage.${range}`;
  }
  const condition = action.effects?.find((effect) => effect.condition)?.condition;
  if (condition) return `Apply ${String(condition).replace(/_/g, " ")}.`;
  const modifier = action.effects?.find((effect) => effect.type === "modifier");
  if (modifier) {
    const duration = modifier.duration?.rounds ? ` for ${modifier.duration.rounds} rounds` : "";
    return `Grants ${String(modifier.stat || "a combat modifier").replace(/_/g, " ")}${duration}.`;
  }
  return "";
}

function unavailableActionReason(actor, action) {
  if (action.type === "consumable" && actor.hp >= actor.maxHp) return "Full health";
  if (action.cost === "action" && actor.economy?.actionAvailable === false) return "Action used";
  if (action.cost === "bonus" && actor.economy?.bonusActionAvailable === false) return "Bonus used";
  if (action.tags?.spell && action.spellLevel > 0 && (actor.spellSlots?.[action.spellLevel]?.current || 0) <= 0) return "No slots";
  if (action.resourceId) {
    const resource = actor.resources?.find((item) => item.id === action.resourceId);
    if ((resource?.current ?? resource?.max ?? 0) <= 0) return "No uses";
  }
  return "Unavailable";
}

function closeContextMenu() {
  contextMenu.hidden = true;
  contextOptions.replaceChildren();
  contextStatus.textContent = "";
}

function positionContextMenu() {
  const characterRight = character.getBoundingClientRect().right;
  const logLeft = log.getBoundingClientRect().left;
  const middleLeft = Math.round(characterRight + 24);
  contextMenu.style.left = `${middleLeft}px`;
  contextMenu.style.right = `${Math.round(window.innerWidth - logLeft + 24)}px`;
  combatActionMenu.style.left = `${middleLeft}px`;
  combatActionMenu.style.right = `${Math.round(window.innerWidth - logLeft + 24)}px`;
}

function scheduleLayoutRefresh() {
  if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = null;
    fitCharacterName(document.querySelector("#combatCharacterName"));
    const characterWidth = character.getBoundingClientRect().right;
    log.style.width = `${Math.round((characterWidth - 25) * 0.6)}px`;
    positionContextMenu();
  });
}

function renderCombatLog() {
  const visibleEvents = combatGame.log.events
    .filter((event) => COMPACT_LOG_EVENT_TYPES.has(event.type))
    .slice(-7);
  combatLogList.replaceChildren(...visibleEvents.map((event) => {
    const item = document.createElement("li");
    item.textContent = compactCombatEvent(event, combatGame.log.events);
    return item;
  }));
  combatLogList.scrollTop = combatLogList.scrollHeight;
}

function compactCombatEvent(event, allEvents = []) {
  const d = event.detail || {};
  const round = `R${event.round || d.round || combatGame.snapshot.round}`;
  const actor = shortCombatName(d.actorName || d.sourceName || d.targetName);
  const lead = actor ? `${round} ${actor}: ` : `${round} `;
  if (event.type === "combat.start") return `${round} Combat begins.`;
  if (event.type === "round.start") return `${round} Round begins.`;
  if (event.type === "ui.action") return `${lead}${d.actionName}.`;
  if (event.type === "move") return `${lead}moves. ${d.movementRemaining} squares left.`;
  if (event.type === "dash") return `${lead}Dash. ${d.movementAfter} squares available.`;
  if (event.type === "dodge") return `${lead}Dodge.`;
  if (event.type === "teleport") return `${lead}${d.actionName}.`;
  if (event.type === "feature.action") return `${lead}${featureActionOutcome(event, allEvents)}`;
  if (event.type === "object.created") return `${lead}${d.actionName || d.objectName}${d.logSummary ? `: ${d.logSummary}` : "."}`;
  if (event.type === "object.moved") return `${lead}${d.objectName} moved.`;
  if (event.type === "area.target") return `${lead}${d.actionName}.`;
  if (event.type === "effect.applied") {
    if (d.stat === "ac" && Number.isFinite(d.currentAc)) return `${lead}${formatSignedAmount(d.amount || 0)} AC from ${d.actionName}. Current AC: ${d.currentAc}.`;
    const sourceAction = heroActor()?.actions.find((action) => action.name === d.actionName || d.effectId?.startsWith(`${action.id}_`));
    const mastery = sourceAction?.weaponMasteryActive === true ? getWeaponMastery(sourceAction.weaponMastery) : null;
    return mastery
      ? `${lead}${mastery.name} applied to ${shortCombatName(d.targetName)}.`
      : `${lead}${d.actionName}.`;
  }
  if (event.type === "effect.removed") return `${lead}${d.actionName}: effect removed from ${shortCombatName(d.targetName || d.actorName)}.`;
  if (event.type === "action.granted") return `${lead}${d.actionName} available.`;
  if (event.type === "attack.result") return `${lead}${d.actionName || "Attack"} ${d.hit ? "hits" : "misses"}${d.critical ? " critically" : ""}.`;
  if (event.type === "damage.applied") return `${lead}${d.amount} ${d.damageType} damage to ${shortCombatName(d.targetName)}.`;
  if (event.type === "healing.applied") {
    const roll = [...allEvents].reverse().find((candidate) => candidate.id < event.id && candidate.type === "healing.roll" && candidate.detail?.actorId === d.actorId);
    const terms = roll ? [...(roll.detail?.rolls || []), roll.detail?.modifier].filter(Number.isFinite) : [];
    const breakdown = terms.length ? ` (${terms.join("+")})` : "";
    return `${lead}${d.amount}${breakdown} HP.`;
  }
  if (event.type === "resource.restore") {
    const restored = (d.restored || []).map((slot) => `level ${slot.level} slot (${slot.current}/${slot.max})`).join(", ");
    return `${lead}${d.actionName}: restored ${restored}.`;
  }
  if (event.type === "condition.applied") return `${lead}${shortCombatName(d.targetName)} gains ${d.label}.`;
  if (event.type === "legendary_resistance.used") return `${lead}${shortCombatName(d.actorName)} uses Legendary Resistance (${d.remaining}/${d.maximum} left).`;
  if (event.type === "actor.defeated") return `${lead}${shortCombatName(d.targetName)} defeated.`;
  return `${lead}${event.type}.`;
}

function featureActionOutcome(event, allEvents) {
  const detail = event.detail || {};
  const priorEvents = allEvents.filter((candidate) => candidate.id < event.id);
  const temporaryHp = [...priorEvents].reverse().find((candidate) => (
    candidate.type === "temp_hp.applied" &&
    candidate.detail?.sourceId === detail.actorId &&
    candidate.detail?.actionName === detail.actionName
  ));
  if (temporaryHp) return `${detail.actionName}: +${temporaryHp.detail.amount} temporary HP.`;
  const saves = priorEvents.filter((candidate) => (
    candidate.type === "save.result" &&
    candidate.detail?.actorId === detail.actorId &&
    candidate.detail?.spellName === detail.actionName
  ));
  if (!saves.length) return `${detail.actionName}.`;

  const outcomes = saves.map((save) => {
    const targetName = shortCombatName(save.detail.targetName);
    if (save.detail.success) return `${targetName} resists`;
    const condition = priorEvents.find((candidate) => (
      candidate.type === "condition.applied" &&
      candidate.detail?.actionName === detail.actionName &&
      candidate.detail?.targetId === save.detail.targetId
    ));
    return condition ? `${targetName} gains ${condition.detail.label}` : `${targetName} fails the save`;
  });
  return `${detail.actionName}: ${outcomes.join("; ")}.`;
}

function shortCombatName(name = "") {
  return String(name).split(",")[0].replace(/^Arena /, "");
}

const COMPACT_LOG_EVENT_TYPES = new Set([
  "combat.start", "round.start", "ui.action", "move", "dash", "dodge", "teleport",
  "feature.action", "object.created", "object.moved", "area.target", "effect.applied", "effect.removed", "action.granted", "attack.result",
  "damage.applied", "healing.applied", "resource.restore", "condition.applied", "legendary_resistance.used", "actor.defeated",
]);

const ACTION_LOG_EVENT_TYPES = new Set([
  "move", "dash", "dodge", "teleport", "feature.action", "object.created", "object.moved", "area.target",
  "effect.applied", "effect.removed", "action.granted", "attack.result", "damage.applied", "healing.applied", "condition.applied",
  "resource.restore", "legendary_resistance.used",
]);

function selectTopLevelMode(mode) {
  selectedCombatMode = mode;
  selectedCategory = null;
  selectedSpellLevel = null;
  selectedSpellSourceId = null;
  spellRhythmPrompt = false;
  selectedDeviceMode = null;
  combatActionButtons.forEach((button) => {
    const active = button.dataset.combatMode === mode;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  document.body.dataset.combatActivity = mode === "movement" ? "click_to_travel" : `${mode}_selection`;
  if (mode === "movement") closeContextMenu();
}

function heroActor() {
  return combatGame.snapshot.actors.find((actor) => actor.team === "heroes");
}

function renderCharacterState() {
  const actor = heroActor();
  const name = document.querySelector("#combatCharacterName");
  const portrait = document.querySelector(".combat-ui-portrait");
  name.textContent = actor.name.split(",")[0];
  fitCharacterName(name);
  const portraitId = actor.portraitId;
  portrait.hidden = !portraitId;
  if (portraitId) {
    portrait.src = new URL(`../${portraitId.replace(/^\.\.\//, "")}`, import.meta.url).href;
    portrait.alt = actor.name.split(",")[0];
  } else {
    portrait.removeAttribute("src");
    portrait.alt = "";
  }
  document.querySelector(".combat-ui-hp-label").textContent = `${actor.hp} / ${actor.maxHp}`;
  document.querySelector(".combat-ui-hp-current").style.width = `${Math.max(0, actor.hp / actor.maxHp) * 100}%`;
  const temporaryHp = document.querySelector(".combat-ui-temp-hp");
  temporaryHp.hidden = !(actor.tempHp > 0);
  temporaryHp.textContent = actor.tempHp > 0 ? `+${actor.tempHp}` : "";
  temporaryHp.title = actor.tempHp > 0
    ? `${actor.tempHp} temporary HP. Damage removes these before Hit Points.`
    : "";
  conditions.replaceChildren();
  const appliedEffects = [
    ...(actor.conditions || []).map((effect) => ({ effect, kind: "condition" })),
    ...(actor.activeEffects || [])
      .filter((effect) => effect.trigger !== "passive" || effect.sourceActionId)
      .map((effect) => ({ effect, kind: "benefit" })),
  ];
  for (const { effect, kind } of appliedEffects.slice(0, 9)) {
    appendCondition({
      name: effect.name || effect.label || effect.id,
      kind,
      description: activeConditionDescription(actor, effect, kind),
    });
  }
  updateTopLevelAvailability(actor);
  scheduleLayoutRefresh();
}

function activeConditionDescription(actor, effect, kind) {
  const sourceAction = actor.actions.find((action) => action.id === effect.sourceActionId);
  const condition = kind === "condition" ? getCondition(effect.id || effect.condition) : null;
  const mechanics = condition?.effects?.join(" ") || (sourceAction ? actionDescription(sourceAction) : describeActiveEffect(effect));
  const duration = activeDurationDescription(effect.duration);
  const source = sourceAction?.name || effect.sourceName || null;
  return [mechanics, duration, source ? `Source: ${source}.` : null].filter(Boolean).join(" ");
}

function describeActiveEffect(effect) {
  const amount = Number(effect.amount);
  if (effect.stat && Number.isFinite(amount)) return `${formatSignedAmount(amount)} to ${String(effect.stat).replace(/_/g, " ")}.`;
  if (effect.damageRider?.damage) return `Adds ${effect.damageRider.damage} ${effect.damageRider.damageType || ""} damage when triggered.`.replace("  ", " ");
  return "This effect is currently active.";
}

function activeDurationDescription(duration) {
  if (!duration) return "";
  if (duration.kind === "rounds") {
    const remaining = duration.remaining ?? duration.rounds;
    return Number.isFinite(remaining) ? `${remaining} round${remaining === 1 ? "" : "s"} remaining.` : "";
  }
  if (duration.kind === "until_timing") {
    return duration.timing === "turn_start" ? "Ends at the start of the turn." : "Ends at the end of the turn.";
  }
  return "";
}

function fitCharacterName(name) {
  name.style.fontSize = "";
  let size = parseFloat(getComputedStyle(name).fontSize);
  while (name.scrollWidth > name.clientWidth && size > 18) {
    size -= 1;
    name.style.fontSize = `${size}px`;
  }
}

function updateTopLevelAvailability(actor) {
  for (const button of combatActionButtons) {
    const mode = button.dataset.combatMode;
    const spent = mode === "action"
      ? actor.economy?.actionAvailable === false
      : mode === "bonus_action"
        ? actor.economy?.bonusActionAvailable === false
        : false;
    button.classList.toggle("is-spent", spent);
    if (spent) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
  }
}

const ACTION_CATEGORIES = [
  { id: "attack", label: "Attack", description: "Make an attack with an equipped weapon.", matches: (action) => action.tags?.weapon === true },
  { id: "spells", label: "Spells", description: "Cast a prepared spell or cantrip.", matches: (action) => action.tags?.spell === true },
  { id: "channel_divinity", label: "Channel Divinity", description: "Spend Channel Divinity on a cleric feature.", matches: (action) => action.resourceId === "channel_divinity" },
  { id: "devices", label: "A Strange Kit", description: "Use a Saboteur kit technique.", matches: isStrangeKitAction },
  { id: "tactics", label: "Tactics", description: "Use a universal combat option such as Dash or Dodge.", matches: (action) => ["dash", "dodge", "hide", "disengage"].includes(action.type) || ["hide", "disengage"].includes(action.actionKind) },
  { id: "abilities", label: "Abilities", description: "Use a class, subclass, species, or lineage ability.", matches: (action) => action.type === "feature_action" && action.resourceId !== "channel_divinity" && !action.tags?.device && !["hide", "disengage"].includes(action.actionKind) },
  { id: "consumables", label: "Consumables", description: "Use a carried consumable or pre-prepared device.", matches: (action) => action.type === "consumable" || isPreparedDeviceAction(action) },
];

function isStrangeKitAction(action) {
  return action.id === "catastrophic_charge" || action.tags?.catastrophicChargeOption === true || Boolean(action.deviceRig?.mode) || action.name.startsWith("Quick Rigging:");
}

function isPreparedDeviceAction(action) {
  return action.tags?.device === true && !isStrangeKitAction(action);
}

while (getCurrentActor(combatGame.snapshot)?.team === "enemies" && !combatGame.snapshot.outcome) {
  await combatGame.runEnemyTurnIfNeeded();
}
renderCharacterState();
renderCombatLog();
const portrait = document.querySelector(".combat-ui-portrait");
portrait.addEventListener("load", scheduleLayoutRefresh);
portrait.addEventListener("error", scheduleLayoutRefresh);
new ResizeObserver(scheduleLayoutRefresh).observe(character);
new ResizeObserver(scheduleLayoutRefresh).observe(log);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  if (selectedDeviceMode) {
    selectedDeviceMode = null;
    renderActionMenu();
    return;
  }
  if (spellRhythmPrompt) {
    spellRhythmPrompt = false;
    selectedCategory = null;
    renderCategoryMenu();
    return;
  }
  if (selectedSpellSourceId) {
    selectedSpellSourceId = null;
    renderActionMenu();
    return;
  }
  if (selectedSpellLevel !== null) {
    selectedSpellLevel = null;
    renderActionMenu();
    return;
  }
  if (selectedCategory) {
    selectedCategory = null;
    renderCategoryMenu();
    return;
  }
  if (selectedCombatMode !== "movement") {
    selectTopLevelMode("movement");
    return;
  }
  window.dispatchEvent(new CustomEvent("dndt:open-system-menu"));
});

function goBackOneLevel() {
  if (selectedDeviceMode) {
    selectedDeviceMode = null;
    renderActionMenu();
    return;
  }
  if (spellRhythmPrompt) {
    spellRhythmPrompt = false;
    selectedCategory = null;
    renderCategoryMenu();
    return;
  }
  if (selectedSpellSourceId) {
    selectedSpellSourceId = null;
    renderActionMenu();
    return;
  }
  if (selectedSpellLevel !== null) {
    selectedSpellLevel = null;
    renderActionMenu();
    return;
  }
  if (selectedCategory) {
    selectedCategory = null;
    renderCategoryMenu();
    return;
  }
  selectTopLevelMode("movement");
}
