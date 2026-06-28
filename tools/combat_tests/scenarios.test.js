import {
  assert,
  createCombatLog,
  createCombatController,
  createSnapshotFromScenario,
  runAiTurn,
  validateCombatActor,
} from "./helpers.js";
import {
  createCombatScenario,
  createEncounterCombatScenario,
  getCombatScenarioOptions,
} from "../../app/combat/scenario.js";
import {
  createCharacterRecord,
  createCharacterMemoryStore,
  createEmptyCharacterDraft,
  createStarterCharacterDraft,
  saveCharacterDraft,
} from "../../app/character/index.js";
import { combatObjectCells } from "../../app/combat/combatObjects.js";
import { inBounds, isMovementBlocked, keyOf } from "../../app/combat/grid.js";
import { createCombatLifecycleUi } from "../../app/combat_test/combatLifecycleUi.js";
import {
  GENERATED_ENCOUNTER_SCENARIOS,
  validateGeneratedEncounterScenarioConfigs,
} from "../../app/combat/scenarios/generatedEncounterScenarioConfigs.js";
import {
  createSaveGameFromCharacterRecord,
  DEFAULT_SAVE_GAME_SLOT,
  getActiveCharacterRecord,
} from "../../app/state/saveGameState.js";
import {
  createSaveGameMemoryStore,
  loadGame,
  saveGame,
} from "../../app/state/saveGameRepository.js";

export async function runScenarioCombatTests() {
  for (const option of getCombatScenarioOptions()) {
    validateScenarioBaseline(createCombatScenario(option.id), option.id);
  }
  testDefaultScenarioContract();
  testBacklandsFieldPlateauStageScenario();
  testGeneratedCharacterArenaContract();
  testGeneratedCharacterArenaUsesSavedCharacterRecord();
  testCombatLifecycleLoadsSavedCharacterForGeneratedArena();
  testCombatLifecycleUsesLatestSavedSameClassCharacter();
  await testCombatLifecycleHydratesFromRendererSaveClient();
  testGeneratedCharacterArenaResetUsesFreshSavedActor();
  testGeneratedEncounterArenaContract();
  testGeneratedEncounterArenaUsesSavedCharacter();
  await testGeneratedEncounterTemplateSmokeTurns();
  testEncounterScenarioLoading();
  testEncounterScenarioInstanceOverrides();
  testEncounterScenarioMixedNaturalAndWeaponActors();
  testExpandedEncounterContent();
  testEncounterScenarioRejectsInvalidPositions();
  await testDefeatedEnemyDoesNotAct();
  testGeneratedEncounterTemplateConfigValidation();
  testScenarioRegistryIsCanonical();
}

function testGeneratedEncounterArenaUsesSavedCharacter() {
  const store = createCharacterMemoryStore();
  saveCharacterDraft(createStarterCharacterDraft("cleric"), { store, slot: "active" });
  const scenario = createCombatScenario("generated-encounter-goblin-skirmish", { characterStore: store });
  const hero = scenario.actors.find((actor) => actor.id === "generated_pc");

  assert.equal(hero.name, "Generated Cleric", "generated encounter arenas should use the saved active character when available");
  assert.equal(hero.role, "cleric");
  assert.equal(scenario.encounterId, "combat_goblin_skirmish");
}

function completeLevelFourWizardDraft() {
  return createEmptyCharacterDraft({
    identity: {
      characterName: "Persistence Wizard",
      level: 4,
      speciesId: "tiefling",
      lineageId: "chthonic",
      backgroundId: "sage",
      classId: "wizard",
      subclassId: "necromancer",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 11,
      charisma: 10,
    },
    gear: { weaponIds: ["quarterstaff", "dagger"], armorId: null, shieldId: null, inventory: [], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["fire_bolt", "mage_hand", "ray_of_frost"],
      preparedSpellIds: ["magic_missile", "burning_hands", "charm_person", "chromatic_orb"],
    },
    choices: {
      backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }],
      advancementChoices: {
        "class:wizard:level_4:ability_score_improvement": { kind: "feat", featId: "ability_score_improvement" },
      },
      featChoices: {
        ability_score_improvement: { abilities: ["intelligence", "intelligence"] },
      },
    },
  });
}

export function validateScenarioBaseline(scenario, label = scenario?.id || "scenario") {
  assert.ok(scenario?.id, `${label}: scenario id is required`);
  assert.ok(scenario.grid, `${label}: grid is required`);
  assert.ok(Number.isFinite(scenario.grid.width) && scenario.grid.width > 0, `${label}: grid width must be positive`);
  assert.ok(Number.isFinite(scenario.grid.height) && scenario.grid.height > 0, `${label}: grid height must be positive`);
  assert.ok(Array.isArray(scenario.actors) && scenario.actors.length > 0, `${label}: actors are required`);
  assert.equal(new Set(scenario.actors.map((actor) => actor.id)).size, scenario.actors.length, `${label}: actor ids must be unique`);

  const snapshot = createSnapshotFromScenario(scenario);
  assert.ok(snapshot.actors.some((actor) => actor.team === "heroes"), `${label}: at least one hero is required`);
  assert.ok(snapshot.actors.some((actor) => actor.team === "enemies"), `${label}: at least one enemy is required`);

  validateTerrain(snapshot, label);
  validateActors(snapshot, label);
  validateCombatObjects(snapshot, label);
}

function validateTerrain(snapshot, label) {
  for (const key of snapshot.grid.blocked) {
    const pos = posFromKey(key);
    assert.ok(inBounds(snapshot.grid, pos), `${label}: blocked cell ${key} must be in bounds`);
  }
  for (const [key, kind] of snapshot.grid.cover) {
    const pos = posFromKey(key);
    assert.ok(inBounds(snapshot.grid, pos), `${label}: cover cell ${key} must be in bounds`);
    assert.ok(["half", "three_quarters", "full"].includes(kind), `${label}: cover kind ${kind} must be supported`);
  }
}

function validateActors(snapshot, label) {
  const occupied = new Map();
  for (const actor of snapshot.actors) {
    assert.deepEqual(validateCombatActor(actor), [], `${label}: ${actor.id} must satisfy CombatActor contract`);
    assert.ok(inBounds(snapshot.grid, actor.position), `${label}: ${actor.id} starts out of bounds`);
    assert.equal(isMovementBlocked(snapshot.grid, actor.position), false, `${label}: ${actor.id} starts on blocked terrain`);
    const key = keyOf(actor.position);
    assert.equal(occupied.has(key), false, `${label}: ${actor.id} overlaps ${occupied.get(key)} at ${key}`);
    occupied.set(key, actor.id);
  }
}

function validateCombatObjects(snapshot, label) {
  for (const object of snapshot.combatObjects || []) {
    const cells = combatObjectCells(snapshot, object);
    assert.ok(cells.length > 0, `${label}: combat object ${object.id} must occupy at least one cell`);
    for (const cell of cells) {
      assert.ok(inBounds(snapshot.grid, cell), `${label}: combat object ${object.id} has out-of-bounds cell ${keyOf(cell)}`);
    }
  }
}

function testDefaultScenarioContract() {
  const scenario = createCombatScenario();
  assert.equal(scenario.id, "generated-character-arena", "generated character arena should be the default combat scenario");
  validateScenarioBaseline(scenario, "default scenario contract");
}

function testBacklandsFieldPlateauStageScenario() {
  const scenario = createCombatScenario("backlands-field-plateau-01", { diceSeed: "backlands-test" });
  validateScenarioBaseline(scenario, "backlands-field-plateau-01 contract");
  const snapshot = createSnapshotFromScenario(scenario);
  const actorPositions = scenario.actors.map((actor) => keyOf(actor.position));
  const presentation = scenario.metadata.presentation;

  assert.equal(snapshot.grid.width, 16, "backlands field grid width should match authored metadata");
  assert.equal(snapshot.grid.height, 11, "backlands field grid height should match authored metadata");
  assert.equal(snapshot.grid.blocked.size, 22, "backlands field blocked cells should be derived from final passability");
  assert.equal(snapshot.actors.length, 6, "backlands field scenario should start as 3-vs-3");
  assert.equal(new Set(actorPositions).size, 6, "backlands field actor positions should be unique");
  for (const actor of snapshot.actors) {
    assert.equal(isMovementBlocked(snapshot.grid, actor.position), false, `${actor.id} should start on passable terrain`);
  }
  assert.equal(
    presentation.backgroundImage,
    "../visual_spike/assets/generated_map_tests/backlands_field_plateau_01_process_01/greyharbour_empty_field_river_hint_01.png",
    "backlands field scenario should use the generated map image"
  );
  assert.equal(presentation.visualGround, "stage_image", "backlands field scenario should render over a stage image");
  assert.equal(presentation.gridProjection.kind, "stage_metadata", "backlands field scenario should use fixed stage projection");
  assert.equal(presentation.stage.grid.origin.x, 960, "backlands field authored grid origin x should remain cell center metadata");
  assert.equal(presentation.stage.grid.origin.y, 120, "backlands field authored grid origin y should remain cell center metadata");
  assert.equal(presentation.gridProjection.origin.x, 960, "backlands field projection origin x should match cell top vertex");
  assert.equal(presentation.gridProjection.origin.y, 88, "backlands field projection origin y should shift to cell top vertex");
  assert.equal(presentation.actorMiniatures.enabled, true, "backlands field scenario should render projected actor figurines");
  assert.ok(
    presentation.actorMiniatures.assets.fighter.endsWith("protagonist_staff_guard_miniature_base_gold_runtime_192x320.png"),
    "backlands fighter should use a perspective miniature asset"
  );
  assert.ok(
    presentation.actorMiniatures.assets.enemies.endsWith("shadow_enemy_crop.png"),
    "backlands enemies should use a perspective enemy miniature asset"
  );
}

function testGeneratedCharacterArenaContract() {
  const scenario = createCombatScenario("generated-character-arena");
  validateScenarioBaseline(scenario, "generated-character-arena contract");
  const snapshot = createSnapshotFromScenario(scenario);
  const hero = snapshot.actors.find((actor) => actor.id === "generated_pc");

  assert.ok(scenario.metadata?.generatedHeroSheet, "generated arena should retain the source resolved sheet for inspection");
  assert.equal(hero.name, "Generated Fighter");
  assert.equal(hero.ac, 18, "generated actor should carry resolved armor and shield AC");
  assert.equal(hero.hp, 12, "generated actor should carry resolved level-1 HP");
  assert.equal(hero.actions.some((action) => action.id === "longsword"), true, "generated actor should expose equipped weapon action");
  assert.equal(hero.actions.some((action) => action.id === "second_wind"), true, "generated actor should expose class feature action");
  assert.equal(hero.actions.some((action) => action.id === "healing_potion"), true, "generated actor should expose inventory consumable action");
  assert.equal(hero.featureHooks.some((hook) => hook.id === "savage_attacker_weapon_damage"), true, "generated actor should carry origin feat combat hooks");
  assert.equal(hero.resistances.includes("fire"), true, "generated actor should carry species and lineage resistance data");
}

function testGeneratedCharacterArenaUsesSavedCharacterRecord() {
  const record = createCharacterRecord(completeLevelFourWizardDraft(), {
    slot: "active",
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });
  const scenario = createCombatScenario("generated-character-arena", { characterRecord: record });
  validateScenarioBaseline(scenario, "generated-character-arena saved character contract");
  const hero = createSnapshotFromScenario(scenario).actors.find((actor) => actor.id === "generated_pc");

  assert.equal(record.status, "ready", "creator output must be combat-ready before entering combat");
  assert.equal(scenario.metadata.generatedHeroSource, "character_record");
  assert.equal(scenario.metadata.generatedHeroRecordId, record.id);
  assert.equal(hero.name, "Persistence Wizard");
  assert.equal(hero.role, "wizard");
  assert.equal(hero.level, 4);
  assert.equal(hero.actions.some((action) => action.id === "chromatic_orb"), true, "saved prepared spells should reach combat actions");
  assert.equal(hero.actions.some((action) => action.id === "longsword"), false, "saved gear should replace starter fixture gear");
}

function testCombatLifecycleLoadsSavedCharacterForGeneratedArena() {
  const record = createCharacterRecord(completeLevelFourWizardDraft(), {
    slot: "active",
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });
  const saveStore = createSaveGameMemoryStore();
  saveGame(saveStore, createSaveGameFromCharacterRecord(record, { slot: "active" }), DEFAULT_SAVE_GAME_SLOT);
  const lifecycle = createCombatLifecycleUi(null, { saveStore });
  const options = lifecycle.scenarioOptions("generated-character-arena");
  const scenario = createCombatScenario("generated-character-arena", options);
  const hero = createSnapshotFromScenario(scenario).actors.find((actor) => actor.id === "generated_pc");

  assert.equal(options.characterRecord.id, record.id, "combat lifecycle should load active character from autosave");
  assert.equal(getActiveCharacterRecord(loadGame(saveStore, DEFAULT_SAVE_GAME_SLOT)).id, record.id);
  assert.equal(scenario.metadata.generatedHeroSource, "character_record");
  assert.equal(hero.name, "Persistence Wizard");
  assert.equal(hero.role, "wizard");
}

function testCombatLifecycleUsesLatestSavedSameClassCharacter() {
  const firstRecord = createCharacterRecord(completeLevelFourWizardDraft(), {
    slot: "active",
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });
  const adjustedDraft = completeLevelFourWizardDraft();
  adjustedDraft.spells.preparedSpellIds = ["shield", "mage_armor", "sleep", "thunderwave"];
  const secondRecord = createCharacterRecord(adjustedDraft, {
    slot: "active",
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });
  const saveStore = createSaveGameMemoryStore();
  saveGame(saveStore, createSaveGameFromCharacterRecord(firstRecord, { slot: "active" }), DEFAULT_SAVE_GAME_SLOT);
  saveGame(saveStore, createSaveGameFromCharacterRecord(secondRecord, { slot: "active" }), DEFAULT_SAVE_GAME_SLOT);
  const lifecycle = createCombatLifecycleUi(null, { saveStore });
  const options = lifecycle.scenarioOptions("generated-character-arena");
  const scenario = createCombatScenario("generated-character-arena", options);
  const hero = createSnapshotFromScenario(scenario).actors.find((actor) => actor.id === "generated_pc");

  assert.equal(options.characterRecord.id, secondRecord.id, "same-class resaves should replace the active character record");
  assert.equal(hero.actions.some((action) => action.id === "shield"), true, "latest saved spell choices should reach combat actions");
  assert.equal(hero.actions.some((action) => action.id === "chromatic_orb"), false, "previous saved spell choices should not linger after same-class resave");
}

async function testCombatLifecycleHydratesFromRendererSaveClient() {
  const adjustedDraft = completeLevelFourWizardDraft();
  adjustedDraft.spells.preparedSpellIds = ["shield", "mage_armor", "sleep", "thunderwave"];
  const record = createCharacterRecord(adjustedDraft, {
    slot: "active",
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });
  const saveState = createSaveGameFromCharacterRecord(record, { slot: "active" });
  const lifecycle = createCombatLifecycleUi(null, {
    saveStore: createSaveGameMemoryStore(),
    saveClient: {
      load: async () => saveState,
    },
  });

  await lifecycle.hydrate();
  const scenario = createCombatScenario("generated-character-arena", lifecycle.scenarioOptions("generated-character-arena"));
  const hero = createSnapshotFromScenario(scenario).actors.find((actor) => actor.id === "generated_pc");

  assert.equal(hero.actions.some((action) => action.id === "shield"), true, "combat lifecycle hydrate should pull latest renderer save before building the arena");
}

function testGeneratedCharacterArenaResetUsesFreshSavedActor() {
  const record = createCharacterRecord(completeLevelFourWizardDraft(), {
    slot: "active",
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });
  const damagedRecord = {
    ...record,
    runtime: {
      ...record.runtime,
      hp: 1,
      defeated: false,
    },
  };
  const saveStore = createSaveGameMemoryStore();
  saveGame(saveStore, createSaveGameFromCharacterRecord(damagedRecord, { slot: "active" }), DEFAULT_SAVE_GAME_SLOT);
  const lifecycle = createCombatLifecycleUi(null, { saveStore });
  const options = lifecycle.scenarioOptions("generated-character-arena");
  const scenario = createCombatScenario("generated-character-arena", options);
  const hero = createSnapshotFromScenario(scenario).actors.find((actor) => actor.id === "generated_pc");

  assert.equal(options.freshCharacterRuntime, true, "test arena resets should request a fresh actor from the saved character definition");
  assert.equal(hero.hp, record.combatActor.hp, "reset should regenerate the saved character arena from base actor HP, not prior combat runtime");
}

function testGeneratedEncounterArenaContract() {
  const scenario = createCombatScenario("generated-encounter-goblin-skirmish");
  validateScenarioBaseline(scenario, "generated-encounter-goblin-skirmish contract");
  const snapshot = createSnapshotFromScenario(scenario);
  const hero = snapshot.actors.find((actor) => actor.id === "generated_pc");
  const enemies = snapshot.actors.filter((actor) => actor.team === "enemies");

  assert.equal(scenario.encounterId, "combat_goblin_skirmish", "generated encounter arena should load from encounter data");
  assert.equal(scenario.metadata?.generatedHeroActorId, "generated_pc", "generated encounter arena should retain the hero actor id");
  assert.equal(hero.name, "Generated Fighter", "generated encounter arena should use the generated character bridge");
  assert.equal(enemies.length, 3, "generated encounter arena should load all encounter enemies");
  assert.equal(enemies.some((actor) => actor.actions.some((action) => action.id === "nimble_escape_dash")), true, "encounter enemies should expose data-driven feature actions in the UI scenario");
  assert.equal(enemies.every((actor) => actor.actions[0].weaponMasteryActive === true), true, "encounter defaults should activate mastery in the UI scenario");

  const boneGuard = createCombatScenario("generated-encounter-bone-guard");
  const shadowHounds = createCombatScenario("generated-encounter-shadow-hounds");
  const levelSevenTrial = createCombatScenario("generated-encounter-level-7-team-trial");
  const levelSevenCasterTrial = createCombatScenario("generated-encounter-level-7-caster-trial");
  validateScenarioBaseline(boneGuard, "generated-encounter-bone-guard contract");
  validateScenarioBaseline(shadowHounds, "generated-encounter-shadow-hounds contract");
  validateScenarioBaseline(levelSevenTrial, "generated-encounter-level-7-team-trial contract");
  validateScenarioBaseline(levelSevenCasterTrial, "generated-encounter-level-7-caster-trial contract");
  assert.equal(boneGuard.encounterId, "combat_bone_guard", "bone guard scenario should load the configured encounter");
  assert.equal(shadowHounds.encounterId, "combat_shadow_hounds", "shadow hounds scenario should load the configured encounter");
  assert.equal(levelSevenTrial.actors.filter((actor) => actor.team === "heroes").length, 3, "level 7 trial should include the PC and two companions");
  assert.equal(levelSevenTrial.actors.find((actor) => actor.id === "generated_pc")?.level, 7, "level 7 trial should use a level 7 PC");
  assert.deepEqual(
    levelSevenCasterTrial.actors.filter((actor) => actor.team === "heroes").map((actor) => actor.className),
    ["Wizard / Dirt Wizard", "Warlock / The Lantern / Pact of the Tome", "Paladin / Oath of Glory"],
    "caster trial should include resolved canonical wizard, warlock, and paladin builds"
  );
  assert.ok(
    levelSevenCasterTrial.actors.find((actor) => actor.id === "generated_pc")?.actions.some((action) => action.id === "fireball"),
    "caster trial wizard should expose resolved area spell testing"
  );
  assert.ok(
    levelSevenCasterTrial.actors.find((actor) => actor.id === "npc_warlock")?.actions.some((action) => action.id === "hex"),
    "caster trial warlock should expose resolved bonus-action spell testing"
  );
  assert.ok(
    levelSevenCasterTrial.actors.find((actor) => actor.id === "npc_paladin")?.actions.some((action) => action.id === "bless"),
    "caster trial paladin should expose resolved party buff testing"
  );
  assert.equal(
    levelSevenCasterTrial.actors.filter((actor) => actor.team === "heroes").every((actor) => actor.metadata?.source === "resolved_character_sheet"),
    true,
    "caster trial heroes should be emitted from resolved character sheets"
  );
}

async function testGeneratedEncounterTemplateSmokeTurns() {
  for (const config of GENERATED_ENCOUNTER_SCENARIOS) {
    const controller = createCombatController({ scenarioId: config.id });
    const label = `${config.id} smoke turn`;
    assert.equal(controller.snapshot.initiative.length, controller.snapshot.actors.length, `${label}: initiative should include every actor`);
    assert.equal(new Set(controller.snapshot.initiative).size, controller.snapshot.initiative.length, `${label}: initiative ids should be unique`);

    let enemyTurns = 0;
    for (let guard = 0; guard < controller.snapshot.actors.length + 2; guard += 1) {
      const actor = currentActor(controller.snapshot);
      if (!actor || actor.team === "heroes") break;
      await runEnemyTurn(controller);
      enemyTurns += 1;
    }

    const hero = currentActor(controller.snapshot);
    assert.equal(hero?.team, "heroes", `${label}: smoke test should reach a player turn`);
    controller.endTurn();

    if (currentActor(controller.snapshot)?.team === "enemies") {
      await runEnemyTurn(controller);
      enemyTurns += 1;
    }

    assert.ok(enemyTurns > 0, `${label}: smoke test should exercise at least one enemy turn`);
    assert.equal(Boolean(controller.pendingReaction), false, `${label}: no reaction prompt should remain unresolved`);
    validateActors(controller.snapshot, label);
  }
}

function testEncounterScenarioLoading() {
  const scenario = createEncounterCombatScenario("combat_goblins_2", {
    heroes: [createHeroActor()],
    grid: { width: 8, height: 6, blocked: [], cover: [] },
    enemyPositions: [{ x: 5, y: 1 }, { x: 6, y: 1 }],
  });
  validateScenarioBaseline(scenario, "encounter scenario loading");
  const snapshot = createSnapshotFromScenario(scenario);
  const enemies = snapshot.actors.filter((actor) => actor.team === "enemies");

  assert.equal(scenario.encounterId, "combat_goblins_2", "encounter scenarios should retain the source encounter id");
  assert.deepEqual(enemies.map((actor) => actor.sourceId), ["goblin", "goblin"], "encounter scenarios should generate enemy actors from data");
  assert.deepEqual(enemies.map((actor) => actor.position), [{ x: 5, y: 1 }, { x: 6, y: 1 }], "encounter scenarios should apply deterministic positions");
  assert.equal(enemies.every((actor) => actor.actions[0].type === "weapon_attack"), true, "encounter enemies should expose generated combat actions");
}

function testEncounterScenarioInstanceOverrides() {
  const scenario = createEncounterCombatScenario("combat_goblins_2", {
    heroes: [createHeroActor()],
    grid: { width: 8, height: 6, blocked: [], cover: [] },
    enemyPositions: [{ x: 5, y: 1 }, { x: 6, y: 1 }],
    enemyInstances: [
      { id: "mastered_goblin", hp: 3, attackBonus: 9, masteredWeaponIds: ["scimitar"] },
      { id: "plain_goblin" },
    ],
  });
  const snapshot = createSnapshotFromScenario(scenario);
  const mastered = snapshot.actors.find((actor) => actor.id === "mastered_goblin");
  const plain = snapshot.actors.find((actor) => actor.id === "plain_goblin");

  assert.equal(mastered.hp, 3, "encounter scenario should apply HP overrides");
  assert.equal(mastered.actions[0].attackBonus, 9, "encounter scenario should apply attack bonus overrides");
  assert.equal(mastered.actions[0].weaponMasteryActive, true, "encounter scenario should activate per-instance mastered weapons");
  assert.equal(plain.actions[0].weaponMasteryActive, undefined, "unmastered enemy weapons should remain inactive");
}

function testEncounterScenarioMixedNaturalAndWeaponActors() {
  const scenario = createEncounterCombatScenario("combat_mixed_patrol", {
    heroes: [createHeroActor()],
    grid: { width: 8, height: 6, blocked: [], cover: [] },
    enemyPositions: [{ x: 5, y: 1 }, { x: 6, y: 1 }],
  });
  const snapshot = createSnapshotFromScenario(scenario);
  const attacks = snapshot.actors.filter((actor) => actor.team === "enemies").map((actor) => actor.actions[0]);

  assert.equal(attacks.some((action) => action.tags.weapon === true), true, "mixed encounter should include generated weapon attacks");
  assert.equal(attacks.some((action) => action.tags.natural === true), true, "mixed encounter should include generated natural attacks");
}

function testExpandedEncounterContent() {
  const skirmish = createSnapshotFromScenario(createEncounterCombatScenario("combat_goblin_skirmish", {
    heroes: [createHeroActor()],
    grid: { width: 10, height: 8, blocked: [], cover: [] },
  }));
  const cutthroat = skirmish.actors.find((actor) => actor.id === "goblin_cutthroat");
  const runner = skirmish.actors.find((actor) => actor.id === "goblin_runner");

  assert.equal(cutthroat.name, "Goblin Cutthroat", "encounter instances should carry tactical role names");
  assert.equal(cutthroat.actions[0].weaponMasteryActive, true, "encounter defaults should activate mastered weapons");
  assert.equal(runner.speed, 7, "encounter instances should carry speed overrides");

  const boneGuard = createSnapshotFromScenario(createEncounterCombatScenario("combat_bone_guard", {
    heroes: [createHeroActor()],
    grid: { width: 10, height: 8, blocked: [], cover: [] },
  }));
  const graveKnight = boneGuard.actors.find((actor) => actor.id === "grave_knight");
  const skeletons = boneGuard.actors.filter((actor) => actor.sourceId === "skeleton");

  assert.equal(graveKnight.auras.some((aura) => aura.id === "commanding_presence"), true, "expanded encounters should preserve enemy auras");
  assert.equal(graveKnight.actions[0].weaponMasteryActive, true, "expanded encounters should support per-instance mastery");
  assert.equal(skeletons.length, 2, "expanded encounters should support named supporting enemies");
}

function testEncounterScenarioRejectsInvalidPositions() {
  assert.throws(
    () => createEncounterCombatScenario("combat_skeleton_1", {
      heroes: [createHeroActor({ position: { x: 1, y: 1 } })],
      grid: { width: 5, height: 5, blocked: [], cover: [] },
      enemyPositions: [{ x: 1, y: 1 }],
    }),
    /overlaps/,
    "encounter scenario loading should reject overlapping starting positions"
  );
}

async function testDefeatedEnemyDoesNotAct() {
  const scenario = createEncounterCombatScenario("combat_skeleton_1", {
    heroes: [createHeroActor()],
    enemyPositions: [{ x: 2, y: 1 }],
  });
  const snapshot = createSnapshotFromScenario(scenario);
  const enemy = snapshot.actors.find((actor) => actor.team === "enemies");
  enemy.hp = 0;
  enemy.defeated = true;
  const log = createCombatLog();
  const controller = {
    log,
    move: () => {
      throw new Error("defeated enemy should not move");
    },
    action: () => {
      throw new Error("defeated enemy should not act");
    },
    afterStep: async () => {},
  };

  await runAiTurn(snapshot, enemy, controller);
  assert.equal(log.events.length, 0, "defeated enemy turns should produce no AI events");
}

function testGeneratedEncounterTemplateConfigValidation() {
  assert.deepEqual(validateGeneratedEncounterScenarioConfigs(), [], "generated encounter scenario configs should be coherent");
}

function testScenarioRegistryIsCanonical() {
  const options = getCombatScenarioOptions();
  assert.deepEqual(
    options.map((scenario) => scenario.id),
    [
      "generated-empty-arena",
      "dockside-stage-grid",
      "backlands-field-plateau-01",
      "trench-ramp-live-test",
      "generated-character-arena",
      "generated-wizard-shield-arena",
      "generated-encounter-goblin-skirmish",
      "generated-encounter-bone-guard",
      "generated-encounter-shadow-hounds",
      "generated-encounter-level-7-team-trial",
      "generated-encounter-level-7-caster-trial",
    ],
    "combat preview scenarios should be exposed through the combat scenario registry"
  );
  assert.deepEqual(
    options.map((scenario) => scenario.group),
    [
      "Generated Character Tests",
      "Stage Geometry Tests",
      "Stage Geometry Tests",
      "Stage Geometry Tests",
      "Generated Character Tests",
      "Reaction Tests",
      "Encounter Templates",
      "Encounter Templates",
      "Encounter Templates",
      "Encounter Templates",
      "Encounter Templates",
    ],
    "scenario registry should expose UI grouping metadata"
  );
  assert.throws(
    () => createCombatScenario("trial-arena"),
    /Unknown combat scenario/,
    "old hardwired arenas should not remain addressable through the scenario factory"
  );
}

function posFromKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function currentActor(snapshot) {
  const actorId = snapshot.initiative[snapshot.turnIndex];
  return snapshot.actors.find((actor) => actor.id === actorId) || null;
}

async function runEnemyTurn(controller) {
  await controller.runEnemyTurnIfNeeded();
  if (controller.pendingReaction) {
    controller.answerReaction(false);
    controller.endTurn();
  }
}

function createHeroActor(overrides = {}) {
  return {
    id: "hero",
    name: "Hero",
    team: "heroes",
    hp: 12,
    maxHp: 12,
    ac: 14,
    speed: 6,
    position: { x: 1, y: 1 },
    actions: [],
    ...overrides,
  };
}
