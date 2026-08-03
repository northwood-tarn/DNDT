export function createEquipmentGrantedActions(foci = []) {
  const actions = [];
  const seenGrantedActions = new Set();
  for (const focus of foci) {
    const grantedActionId = focus.mechanics?.grantedAction;
    if (!grantedActionId || seenGrantedActions.has(grantedActionId)) continue;
    seenGrantedActions.add(grantedActionId);
    if (focus.mechanics?.grantedAction === "restless_suffering_revivify") actions.push({
      id: "restless_suffering_revivify", name: "Symbol of Restless Suffering: Revivify",
      iconId: "restless_suffering_revivify",
      description: "Return a fallen ally to life at 1 HP, then take 3d10 unavoidable necrotic damage.",
      type: "relic_revivify", cost: "action", range: 1, requiresTarget: true,
      allowDefeatedTarget: true, requiresDefeatedTarget: true, uses: { max: 1, remaining: 1, recovery: "long_rest" },
      grantedByEquipment: true, sourceItemId: focus.id,
      tags: { spell: true, harmful: false, requiresHands: true },
    });
    if (focus.mechanics?.grantedAction === "staff_of_the_adder_transform") actions.push({
      id: "staff_of_the_adder_transform", name: "Awaken the Adder",
      iconId: "staff_of_the_adder",
      description: "For one minute, the staff's attacks deal an additional 1d6 poison damage and prevent Opportunity Attacks until the start of the target's next turn.",
      type: "feature_action", actionKind: "staff_of_the_adder_transform", cost: "action", requiresTarget: false,
      resourceId: "staff_of_the_adder_transform", grantedByEquipment: true, sourceItemId: focus.id,
      tags: { spell: false, harmful: false, requiresHands: true },
    });
  }
  return actions;
}

export function reconcileEquipmentGrantedActions(actor, resolveFocus) {
  const equippedIds = (actor.equipment?.weaponSetIds || []).flat().filter(Boolean);
  const foci = equippedIds.map(resolveFocus).filter(Boolean);
  const retained = (actor.actions || []).filter((action) => action.grantedByEquipment !== true);
  const granted = createEquipmentGrantedActions(foci);
  actor.actions = [...retained, ...granted];
  return granted;
}
