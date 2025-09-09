// app/systems/combatLoader.js — unified actors[] contract
// Builds a canonical state.combat with actors[] and triggers, then hands off to CombatScene.
// No healing or mutation: we pass through whatever is in state.player.

import { sceneManager } from '../engine/sceneManager.js';
import CombatScene from '../scenes/CombatScene.js';
import { state } from '../state/stateStore.js';
import { logSystem } from '../engine/log.js';

// Optional registry of encounters (flat table). Fine if missing.
let encountersTable = {};
try {
  const mod = await import('../data/encounters.js');
  encountersTable = (mod && (mod.default || mod.encounters)) || {};
} catch (_) {}

// Enemies DB (stats keyed by id). Fine if missing; scene can still run with defaults.
let enemiesDB = {};
try {
  const mod = await import('../data/enemies.js');
  enemiesDB = (mod && (mod.default || mod.enemies)) || {};
} catch (_) {}

function buildPlayerActorFromState() {
  const p = state.player || {};
  const vitals = p.vitals || {};
  const derived = p.derived || {};
  const combat = p.combat || {};
  const equip = (p.equipment || {});
  const mainHand = (equip.weapons && equip.weapons[0]) || equip.mainHand || {};

  return {
    kind: 'pc',
    id: p.id || 'PC',
    name: p.name || 'Aya',
    ac: (typeof p.ac === 'number' ? p.ac : (derived.ac && (derived.ac.total ?? derived.ac))) ?? 10,
    hp: (typeof p.hp === 'number' ? p.hp : vitals.hp),
    maxHp: (typeof p.maxHp === 'number' ? p.maxHp : vitals.maxHp),
    attackBonus: (typeof p.attackBonus === 'number' ? p.attackBonus : (combat.attackBonusBase ?? combat.attack ?? 0)),
    damage: mainHand.damage || p.damage || '1d8+2',
    weapon: mainHand.key || mainHand.name || p.weapon || 'weapon',
    inventory: p.inventory || [],
    distanceFromPC: 0,
    dexMod: p.dexMod ?? (derived.abilityMods && derived.abilityMods.dex) ?? 0
  };
}

function buildEnemyActor(part, idx) {
  const key = part.enemyKey || part.id || 'goblin';
  const bp = enemiesDB[key] || {};
  return {
    kind: 'npc',
    id: part.enemyId || `${key}_${idx}`,
    name: bp.name || key.replace(/_/g, ' '),
    ac: bp.ac ?? part.ac ?? 12,
    hp: bp.hp ?? part.hp ?? 7,
    maxHp: (bp.hp ?? part.hp ?? 7),
    attackBonus: bp.attackBonus ?? part.attackBonus ?? 3,
    damage: bp.damage ?? part.damage ?? '1d6+1',
    weapon: bp.weapon || part.weapon || 'scimitar',
    distanceFromPC: part.distanceFromPC ?? 5,
    dexMod: part.dexMod ?? 0
  };
}

export async function startCombat(encounterId) {
  // 1) Resolve encounter definition
  let enc = encountersTable[encounterId];
  if (!enc) {
    // try area-scoped module: ../areas/<area>/encounters/<encounterId>.js
    // For now, dockside is our testbed; expand later to use a registry map.
    try {
      const mod = await import(`../areas/00_dockside/encounters/${encounterId}.js`);
      enc = mod && (mod.default || mod);
    } catch (_) {}
  }
  if (!enc) {
    logSystem(`[combatLoader] Unknown encounter '${encounterId}', using fallback.`);
    enc = {
      title: 'Skirmish',
      returnAreaId: '00_dockside',
      participants: [
        { role: 'pc', ref: 'player' },
        { role: 'npc', enemyKey: 'goblin', enemyId: 'goblin_a', distanceFromPC: 5 },
        { role: 'npc', enemyKey: 'goblin', enemyId: 'goblin_b', distanceFromPC: 5 }
      ],
      triggers: [
        { type: 'spawn', at: 'roundStart', round: 2,
          actor: { role:'npc', enemyKey: 'goblin_intern', enemyId: 'intern', distanceFromPC: 30 },
          announceAtEndOfPrev: true, announceText: 'A Goblin Intern rushes in!' }
      ]
    };
  }

  // 2) Build actors[] (PC + NPCs) from canonical state + enemiesDB
  const actors = [];
  const parts = enc.participants || [];
  if (parts.length === 0) {
    // safe default
    parts.push({ role: 'pc', ref: 'player' },
               { role: 'npc', enemyKey: 'goblin', enemyId: 'goblin_a', distanceFromPC: 5 },
               { role: 'npc', enemyKey: 'goblin', enemyId: 'goblin_b', distanceFromPC: 5 });
  }
  let npcIdx = 0;
  for (const part of parts) {
    if (part.role === 'pc') {
      actors.push(buildPlayerActorFromState());
    } else if (part.role === 'npc') {
      actors.push(buildEnemyActor(part, npcIdx++));
    }
  }

  // 3) Seed state.combat with the unified contract
  state.combat = {
    title: enc.title || 'Combat',
    returnAreaId: enc.returnAreaId || '00_dockside',
    encounterId,
    triggers: enc.triggers || [],
    actors,           // canonical list for the scene
    round: 1,
    turnIdx: 0
  };

  // 4) Hand off to the scene
  sceneManager.replace(CombatScene, { fromLoader: true });
}
