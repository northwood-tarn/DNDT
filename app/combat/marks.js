export function normalizeMarks(marks = []) {
  return (Array.isArray(marks) ? marks : []).map((mark, index) => ({
    id: mark.id || `mark_${index + 1}`,
    label: mark.label || mark.name || mark.id || `Mark ${index + 1}`,
    sourceActorId: mark.sourceActorId || null,
    sourceFeatureId: mark.sourceFeatureId || null,
    duration: mark.duration ? structuredClone(mark.duration) : null,
    removeOnSourceDefeated: mark.removeOnSourceDefeated !== false,
    removeOnTargetDefeated: mark.removeOnTargetDefeated !== false,
  }));
}

export function applyMark(target, mark, source, action) {
  if (!target || !mark?.id) return false;
  if (!Array.isArray(target.marks)) target.marks = [];
  const normalized = normalizeMarks([{
    ...mark,
    sourceActorId: mark.sourceActorId || source?.id || null,
    sourceFeatureId: mark.sourceFeatureId || action?.id || null,
    label: mark.label || mark.name || action?.name || mark.id,
  }])[0];
  const existing = target.marks.find((item) =>
    item.id === normalized.id && item.sourceActorId === normalized.sourceActorId
  );
  if (existing) {
    Object.assign(existing, normalized);
    return false;
  }
  target.marks.push(normalized);
  return true;
}

export function removeMark(target, markId, sourceActorId = null) {
  if (!Array.isArray(target?.marks)) return false;
  const before = target.marks.length;
  target.marks = target.marks.filter((mark) =>
    mark.id !== markId || (sourceActorId && mark.sourceActorId !== sourceActorId)
  );
  return target.marks.length !== before;
}

export function targetHasRequiredMark(source, target, requirement) {
  if (!requirement) return true;
  const marks = target?.marks || [];
  return marks.some((mark) =>
    mark.id === requirement.id &&
    (!requirement.source || requirement.source !== "self" || mark.sourceActorId === source?.id) &&
    (!requirement.sourceActorId || mark.sourceActorId === requirement.sourceActorId)
  );
}

export function cleanupInvalidMarks(snapshot, log) {
  for (const actor of snapshot.actors || []) {
    for (const mark of [...(actor.marks || [])]) {
      const source = mark.sourceActorId ? snapshot.actors.find((item) => item.id === mark.sourceActorId) : null;
      const removeForSource = mark.removeOnSourceDefeated && source && source.hp <= 0;
      const removeForTarget = mark.removeOnTargetDefeated && actor.hp <= 0;
      if (!removeForSource && !removeForTarget) continue;
      removeMark(actor, mark.id, mark.sourceActorId);
      log?.add("mark.removed", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        markId: mark.id,
        markLabel: mark.label,
        reason: removeForSource ? "source defeated" : "target defeated",
      });
    }
  }
}
