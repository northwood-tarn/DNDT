import { getActor } from "./combatState.js";
import { resolveAction } from "./resolver.js";
import { canTargetAction, canUseAction } from "./rules.js";

export function resolveActionResult(snapshot, actor, actionId, targetPayload, dice, log) {
  const preflight = preflightAction(snapshot, actor, actionId, targetPayload);
  if (!preflight.ok) {
    logInvalidAction(snapshot, preflight, log);
    return preflight;
  }

  const beforeEventCount = log?.events?.length || 0;
  const resolved = resolveAction(snapshot, actor, actionId, targetPayload, dice, log);
  if (resolved) return actionResult(true, "resolved", "action resolved", preflight);
  return failureFromLog(log, beforeEventCount, preflight);
}

export function preflightAction(snapshot, actor, actionId, targetPayload) {
  if (!actor) return actionResult(false, "actor_missing", "actor is missing", { actionId });
  if (actor.hp <= 0) return actionResult(false, "actor_defeated", "actor is not able to act", { actorId: actor.id, actionId });
  if (snapshot.outcome) return actionResult(false, "combat_ended", "combat has ended", { actorId: actor.id, actionId });

  const action = actor.actions.find((item) => item.id === actionId);
  if (!action) return actionResult(false, "action_missing", "action is missing", { actorId: actor.id, actionId });

  const use = canUseAction(actor, action);
  if (!use.ok) return actionResult(false, "action_unavailable", use.reason, actionContext(actor, action, targetPayload));

  if (isAreaAction(action)) {
    if (!hasAreaAnchor(targetPayload)) return actionResult(false, "target_area_missing", "target area is missing", actionContext(actor, action, targetPayload));
    return actionResult(true, "ready", "action can resolve", actionContext(actor, action, targetPayload));
  }

  if (action.requiresTarget === false) return actionResult(true, "ready", "action can resolve", actionContext(actor, action, targetPayload));
  const target = getActor(snapshot, targetActorId(targetPayload));
  const targetLegality = canTargetAction(snapshot, actor, action, target);
  if (!targetLegality.ok) {
    return actionResult(false, "target_invalid", targetLegality.reason, actionContext(actor, action, targetPayload, target));
  }
  return actionResult(true, "ready", "action can resolve", actionContext(actor, action, targetPayload, target));
}

function failureFromLog(log, beforeEventCount, context) {
  const event = [...(log?.events || []).slice(beforeEventCount)].reverse().find((item) =>
    ["target.invalid", "target_gate.save.result"].includes(item.type)
  );
  if (event?.type === "target.invalid") return actionResult(false, "target_invalid", event.detail.reason, { ...context, event });
  if (event?.type === "target_gate.save.result") return actionResult(false, "target_gate_blocked", "target gate blocked the action", { ...context, event });
  return actionResult(false, "not_resolved", "action did not resolve", context);
}

function logInvalidAction(snapshot, result, log) {
  if (!log?.add) return;
  log.add("target.invalid", {
    round: snapshot.round,
    actorId: result.actorId,
    actorName: result.actorName,
    targetName: result.targetName || result.actionName || "target",
    reason: result.reason,
  });
}

function actionResult(ok, code, reason, context = {}) {
  return { ok, code, reason, ...context };
}

function actionContext(actor, action, targetPayload, target = null) {
  return {
    actorId: actor?.id || null,
    actorName: actor?.name || null,
    actionId: action?.id || null,
    actionName: action?.name || null,
    targetId: target?.id || targetActorId(targetPayload),
    targetName: target?.name || (typeof targetPayload === "string" ? targetPayload : "target area"),
  };
}

function targetActorId(targetPayload) {
  if (typeof targetPayload === "string") return targetPayload;
  return targetPayload?.targetId || null;
}

function isAreaAction(action) {
  return action?.type === "spell_area_save" || action?.type === "spell_object" || Boolean(action?.targeting?.shape);
}

function hasAreaAnchor(targetPayload) {
  const anchor = targetPayload?.anchor || targetPayload;
  return Boolean(anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
}
