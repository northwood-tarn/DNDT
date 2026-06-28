import { createPresentationFromStage } from "../stageMetadata.js";

const GRID_ROWS = [
  "                                  ",
  "                                  ",
  "                                  ",
  "                                  ",
  "                                  ",
  "                                  ",
  "            .......               ",
  "           ...M.M...              ",
  "           ...........            ",
  "          ....M.M.....            ",
  "          ..............          ",
  "          ...............         ",
  "          ................        ",
  "          ................        ",
  "          .................       ",
  "          .....  RR........       ",
  "                 RRR              ",
  "                 RRR              ",
  "                 RRR              ",
  "                 RRR   .....      ",
  "             ... RRR   .....      ",
  "             ...  RR   .....      ",
  "             ...  RR   .....      ",
  "             .... RR   ....       ",
  "             .......   ...        ",
  "             ...........          ",
  "             ..........           ",
  "             .........            ",
  "              .P.P.P.             ",
  "              .......             ",
  "               ......             ",
  "                 .                ",
  "                                  ",
  "                                  ",
];

const STAGE = Object.freeze({
  stageId: "trench_ramp_test_01_lit",
  status: "image_first_user_annotated_live_test",
  image: {
    runtimePlate: "trench_ramp_test_01/trench_ramp_test_01.lit.png",
    sourcePlate: "trench_ramp_test_01/trench_ramp_test_01.lit.png",
    width: 1920,
    height: 1080,
  },
  grid: {
    projection: "isometric_square",
    tileWidth: 128,
    tileHeight: 64,
    origin: { x: 960, y: -512 },
    width: 34,
    height: 34,
    coordinateRule: "x increases down-right; y increases down-left",
  },
  spawns: {
    defaultHeroSpawns: positionsFor("P"),
    defaultEnemySpawns: positionsFor("M"),
  },
});

export function createTrenchRampLiveScenario(options = {}) {
  const grid = createGridFromRows();
  const heroSpawns = STAGE.spawns.defaultHeroSpawns;
  const enemySpawns = STAGE.spawns.defaultEnemySpawns;

  return {
    id: "trench-ramp-live-test",
    grid,
    actors: [
      createFriendly({
        id: "trench_guardian",
        name: "Level 5 Guardian",
        className: "Fighter",
        role: "melee",
        token: "G",
        position: heroSpawns[0],
        hp: 46,
        maxHp: 46,
        ac: 17,
        attackBonus: 7,
        damage: "1d8+4",
      }),
      createFriendly({
        id: "trench_scout",
        name: "Level 5 Scout",
        className: "Rogue",
        role: "skirmisher",
        token: "S",
        position: heroSpawns[1],
        hp: 35,
        maxHp: 35,
        ac: 15,
        speed: 7,
        attackBonus: 7,
        damage: "1d6+4",
      }),
      createFriendly({
        id: "trench_adept",
        name: "Level 5 Adept",
        className: "Cleric",
        role: "caster",
        token: "A",
        position: heroSpawns[2],
        hp: 38,
        maxHp: 38,
        ac: 16,
        attackBonus: 6,
        damage: "1d8+3",
        actions: [
          weaponAttack("adept_mace", "Mace", 6, "1d6+3", "bludgeoning"),
          spellSave("sacred_flame", "Sacred Flame", 14, "1d8", "radiant", 8),
          healAction("cure_wounds", "Cure Wounds", "1d8+3"),
        ],
      }),
      ...enemySpawns.slice(0, 4).map((position, index) => createEnemy(index, position)),
    ],
    combatObjects: [],
    metadata: {
      diceSeed: options.diceSeed || "trench-ramp-live-test-001",
      combatStageId: STAGE.stageId,
      presentation: {
        ...createPresentationFromStage(STAGE),
        actorMiniatures: {
          enabled: true,
          defaultSize: { width: 120, height: 200 },
          assets: {
            guardian: "../visual_spike/assets/protagonist_staff_guard_miniature_base_gold_runtime_192x320.png",
            scout: "../visual_spike/assets/protagonist_rogue_guard_crop.png",
            adept: "../visual_spike/assets/protagonist_cleric_guard_crop.png",
            enemy: "../visual_spike/assets/shadow_enemy_crop.png",
            heroes: "../visual_spike/assets/protagonist_staff_guard_miniature_base_gold_runtime_192x320.png",
            enemies: "../visual_spike/assets/shadow_enemy_crop.png",
          },
        },
      },
      sourceSketch: "../visual_spike/assets/trench_ramp_test_01_lit/trench_ramp_test_01_lit.grid-sketch.json",
    },
  };
}

function createGridFromRows() {
  const blocked = [];
  const cover = [];
  for (let y = 0; y < STAGE.grid.height; y += 1) {
    for (let x = 0; x < STAGE.grid.width; x += 1) {
      const symbol = cellSymbol(x, y);
      if (symbol === " ") blocked.push({ x, y, kind: "unpainted_or_nonpassable" });
      if (symbol === "h") cover.push({ x, y, kind: "half" });
      if (symbol === "C") cover.push({ x, y, kind: "three_quarters" });
    }
  }
  return {
    width: STAGE.grid.width,
    height: STAGE.grid.height,
    blocked,
    cover,
  };
}

function positionsFor(symbol) {
  const positions = [];
  for (let y = 0; y < GRID_ROWS.length; y += 1) {
    for (let x = 0; x < GRID_ROWS[y].length; x += 1) {
      if (GRID_ROWS[y][x] === symbol) positions.push({ x, y });
    }
  }
  return positions;
}

function cellSymbol(x, y) {
  return GRID_ROWS[y]?.[x] || " ";
}

function createFriendly(options) {
  return {
    team: "heroes",
    creatureType: "humanoid",
    size: "medium",
    level: 5,
    speed: options.speed || 6,
    initiativeBonus: 2,
    abilityMods: { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
    saves: { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
    actions: [
      weaponAttack(`${options.id}_strike`, "Strike", options.attackBonus, options.damage, "slashing"),
      ...(options.actions || []),
    ],
    ...options,
  };
}

function createEnemy(index, position) {
  const names = ["Level 4 Blade", "Level 4 Hook", "Level 4 Hexer", "Level 4 Warden"];
  return {
    id: `trench_enemy_${index + 1}`,
    name: names[index] || `Level 4 Enemy ${index + 1}`,
    team: "enemies",
    role: index === 2 ? "caster" : "melee",
    creatureType: "humanoid",
    size: "medium",
    level: 4,
    token: "E",
    hp: index === 2 ? 24 : 31,
    maxHp: index === 2 ? 24 : 31,
    ac: index === 2 ? 13 : 15,
    speed: 6,
    initiativeBonus: 1,
    position,
    abilityMods: { str: 2, dex: 1, con: 2, int: 0, wis: 1, cha: 0 },
    saves: { str: 2, dex: 1, con: 2, int: 0, wis: 1, cha: 0 },
    ai: { profile: index === 2 ? "caster" : "melee", targetPriority: "nearest" },
    actions: index === 2
      ? [
          weaponAttack("hexer_dagger", "Dagger", 5, "1d4+3", "piercing"),
          spellSave("grave_spark", "Grave Spark", 13, "1d8", "necrotic", 6),
        ]
      : [weaponAttack("enemy_blade", "Blade", 5, "1d8+3", "slashing")],
  };
}

function weaponAttack(id, name, attackBonus, damage, damageType) {
  return {
    id,
    name,
    type: "weapon_attack",
    cost: "action",
    range: 1,
    attackBonus,
    damage,
    damageType,
    description: `${name}: melee weapon attack for ${damage} ${damageType} damage.`,
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  };
}

function spellSave(id, name, saveDC, damage, damageType, range) {
  return {
    id,
    name,
    type: "spell_save",
    cost: "action",
    range,
    saveAbility: "dex",
    spellSaveDC: saveDC,
    damage,
    damageType,
    description: `${name}: target makes a Dexterity save or takes ${damage} ${damageType} damage.`,
    tags: { harmful: true, spell: true, savingThrow: true },
  };
}

function healAction(id, name, healing) {
  return {
    id,
    name,
    type: "spell_self_heal",
    cost: "action",
    range: 1,
    healing,
    requiresTarget: true,
    targetTeam: "heroes",
    description: `${name}: restore ${healing} hit points to an adjacent ally.`,
    tags: { harmful: false, spell: true, healing: true },
    uses: { max: 2, remaining: 2, recharge: "long_rest" },
  };
}
