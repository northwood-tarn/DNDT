// app/data/classes/Warlock.js
export default {
  id: "warlock",
  name: "Warlock",
  summary: "Pact-bound caster who channels otherworldly patrons.",
  hitDie: 8,
  primaryAbility: ["Charisma"],
  savingThrows: ["Wisdom", "Charisma"],
  armor: ["Light armor"],
  weapons: ["Simple weapons"],
  tools: [],
  hp: {
    level1: { base: 8, addCon: true },
    perLevel: { base: 5, addCon: true }
  },
  spellcasting: {
    ability: "Charisma",
    preparation: "known",
    pactMagic: true
  },
  choices: [
    { id: "subclass", kind: "subclass", level: 3, required: true },
    { id: "pact", kind: "pact", level: 3, required: true }
  ],
  features: {
    4: [
      {
        name: "Spiral of Retribution",
        type: "Reaction",
        uses: "longRest:1",
        description: "After you have been hit 3+ times since your last turn, lash out with patron power as a reaction, dealing force damage that scales with proficiency and additional hits.",
        effects: {
          resources: [{ id: "spiral_of_retribution", name: "Spiral of Retribution", max: 1, recovery: "long_rest" }],
          reactions: [{
            id: "spiral_of_retribution",
            name: "Spiral of Retribution",
            trigger: "takes_damage_from_creature",
            resourceId: "spiral_of_retribution",
            minimumHitsTakenSinceLastTurn: 3,
            target: "damage_source",
            damage: "3d6",
            damageType: "force",
            reactionMode: "automatic",
            priority: 44
          }]
        }
      },
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
    8: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
    11: [{
      name: "Mystic Arcanum",
      type: "Special",
      uses: "longRest:1",
      description: "Choose one 6th-level spell as an Arcanum. Cast it once per long rest without expending a slot.",
      effects: {
        choiceRequirements: [{ id: "mystic_arcanum_spell", kind: "spell", count: 1 }],
        resources: [{ id: "mystic_arcanum", name: "Mystic Arcanum", max: 1, recovery: "long_rest" }]
      }
    }],
    12: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
    13: [
      {
        name: "Mystic Arcanum",
        type: "Special",
        uses: "longRest:1",
        description: "Choose one 7th-level spell as an Arcanum. Cast it once per long rest without expending a slot.",
        effects: {
          choiceRequirements: [{ id: "mystic_arcanum_spell", kind: "spell", count: 1 }],
          resources: [{ id: "mystic_arcanum_7", name: "Mystic Arcanum (7th)", max: 1, recovery: "long_rest" }]
        }
      }
    ]
  },
  pacts: {
    "Pact of the Blade": {
      id: "pact_of_the_blade",
      summary:
        "A cursed weapon binds to you at 3rd level; you fight through it and it feeds on what you slay.",
      features: {
        3: [
          {
            name: "Cursed Weapon",
            type: "Passive",
            description:
              "At 3rd level, choose an eligible weapon; it manifests and binds to you. It cannot be dismissed, replaced, or exchanged. You use your Charisma modifier for attack and damage rolls with it. It counts as magical for overcoming resistance.",
            effects: {
              modifiers: [
                { id: "pact_weapon_charisma_attacks", target: "pact_weapon_attack_ability", ability: "charisma" },
                { id: "pact_weapon_charisma_damage", target: "pact_weapon_damage_ability", ability: "charisma" },
                { id: "pact_weapon_magical", target: "pact_weapon_damage", property: "magical" }
              ]
            }
          }
        ],
        5: [
          {
            name: "Extra Attack (with pact weapon)",
            type: "Passive",
            description:
              "When you take the Attack action with your pact weapon, you can attack twice instead of once.",
            effects: {
              attackAction: [{ attacks: 2, scope: "pact_weapon" }],
              modifiers: [{ id: "pact_weapon_extra_attack", target: "pact_weapon_attack_count", value: 2 }]
            }
          }
        ],
        7: [
          {
            name: "Blade Channel",
            type: "Bonus Action",
            uses: "shortRest",
            description:
              "Once per short rest, empower your pact weapon for 1 minute; its attacks deal an extra 1d6 damage of your choice (radiant, necrotic, or fire).",
            effects: {
              resources: [{ id: "blade_channel", name: "Blade Channel", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "blade_channel",
                name: "Blade Channel",
                actionType: "bonus_action",
                resourceId: "blade_channel",
                requiresTarget: false,
                duration: { rounds: 10, tick: "turn_end" },
                damageTypeChoices: ["radiant", "necrotic", "fire"],
                pactWeaponDamageBonus: { dice: "1d6", damageTypeChoice: ["radiant", "necrotic", "fire"] }
              }]
            }
          }
        ],
        11: [
          {
            name: "Lifedrinker (Vampiric)",
            type: "Passive",
            description:
              "When you hit with your pact weapon, you deal extra necrotic damage equal to your Charisma modifier. Once per turn, this necrotic damage is converted into healing, restoring the same number of hit points to you (not above max HP).",
            effects: {
              triggeredEffects: [{
                id: "lifedrinker_vampiric",
                trigger: "pact_weapon_hit",
                damage: { dice: "charisma_modifier", type: "necrotic" },
                healingFormula: "necrotic_damage_dealt",
                limit: "once_per_turn"
              }]
            }
          }
        ],
        13: [
          {
            name: "Blade Mastery",
            type: "Passive",
            description:
              "Your pact weapon gains a permanent +1 bonus to attack and damage rolls.",
            effects: {
              modifiers: [
                { id: "blade_mastery_attack_bonus", target: "pact_weapon_attack_roll", value: 1 },
                { id: "blade_mastery_damage_bonus", target: "pact_weapon_damage_roll", value: 1 }
              ]
            }
          }
        ]
      }
    },

    "Pact of the Tome": {
      id: "pact_of_the_tome",
      summary:
        "A cursed grimoire opens further secrets—insight, recall, and a late-game transgressive spike.",
      features: {
        3: [
          {
            name: "Book of Shadows",
            type: "Passive",
            description:
              "Gain two additional cantrips of your choice from any class list; they are always prepared, use CHA as your casting and count as Warlock cantrips.",
            effects: {
              choiceRequirements: [{ id: "book_of_shadows_cantrips", kind: "spell", count: 2 }],
              modifiers: [{ id: "book_of_shadows_warlock_cantrips", target: "chosen_spells_count_as_warlock_spells", choiceId: "book_of_shadows_cantrips" }]
            }
          }
        ],
        7: [
          {
            name: "Ominous Insight",
            type: "Special",
            uses: "shortRest",
            description:
              "When you make an Arcana, Investigation, or Insight check, you may invoke the Book’s whispers to gain advantage on the roll.",
            effects: {
              resources: [{ id: "ominous_insight", name: "Ominous Insight", max: 1, recovery: "short_rest" }],
              modifiers: [{ id: "ominous_insight_advantage", target: "ability_check", skills: ["arcana", "investigation", "insight"], mode: "advantage", timing: "on_use" }]
            }
          }
        ],
        11: [
          {
            name: "Grimoire Recall",
            type: "Special",
            uses: "longRest",
            description:
              "Once per long rest, regain one expended Warlock spell slot (bonus action in combat, or 1 minute outside combat).",
            effects: {
              resources: [{ id: "grimoire_recall", name: "Grimoire Recall", max: 1, recovery: "long_rest" }],
              actionOptions: [{ id: "grimoire_recall", actionType: "bonus_action", resourceId: "grimoire_recall", restoresResource: "warlock_spell_slot", amount: 1 }]
            }
          }
        ],
        13: [
          {
            name: "Forbidden Transcription",
            type: "Special",
            uses: "longRest",
            description:
              "Once per long rest, when you cast a Warlock spell, you may immediately cast it again without expending a spell slot. The second casting must follow the spell’s normal targeting rules.",
            effects: {
              resources: [{ id: "forbidden_transcription", name: "Forbidden Transcription", max: 1, recovery: "long_rest" }],
              triggeredEffects: [{ id: "forbidden_transcription_repeat_spell", trigger: "warlock_spell_cast", repeatWithoutSlot: true }]
            }
          }
        ]
      }
    },

    "Pact of the Tessera": {
      id: "pact_of_the_tessera",
      summary:
        "A tally-token—the missing piece that shortcuts paths, brands debtors, and calls all debts due.",
      features: {
        3: [
          {
            name: "Missing Piece",
            type: "Passive",
            description:
              "You always count as having +1 map fragment toward uncovering hidden paths or exploration objectives.",
            effects: {
              modifiers: [{ id: "missing_piece_map_fragment", target: "exploration_map_fragments", value: 1 }]
            }
          }
        ],
        7: [
          {
            name: "Token of Passage",
            type: "Bonus Action",
            uses: "shortRest",
            description:
              "Once per short rest, teleport up to 30 ft to a space you can see, as per the Misty Step spell.",
            effects: {
              resources: [{ id: "token_of_passage", name: "Token of Passage", max: 1, recovery: "short_rest" }],
              actionOptions: [{ id: "token_of_passage", actionType: "bonus_action", resourceId: "token_of_passage", teleportFt: 30, requiresSight: true }]
            }
          }
        ],
        11: [
          {
            name: "Mark of Authority",
            type: "Passive",
            description:
              "The first creature you damage in each combat becomes branded. You have advantage on all attacks against the branded creature while the brand lasts. If you make an attack against a different creature (hit or miss), the brand immediately fades. Incidental area damage to other creatures does not end the brand.",
            effects: {
              triggeredEffects: [{
                id: "mark_of_authority_brand",
                trigger: "first_damage_in_combat",
                condition: "branded_by_authority",
                grantAdvantageAgainstTarget: true,
                endsOnAttackAgainstDifferentCreature: true
              }]
            }
          }
        ],
        13: [
          {
            name: "Cataclysmic Debt",
            type: "Special",
            uses: "longRest",
            description:
              "Once per long rest, brand all enemies you can see within 30 ft. Until one branded creature dies, every time you hit any branded creature, all branded creatures take damage equal to your Charisma modifier. When the first branded creature falls, all marks vanish.",
            effects: {
              resources: [{ id: "cataclysmic_debt", name: "Cataclysmic Debt", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "cataclysmic_debt",
                name: "Cataclysmic Debt",
                actionType: "action",
                resourceId: "cataclysmic_debt",
                rangeFt: 30,
                targeting: { mode: "nearby_actors" },
                targetFilter: { team: "enemies" },
                effects: [{
                  type: "condition",
                  trigger: "failed_save",
                  condition: "cataclysmic_debt",
                  duration: { rounds: 10, tick: "turn_end" }
                }],
                activeEffectOnResolve: {
                  id: "cataclysmic_debt_link",
                  label: "Cataclysmic Debt",
                  duration: { rounds: 10, tick: "turn_end" },
                  damageRider: {
                    trigger: "source_hits_with_attack_roll",
                    requiresConditionOnTarget: "cataclysmic_debt",
                    splashCondition: "cataclysmic_debt",
                    damage: "charisma_modifier",
                    damageType: "force"
                  }
                }
              }]
            }
          }
        ]
      }
    }
  },
  subclasses: {
    "The Fiend": {
      id: "the_fiend",
      summary: "Infernal pact warlock who turns hellfire into relentless offense.",
      features: {
        3: [
          { name: "Hellish Rebuke", type: "Reaction",
            description: "To avoid pop-up spam, this triggers automatically: the first time you are hit in a combat, the attacker takes 2d10 fire damage (DEX save for half). This consumes your reaction on that round.",
            effects: {
              resources: [{ id: "hellish_rebuke", name: "Hellish Rebuke", max: 1, recovery: "combat" }],
              reactions: [{
                id: "hellish_rebuke",
                name: "Hellish Rebuke",
                trigger: "takes_damage_from_creature",
                resourceId: "hellish_rebuke",
                target: "damage_source",
                damage: "2d10",
                damageType: "fire",
                save: { ability: "dexterity", dcFrom: "spellSaveDC", onSave: "half" },
                reactionMode: "automatic",
                priority: 42
              }]
            } }
        ],
        7: [
          { name: "Infernal Resilience", type: "Passive",
            description: "You gain resistance to fire damage.",
            effects: { resistances: ["fire"] } },
          { name: "Hellish Rebuke — Escalation", type: "Passive",
            description: "Starting at 7th level, Hellish Rebuke can trigger automatically the first two times you are hit in a combat (still consumes your reaction on that round).",
            effects: {
              resources: [{ id: "hellish_rebuke", name: "Hellish Rebuke", max: 2, recovery: "combat" }]
            } },
          { name: "Patron's Spear", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 fire damage. Using this ends any concentration you are maintaining.",
            effects: {
              resources: [{ id: "fiend_patrons_spear", name: "Patron's Spear", max: 1, recovery: "long_rest" }],
              damageRiders: [{
                id: "fiend_patrons_spear",
                name: "Patron's Spear",
                trigger: "source_hits_with_attack_roll",
                resourceId: "fiend_patrons_spear",
                damage: "5d10",
                damageType: "fire",
                endsConcentration: true
              }]
            } }
        ],
        11: [
          { name: "Hurl Through Hell", type: "Special", uses: "longRest",
            description: "When you hit a creature with an attack, you can banish it to hellish vistas until the end of your next turn (no save). When it returns, it takes 8d10 psychic damage and is frightened of you until the end of your next turn.",
            effects: {
              resources: [{ id: "hurl_through_hell", name: "Hurl Through Hell", max: 1, recovery: "long_rest" }],
              conditionRiders: [{
                id: "hurl_through_hell_banish",
                name: "Hurl Through Hell",
                trigger: "source_hits_with_attack_roll",
                resourceId: "hurl_through_hell",
                condition: "banished",
                duration: { kind: "until_timing", timing: "turn_end" },
                end: { damage: "8d10", damageType: "psychic", condition: "frightened" }
              }]
            } }
        ]
      }
    },
    "The Undead": {
      id: "the_undead",
      summary: "Deathless patron grants fear and necrotic resilience, making you a terror on the field.",
      features: {
        3: [
          { name: "Form of Dread", type: "Bonus Action", uses: "shortRest",
            description: "Transform for 1 minute: gain 1d10 + Warlock level temporary HP; immune to being frightened; the first time each turn you hit a creature with an attack or spell, it must succeed on a WIS save or be frightened of you until the end of your next turn.",
            effects: {
              resources: [{ id: "form_of_dread", name: "Form of Dread", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "form_of_dread",
                name: "Form of Dread",
                actionType: "bonus_action",
                resourceId: "form_of_dread",
                requiresTarget: false,
                temporaryHpFormula: "1d10+level",
                selfCondition: { id: "form_of_dread_active", duration: { rounds: 10, tick: "turn_end" } }
              }],
              conditionRiders: [{
                id: "form_of_dread_frighten",
                name: "Form of Dread",
                trigger: "source_hits_with_attack_roll",
                requiresSourceCondition: "form_of_dread_active",
                oncePerTurn: true,
                save: { ability: "wisdom", dcFrom: "spellSaveDC" },
                condition: "frightened",
                duration: { kind: "until_timing", timing: "turn_end" }
              }]
            } }
        ],
        7: [
          { name: "Grave Tether", type: "Passive",
            description: "Once per turn, the first time you deal necrotic damage on your turn, regain HP equal to your Charisma modifier. You also gain resistance to necrotic damage.",
            effects: {
              resistances: ["necrotic"],
              triggeredEffects: [{
                id: "grave_tether_heal",
                trigger: "first_necrotic_damage_on_turn",
                limit: "once_per_turn",
                healingFormula: "charisma_modifier"
              }]
            } },
          { name: "Patron's Spear", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 necrotic damage. Using this ends any concentration you are maintaining.",
            effects: {
              resources: [{ id: "undead_patrons_spear", name: "Patron's Spear", max: 1, recovery: "long_rest" }],
              damageRiders: [{
                id: "undead_patrons_spear",
                name: "Patron's Spear",
                trigger: "source_hits_with_attack_roll",
                resourceId: "undead_patrons_spear",
                damage: "5d10",
                damageType: "necrotic",
                endsConcentration: true
              }]
            } }
        ],
        11: [
          { name: "Aura of the Grave (Hybrid Aura)", type: "Passive",
            description: "Radius 10 ft. Self: resistance to nonmagical bludgeoning, piercing, and slashing damage. Enemies: any enemy that starts its turn in the aura must succeed on a WIS save or become frightened until the beginning of its next turn; if already frightened, it also takes 1d6 necrotic damage at the start of its turn.",
            effects: {
              auras: [{
                id: "aura_of_the_grave",
                name: "Aura of the Grave",
                radiusFt: 10,
                affects: "enemies",
                effects: [
                  {
                    id: "aura_of_the_grave_fear",
                    type: "condition",
                    trigger: "turn_start",
                    condition: "frightened",
                    save: { ability: "wis", dcFrom: "spellSaveDC", onSave: "negates" },
                    duration: { kind: "until_timing", timing: "turn_start" }
                  },
                  {
                    id: "aura_of_the_grave_necrotic",
                    type: "damage",
                    trigger: "turn_start",
                    requiresCondition: "frightened",
                    damage: "1d6",
                    damageType: "necrotic"
                  }
                ]
              }]
            } }
        ],
        13: [
          { name: "Deathless Form", type: "Action", uses: "longRest",
            description: "For 1 minute: gain resistance to all damage except radiant; gain a fly speed of 30 ft; once per turn when you hit with an attack or spell, deal an extra +2d8 necrotic damage.",
            effects: {
              resources: [{ id: "deathless_form", name: "Deathless Form", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "deathless_form",
                name: "Deathless Form",
                actionType: "action",
                resourceId: "deathless_form",
                requiresTarget: false,
                selfCondition: { id: "deathless_form_active", duration: { rounds: 10, tick: "turn_end" } },
                effects: [
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "damage_reduction", damageType: "all", multiplier: 0.5, duration: { kind: "rounds", rounds: 10, tick: "turn_end" } },
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "speed", amountFt: 30, mode: "fly", duration: { kind: "rounds", rounds: 10, tick: "turn_end" } }
                ]
              }],
              damageRiders: [{
                id: "deathless_form_necrotic",
                name: "Deathless Form",
                trigger: "source_hits_with_attack_roll",
                requiresSourceCondition: "deathless_form_active",
                oncePerTurn: true,
                damage: "2d8",
                damageType: "necrotic"
              }]
            } }
        ]
      }
    },
    "The Lantern": {
      id: "the_lantern",
      summary: "Pact with a dying star: shelter allies in failing light, expose hidden enemies, and risk an unstable final detonation.",
      features: {
        3: [
          {
            name: "Wicklight",
            type: "Passive",
            description: "When you damage a creature with a Warlock spell or cantrip, you may mark it with Wicklight until the start of your next turn. The next attack against that creature ignores Half Cover and Three-Quarters Cover, and the creature cannot benefit from being invisible against that attack.",
            effects: {
              triggeredEffects: [{
                id: "wicklight_mark",
                trigger: "warlock_spell_or_cantrip_damage",
                condition: "wicklit",
                duration: { until: "start_of_source_next_turn" },
                nextAttackAgainstTarget: {
                  ignoreCover: ["half", "three_quarters"],
                  ignoreInvisible: true,
                  consumeOnUse: true
                }
              }]
            }
          },
          {
            name: "Borrowed Flame",
            type: "Bonus Action",
            uses: "shortRest",
            description: "Once per short rest, gain temporary HP equal to 1d8 + your Charisma modifier and shed bright light for 1 minute. While those temporary HP last, the first enemy that hits you with a melee attack takes radiant damage equal to your Charisma modifier.",
            effects: {
              resources: [{ id: "borrowed_flame", name: "Borrowed Flame", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "borrowed_flame",
                name: "Borrowed Flame",
                actionType: "bonus_action",
                resourceId: "borrowed_flame",
                requiresTarget: false,
                temporaryHpFormula: "1d8 + charisma_modifier",
                duration: { value: 1, unit: "minute" },
                light: { brightRadiusFt: 20 },
                selfCondition: {
                  id: "borrowed_flame",
                  duration: { rounds: 10, tick: "turn_end" },
                  damageRetaliation: {
                    trigger: "hit_by_melee",
                    damage: "charisma_modifier",
                    damageType: "radiant",
                    requiresTempHp: true
                  }
                }
              }]
            }
          }
        ],
        7: [
          {
            name: "Light Through the Cracks",
            type: "Passive",
            description: "Creatures marked by Wicklight have disadvantage on saving throws against your effects that would reveal, restrain, blind, frighten, or banish them. Once per turn when you damage a Wicklit creature, one ally who can see it gains temporary HP equal to your Charisma modifier.",
            effects: {
              modifiers: [{
                id: "wicklight_control_save_disadvantage",
                target: "saving_throw",
                appliesToTargetsWithCondition: "wicklit",
                mode: "disadvantage",
                effectTags: ["reveal", "restrain", "blind", "frighten", "banish"]
              }],
              triggeredEffects: [{
                id: "wicklight_ally_temporary_hp",
                trigger: "damage_wicklit_creature",
                limit: "once_per_turn",
                chooseAllyWhoCanSeeTarget: true,
                temporaryHpFormula: "charisma_modifier"
              }]
            }
          }
        ],
        11: [
          {
            name: "The Door in the Floor",
            type: "Bonus Action",
            uses: "shortRest",
            description: "Once per short rest, choose a lit space you can see within 30 ft. You teleport to it, or pull a willing ally within 30 ft to it. The arrival space glows until the end of your next turn; enemies entering it or starting their turns there take radiant damage equal to your proficiency bonus.",
            effects: {
              resources: [{ id: "door_in_the_floor", name: "The Door in the Floor", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "door_in_the_floor",
                name: "The Door in the Floor",
                actionType: "bonus_action",
                resourceId: "door_in_the_floor",
                rangeFt: 30,
                teleportFt: 30,
                requiresSight: true,
                requiresLitDestination: true,
                modes: ["teleport_self", "pull_willing_ally"],
                createsCombatObject: {
                  id: "door_in_the_floor_afterglow",
                  shape: "square",
                  sizeSquares: 1,
                  duration: { until: "end_of_source_next_turn" },
                  light: { brightRadiusFt: 5 },
                  triggers: [
                    { event: "enter_area", team: "enemies", damage: { dice: "proficiency_bonus", type: "radiant" } },
                    { event: "start_turn_in_area", team: "enemies", damage: { dice: "proficiency_bonus", type: "radiant" } }
                  ]
                }
              }]
            }
          }
        ],
        13: [
          {
            name: "Last Light",
            type: "Action",
            uses: "longRest",
            description: "Once per long rest, create a 20-ft-radius lantern field centered on a point you can see within 60 ft. The field carries two charges, each starting at 4d8 and increasing by 1d8 at the start of each of your turns. Allies inside gain temporary HP equal to your Charisma modifier at the start of their turns and shed the blinded and frightened conditions. Enemies inside cannot benefit from invisibility or being hidden. On a later turn before the charge reaches 8d8, you may collapse the field as a bonus action; enemies inside make a Constitution save against your spell save DC, taking radiant damage equal to the manual charge on a failed save, or half on a success. If you do not collapse it first, the overload charge explodes as soon as it reaches 8d8.",
            effects: {
              resources: [{ id: "last_light", name: "Last Light", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "last_light",
                name: "Last Light",
                actionType: "action",
                resourceId: "last_light",
                rangeFt: 60,
                createsCombatObject: {
                  id: "last_light_field",
                  name: "Last Light",
                  shape: "radius",
                  radiusFt: 20,
                  timers: {
                    manual: { startDice: 4, die: "d8", increaseAtStartOfOwnerTurn: 1, expiresAtDice: 8 },
                    overload: { startDice: 4, die: "d8", increaseAtStartOfOwnerTurn: 1, explodesAtDice: 8 }
                  },
                  effects: [
                    { type: "temp_hp", trigger: "turn_start", affects: "allies", amountFormula: "charisma_modifier" },
                    { type: "remove_conditions", trigger: "turn_start", affects: "allies", conditions: ["blinded", "frightened"] },
                    { type: "remove_conditions", trigger: "turn_start", affects: "enemies", conditions: ["hidden", "invisible"] }
                  ],
                  collapse: {
                    manual: {
                      actionType: "bonus_action",
                      target: "enemies_in_area",
                      save: { ability: "constitution", dcFrom: "spellSaveDC", onSave: "half" },
                      damage: { diceFromTimer: "manual", type: "radiant" }
                    },
                    automatic: {
                      timer: "overload",
                      target: "creatures_in_area",
                      save: { ability: "constitution", dcFrom: "spellSaveDC", onSave: "half" },
                      damage: { diceFromTimer: "overload", type: "radiant" },
                      removeObject: true
                    }
                  }
                }
              }]
            }
          }
        ]
      }
    }
  }
};
