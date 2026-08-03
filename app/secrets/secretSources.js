import { acquireSecretClue, isSecretClueAvailable } from "./secretState.js";

export function findClueAtSource(definitions, source) {
  return (definitions || []).flatMap((secret) => secret.clues.map((clue) => ({ secret, clue }))).filter(({ clue }) => sameSource(clue.source, source));
}

export function acquireCluesAtSource(saveGame, definitions, source, options = {}) {
  let save = saveGame;
  const events = [];
  for (const { secret, clue } of findClueAtSource(definitions, source)) {
    if (!isSecretClueAvailable(save, secret, clue.id)) continue;
    const acquired = acquireSecretClue(save, secret, clue.id, options);
    save = acquired.saveGame;
    events.push(...acquired.events);
  }
  return { saveGame: save, events };
}

export function isSourceClueAvailable(saveGame, definitions, source) {
  return findClueAtSource(definitions, source).some(({ secret, clue }) => isSecretClueAvailable(saveGame, secret, clue.id));
}

function sameSource(left, right) {
  if (!left || !right || left.type !== right.type || left.id !== right.id) return false;
  return left.type !== "node" || left.mapId === right.mapId;
}
