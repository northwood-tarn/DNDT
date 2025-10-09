// app/data/pacts.js
// Second-order progression tracks independent of patron (subclass) choice.
// Place this file in app/data/ and import `pacts` for Warlock pact selection.

export const pacts = {
  Warlock: {
    "Pact of the Blade": {
      summary: "A cursed weapon binds to you at 3rd level; you fight through it and it feeds on what you slay.",
      features: {
        3: [
          { name: "Cursed Weapon", type: "Passive",
            description: "At 3rd level, choose an eligible weapon; it manifests and binds to you. It cannot be dismissed, replaced, or exchanged. You use your Charisma modifier for attack and damage rolls with it. It counts as magical for overcoming resistance." }
        ],
        5: [
          { name: "Extra Attack (with pact weapon)", type: "Passive",
            description: "When you take the Attack action with your pact weapon, you can attack twice instead of once." }
        ],
        7: [
          { name: "Blade Channel", type: "Bonus Action", uses: "shortRest",
            description: "Once per short rest, empower your pact weapon for 1 minute; its attacks deal an extra 1d6 damage of your choice (radiant, necrotic, or fire)." }
        ],
        11: [
          { name: "Lifedrinker (Vampiric)", type: "Passive",
            description: "When you hit with your pact weapon, you deal extra necrotic damage equal to your Charisma modifier. Once per turn, this necrotic damage is converted into healing, restoring the same number of hit points to you (not above max HP)." }
        ],
        13: [
          { name: "Blade Mastery", type: "Passive",
            description: "Your pact weapon gains a permanent +1 bonus to attack and damage rolls." }
        ]
      }
    },

    "Pact of the Tome": {
      summary: "A cursed grimoire opens further secrets—insight, recall, and a late-game transgressive spike.",
      features: {
        3: [
          { name: "Book of Shadows", type: "Passive",
            description: "Gain two additional cantrips of your choice from any class list; they are always prepared and count as Warlock cantrips." }
        ],
        7: [
          { name: "Ominous Insight", type: "Special", uses: "shortRest",
            description: "When you make an Arcana, Investigation, or Insight check, you may invoke the Book’s whispers to gain advantage on the roll." }
        ],
        11: [
          { name: "Grimoire Recall", type: "Special", uses: "longRest",
            description: "Once per long rest, regain one expended Warlock spell slot (bonus action in combat, or 1 minute outside combat)." }
        ],
        13: [
          { name: "Forbidden Transcription", type: "Special", uses: "longRest",
            description: "Once per long rest, when you cast a Warlock spell, you may immediately cast it again without expending a spell slot. The second casting must follow the spell’s normal targeting rules." }
        ]
      }
    },

    "Pact of the Tessera": {
      summary: "A tally-token—the missing piece that shortcuts paths, brands debtors, and calls all debts due.",
      features: {
        3: [
          { name: "Missing Piece", type: "Passive",
            description: "You always count as having +1 map fragment toward uncovering hidden paths or exploration objectives." }
        ],
        7: [
          { name: "Token of Passage", type: "Bonus Action", uses: "shortRest",
            description: "Once per short rest, teleport up to 30 ft to a space you can see, as per the Misty Step spell. Usable in combat and exploration." }
        ],
        11: [
          { name: "Mark of Authority", type: "Passive",
            description: "The first creature you damage in each combat becomes branded. You have advantage on all attacks against the branded creature while the brand lasts. If you make an attack against a different creature (hit or miss), the brand immediately fades. Incidental area damage to other creatures does not end the brand." }
        ],
        13: [
          { name: "Cataclysmic Debt", type: "Special", uses: "longRest",
            description: "Once per long rest, brand all enemies you can see within 30 ft. Until one branded creature dies, every time you hit any branded creature, all branded creatures take damage equal to your Charisma modifier. When the first branded creature falls, all marks vanish." }
        ]
      }
    }
  }
};

export default pacts;
