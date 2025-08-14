import { metamagicRules } from "../utils/metamagicRules.js";

export function applyMetamagicToSpell(spell, caster) {
  const active = caster.metamagic;
  const rules = metamagicRules[active];
  if (!rules || caster.sorceryPoints < rules.cost) return spell;

  // Deduct Sorcery Point
  caster.sorceryPoints -= rules.cost;
  console.log(`${caster.name} uses ${active} (${rules.cost} SP left: ${caster.sorceryPoints})`);

  // Apply effect
  switch (active) {
    case "Distant":
      if (spell.range) {
        spell.range *= 2;
        console.log(`${spell.name} range doubled to ${spell.range}`);
      }
      break;
    case "Quickened":
      spell.castTime = "bonus";
      console.log(`${spell.name} now cast as bonus action`);
      break;
    case "Overcharged":
      if (!spell.extraDamage) spell.extraDamage = 1;
      else spell.extraDamage += 1;
      console.log(`${spell.name} gains 1 extra damage die`);
      break;
    // Twinned is more complex and can be implemented later
  }

  return spell;
}
