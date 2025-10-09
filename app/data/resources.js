// app/data/resources.js
// Central registry for per-class and subclass resource pools.

export const resources = {
  sharedPools: {
    Cleric: {
      ChannelDivinity: {
        progression: [
          { min: 2, max: 5, uses: 1 },
          { min: 6, max: 14, uses: 2 }
        ],
        resets: "shortRest"
      }
    }
  },
  subclassPools: {
    Fighter: {
      Berserker: {
        Rage: {
          progression: [
            { min: 3, max: 14, uses: 3 }
          ],
          resets: "longRest"
        }
      }
    }
  }
};

function lookupProgression(prog, level) {
  if (!Array.isArray(prog)) return 0;
  for (const bracket of prog) {
    const min = bracket.min ?? 0;
    const max = (bracket.max === undefined || bracket.max === null) ? Infinity : bracket.max;
    if (level >= min && level <= max) return bracket.uses ?? 0;
  }
  const last = prog[prog.length - 1];
  if (last && (last.max === undefined || last.max === null) && level >= (last.min ?? 0)) {
    return last.uses ?? 0;
  }
  return 0;
}

export function getResourceUses({ className, level, resource, subclassName }) {
  const bySubclass = resources.subclassPools?.[className]?.[subclassName]?.[resource];
  if (bySubclass) return lookupProgression(bySubclass.progression, level);

  const byClass = resources.sharedPools?.[className]?.[resource];
  if (byClass) return lookupProgression(byClass.progression, level);

  return 0;
}

export function listResourcesFor({ className, level, subclassName }) {
  const out = [];
  const subs = resources.subclassPools?.[className]?.[subclassName] || {};
  for (const [resource, def] of Object.entries(subs)) {
    out.push({ resource, uses: lookupProgression(def.progression, level), resets: def.resets || "none" });
  }
  const shared = resources.sharedPools?.[className] || {};
  for (const [resource, def] of Object.entries(shared)) {
    if (subs[resource]) continue;
    out.push({ resource, uses: lookupProgression(def.progression, level), resets: def.resets || "none" });
  }
  return out;
}

export default resources;
