export function applySpellCastEndEffects(snapshot, actor, action, log, startEventIndex = 0) {
  const effect = action?.onCastEnd;
  if (!effect) return;
  if (effect.kind === "grant_persistent_spell_attack") {
    grantPersistentSpellAttack(snapshot, actor, action, effect, log);
    return;
  }
  if (effect.kind === "grant_move_spell_area") {
    grantMoveSpellArea(snapshot, actor, action, effect, log);
    return;
  }
  if (effect.kind !== "party_temp_hp_from_damage") return;
  const damageTotal = damageSince(log, actor.id, startEventIndex);
  const amount = sharedAmount(damageTotal, effect.share);
  if (amount <= 0) return;
  const targets = partyTargets(snapshot, actor, effect.distribution);
  for (const target of targets) {
    const before = target.tempHp || 0;
    if (effect.bestOf !== false && before >= amount) continue;
    target.tempHp = amount;
    log.add("temp_hp.applied", {
      round: snapshot.round,
      sourceId: actor.id,
      sourceName: actor.name,
      targetId: target.id,
      targetName: target.name,
      actionName: action.name,
      amount,
      before,
    });
  }
}

function grantMoveSpellArea(snapshot, actor, action, effect, log) {
  const id = `${action.sourceSpellId || action.id}_move_area`;
  const granted = {
    id,
    name: effect.name || `${action.name}: Move`,
    type: "move_spell_area",
    cost: "bonus",
    requiresTarget: true,
    range: Math.ceil((effect.distanceFt || 60) / 5),
    targeting: { shape: "radius", radiusSquares: Math.ceil((effect.distanceFt || 60) / 5), radiusFt: effect.distanceFt || 60 },
    objectSourceActionId: action.id,
    grantedByActionId: action.id,
    sourceSpellId: action.sourceSpellId,
    spellLevel: action.baseSpellLevel || action.spellLevel || 0,
    baseSpellLevel: action.baseSpellLevel || action.spellLevel || 0,
    usesExactSpellSlot: false,
    tags: { spell: true, harmful: false, persistentSpellAction: true },
  };
  const existing = (actor.actions || []).findIndex((item) => item.id === id);
  if (existing >= 0) actor.actions[existing] = granted;
  else actor.actions.push(granted);
  log.add("action.granted", { round: snapshot.round, sourceId: actor.id, sourceName: actor.name, targetId: actor.id, targetName: actor.name, actionId: id, actionName: granted.name, sourceActionId: action.id });
}

function grantPersistentSpellAttack(snapshot, actor, action, effect, log) {
  const id = `${action.sourceSpellId || action.id}_persistent_attack`;
  const granted = {
    ...structuredClone(action),
    id,
    name: effect.name || `${action.name}: Strike`,
    cost: effect.cost || "bonus",
    concentration: false,
    spellLevel: action.baseSpellLevel || action.spellLevel || 0,
    baseSpellLevel: action.baseSpellLevel || action.spellLevel || 0,
    usesExactSpellSlot: false,
    onCastEnd: null,
    effects: [],
    grantedByActionId: action.id,
    duration: { kind: "rounds", rounds: effect.durationRounds || 10, remaining: effect.durationRounds || 10, tick: "turn_end" },
    tags: { ...(action.tags || {}), persistentSpellAction: true },
  };
  const existing = (actor.actions || []).findIndex((item) => item.id === id);
  if (existing >= 0) actor.actions[existing] = granted;
  else actor.actions.push(granted);
  log.add("action.granted", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: actor.id,
    targetName: actor.name,
    actionId: id,
    actionName: granted.name,
    sourceActionId: action.id,
  });
}

function damageSince(log, sourceId, startEventIndex) {
  return (log?.events || [])
    .slice(startEventIndex)
    .filter((event) => event.type === "damage.applied" && event.detail?.sourceId === sourceId)
    .reduce((total, event) => total + Math.max(0, event.detail?.amount || 0), 0);
}

function sharedAmount(total, share = {}) {
  const raw = total * (Number.isFinite(share.fraction) ? share.fraction : 1);
  if (share.round === "ceil") return Math.ceil(raw);
  if (share.round === "round") return Math.round(raw);
  return Math.floor(raw + 1e-6);
}

function partyTargets(snapshot, actor, distribution) {
  if (distribution !== "party_wide") return [actor];
  return (snapshot?.actors || []).filter((target) => target.team === actor.team && target.hp > 0);
}
