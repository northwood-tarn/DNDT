import { validateCombatAction } from "../app/combat/actionSchema.js";
import { createSpellAction } from "../app/combat/actionFactory.js";
import { SPELLS } from "../app/data/spells.js";

const DEFAULTS = {
  attackBonus: 5,
  spellSaveDC: 13,
};

const rows = Object.values(SPELLS).filter((spell) => spell.active !== false).map((spell) => {
  const action = createSpellAction(spell, DEFAULTS);
  if (!action) {
    if (spell.hooks?.utility) {
      return {
        id: spell.id,
        name: spell.name,
        status: "external",
        reason: `utility resolver: ${spell.hooks.utility.kind}`,
      };
    }
    return {
      id: spell.id,
      name: spell.name,
      status: "unsupported",
      reason: explainUnsupported(spell),
    };
  }
  const errors = validateCombatAction(action);
  return {
    id: spell.id,
    name: spell.name,
    status: errors.length ? "invalid" : "supported",
    reason: errors.join("; "),
    actionType: action.type,
  };
});

const supported = rows.filter((row) => row.status === "supported");
const external = rows.filter((row) => row.status === "external");
const invalid = rows.filter((row) => row.status === "invalid");
const unsupportedCombat = rows.filter((row) => row.status === "unsupported" && looksCombatRelevant(SPELLS[row.id]));
const unsupportedNonCombat = rows.filter((row) => row.status === "unsupported" && !looksCombatRelevant(SPELLS[row.id]));

console.log(`[spell-actions] supported: ${supported.length}`);
console.log(`[spell-actions] wired exploration/dialogue utility spells: ${external.length}`);
console.log(`[spell-actions] invalid generated actions: ${invalid.length}`);
console.log(`[spell-actions] unsupported combat-looking spells: ${unsupportedCombat.length}`);
console.log(`[spell-actions] unsupported non-combat/utility spells: ${unsupportedNonCombat.length}`);

printSection("Invalid Generated Actions", invalid);
printSection("Unsupported Combat-Looking Spells", unsupportedCombat);
printSection("Unsupported Non-Combat/Utility Spells", unsupportedNonCombat);

if (invalid.length) process.exitCode = 1;

function printSection(title, entries) {
  if (!entries.length) return;
  console.log(`\n${title}`);
  for (const entry of entries) {
    console.log(`- ${entry.id}: ${entry.reason || "no reason recorded"}`);
  }
}

function explainUnsupported(spell) {
  if (spell.dialogueRelated || spell.hooks?.ui?.hideInCombat || spell.hooks?.dialogueOnly) return "dialogue/exploration spell";
  if (!spell.hooks) return "missing hooks";
  if (!spell.hooks.attack && !spell.hooks.save && !spell.hooks.healing && !spell.hooks.applyEffect) return "no combat hook";
  if (spell.hooks.applyEffect) return `unsupported applyEffect kind: ${spell.hooks.applyEffect.kind || "unknown"}`;
  return "hook shape is not yet supported by actionFactory";
}

function looksCombatRelevant(spell) {
  if (spell.dialogueRelated || spell.hooks?.ui?.hideInCombat || spell.hooks?.dialogueOnly) return false;
  const tags = new Set(spell.tags || []);
  return Boolean(
    spell.hooks?.attack ||
    spell.hooks?.save ||
    spell.hooks?.damage ||
    tags.has("damage") ||
    tags.has("control") ||
    tags.has("debuff") ||
    tags.has("buff") ||
    tags.has("healing")
  );
}
