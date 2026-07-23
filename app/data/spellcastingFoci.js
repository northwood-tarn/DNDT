// Canonical hand-held spellcasting foci.
// These occupy weapon-set hand slots but are not weapon attacks.

const focusRecords = [
  focus("clerics_holy_symbol", "Cleric's Holy Symbol", "A one-handed holy symbol used to cast Cleric spells.", {
    mechanics: { kind: "spellcasting_focus", spellcastingClass: "cleric" },
  }),
  focus("sacral_holy_symbol", "Sacral Holy Symbol", "You gain +1 to spell attack rolls and Spell Save DC. When you cast a spell, you regain HP equal to that spell's level.", {
    modifiers: { spellAttackBonus: 1, spellSaveDCBonus: 1 },
    mechanics: {
      kind: "enhanced_spellcasting_focus",
      spellcastingClass: "cleric",
      spellAttackBonus: 1,
      spellSaveDCBonus: 1,
      onSpellCast: { kind: "heal_wearer", amountFrom: "spell_level" },
    },
  }),
  focus("steadfast_holy_symbol", "Steadfast Holy Symbol", "You have advantage on Constitution saving throws made to maintain Concentration.", {
    modifiers: { saveAdvantages: [{ condition: "maintain_concentration", ability: "constitution" }] },
    mechanics: {
      kind: "saving_throw_advantage",
      ability: "constitution",
      when: "maintain_concentration",
    },
  }),
  focus("symbol_of_red_ruin", "Symbol of Red Ruin", "You gain +2 to spell attack rolls and Spell Save DC. The first time you deal spell damage on your turn, you deal an additional 1d8 necrotic damage.", {
    modifiers: { spellAttackBonus: 2, spellSaveDCBonus: 2 },
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "cleric", spellAttackBonus: 2, spellSaveDCBonus: 2,
      damageRider: { id: "red_ruin", trigger: "source_deals_damage", oncePerTurn: true, damage: "1d8", damageType: "necrotic", actionTags: ["spell"] } },
  }),
  focus("symbol_of_restless_suffering", "Symbol of Restless Suffering", "You gain +2 to spell attack rolls and Spell Save DC. Once per Long Rest, cast Revivify without a spell slot or material component; afterward, take 3d10 necrotic damage that cannot be reduced or prevented.", {
    modifiers: { spellAttackBonus: 2, spellSaveDCBonus: 2 },
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "cleric", spellAttackBonus: 2, spellSaveDCBonus: 2, grantedAction: "restless_suffering_revivify" },
  }),
  focus("wizards_staff", "Wizard's Staff", "A staff required to cast Wizard spells.", {
    focusType: "wizard_staff", spellcastingClass: "wizard", exclusiveGroup: "wizard_staff", functionsAsWeapon: "quarterstaff",
    hands: 2, damageFormula: "1d8", properties: ["two-handed"], mastery: "topple", masteryEquivalentId: "quarterstaff",
    iconSrc: "combat_ui_v2/icons/weapons/quarterstaff.png",
  }),
  focus("staff_of_the_repurposed_flask", "Staff of the Repurposed Flask", "This staff includes a long hollow portion originally designed to be filled with vodka. It now stores an extra evening's worth of Lanterna oil. Add 5 to your maximum oil, and gain 5 temporary HP after each Long Rest.", {
    focusType: "wizard_staff", spellcastingClass: "wizard", exclusiveGroup: "wizard_staff", functionsAsWeapon: "quarterstaff",
    hands: 2, damageFormula: "1d8", properties: ["two-handed"], mastery: "topple", masteryEquivalentId: "quarterstaff",
    modifiers: { lanternaOilCapacityBonus: 5 },
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "wizard", longRestTempHp: 5, lanternaOilCapacityBonus: 5 },
    iconSrc: "combat_ui_v2/assets/icons/wizard_staffs/staff_of_the_repurposed_flask.png",
  }),
  focus("staff_of_the_hollow_star", "Staff of the Hollow Star", "The first time each turn that you deal damage from a spell, deal an additional 1d10 force damage.", {
    focusType: "wizard_staff", spellcastingClass: "wizard", exclusiveGroup: "wizard_staff", functionsAsWeapon: "quarterstaff",
    hands: 2, damageFormula: "1d8", properties: ["two-handed"], mastery: "topple", masteryEquivalentId: "quarterstaff",
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "wizard",
      damageRider: { id: "hollow_star", trigger: "source_deals_damage", oncePerTurn: true, damage: "1d10", damageType: "force", actionTags: ["spell"] } },
    iconSrc: "combat_ui_v2/assets/icons/wizard_staffs/staff_of_the_hollow_star.png",
  }),
  focus("staff_of_the_adder", "Staff of the Adder", "The staff's head can become a living serpent for one minute. Its melee attacks deal 1d8 bludgeoning plus 1d6 poison damage, and a creature struck cannot make Opportunity Attacks until the start of its next turn. Recharges after a Long Rest.", {
    focusType: "wizard_staff", spellcastingClass: "wizard", exclusiveGroup: "wizard_staff", functionsAsWeapon: "quarterstaff",
    hands: 2, damageFormula: "1d8", properties: ["two-handed"], mastery: "topple", masteryEquivalentId: "quarterstaff",
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "wizard", grantedAction: "staff_of_the_adder_transform" },
    iconSrc: "combat_ui_v2/assets/icons/wizard_staffs/staff_of_the_adder.png",
  }),
  focus("staff_of_the_winter_hand", "Staff of the Winter Hand", "Your cold spells ignore resistance to cold damage. The first time each turn that you deal cold damage, reduce one affected creature's Speed by 5 feet until the start of your next turn.", {
    focusType: "wizard_staff", spellcastingClass: "wizard", exclusiveGroup: "wizard_staff", functionsAsWeapon: "quarterstaff",
    hands: 2, damageFormula: "1d8", properties: ["two-handed"], mastery: "topple", masteryEquivalentId: "quarterstaff",
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "wizard",
      featureHooks: [{ id: "winter_hand_ignore_cold_resistance", timing: "damage_resolution", ignoreResistance: true, damageTypes: ["cold"], actionTags: ["spell"] }],
      damageRider: { id: "winter_hand_slow", trigger: "source_deals_damage", oncePerTurn: true, damage: 0, damageType: "cold", actionTags: ["spell"], damageTypes: ["cold"], effects: [{ type: "modifier", trigger: "hit", stat: "speed", amount: -1, duration: { kind: "until", point: "source_turn_start" } }] } },
    iconSrc: "combat_ui_v2/assets/icons/wizard_staffs/staff_of_the_winter_hand.png",
  }),
  focus("warlocks_gloves", "Warlock's Pact Gloves", "Full ritual gloves into which the Warlock's pact is stitched. They are required to cast Warlock spells.", {
    focusType: "warlock_gloves", spellcastingClass: "warlock", exclusiveGroup: "warlock_gloves", functionsAsWeapon: null,
    canMakeWeaponAttack: false, damageFormula: null, mastery: null, hands: 2, mirroredHandPair: true,
    iconSrc: "combat_ui_v2/assets/icons/warlock_gloves/warlocks_gloves.png",
  }),
  focus("gloves_of_the_burnt_compact", "Gloves of the Burnt Compact", "You gain +1 to spell attacks and Spell Save DC. Your fire damage ignores resistance. The first time each turn that you deal fire damage, deal an additional 1d8 fire damage.", {
    focusType: "warlock_gloves", spellcastingClass: "warlock", exclusiveGroup: "warlock_gloves", functionsAsWeapon: null, canMakeWeaponAttack: false, damageFormula: null, mastery: null, hands: 2, mirroredHandPair: true,
    modifiers: { spellAttackBonus: 1, spellSaveDCBonus: 1 },
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "warlock",
      featureHooks: [{ id: "burnt_compact_ignore_fire_resistance", timing: "damage_resolution", ignoreResistance: true, damageTypes: ["fire"], actionTags: ["spell"] }],
      damageRider: { id: "burnt_compact", trigger: "source_deals_damage", oncePerTurn: true, damage: "1d8", damageType: "fire", damageTypes: ["fire"] } },
    iconSrc: "combat_ui_v2/assets/icons/warlock_gloves/gloves_of_the_burnt_compact.png",
  }),
  focus("gloves_of_the_quiet_sepulchre", "Gloves of the Quiet Sepulchre", "You gain +1 to spell attacks and Spell Save DC. You have Advantage on Constitution saves made to maintain Concentration. When you succeed on one of these saves, the creature that caused the damage takes necrotic damage equal to your Charisma modifier.", {
    focusType: "warlock_gloves", spellcastingClass: "warlock", exclusiveGroup: "warlock_gloves", functionsAsWeapon: null, canMakeWeaponAttack: false, damageFormula: null, mastery: null, hands: 2, mirroredHandPair: true,
    modifiers: { spellAttackBonus: 1, spellSaveDCBonus: 1 },
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "warlock",
      activeEffects: [{ id: "quiet_sepulchre_concentration", label: "Gloves of the Quiet Sepulchre", type: "modifier", stat: "save", ability: "con", mode: "advantage", conditionId: "concentration" }],
      concentrationSuccessRetaliation: { damageFrom: "charisma_modifier", damageType: "necrotic" } },
    iconSrc: "combat_ui_v2/assets/icons/warlock_gloves/gloves_of_the_quiet_sepulchre.png",
  }),
  focus("gloves_of_the_last_wick", "Gloves of the Last Wick", "You gain +1 to spell attacks and Spell Save DC. The first creature you damage with a spell on your turn becomes Wicklit until the start of your next turn. It cannot become Invisible or Hidden, and the next attack against it has Advantage.", {
    focusType: "warlock_gloves", spellcastingClass: "warlock", exclusiveGroup: "warlock_gloves", functionsAsWeapon: null, canMakeWeaponAttack: false, damageFormula: null, mastery: null, hands: 2, mirroredHandPair: true,
    modifiers: { spellAttackBonus: 1, spellSaveDCBonus: 1 },
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "warlock",
      damageRider: { id: "last_wick", trigger: "source_deals_damage", oncePerTurn: true, damage: 0, damageType: "radiant", actionTags: ["spell"], effects: [
        { type: "condition", trigger: "hit", condition: "wicklit", noSave: true, duration: { kind: "until", point: "source_turn_start" } },
        { type: "condition", trigger: "hit", condition: "next_incoming_attack_advantage", noSave: true, duration: { kind: "until", point: "source_turn_start" } }
      ] } },
    iconSrc: "combat_ui_v2/assets/icons/warlock_gloves/gloves_of_the_last_wick.png",
  }),
  focus("gloves_of_the_first_covenant", "Gloves of the First Covenant", "You gain +2 to spell attacks and Spell Save DC. Once per Long Rest, cast a Warlock spell of 5th level or lower without expending a spell slot. The gloves provide all verbal, somatic and non-consumed material components for that casting.", {
    focusType: "warlock_gloves", spellcastingClass: "warlock", exclusiveGroup: "warlock_gloves", functionsAsWeapon: null, canMakeWeaponAttack: false, damageFormula: null, mastery: null, hands: 2, mirroredHandPair: true,
    modifiers: { spellAttackBonus: 2, spellSaveDCBonus: 2 },
    mechanics: { kind: "enhanced_spellcasting_focus", spellcastingClass: "warlock", freeSpellCastMaxLevel: 5, freeSpellCastResourceId: "first_covenant_free_cast" },
    iconSrc: "combat_ui_v2/assets/icons/warlock_gloves/gloves_of_the_first_covenant.png",
  }),
];

export const spellcastingFoci = Object.freeze(focusRecords.map((record) => Object.freeze(record)));

const focusById = new Map(spellcastingFoci.map((record) => [record.id, record]));

export function getSpellcastingFocusById(id) {
  if (!id) return null;
  return focusById.get(id) || null;
}

function focus(id, name, description, rules) {
  const spellcastingClass = rules.spellcastingClass || rules.mechanics?.spellcastingClass || "cleric";
  const isHolySymbol = spellcastingClass === "cleric";
  return {
    id,
    type: "equipment",
    equipmentKind: "spellcasting_focus",
    name,
    description,
    stackable: false,
    maxStackSize: 1,
    allowedSlots: ["weapon-1", "weapon-2"],
    hands: rules.hands || 1,
    mirroredHandPair: rules.mirroredHandPair === true,
    focusType: rules.focusType || (isHolySymbol ? "holy_symbol" : null),
    spellcastingClass,
    exclusiveGroup: rules.exclusiveGroup || (isHolySymbol ? "holy_symbol" : null),
    maxEquippedFromGroup: 1,
    proficiencies: rules.functionsAsWeapon === "quarterstaff" ? ["quarterstaffs"] :
      rules.functionsAsWeapon === "club" || isHolySymbol ? ["simple_weapons"] : [],
    functionsAsWeapon: rules.functionsAsWeapon === undefined ? "club" : rules.functionsAsWeapon,
    canMakeWeaponAttack: rules.canMakeWeaponAttack ?? true,
    weaponType: "melee",
    attackAbility: "strength",
    damageFormula: rules.damageFormula === undefined ? "1d6" : rules.damageFormula,
    damageType: "bludgeoning",
    range: 1,
    properties: rules.properties || ["light"],
    mastery: rules.mastery === undefined ? "slow" : rules.mastery,
    masteryEquivalentId: rules.masteryEquivalentId === undefined ? "club" : rules.masteryEquivalentId,
    magical: !["clerics_holy_symbol", "wizards_staff", "warlocks_gloves"].includes(id),
    icon: {
      src: rules.iconSrc || `combat_ui_v2/assets/icons/holy_symbols/${id}.png`,
      width: 80,
      height: 80,
    },
    modifiers: rules.modifiers || {},
    mechanics: rules.mechanics,
  };
}
