export const conditions = [
  { name: 'Blinded', effects: ['Attack rolls against the creature have advantage', 'The creature’s attack rolls have disadvantage', 'The creature automatically fails ability checks that require sight'], icon: '👁️\u200d🗨️' },
  { name: 'Charmed', effects: ["The creature can't attack the charmer or target the charmer with harmful abilities or magical effects", 'The charmer has advantage on ability checks to interact socially with the creature'], icon: '💘' },
  { name: 'Deafened', effects: ["The creature can't hear", 'Automatically fails checks that require hearing'], icon: '🔇' },
  { name: 'Frightened', effects: ['Disadvantage on ability checks and attack rolls while the source of fear is in line of sight', 'The creature can’t willingly move closer to the source of its fear'], icon: '😱' },
  { name: 'Grappled', effects: ['Speed becomes 0 and can’t benefit from any bonus to speed', 'Condition ends if the grappler is incapacitated or moved away'], icon: '🤼' },
  { name: 'Incapacitated', effects: ['The creature can’t take actions or reactions'], icon: '😵' },
  { name: 'Invisible', effects: ['The creature is heavily obscured', 'The creature’s location can’t be detected by sight', 'Attack rolls against the creature have disadvantage; its attacks have advantage'], icon: '👻' },
  { name: 'Paralyzed', effects: ['Incapacitated and can’t move or speak', 'Fails Strength and Dexterity saves', 'Attack rolls have advantage; melee attacks from within 5 ft are critical hits'], icon: '🧊' },
  { name: 'Petrified', effects: ['Transformed into stone: incapacitated, immune to poison/disease, resistant to damage', 'Can’t move, speak, or perceive'], icon: '🪨' },
  { name: 'Poisoned', effects: ['Disadvantage on attack rolls and ability checks'], icon: '☠️' },
  { name: 'Prone', effects: ['The creature’s only movement option is to crawl', 'Disadvantage on attack rolls', 'Attack rolls against the creature have advantage if attacker is within 5 feet'], icon: '🤸' },
  { name: 'Restrained', effects: ['Speed becomes 0', 'Disadvantage on attack rolls and Dexterity saves', 'Attack rolls against the creature have advantage'], icon: '🪢' },
  { name: 'Stunned', effects: ['Incapacitated, can’t move, and can speak only falteringly', 'Fails Strength and Dexterity saves', 'Attack rolls against the creature have advantage'], icon: '💫' },
  { name: 'Unconscious', effects: ['Incapacitated, can’t move or speak, unaware of surroundings', 'Drops prone, drops held items', 'Fails Strength and Dexterity saves', 'Attack rolls have advantage; melee attacks from within 5 ft are critical hits'], icon: '🛌' }
];

export function hasCondition(actor, name) {
  return actor.conditions?.includes(name);
}
