export const DEVICE_RECIPES = {
  fire_granado: recipe({
    id: "fire_granado",
    name: "Fire Granado",
    minLevel: 3,
    use: "Action",
    text: "Thrown 20 ft; 5-ft radius explosion, 2d6 fire (DEX save half).",
    action: areaSave({ damage: "2d6", damageType: "fire", radiusFt: 5 }),
  }),
  acid_flask: recipe({
    id: "acid_flask",
    name: "Acid Flask",
    minLevel: 3,
    use: "Action",
    text: "Thrown 20 ft; on hit 2d6 acid, target's AC -1 until end of next turn.",
    action: attack({ damage: "2d6", damageType: "acid", effects: [armorPenalty()] }),
  }),
  lightning_paper: recipe({
    id: "lightning_paper",
    name: "Lightning Paper",
    minLevel: 3,
    use: "Bonus Action",
    text: "Apply to weapon; for 2 rounds, attacks deal +1d6 lightning.",
    action: selfBuff({
      actionType: "bonus_action",
      effects: [{ type: "damage_rider", damage: "1d6", damageType: "lightning", duration: { kind: "rounds", rounds: 2 } }],
    }),
  }),
  smoke_marble: recipe({
    id: "smoke_marble",
    name: "Smoke Marble",
    minLevel: 4,
    use: "Action",
    text: "Thrown 30 ft; creates a 10-ft radius smoke cloud until the end of your next turn.",
    action: utilityArea({ rangeFt: 30, radiusFt: 10, objectKind: "smoke_cloud" }),
  }),
  glass_tangle: recipe({
    id: "glass_tangle",
    name: "Glass Tangle",
    minLevel: 5,
    use: "Action",
    text: "Thrown 30 ft; 10-ft radius difficult terrain. Creatures entering or starting there take 1d4 slashing.",
    action: utilityArea({ rangeFt: 30, radiusFt: 10, damage: "1d4", damageType: "slashing", objectKind: "difficult_terrain" }),
  }),
  thunder_snap: recipe({
    id: "thunder_snap",
    name: "Thunder Snap",
    minLevel: 6,
    use: "Action",
    text: "Thrown 20 ft; 5-ft radius blast, 3d6 thunder (CON save half) and audible 300 ft.",
    action: areaSave({ damage: "3d6", damageType: "thunder", saveAbility: "constitution", radiusFt: 5 }),
  }),
  frost_nail: recipe({
    id: "frost_nail",
    name: "Frost Nail",
    minLevel: 7,
    use: "Action",
    text: "Thrown 30 ft; 2d6 cold and target speed -10 ft until the end of its next turn.",
    action: attack({ damage: "2d6", damageType: "cold", rangeFt: 30, effects: [speedPenalty()] }),
  }),
  choking_vial: recipe({
    id: "choking_vial",
    name: "Choking Vial",
    minLevel: 8,
    use: "Action",
    text: "Thrown 30 ft; 10-ft radius, 2d6 poison (CON save half) and light obscurement.",
    action: areaSave({ damage: "2d6", damageType: "poison", saveAbility: "constitution", rangeFt: 30, radiusFt: 10 }),
  }),
  binding_tar: recipe({
    id: "binding_tar",
    name: "Binding Tar",
    minLevel: 9,
    use: "Action",
    text: "Thrown 30 ft; 10-ft radius tar patch. Failed STR save restrains until the target uses an action to break free.",
    action: areaSave({
      damage: null,
      damageType: null,
      saveAbility: "strength",
      rangeFt: 30,
      radiusFt: 10,
      effects: [{ type: "condition", trigger: "failed_save", condition: "restrained", duration: { kind: "save_ends" } }],
    }),
  }),
  flash_powder: recipe({
    id: "flash_powder",
    name: "Flash Powder",
    minLevel: 10,
    use: "Bonus Action",
    text: "Scatter powder in a 10-ft cone; failed CON save blinds until the end of the target's next turn.",
    action: areaSave({
      actionType: "bonus_action",
      damage: null,
      damageType: null,
      saveAbility: "constitution",
      rangeFt: 0,
      targeting: { shape: "cone", lengthSquares: 2, lengthFt: 10 },
      effects: [{ type: "condition", trigger: "failed_save", condition: "blinded", duration: { kind: "rounds", rounds: 1 } }],
    }),
  }),
  sunrod_charge: recipe({
    id: "sunrod_charge",
    name: "Sunrod Charge",
    minLevel: 11,
    use: "Action",
    text: "Thrown 30 ft; 10-ft radius burst, 4d6 radiant (DEX save half).",
    action: areaSave({ damage: "4d6", damageType: "radiant", rangeFt: 30, radiusFt: 10 }),
  }),
  null_salt: recipe({
    id: "null_salt",
    name: "Null Salt",
    minLevel: 12,
    use: "Action",
    text: "Thrown 30 ft; target takes 3d6 force and has disadvantage on concentration saves until next turn.",
    action: attack({
      damage: "3d6",
      damageType: "force",
      rangeFt: 30,
      effects: [{ type: "condition", condition: "concentration_disadvantage", duration: { kind: "rounds", rounds: 1 } }],
    }),
  }),
  catastrophe_core: recipe({
    id: "catastrophe_core",
    name: "Catastrophe Core",
    minLevel: 13,
    use: "Action",
    text: "Thrown 30 ft; 15-ft radius blast, 5d6 fire or thunder (DEX save half).",
    action: areaSave({ damage: "5d6", damageType: "fire", damageTypeChoices: ["fire", "thunder"], rangeFt: 30, radiusFt: 15 }),
  }),
};

export const DEVICE_RECIPE_LIST = Object.values(DEVICE_RECIPES);

export function getDeviceRecipeById(id) {
  return DEVICE_RECIPES[id] || null;
}

export function listDeviceRecipes(options = {}) {
  const level = options.level || 20;
  const ids = new Set(options.ids || DEVICE_RECIPE_LIST.map((recipe) => recipe.id));
  return DEVICE_RECIPE_LIST
    .filter((recipe) => ids.has(recipe.id))
    .filter((recipe) => (recipe.minLevel || 1) <= level)
    .sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1) || a.name.localeCompare(b.name));
}

function recipe(record) {
  return {
    tags: ["device"],
    ...record,
    action: {
      tags: ["device"],
      ...(record.action || {}),
    },
  };
}

function areaSave({ actionType = "action", damage, damageType, damageTypeChoices = null, saveAbility = "dexterity", rangeFt = 20, radiusFt = 5, targeting = null, effects = [] }) {
  return {
    actionType,
    requiresTarget: true,
    rangeFt,
    save: { ability: saveAbility, dcFrom: "deviceSaveDC", onSave: damage ? "half" : "negates" },
    damage: damage ? { dice: damage, type: damageType } : null,
    damageTypeChoices,
    targeting: targeting || { shape: "radius", radiusSquares: Math.ceil(radiusFt / 5), radiusFt },
    effects,
  };
}

function attack({ actionType = "action", damage, damageType, rangeFt = 20, effects = [] }) {
  return {
    actionType,
    requiresTarget: true,
    rangeFt,
    damage: { dice: damage, type: damageType },
    effects,
  };
}

function selfBuff({ actionType = "action", effects = [] }) {
  return { actionType, requiresTarget: false, rangeFt: 0, effects };
}

function utilityArea({ actionType = "action", rangeFt = 20, radiusFt = 5, damage = null, damageType = null, objectKind }) {
  return {
    actionType,
    requiresTarget: true,
    rangeFt,
    damage: damage ? { dice: damage, type: damageType } : null,
    targeting: { shape: "radius", radiusSquares: Math.ceil(radiusFt / 5), radiusFt },
    object: { kind: objectKind, radiusFt },
  };
}

function armorPenalty() {
  return { type: "modifier", trigger: "hit", stat: "ac", amount: -1, duration: { kind: "rounds", rounds: 1 } };
}

function speedPenalty() {
  return { type: "modifier", trigger: "hit", stat: "speed", amountFt: -10, duration: { kind: "rounds", rounds: 1 } };
}
