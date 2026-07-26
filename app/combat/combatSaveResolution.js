import { applyLuckyToRoll } from "./luck.js";
import { rollSaveModifier } from "./modifiers.js";
import { rollSaveD20 } from "./combatRolls.js";
import { weaponMasterySaveDc } from "./weaponMasteryResolution.js";
import { applyLegendaryResistance } from "./legendaryResistance.js";

export function resolveEffectSave(save, actor, action) {
  if (save.dcFrom !== "weapon_mastery") return save;
  return {
    ...save,
    dc: weaponMasterySaveDc(actor, action),
  };
}

export function resolveInlineSave(snapshot, source, target, effect, dice, log) {
  const ability = String(effect.save.ability || "").toLowerCase();
  const dc = effect.save.dc || 10;
  const saveModifier = rollSaveModifier(snapshot, target, ability, { name: effect.name, saveAbility: ability }, dice);
  const baseBonus = target.saves?.[ability] || 0;
  const bonus = baseBonus + saveModifier.total;
  const roll = applyLuckyToRoll({
    actor: target,
    roll: rollSaveD20(target, { name: effect.name, saveAbility: ability }, dice, snapshot, source),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "save",
      label: effect.name,
      targetNumber: dc,
      bonus,
    },
  });
  const total = roll.roll + bonus;
  let success = !roll.autoFail && total >= dc;
  ({ success } = applyLegendaryResistance({ snapshot, target, success, action: { name: effect.name, effects: [effect] }, effect, log, total, dc }));
  log.add("save.roll", {
    round: snapshot.round,
    actorId: source.id,
    actorName: source.name,
    targetId: target.id,
    targetName: target.name,
    spellName: effect.name,
    ability,
    roll: roll.roll,
    rolls: roll.rolls,
    mode: roll.mode,
    reasons: roll.reasons,
    lucky: roll.lucky,
    bonus,
    baseBonus,
    modifierReasons: saveModifier.reasons,
    cover: null,
    effectiveBonus: bonus,
    total,
    dc,
  });
  log.add("save.result", {
    round: snapshot.round,
    actorId: source.id,
    actorName: source.name,
    targetId: target.id,
    targetName: target.name,
    spellName: effect.name,
    success,
  });
  return { success, onSave: effect.save.onSave };
}
