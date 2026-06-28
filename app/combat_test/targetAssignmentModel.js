export function isMultiTargetAction(action) {
  return action?.requiresTarget !== false && Number.isFinite(action.maxTargets) && action.maxTargets > 1 && !action.targeting?.shape;
}

export function toggleTargetAssignment(selectedTargetIds, targetId, action) {
  if (!targetId || !isMultiTargetAction(action)) return [...(selectedTargetIds || [])];
  const current = [...(selectedTargetIds || [])];
  const maxTargets = action.maxTargets;

  if (action.allowRepeatedTargets) {
    if (current.length >= maxTargets) {
      const index = current.lastIndexOf(targetId);
      if (index >= 0) current.splice(index, 1);
      return current;
    }
    current.push(targetId);
    return current;
  }

  if (current.includes(targetId)) return current.filter((id) => id !== targetId);
  if (current.length >= maxTargets) return current;
  return [...current, targetId];
}

export function multiTargetConfirmState(action, selectedTargetIds = []) {
  if (!isMultiTargetAction(action)) {
    return { disabled: true, text: "Confirm Target", status: "Click grid to lock target" };
  }
  const maxTargets = action.maxTargets;
  const count = selectedTargetIds.length;
  const exactRequired = action.requireExactTargetCount === true;
  const noun = action.targetAssignments === "per_hit" ? "assignments" : "targets";
  const disabled = exactRequired ? count !== maxTargets : count < 1;
  const text = `Confirm ${count}/${maxTargets}`;
  const status = count
    ? `Selected ${count}/${maxTargets} ${noun}. ${action.allowRepeatedTargets ? "Click again to stack another, or click after full to remove one." : "Click a selected target to remove it."}`
    : `Select ${exactRequired ? "" : "up to "}${maxTargets} ${noun}, then confirm.`;
  return { disabled, text, status };
}
