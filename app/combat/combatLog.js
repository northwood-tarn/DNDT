export function createCombatLog() {
  const events = [];

  function add(type, detail = {}) {
    const event = {
      id: events.length + 1,
      type,
      round: detail.round ?? null,
      turn: detail.turn ?? null,
      detail,
    };
    events.push(event);
    return event;
  }

  function clear() {
    events.length = 0;
  }

  return {
    events,
    add,
    clear,
  };
}

export function summarizeCombat(events, actors) {
  const byActor = new Map();
  for (const actor of actors) {
    byActor.set(actor.id, {
      actorId: actor.id,
      name: actor.name,
      team: actor.team,
      damageDealt: 0,
      damageTaken: 0,
      attacks: 0,
      hits: 0,
      savesForced: 0,
      failedSavesForced: 0,
      kills: 0,
    });
  }

  for (const event of events) {
    const d = event.detail || {};
    if (event.type === "attack.result") {
      const attacker = byActor.get(d.actorId);
      if (attacker) {
        attacker.attacks += 1;
        if (d.hit) attacker.hits += 1;
      }
    }
    if (event.type === "save.result") {
      const caster = byActor.get(d.actorId);
      if (caster) {
        caster.savesForced += 1;
        if (!d.success) caster.failedSavesForced += 1;
      }
    }
    if (event.type === "damage.applied") {
      const source = byActor.get(d.sourceId);
      const target = byActor.get(d.targetId);
      if (source) source.damageDealt += d.amount || 0;
      if (target) target.damageTaken += d.amount || 0;
    }
    if (event.type === "actor.defeated") {
      const source = byActor.get(d.sourceId);
      if (source) source.kills += 1;
    }
  }

  return Array.from(byActor.values());
}

export function formatEvent(event) {
  const d = event.detail || {};
  const prefix = event.round ? `R${event.round} ` : "";

  switch (event.type) {
    case "combat.start":
      return `${prefix}Combat begins. ${d.seeded ? "Deterministic dice are ON." : "Live dice are ON."}`;
    case "scenario.loaded":
      return `${prefix}Loaded ${d.actorName} from ${d.source}${d.recordId ? ` (${d.recordId})` : ""}. Spell actions: ${d.spells?.length ? d.spells.join(", ") : "none"}.`;
    case "initiative.roll":
      return `${prefix}Initiative: ${d.rolls.map((item) => `${item.actorName} ${initiativeRollText(item)} + ${item.bonus} = ${item.total}`).join("; ")}. Order: ${d.order.join(" -> ")}.`;
    case "dice.mode":
      return d.seeded
        ? `Deterministic dice ON: rolls now come from seed "${d.seed}". Resetting the same seed repeats the same rolls for debugging.`
        : "Deterministic dice OFF: rolls now use the existing live dice utility and Math.random.";
    case "turn.start":
      return `${prefix}${d.actorName}'s turn begins. Movement ${d.movementRemaining} squares.`;
    case "turn.end":
      return `${prefix}${d.actorName}'s turn ends.`;
    case "move":
      return `${prefix}${d.actorName} moves from (${d.from.x},${d.from.y}) to (${d.to.x},${d.to.y}). Movement left: ${d.movementRemaining}.`;
    case "forced.move":
      return `${prefix}${d.targetName} is forced from (${d.from.x},${d.from.y}) to (${d.to.x},${d.to.y}) by ${d.reason}.`;
    case "teleport":
      return `${prefix}${d.actorName} teleports with ${d.actionName} from (${d.from.x},${d.from.y}) to (${d.to.x},${d.to.y}).`;
    case "push":
      return `${prefix}${d.actorName} pushes ${d.targetName} ${d.movedSquares}/${d.intendedSquares} squares${d.collisionAt ? `, colliding at (${d.collisionAt.x},${d.collisionAt.y})` : ""}.`;
    case "collision.damage":
      return `${prefix}${d.targetName} takes ${d.amount} ${d.damageType} collision damage${damageModifierText(d)} (${d.hpBefore} -> ${d.hpAfter}); ${d.dice} rolled [${d.rolls.join(", ")}].`;
    case "move.blocked":
      return `${prefix}${d.actorName} cannot move to (${d.to.x},${d.to.y}): ${d.reason}.`;
    case "opportunity.attack":
      return `${prefix}${d.actorName} makes an opportunity attack against ${d.targetName} with ${d.actionName}.`;
    case "reaction.spend":
      return `${prefix}${d.actorName} spends reaction: ${d.reason}.`;
    case "dash":
      return `${prefix}${d.actorName} dashes, adding ${d.addedMovement} squares of movement (${d.movementBefore} -> ${d.movementAfter} remaining).`;
    case "dodge":
      return `${prefix}${d.actorName} takes the Dodge action. Attacks against them have disadvantage until the ${d.expires}.`;
    case "feature.action":
      return `${prefix}${d.actorName} uses ${d.actionName}${d.cost === "free" ? "" : ` as a ${d.cost}`}.`;
    case "target.invalid":
      return `${prefix}${d.actorName} cannot target ${d.targetName}: ${d.reason}.`;
    case "target.test":
      return `${prefix}${d.actorName} confirms Target Test ${targetTestShapeText(d)} at (${d.anchor.x},${d.anchor.y}): ${d.cells.length} cells; actors ${d.affectedActors.length ? d.affectedActors.map((actor) => actor.name).join(", ") : "none"}.`;
    case "area.target":
      return `${prefix}${d.actorName} casts ${d.actionName} ${d.shape} at (${d.anchor.x},${d.anchor.y}): ${d.cells.length} cells; targets ${d.targets.length ? d.targets.map((target) => target.name).join(", ") : "none"}.`;
    case "object.created":
      return `${prefix}${d.actorName} creates ${d.objectName} at (${d.anchor.x},${d.anchor.y})${d.blocksLineOfSight ? ", blocking sight" : ""}${d.difficultTerrain ? ", difficult terrain" : ""}.`;
    case "object.removed":
      return `${prefix}${d.actionName || d.objectName || d.actionId || "Spell object"} zone ends: ${d.reason}.`;
    case "trigger.fired":
      return `${prefix}${d.sourceName} triggers on ${d.actorName}: ${d.trigger}.`;
    case "effect.applied":
      return `${prefix}${d.targetName} gains ${d.actionName}: ${modifierEffectText(d)}.`;
    case "effect.removed":
      return `${prefix}${d.actorName || d.targetName || "Actor"} loses ${d.label || d.effectId || "effect"}: ${d.reason}.`;
    case "attack.roll":
      if (d.actionType === "spell_attack") {
        return `${prefix}${d.actorName} casts ${d.actionName} on ${d.targetName}: ${attackRollText(d)} + ${attackBonusText(d)} = ${d.total} vs AC ${d.ac}${coverText(d.cover)} = ${d.effectiveAc}.`;
      }
      return `${prefix}${d.actorName} attacks ${d.targetName}: ${attackRollText(d)} + ${attackBonusText(d)} = ${d.total} vs AC ${d.ac}${coverText(d.cover)} = ${d.effectiveAc}.`;
    case "lucky.roll":
      return `${prefix}${d.actorName} uses Lucky on ${d.rollType} ${d.label}: missed by ${d.missedBy}, rolled ${d.originalRoll} then ${d.secondRoll}, kept ${d.roll}. ${d.pointsRemaining} Luck Point(s) remain.`;
    case "attack.result":
      if (d.actionType === "spell_attack") {
        return `${prefix}${d.hit ? "Spell hit" : "Spell miss"}: ${d.actorName} ${d.hit ? "hits" : "misses"} ${d.targetName} with ${d.actionName}${d.critical ? " critically" : ""}.`;
      }
      return `${prefix}${d.hit ? "Hit" : "Miss"}: ${d.actorName} ${d.hit ? "hits" : "misses"} ${d.targetName}${d.critical ? " critically" : ""}.`;
    case "save.roll":
      return `${prefix}${d.targetName} makes a ${d.ability.toUpperCase()} save: ${rollText(d)} + ${d.bonus}${coverText(d.cover)} = ${d.total} vs DC ${d.dc}.`;
    case "save.result":
      return `${prefix}${d.success ? "Save succeeds" : "Save fails"} against ${d.spellName}.`;
    case "damage.roll":
      return `${prefix}${d.label}${d.critical ? " critical" : ""}: ${d.dice} rolled [${d.rolls.join(", ")}] ${d.modifierText} = ${d.total}${savageAttackerText(d)}.`;
    case "damage.applied":
      return `${prefix}${d.targetName} takes ${d.amount} ${d.damageType} damage${damageModifierText(d)} (${d.hpBefore} -> ${d.hpAfter}).`;
    case "healing.roll":
      return `${prefix}${d.actorName} uses ${d.label}: ${d.dice} rolled [${d.rolls.join(", ")}] + ${d.modifier} = ${d.total}.`;
    case "healing.applied":
      return `${prefix}${d.actorName} regains ${d.amount} HP (${d.hpBefore} -> ${d.hpAfter}).${Number.isFinite(d.remaining) ? ` ${d.remaining} healing potion(s) remain.` : ""}`;
    case "condition.applied":
      return `${prefix}${d.targetName} gains ${d.label}${d.noSave ? " (no save)" : ""} from ${d.actionName}.`;
    case "condition.removed":
      return `${prefix}${d.actorName} loses ${d.condition}: ${d.reason}${Number.isFinite(d.movementCost) ? ` (${d.movementCost} movement spent, ${d.movementRemaining} left)` : ""}.`;
    case "condition.save.roll":
      return `${prefix}${d.actorName} rolls to end ${d.condition}: ${rollText(d)} + ${d.bonus} = ${d.total} vs DC ${d.dc}.`;
    case "condition.save.result":
      return `${prefix}${d.actorName} ${d.success ? "ends" : "fails to end"} ${d.condition}.`;
    case "concentration.start":
      return `${prefix}${d.actorName} starts concentrating on ${d.actionName}.`;
    case "concentration.save.roll":
      return `${prefix}${d.actorName} checks concentration on ${d.actionName}: ${rollText(d)} + ${d.bonus} = ${d.total} vs DC ${d.dc}.`;
    case "concentration.save.result":
      return `${prefix}${d.actorName} ${d.success ? "maintains" : "loses"} concentration on ${d.actionName}.`;
    case "concentration.end":
      return `${prefix}${d.actorName}'s concentration on ${d.actionName} ends: ${d.reason}.`;
    case "actor.defeated":
      return `${prefix}${d.targetName} is defeated.`;
    case "ai.intent":
      return `${prefix}${d.actorName} AI: ${d.intent}`;
    case "cover.move":
      return `${prefix}${d.actorName} ducks back into ${d.cover?.label || "cover"} at (${d.to.x},${d.to.y}).`;
    case "round.start":
      return `Round ${d.round} begins.`;
    case "combat.end":
      return `${prefix}Combat ends: ${d.outcome}.`;
    case "reset":
      return "Combat reset from the initial test setup.";
    default:
      return `${prefix}${event.type}: ${JSON.stringify(d)}`;
  }
}

function coverText(cover) {
  if (!cover || !cover.bonus || !Number.isFinite(cover.bonus)) return "";
  return ` + ${cover.label} ${cover.bonus}`;
}

function modifierEffectText(detail) {
  const stat = String(detail.stat || "modifier").replace(/_/g, " ");
  const amount = Number.isFinite(detail.amount) && detail.amount !== 0 ? ` ${formatSigned(detail.amount)}` : "";
  const die = detail.die ? ` ${detail.die}` : "";
  return `${stat}${amount}${die}`;
}

function attackBonusText(detail) {
  const reasons = Array.isArray(detail.modifierReasons) ? detail.modifierReasons.filter(Boolean) : [];
  if (!reasons.length) return `${detail.bonus}`;
  const baseBonus = Number.isFinite(detail.baseBonus) ? detail.baseBonus : detail.bonus;
  return `${detail.bonus} (base ${formatSigned(baseBonus)}; ${reasons.join("; ")})`;
}

function formatSigned(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function initiativeRollText(item) {
  if (Array.isArray(item.rolls) && item.rolls.length > 1) return `ADV [${item.rolls.join(", ")}] -> ${item.roll}`;
  return `${item.roll}`;
}

function damageModifierText(detail) {
  const modifiers = detail.damageModifiers;
  if (!modifiers) return "";
  const parts = [];
  if (modifiers.immune?.length) parts.push("immune");
  if (modifiers.resistant?.length) parts.push("resisted");
  if (modifiers.vulnerable?.length) parts.push("vulnerable");
  if (modifiers.reduced?.length) parts.push(`reduced: ${modifiers.reduced.join(", ")}`);
  if (!parts.length) return "";
  return ` (${parts.join(", ")} from ${detail.originalAmount})`;
}

function savageAttackerText(detail) {
  const savage = detail.savageAttacker;
  if (!savage) return "";
  return `; Savage Attacker kept ${savage.kept} roll (${savage.first.total}/${savage.second.total})`;
}

function targetTestShapeText(detail) {
  if (detail.shape === "line") {
    const direction = detail.direction ? ` dir (${detail.direction.x},${detail.direction.y})` : "";
    return `line ${detail.lengthFt}ft${direction}`;
  }
  if (detail.shape === "cone") {
    const direction = detail.direction ? ` dir (${detail.direction.x},${detail.direction.y})` : "";
    return `cone ${detail.coneLengthFt}ft${direction}`;
  }
  if (detail.shape === "cube") {
    return `cube ${detail.cubeSizeFt}ft`;
  }
  return `radius ${detail.radiusFt}ft`;
}

function attackRollText(detail) {
  const lucky = luckyText(detail);
  if (!Array.isArray(detail.rolls) || detail.rolls.length < 2) return `d20 ${detail.roll}`;
  const reason = detail.reasons?.length ? ` (${detail.reasons.join("; ")})` : "";
  const mode = detail.mode === "advantage" ? "ADV" : "DIS";
  return `${mode} [${detail.rolls.join(", ")}] -> ${detail.roll}${reason}${lucky}`;
}

function rollText(detail) {
  if (detail.mode === "auto_fail") {
    const reason = detail.reasons?.length ? ` (${detail.reasons.join("; ")})` : "";
    return `AUTO FAIL${reason}`;
  }
  const lucky = luckyText(detail);
  if (!Array.isArray(detail.rolls) || detail.rolls.length < 2) return `d20 ${detail.roll}`;
  const reason = detail.reasons?.length ? ` (${detail.reasons.join("; ")})` : "";
  const mode = detail.mode === "advantage" ? "ADV" : "DIS";
  return `${mode} [${detail.rolls.join(", ")}] -> ${detail.roll}${reason}${lucky}`;
}

function luckyText(detail) {
  if (!detail?.lucky?.usedLucky) return "";
  return `; Lucky ${detail.lucky.originalRoll} -> ${detail.lucky.secondRoll} kept ${detail.lucky.roll}`;
}
