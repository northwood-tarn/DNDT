export function addUniqueAll(target, values = []) {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
}

export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}
