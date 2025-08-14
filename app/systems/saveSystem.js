// app/systems/saveSystem.js — Browser-safe (IPC + localStorage fallback)
const SLOTS = {
  autosave: 'autosave',
  emberRest: 'ember',
  preCombat: 'preCombat',
  quickSave: 'quick'
};

function hasAPI(){ return typeof window !== 'undefined' && window.api && typeof window.api.saveGame === 'function'; }

function makePayload(player){
  const inferredSceneKey = player.lastSceneKey || 'ExplorationScene_Forest';
  const inferredSceneLabel = player.sceneLabel || 'at the forest\'s edge';
  return {
    ...player,
    lastSceneKey: inferredSceneKey,
    sceneLabel: inferredSceneLabel,
  };
}

export async function savePlayer(player, slot = 'emberRest'){
  const slotId = SLOTS[slot] || SLOTS.emberRest;
  const name = player.name || 'Adventurer';
  const payload = makePayload(player);

  if (hasAPI()){
    await window.api.saveGame({ name, slot: slotId, data: payload });
    return true;
  } else {
    const key = `${name}_${slotId}`;
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  }
}

export async function loadPlayer(createPlayerFn, name, slot = 'emberRest'){
  const slotId = SLOTS[slot] || SLOTS.emberRest;

  let data = null;
  if (hasAPI()){
    data = await window.api.loadGame({ name, slot: slotId });
  } else {
    const key = `${name}_${slotId}`;
    const json = localStorage.getItem(key);
    data = json ? JSON.parse(json) : null;
  }
  if (!data) return null;

  const player = createPlayerFn(data);
  player.lastSceneKey = data.lastSceneKey || 'ExplorationScene_Fallback';
  player.sceneLabel  = data.sceneLabel  || 'Unknown Location';
  return player;
}

export async function clearSave(name, slot = 'emberRest'){
  const slotId = SLOTS[slot] || SLOTS.emberRest;
  if (hasAPI()){
    await window.api.clearGame({ name, slot: slotId });
  } else {
    const key = `${name}_${slotId}`;
    localStorage.removeItem(key);
  }
}

export async function getCharacterSaveKeys(name){
  return {
    ember: `${name}_${SLOTS.emberRest}`,
    preCombat: `${name}_${SLOTS.preCombat}`,
    quick: `${name}_${SLOTS.quickSave}`
  };
}

export async function getAvailableSaves(){
  if (hasAPI()){
    return await window.api.listSaves();
  } else {
    const saves = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const match = key.match(/^(.+?)_(ember|preCombat|quick|autosave)$/);
      if (match) {
        const [_, name, slot] = match;
        if (!saves[name]) saves[name] = {};
        try {
          const json = localStorage.getItem(key);
          const data = JSON.parse(json);
          saves[name][slot] = {
            lastSceneKey: data.lastSceneKey || 'ExplorationScene_Fallback',
            sceneLabel: data.sceneLabel || 'Unknown Location'
          };
        } catch {
          saves[name][slot] = { lastSceneKey: 'ExplorationScene_Fallback', sceneLabel: 'Unknown' };
        }
      }
    }
    return saves;
  }
}
