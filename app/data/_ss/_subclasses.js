// app/data/Subclasses.js
export const subclasses = {
  Fighter: {
    "Champion": {
      summary: "Steadfast paragon who turns steady blows into heroic finishes.",
      features: {
        3: [
          { name: "Press the Attack", type: "Special", uses: "shortRest",
            description: "Once per short rest, if your attack leaves a creature at or below 10% of its max HP, the creature is slain." }
        ],
        7: [
          { name: "Second Wind Upgrade", type: "Passive",
            description: "When you use Second Wind, you also gain advantage on your next attack before the end of your turn." }
        ],
        11: [
          { name: "Unyielding Stance", type: "Special",
            description: "Once per combat, when you would be reduced to 0 HP, you stay at 1 HP instead." }
        ]
      }
    },
    "Duelist": {
      summary: "Swift, precise fencer who punishes openings and avoids harm.",
      features: {
        3: [
          { name: "Flourish", type: "Passive",
            description: "Once per turn when you hit with a melee attack, you gain +2 AC until the start of your next turn." }
        ],
        7: [
          { name: "Evasive Step", type: "Passive",
            description: "When an adjacent enemy misses you with a melee attack, you may move 5 ft without provoking." }
        ],
        11: [
          { name: "Deadly Precision", type: "Passive",
            description: "Your critical hits with finesse weapons roll one additional damage die." }
        ]
      }
    },
    "Berserker": {
      summary: "Primal fury in human form: devastates foes in surging rages.",
      features: {
        3: [
          { name: "Rage", type: "Bonus Action", uses: "longRest:3",
            description: "Enter a 1-minute rage: advantage on STR checks/saves, +2 melee damage with STR, resistance to bludgeoning/piercing/slashing. Ends early if you don’t attack or take damage on your turn." },
          { name: "Reckless Attack", type: "Special",
            description: "On your turn, you can gain advantage on STR melee attacks; attacks against you have advantage until your next turn." },
          { name: "Ferocious Swing", type: "Special",
            description: "While raging, once per turn you may make a sweeping strike, making one attack roll that targets all adjacent enemies." }
        ],
        7: [
          { name: "Primal Roar", type: "Bonus Action", uses: "shortRest",
            description: "While raging, unleash a roar. Creatures of your choice within 10 ft must succeed on a WIS save or be frightened until the end of your next turn." }
        ],
        11: [
          { name: "Savage Momentum", type: "Special",
            description: "Once per rage, when you reduce a creature to 0 HP, immediately make one bonus-action melee attack against another target." }
        ]
      }
    }
  },

  Rogue: {
    "Assassin": {
      summary: "Cold-blooded precision killer who excels at the opening strike. Save DC = 8 + proficiency bonus + Dexterity modifier.",
      features: {
        3: [
          { name: "Assassinate", type: "Passive",
            description: "You have advantage on attack rolls against creatures that have not acted yet. Your hits against surprised creatures are critical hits." }
        ],
        7: [
          { name: "Lethal Ambush", type: "Passive",
            description: "On the first round of combat, your first weapon hit deals +2d6 Sneak Attack damage." }
        ],
        11: [
          { name: "Assassinate Upgrade", type: "Passive",
            description: "When you hit a surprised creature, you deal double Sneak Attack dice (in addition to the critical hit)." }
        ],
        13: [
          { name: "Umbral Guise", type: "Special", uses: "shortRest",
            description: "Once per short rest, when you Hide, you become invisible until the end of your next turn." }
        ]
      }
    },
    "Cutthroat": {
      summary: "Dirty-fighting enforcer who terrifies and overwhelms foes. Save DC = 8 + proficiency bonus + Charisma modifier.",
      features: {
        1: [
          { name: "Cunning Words", type: "Bonus Action",
            description: "Target a creature within 30 ft. It must succeed on a WIS save against your subclass save DC or take psychic damage equal to your Charisma modifier and have disadvantage on its next attack before the end of its turn." }
        ],
        3: [
          { name: "Dark Presence", type: "Passive",
            description: "Your subclass save DC uses Charisma. Gain Expertise in one: Deception, Intimidation, or Persuasion." }
        ],
        7: [
          { name: "Secrets Exposed", type: "Bonus Action", uses: "longRest",
            description: "As a bonus action, size up a foe. Make a contested check (your Charisma vs target’s Wisdom [Insight]) or the target makes a WIS save against your subclass save DC (your choice when you use this). On a success, for 1 minute, allies have advantage on the first attack they make each turn against that creature." }
        ],
        11: [
          { name: "Exploit Weakness", type: "Special", uses: "longRest",
            description: "Choose a creature you can see; until the end of the combat, your Sneak Attacks against it deal extra psychic damage equal to your Charisma modifier, and it cannot benefit from advantage." }
        ]
      }
    }
        ],
        7: [
          { name: "Bloody Momentum", type: "Bonus Action",
            description: "When you score a critical hit or reduce a creature to 0 HP, you may make one weapon attack as a bonus action." }
        ],
        11: [
          { name: "Fearsome Reputation", type: "Special",
            description: "When you drop an enemy to 0 HP, creatures of your choice within 10 ft must make a WIS save or be frightened until the end of your next turn." }
        ],
        13: [
          { name: "Finishing Move", type: "Passive",
            description: "When you hit a creature at or below 25% of its max HP, add +4d6 damage." }
        ]
      }
    },
    "Saboteur": {
      summary: "Gadgeteer rogue who prepares devices and turns battlefields chaotic. Save DC = 8 + proficiency bonus + Intelligence modifier.",
      features: {
        1: [
          { name: "Quick Rigging I", type: "Bonus Action",
            description: "Once per combat, assemble and use a device as a bonus action from your known recipes. You begin play knowing one origin device of your choice." }
        ],
        3: [
          { name: "Bombmaker", type: "Special",
            description: "You gain a Cookbook with 2 recipes. After a long rest, choose 3 devices to prepare; they are created and ready to use." }
        ],
        7: [
          { name: "Quick Rigging II", type: "Bonus Action",
            description: "Once per combat, you may assemble and use up to two devices this combat (one per use) as a bonus action." }
        ],
        11: [
          { name: "Master of Mixtures", type: "Passive",
            description: "Add 2 more recipes to your Cookbook. After a long rest, prepare 5 devices. Your devices deal +1d6 extra damage of their type." }
        ],
        13: [
          { name: "Catastrophic Charge", type: "Special", uses: "longRest",
            description: "Once per long rest, throw an empowered device: 20-ft radius, double damage dice." }
        ]
      },
      cookbookExamples: [
        { name: "Fire Granado", use: "Action", text: "Thrown 20 ft; 5-ft radius explosion, 2d6 fire (DEX save half)." },
        { name: "Acid Flask", use: "Action", text: "Thrown 20 ft; on hit 2d6 acid, target’s AC −1 until end of next turn." },
        { name: "Lightning Paper", use: "Bonus Action", text: "Apply to weapon; for 2 rounds, attacks deal +1d6 lightning." }
      ]
    }
        ],
        7: [
          { name: "Expanded Recipes", type: "Passive",
            description: "Add 2 recipes to your Cookbook. After a long rest, prepare 4 devices." },
          { name: "Quick Rigging", type: "Bonus Action",
            description: "Once per combat, assemble and throw one of your prepared devices as a bonus action." }
        ],
        11: [
          { name: "Master of Mixtures", type: "Passive",
            description: "Add 2 more recipes to your Cookbook. After a long rest, prepare 5 devices. Your devices deal +1d6 extra damage of their type." }
        ],
        13: [
          { name: "Catastrophic Charge", type: "Special", uses: "longRest",
            description: "Once per long rest, throw an empowered device: 20-ft radius, double damage dice." }
        ],
        14: [
          { name: "Expanded Recipes (final)", type: "Passive",
            description: "Add 2 more recipes to your Cookbook. After a long rest, prepare 6 devices." }
        ]
      },
      cookbookExamples: [
        { name: "Fire Granado", use: "Action", text: "Thrown 20 ft; 5-ft radius explosion, 2d6 fire (DEX save half)." },
        { name: "Acid Flask", use: "Action", text: "Thrown 20 ft; on hit 2d6 acid, target’s AC −1 until end of next turn." },
        { name: "Lightning Paper", use: "Bonus Action", text: "Apply to weapon; for 2 rounds, attacks deal +1d6 lightning." }
      ]
    }
  },

  Wizard: {
"Dirt Wizard": {
  summary: "Indomitable marginal scholar who clings to truth and logic beyond the reach of society.",
  features: {
    3: [
      { name: "Relentless", type: "Passive",
        description: "Once per combat, the first time a spell you cast fails to affect any creature (attack miss or all targets succeed their save), you immediately regain the expended slot (up to 3rd level) and gain temporary HP equal to your INT modifier. In exploration, treat any roll of 9 or lower on Arcana or Investigation as a 10." }
    ],
    7: [
      { name: "Grit of the Marginal", type: "Passive",
        description: "When you start your turn below half HP, gain temporary HP equal to twice your INT modifier." }
    ],
    11: [
      { name: "Truth in Shards", type: "Passive",
        description: "The first time each turn you deal damage with a spell, add +1d8 force damage. Your damaging spells ignore resistance to force damage." }
    ],
    13: [
      { name: "Indomitability", type: "Special", uses: "longRest",
        description: "Once per long rest, when you would be reduced to 0 HP, instead drop to 1 HP and immediately regain one expended spell slot of 5th level or lower." }
    ]
  }
},
   "Necromancer": {
  summary: "High Chair of the Pale — the sanctioned, elite master of death, wielding seals and edicts with bureaucratic authority.",
  features: {
    3: [
      { name: "Seal of Mortality", type: "Passive",
        description: "Once per combat, the first time your spell deals necrotic damage, the target becomes sealed until the end of your next turn: your spells deal +1d6 necrotic to it and it cannot regain HP. In exploration, you gain proficiency in Medicine; if already proficient, you double your proficiency bonus." }
    ],
    7: [
      { name: "Black Aegis", type: "Passive",
        description: "You have resistance to necrotic damage. The first time on your turn that any creature takes necrotic damage from your spell, you regain HP equal to your INT modifier (min 1). This healing occurs once per turn, no matter how many creatures are affected. In addition, the first undead you target on your turn has disadvantage on the first saving throw it makes against your spell that turn." }
    ],
    11: [
      { name: "Mortmain (The Dead Hand)", type: "Passive",
        description: "Once per turn, when you deal necrotic damage to a creature, that creature is under Mortmain until the end of your next turn: it cannot take reactions, its speed is halved, and it cannot regain HP." }
    ],
    13: [
      { name: "Final Edict", type: "Action", uses: "longRest",
        description: "As an action once per long rest, choose a point you can see within 60 ft. All creatures in a 20-ft-radius sphere centered there must make a CON save. On a fail: they take 8d6 necrotic damage, cannot regain HP for 1 minute, and are frightened of you until the end of your next turn. On a success: they take half damage and cannot regain HP until the end of your next turn. This ability is a magical effect and does not consume a spell slot." }
    ]
  },

"Battlemage": {
  summary: "Court-trained warcaster who unites steel and spell; a duelist whose blade is an arcane instrument.",
  features: {
    3: [
      { name: "Arcane Armament", type: "Passive",
        description: "Choose one melee weapon you are proficient with as your arcane armament; it remains your armament until you choose to change it after a long rest. You use INT for attack and damage rolls with your arcane armament, instead of STR or DEX. Whenever you cast a leveled spell, the next time you hit with your arcane armament before the end of your next turn it deals extra force damage equal to your proficiency bonus."     5: [
      { name: "Bonded Accuracy +1", type: "Passive",
        description: "Starting at 5th level, you gain a +1 bonus to attack rolls made with your Bonded Armament." }
    ],
    10: [
      { name: "Bonded Accuracy +2", type: "Passive",
        description: "Starting at 10th level, your bonus to attack rolls made with your Bonded Armament increases to +2." }
    ],
}
    ],
    7: [
      { name: "Spell Rhythm", type: "Bonus Action", uses: "shortRest",
        description: "As a bonus action, once per short rest, you may enter a spell rhythm for one minute. In this state, a melee attack action is doubled by the casting of a cantrip or the casting of a cantrip is doubled by a free melee attack." }
    ],
    11: [
      { name: "Martial Sigils", type: "Passive",
        description: "While wielding your arcane armament, you gain +1 AC. Once per turn when you hit with a melee attack, you can choose to mark the target with a sigil, forcing it to make its next attack roll at disadvantage before the end of its next turn." }
    ],
    13: [
      { name: "Crescendo Duel", type: "Bonus Action", uses: "longRest",
        description: "As a bonus action, once per long rest, you may enter a crescendo for one minute. While it lasts, when you hit with your arcane armament, add +2d8 force damage. In addition, once on each of your turns when you cast a spell, you may also make one melee attack with your arcane armament as a bonus action." }
    ]
  }
}

  }
  ,

  Warlock: {
   "The Fiend": {
  summary: "Infernal pact warlock who turns hellfire into relentless offense.",
  features: {
    3: [
      { name: "Hellish Rebuke", type: "Reaction",
        description: "To avoid pop-up spam, this triggers automatically: the first time you are hit in a combat, the attacker takes 2d10 fire damage (DEX save for half). This consumes your reaction on that round." }
    ],
    7: [
      { name: "Infernal Resilience", type: "Passive",
        description: "You gain resistance to fire damage." },
      { name: "Hellish Rebuke — Escalation", type: "Passive",
        description: "Starting at 7th level, Hellish Rebuke can trigger automatically the first two times you are hit in a combat (still consumes your reaction on that round)." },
      { name: "Patron's Spear", type: "Special", uses: "longRest",
        description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 fire damage. Using this ends any concentration you are maintaining." }
    ],
    11: [
      { name: "Hurl Through Hell", type: "Special", uses: "longRest",
        description: "When you hit a creature with an attack, you can banish it to hellish vistas until the end of your next turn (no save). When it returns, it takes 8d10 psychic damage and is frightened of you until the end of your next turn." }
    ]
  }
}
    "The Undead": {
      summary: "Deathless patron grants fear and necrotic resilience, making you a terror on the field.",
      features: {
        3: [
          { name: "Form of Dread", type: "Bonus Action", uses: "shortRest",
            description: "Transform for 1 minute: gain 1d10 + Warlock level temporary HP; immune to being frightened; the first time each turn you hit a creature with an attack or spell, it must succeed on a WIS save or be frightened of you until the end of your next turn." }
        ],
        7: [
          { name: "Grave Tether", type: "Passive",
            description: "Once per turn, the first time you deal necrotic damage on your turn, regain HP equal to your Charisma modifier. You also gain resistance to necrotic damage." },
          { name: "Patron's Spear", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 necrotic damage. Using this ends any concentration you are maintaining." }
        ],
        11: [
          { name: "Aura of the Grave (Hybrid Aura)", type: "Passive",
            description: "Radius 10 ft. Self: resistance to nonmagical bludgeoning, piercing, and slashing damage. Enemies: any enemy that starts its turn in the aura must succeed on a WIS save or become frightened until the beginning of its next turn; if already frightened, it also takes 1d6 necrotic damage at the start of its turn." }
        ],
        13: [
          { name: "Deathless Form", type: "Action", uses: "longRest",
            description: "For 1 minute: gain resistance to all damage except radiant; gain a fly speed of 30 ft; once per turn when you hit with an attack or spell, deal an extra +2d8 necrotic damage." }
        ]
      }
    },

    "The Lantern": {
      summary: "Pact with a dying star—wield fading radiance, sustain yourself with light, and end battles in a blazing nova.",
      features: {
        3: [
          { name: "Starfire Boon", type: "Passive",
            description: "The first time each turn you deal damage with a Warlock spell or cantrip, add radiant damage equal to your Charisma modifier." },
          { name: "Channel Radiance", type: "Bonus Action", uses: "shortRest",
            description: "Once per short rest, blaze for one round: your next attack or spell deals +2d8 radiant damage and you shed bright light in a 20‑ft radius." }
        ],
        7: [
          { name: "Radiant Aegis", type: "Passive",
            description: "You gain resistance to necrotic damage. When you take necrotic damage, the attacker takes radiant damage equal to your Charisma modifier." },
          { name: "Patron's Spear", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 radiant damage. Using this ends any concentration you are maintaining." }
        ],
        11: [
          { name: "Aura of the Last Light", type: "Bonus Action",
            description: "Once per combat, ignite your aura (10‑ft radius) for the rest of the combat. Self: at the start of your turn, gain 5 temporary HP. Enemies: have disadvantage on saving throws against your radiant damage." }
          ]
        ,
        13: [
          { name: "Nova of Ash", type: "Action", uses: "longRest",
            description: "Unleash a dying star’s flare: creatures of your choice within 20 ft make CON saves; on a failure take 8d8 radiant + 8d8 fire damage (half on success). After this effect, if your Aura of the Last Light is active, it ends immediately and cannot be reignited this combat." }
        ]
      }
    }
  },

Cleric: {
    "Grave Domain": {
      summary: "Guardian against profane undeath; punishes necromancy and guides souls.",
      features: {
        3: [
          { name: "Grave’s Rebuke (Channel Divinity)", type: "Action", uses: "channelDivinity",
            description: "Force one creature within 30 ft that dealt necrotic damage since your last turn to make a CON save; on failure it takes 4d8 radiant damage and its next necrotic damage is halved; on success it takes half damage and no halving rider." }
        ],
        7: [
          { name: "Sentinel at Death’s Door", type: "Reaction", uses: "shortRest",
            description: "When you or an enemy within 30 ft would be critically hit, you cancel the critical (it becomes a normal hit)." }
        ],
        11: [
          { name: "Keeper of Souls", type: "Passive",
            description: "When a creature you can see dies, you or an ally of your choice within 30 ft regains HP equal to your Wisdom modifier (once per round)." }
        ],
        13: [
          { name: "Reaper’s Shroud", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, your radiant and necrotic spells deal +1d8 damage, and you gain resistance to necrotic." }
        ]
      }
    },

    "Lantern Keeper Domain": {
      summary: "Bearer of sacred light; turns darkness into a weapon and shield.",
      features: {
        3: [
          { name: "Radiance of the Dawn (Channel Divinity)", type: "Action", uses: "channelDivinity",
            description: "Dispel magical darkness within 30 ft and deal 2d10 + level radiant damage (CON save half) to hostile creatures within 30 ft." }
        ],
        7: [
          { name: "Lantern’s Pulse", type: "Bonus Action", uses: "shortRest",
            description: "Emit a 10‑ft pulse of light; enemies in the area must make a CON save or be blinded until the start of your next turn." }
        ],
        11: [
          { name: "Judging Flame", type: "Passive",
            description: "The first time each turn your spell deals radiant damage, add your Wisdom modifier to that damage." }
        ],
        13: [
          { name: "Halo of Daybreak", type: "Action", uses: "longRest",
            description: "Create a 15‑ft radius aura of bright light for 1 minute; you and allies inside have advantage on saves vs. fear and charm; enemies that start in the aura take radiant damage equal to your Wisdom modifier." }
        ]
      }
    },

    "War Domain": {
      summary: "Battle-minded priest who channels divine force through martial prowess.",
      features: {
        3: [
          { name: "Warpriest (Channel Divinity)", type: "Bonus Action", uses: "channelDivinity",
            description: "Spend a Channel Divinity use to make one weapon attack as a bonus action this turn." }
        ],
        7: [
          { name: "Guided Strike", type: "Reaction", uses: "shortRest",
            description: "When you miss with an attack, add +5 to the roll after seeing the result." }
        ],
        11: [
          { name: "Divine Strike", type: "Passive",
            description: "Once per turn when you hit with a weapon attack, deal an extra 1d8 radiant or force damage." }
        ],
        13: [
          { name: "Avatar of War", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, you have resistance to nonmagical weapon damage and your Divine Strike bonus becomes 2d8." }
        ]
      }
    }
  },

  Paladin: {
    "Oath of Vengeance": {
      summary: "Relentless hunter who brings retribution to the guilty.",
      features: {
        3: [
          { name: "Vow of Enmity", type: "Bonus Action", uses: "shortRest",
            description: "Choose a creature within 10 ft; for 1 minute, you have advantage on attack rolls against it." }
        ],
        7: [
          { name: "Chains of Vengeance", type: "Reaction", uses: "shortRest",
            description: "When your Vow target moves or attacks, you may force a STR save; on failure, it is restrained until the start of its next turn." }
        ],
        11: [
          { name: "Relentless Pursuit", type: "Passive",
            description: "Your movement increases by 10 ft and opportunity attacks against you are at disadvantage while moving toward your Vow target." }
        ],
        13: [
          { name: "Executioner’s Verdict", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit your Vow target, deal an extra 6d8 radiant damage." }
        ]
      }
    },

    "Oath of the Sacred": {
      summary: "Fusion of Devotion and Ancients—holy light tempered with verdant mercy.",
      features: {
        3: [
          { name: "Radiant Smite", type: "Passive",
            description: "The first time you hit with a melee attack each round, deal an extra 1d6 radiant damage." }
        ],
        7: [
          { name: "Sanctified Presence", type: "Passive",
            description: "You and hostile creatures within 10 ft have disadvantage on charm and fear effects you impose; hostile spell save DCs against your spells are at disadvantage." }
        ],
        11: [
          { name: "Nature’s Aegis", type: "Passive",
            description: "You gain resistance to necrotic and poison damage." }
        ],
        13: [
          { name: "Aura of Renewal", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, the first time each turn you hit a creature, you or an ally within 10 ft regains HP equal to your Charisma modifier." }
        ]
      }
    },

    "Oath of Glory": {
      summary: "Heroic exemplar whose prowess inspires daring feats.",
      features: {
        3: [
          { name: "Athletic Prowess", type: "Passive",
            description: "You have advantage on Athletics and Acrobatics checks; when you Dash, you can jump as part of the move." }
        ],
        7: [
          { name: "Aura of Alacrity", type: "Passive",
            description: "Your speed increases by 10 ft; enemies within 10 ft treat difficult terrain of your choice as normal for you." }
        ],
        11: [
          { name: "Glorious Challenge", type: "Bonus Action", uses: "shortRest",
            description: "Choose a creature within 30 ft; it has disadvantage on attacks against others while it can see you until the end of its next turn." }
        ],
        13: [
          { name: "Legend’s Surge", type: "Special", uses: "longRest",
            description: "Once per long rest, immediately take an additional action on your turn." }
        ]
      }
    }
  }
  }
}