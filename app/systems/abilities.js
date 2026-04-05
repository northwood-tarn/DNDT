// app/systems/abilities.js
// Central place to derive ability scores/modifiers and roll components.
//
// Philosophy
// ----------
// - Store only *base* ability scores on the actor (e.g., STR/DEX/CON/INT/WIS/CHA).
// - Store all temporary/permanent changes as *effects* on the actor/state.
// - Derive modifiers (and advantage/disadvantage) on demand from base + effects.
// - Provide a tiny cache (version-based) so repeated queries in a single frame are cheap.
//
// Data shapes
// -----------
// Actor (minimal):
//   actor.abilities = { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }
//   actor.revision (optional, bump when base changes)
// Effects (on actor):
//   state.effects[actorId] = [
//     { key: 'belt-cloud-giant-strength', when: 'always',
//       applies: [{ stat: 'str', op: 'setScore', value: 29 }] },
//     { key: 'hexed', when: 'combat', duration: { rounds: 10 },
//       applies: [{ stat: 'strChecks', op: 'disadv' }] },
//     { key: 'bless', concentration: true, applies: [{ roll: 'attack', op: 'addDie', value: '1d4' }]},
//     { key: 'alert', feat: true, applies: [{ roll: 'initiative', op: 'add', value: 5 }]},
//   ]
//
// Supported ops
// -------------
// - setScore (sets the final ability *score*)
// - addScore (adds to the ability *score*)
// - add (adds to the *modifier* for a named roll or ability checks/saves)
// - mult (multiplies the modifier; rare, but present in some effects)
// - max/min (clamp a final modifier)
// - adv / disadv (advantage/disadvantage flags on specific rolls)
// - addDie (e.g., Bless to attacks/saves) — the caller can include this in text; we preserve it.
//
// Public API
// ----------
// scoreToMod(score): classic 5e modifier from a score
// getAbilityScore(actor, ability, state): derived final score (after setScore/addScore)
// getAbilityMod(actor, ability, state): derived final modifier
// getRollComponents(actor, rollType, ability, state): { mod, adv: -1|0|1, bonus: number, addDie: [] }
//   - rollType: 'check' | 'save' | 'attack' | 'initiative'
//   - ability: 'str'|'dex'|'con'|'int'|'wis'|'cha' (optional for some roll types)
// getInitiativeComponents(actor, state): sugar for initiative
//
// Notes
// -----
// - We compute on demand each call. If needed later, add memoization keyed by (actor.revision, effects.revision).
//

export function scoreToMod(score){
  if (typeof score !== 'number') return 0;
  return Math.floor((score - 10) / 2);
}

function listEffects(state, actorId){
  const all = (state && state.effects && state.effects[actorId]) || [];
  // Filter by context if needed; for now return all.
  return all;
}

function deriveScore(baseScore, effectsForAbility){
  // Apply setScore (highest wins), then addScore (sum)
  let setTo = null;
  let add = 0;
  for (const e of effectsForAbility){
    if (e.op === 'setScore'){
      setTo = (setTo == null) ? e.value : Math.max(setTo, e.value);
    } else if (e.op === 'addScore'){
      add += (e.value || 0);
    }
  }
  const s = (setTo != null ? setTo : baseScore) + add;
  return s;
}

export function getAbilityScore(actor, ability, state){
  const base = (actor.abilities && typeof actor.abilities[ability] === 'number')
    ? actor.abilities[ability] : 10;
  const effects = listEffects(state, actor.id).flatMap(e =>
    (e.applies || []).filter(a => a.stat === ability && (a.op === 'setScore' || a.op === 'addScore'))
  );
  return deriveScore(base, effects);
}

export function getAbilityMod(actor, ability, state){
  return scoreToMod(getAbilityScore(actor, ability, state));
}

export function getRollComponents(actor, rollType, ability, state){
  // Base modifier: either the ability modifier (checks/saves/initiative) or 0 for generic rolls.
  let mod = 0;
  if (rollType === 'check' || rollType === 'save' || rollType === 'initiative'){
    mod = getAbilityMod(actor, ability || (rollType === 'initiative' ? 'dex' : null), state);
  }
  let adv = 0;
  let bonus = 0;
  const addDie = [];
  const eff = listEffects(state, actor.id);

  for (const e of eff){
    for (const a of (e.applies || [])){
      // Targeting rules
      const appliesToThisRoll =
        (a.roll && a.roll === rollType) ||
        (a.stat && ability && a.stat === ability + (rollType === 'check' ? 'Checks' : (rollType === 'save' ? 'Saves' : ''))) ||
        (a.stat && a.stat === (rollType === 'initiative' ? 'initiative' : ''));

      if (!appliesToThisRoll) continue;

      switch (a.op){
        case 'add': bonus += (a.value || 0); break;
        case 'mult': mod *= (a.value || 1); break;
        case 'max': mod = Math.min(mod, a.value); break;
        case 'min': mod = Math.max(mod, a.value); break;
        case 'adv': adv = Math.max(adv, 1); break;
        case 'disadv': adv = Math.min(adv, -1); break;
        case 'addDie': if (a.value) addDie.push(String(a.value)); break;
        default: break;
      }
    }
  }

  return { mod, adv, bonus, addDie };
}

export function getInitiativeComponents(actor, state){
  return getRollComponents(actor, 'initiative', 'dex', state);
}
