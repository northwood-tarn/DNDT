/* --------------------------------------------------------------------------
   AREA TEMPLATE (copy/paste to add a new gameplay area)
   --------------------------------------------------------------------------

   {
     id: "AREA_ID",
     name: "Readable Area Name",

     // Economy + rewards
     goldMultiplier: 1.0,       // e.g. 1.2 boosts gold, 0.8 reduces it
     xpMultiplier: 1.0,         // same idea for XP rewards

     // Encounter tuning
     encounterBias: null,       // e.g. "maritime", "undead", "forest", etc.

     // Environment (systems-facing)
     lighting: null,            // e.g. "dark", "dim", "day", "shadowed"
     difficulty: "normal",      // "trivial" | "low" | "normal" | "high" | "deadly"

     // Rest / pacing modifiers
     restPenalty: 1.0,          // <1 = easier rest, >1 = harder rest
     restSafety: "neutral",     // "safe" | "unsafe" | "dangerous"

     // Optional: region tags, planar bleed, kingdom, chapter grouping
     tag: null
   },

-------------------------------------------------------------------------- */


/* --------------------------------------------------------------------------
   EXAMPLE AREA (for reference only)
   --------------------------------------------------------------------------

   {
     id: "dockside",
     name: "Dockside (Night Rain)",

     goldMultiplier: 1.2,
     xpMultiplier: 1.0,

     encounterBias: "maritime",

     lighting: "dark",
     difficulty: "low",

     restPenalty: 0.8,
     restSafety: "unsafe",

     tag: "quardas_coast"
   },

-------------------------------------------------------------------------- */


// ==========================================================================
// ACTUAL GAMEPLAY AREA DEFINITIONS
// ==========================================================================

export const AREA_DATA = {

  // -----------------------------------------------------------------------
  // DOCKSIDE (your starting scene)
  // -----------------------------------------------------------------------
  dockside: {
    id: "dockside",
    name: "Dockside (Night Rain)",

    goldMultiplier: 1.2,
    xpMultiplier: 1.0,

    encounterBias: "maritime",

    lighting: "dark",
    difficulty: "low",

    restPenalty: 0.8,
    restSafety: "unsafe",

    tag: "quardas_coast"
  },


  // -----------------------------------------------------------------------
  // ENTRY HALL (from your Ink example)
  // -----------------------------------------------------------------------
  entry_hall: {
    id: "entry_hall",
    name: "Entry Hall",

    goldMultiplier: 1.0,
    xpMultiplier: 1.0,

    encounterBias: "ruins",

    lighting: "dim",
    difficulty: "normal",

    restPenalty: 1.0,
    restSafety: "neutral",

    tag: "old_city"
  },


  // -----------------------------------------------------------------------
  // OSSUARY
  // -----------------------------------------------------------------------
  ossuary: {
    id: "ossuary",
    name: "The Ossuary",

    goldMultiplier: 0.9,
    xpMultiplier: 1.2,

    encounterBias: "undead",

    lighting: "dark",
    difficulty: "medium",

    restPenalty: 1.2,
    restSafety: "unsafe",

    tag: "old_city"
  },


  // -----------------------------------------------------------------------
  // GUARD GATE
  // -----------------------------------------------------------------------
  guard_gate: {
    id: "guard_gate",
    name: "Guard Gate",

    goldMultiplier: 1.0,
    xpMultiplier: 1.0,

    encounterBias: "guarded",

    lighting: "dim",
    difficulty: "medium",

    restPenalty: 1.1,
    restSafety: "unsafe",

    tag: "old_city"
  },


  // -----------------------------------------------------------------------
  // TOMB NEXUS
  // -----------------------------------------------------------------------
  tomb_nexus: {
    id: "tomb_nexus",
    name: "Tomb Nexus",

    goldMultiplier: 1.1,
    xpMultiplier: 1.2,

    encounterBias: "ancient",

    lighting: "dark",
    difficulty: "high",

    restPenalty: 1.3,
    restSafety: "dangerous",

    tag: "old_city_depths"
  },


  // -----------------------------------------------------------------------
  // LIGHTWELL
  // -----------------------------------------------------------------------
  lightwell: {
    id: "lightwell",
    name: "The Lightwell",

    goldMultiplier: 1.0,
    xpMultiplier: 1.1,

    encounterBias: "eldritch",

    lighting: "low-light",
    difficulty: "medium",

    restPenalty: 1.0,
    restSafety: "neutral",

    tag: "old_city_depths"
  }

};


// Handy accessor
export function getAreaData(id) {
  return AREA_DATA[id] || null;
}