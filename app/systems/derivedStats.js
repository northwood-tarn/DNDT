// app/systems/derivedStats.js
// Computes ability modifiers, proficiency bonus, AC, initiative, etc.

export function getAbilityMod(score){
  const s = typeof score === "number" ? score : 10;
  // Floor((score - 10)/2) with negative support
  return Math.floor((s - 10) / 2);
}

export function getProficiencyBonus(level){
  const L = Math.max(1, level|0);
  if (L >= 17) return 6;
  if (L >= 13) return 5;
  if (L >= 9)  return 4;
  if (L >= 5)  return 3;
  return 2;
}

// Armor Class: basic prototype that prefers explicit armor/shield on the profile.
export function computeAC(player){
  const armor = player?.equipment?.armor || null;
  const shield = player?.equipment?.shield || null;
  const dex = player?.abilities?.dex ?? 10;
  const dexMod = getAbilityMod(dex);

  // If explicit armor AC given, respect dex cap
  if (armor && typeof armor.ac === "number"){
    const cap = typeof armor.dexCap === "number" ? armor.dexCap : null;
    const dexToApply = cap === null ? dexMod : Math.min(dexMod, cap);
    const base = armor.ac + (dexToApply||0);
    const total = base + (shield?.bonus || 0);
    return { total, base, armor, shield, dexModApplied: dexToApply };
  }

  // Otherwise, unarmored: 10 + Dex + shield
  const base = 10 + dexMod;
  const total = base + (shield?.bonus || 0);
  return { total, base, armor: null, shield, dexModApplied: dexMod };
}

export function computeInitiativeMod(player){
  const dex = player?.abilities?.dex ?? 10;
  const dexMod = getAbilityMod(dex);
  const bonus = player?.combat?.initiativeBonus || 0;
  return dexMod + bonus;
}
