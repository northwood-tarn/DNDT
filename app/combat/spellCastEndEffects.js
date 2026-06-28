export function applySpellCastEndEffects(snapshot, actor, action, log, startEventIndex = 0) {
  const effect = action?.onCastEnd;
  if (!effect || effect.kind !== "party_temp_hp_from_damage") return;
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
