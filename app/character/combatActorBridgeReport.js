import { getArmorById } from "../data/armor.js";
import { getConsumableById } from "../data/consumables.js";
import { getSpellRecordById } from "../data/spells.js";
import { getWeaponById } from "../data/weapons.js";
import { resolvedSheetToCombatActor, validateResolvedSheetCombatActor } from "./combatActorAdapter.js";
import { validateResolvedCharacterSheet } from "./resolvedSheet.js";

export function createCombatActorBridgeReport(sheet, options = {}) {
  const sheetErrors = validateResolvedCharacterSheet(sheet);
  const actorErrors = sheetErrors.length ? [] : validateResolvedSheetCombatActor(sheet, options.actorOptions || {});
  const actor = sheetErrors.length || actorErrors.length ? null : resolvedSheetToCombatActor(sheet, options.actorOptions || {});
  return {
    version: 1,
    valid: sheetErrors.length === 0 && actorErrors.length === 0,
    sheetErrors,
    actorErrors,
    sections: [
      identitySection(sheet, actor),
      durabilitySection(sheet, actor),
      defenseSection(sheet, actor),
      spellcastingSection(sheet, actor),
      equipmentSection(sheet, actor),
      featureSection(sheet, actor),
      actionSection(actor),
    ],
  };
}

function identitySection(sheet, actor) {
  return section("Identity", [
    line("Actor id", actor?.id || "Unavailable", "Generated from character name unless overridden."),
    line("Name", actor?.name || sheet.identity.characterName || "Unnamed", "Resolved sheet identity."),
    line("Role", actor?.role || sheet.identity.classId || "character", "Combat role uses class id."),
    line("Level / PB", `${sheet.identity.level} / +${sheet.proficiencyBonus}`, "Resolved character level and proficiency bonus."),
  ]);
}

function durabilitySection(sheet, actor) {
  return section("Durability", [
    line("HP", `${actor?.maxHp ?? "?"}`, hpSourceText(sheet)),
    line("Speed", `${actor?.speed ?? "?"} squares`, `${sheet.combatBasics.speed || 0} ft from resolved sheet.`),
    line("Resistances", list(sheet.durability.resistances), "Copied directly to combat actor."),
    line("Immunities", list([...sheet.durability.immunities, ...sheet.durability.conditionImmunities]), "Damage and condition immunities copied directly."),
  ]);
}

function defenseSection(sheet, actor) {
  return section("Defense", [
    line("AC", `${actor?.ac ?? "?"}`, armorClassSourceText(sheet)),
    line("Initiative", signed(actor?.initiativeBonus ?? sheet.combatBasics.initiativeBonus ?? 0), "Resolved combat basics."),
    line("Saves", saveSourceText(sheet), "Full save totals are converted to abbreviated combat save keys."),
    line("Senses", list(sheet.combatBasics.senses), "Copied to combat perception gates."),
  ]);
}

function spellcastingSection(sheet, actor) {
  const known = spellNames(sheet.spellcasting.knownSpellIds);
  const prepared = spellNames(sheet.spellcasting.preparedSpellIds);
  return section("Spellcasting", [
    line("Frame", sheet.spellcasting.canCast ? casterFrame(sheet) : "No spellcasting", "Class spellcasting frame, not a chosen spell list."),
    line("Known", list(known), "Known spells on the resolved sheet become combat spell actions."),
    line("Prepared", list(prepared), "Prepared spells on the resolved sheet become combat spell actions."),
    line("Slots", slotText(actor?.spellSlots || sheet.spellcasting.slots), "Runtime actor receives current/max slot state."),
  ]);
}

function equipmentSection(sheet, actor) {
  return section("Equipment", [
    line("Weapons", list((sheet.equipment.weaponIds || []).map(weaponName)), "Weapon records produce combat weapon actions automatically."),
    line("Masteries", list((sheet.equipment.masteredWeaponIds || []).map(weaponName)), "Mastered weapon ids enable weapon mastery riders/actions."),
    line("Armor", getArmorById(sheet.equipment.armorId)?.name || "None", "Armor record feeds AC calculation before bridge."),
    line("Shield", getArmorById(sheet.equipment.shieldId)?.name || "None", "Shield record feeds AC calculation before bridge."),
    line("Consumables", list((sheet.equipment.inventory || []).map((entry) => `${getConsumableById(entry.id)?.name || entry.id} x${entry.quantity || 1}`)), "Inventory consumables become combat consumable actions."),
    line("Actor gear ids", actor ? list([...(actor.equipment?.weaponIds || []), actor.equipment?.armorId, actor.equipment?.shieldId].filter(Boolean)) : "Unavailable", "IDs retained for runtime inspection."),
  ]);
}

function featureSection(sheet, actor) {
  return section("Features", [
    line("Feature count", String((sheet.features || []).length), "All resolved features are copied to the actor."),
    line("Passive effects", String((actor?.activeEffects || []).length), "Feature modifiers bridged as active passive effects."),
    line("Auras", String((actor?.auras || []).length), "Feature aura definitions bridged to the aura engine."),
    line("Resources", list((actor?.resources || sheet.resources || []).map((item) => `${item.name || item.id}: ${item.current ?? item.max}/${item.max}`)), "Resources copied with current/max state."),
  ]);
}

function actionSection(actor) {
  const actions = actor?.actions || [];
  const byType = actions.reduce((counts, action) => {
    counts[action.type] = (counts[action.type] || 0) + 1;
    return counts;
  }, {});
  return section("Actions", [
    line("Total", String(actions.length), "Weapon, spell, consumable, and feature actions generated from records."),
    line("By type", Object.entries(byType).map(([type, count]) => `${type}: ${count}`).join(", ") || "None", "Useful for spotting missing action families."),
    line("Names", list(actions.map((action) => action.name)), "Final action names exposed to combat UI."),
  ]);
}

function section(label, lines) {
  return { label, lines };
}

function line(label, value, source) {
  return { label, value, source };
}

function hpSourceText(sheet) {
  const bonuses = (sheet.durability.hitPointBonuses || []).map((bonus) => `${bonus.source}: +${bonus.total}`);
  return [sheet.durability.hitDice ? `Hit die ${sheet.durability.hitDice}` : null, ...bonuses].filter(Boolean).join("; ") || "Resolved durability.maxHp.";
}

function armorClassSourceText(sheet) {
  return (sheet.combatBasics.armorClassSources || [])
    .map((source) => `${source.label} ${signed(source.amount)}${source.detail ? ` (${source.detail})` : ""}`)
    .join("; ") || "Resolved combatBasics.armorClass.";
}

function saveSourceText(sheet) {
  return Object.entries(sheet.combatBasics.saves || {})
    .map(([ability, value]) => `${ability} ${signed(value)}`)
    .join(", ") || "No save totals.";
}

function casterFrame(sheet) {
  return [
    sheet.spellcasting.classId || sheet.identity.classId,
    sheet.spellcasting.ability ? `${sheet.spellcasting.ability} casting` : null,
    sheet.spellcasting.pactMagic ? "pact magic" : null,
    `DC ${sheet.spellcasting.spellSaveDc ?? "?"}`,
    `attack ${signed(sheet.spellcasting.spellAttackBonus ?? 0)}`,
  ].filter(Boolean).join(" · ");
}

function spellNames(ids = []) {
  return ids.map((id) => getSpellRecordById(id, { includeInactive: true })?.name || id);
}

function weaponName(id) {
  return getWeaponById(id)?.name || id;
}

function slotText(slots = {}) {
  const entries = Object.entries(slots || {});
  if (!entries.length) return "None";
  return entries.map(([level, slot]) => {
    if (typeof slot === "number") return `L${level}: ${slot}`;
    return `L${level}: ${slot.current ?? slot.max ?? 0}/${slot.max ?? slot.current ?? 0}`;
  }).join(", ");
}

function list(values = []) {
  return values.filter(Boolean).length ? values.filter(Boolean).join(", ") : "None";
}

function signed(value) {
  return Number(value) >= 0 ? `+${Number(value) || 0}` : String(value);
}
