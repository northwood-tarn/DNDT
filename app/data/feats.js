// app/data/feats.js
// Origin Feats (CC SRD aligned). Kept concise for our prototype.
// We use simple, readable effects that integrate with our text-mode shell.

export const ORIGIN_FEATS = [
  {
    id: "alert",
    name: "Alert (Origin)",
    description: "Ever watchful; gain +5 to initiative.",
    apply(p) {
      p.initiativeBonus = (p.initiativeBonus || 0) + 5;
      p.notes = [...(p.notes||[]), "+5 initiative (Alert)"];
    }
  },
  {
    id: "savage_attacker",
    name: "Savage Attacker (Origin)",
    description: "On your turn, you may reroll one weapon damage die (keep the new result).",
    apply(p) {
      p.notes = [...(p.notes||[]), "Savage Attacker: reroll 1 damage die once/turn"];
    }
  },
  {
    id: "skilled",
    name: "Skilled (Origin)",
    description: "Gain proficiency in three skills of your choice.",
    apply(p) {
      if (!p.proficiencies) p.proficiencies = { skills: [] };
      const picks = p.__featPicks?.skilled ?? ["Perception","Insight","Stealth"];
      picks.forEach(skill => {
        if (!p.proficiencies.skills.includes(skill)) {
          p.proficiencies.skills.push(skill);
        }
      });
      p.notes = [...(p.notes||[]), "Skilled: +3 skill proficiencies"];
    }
  },
  // --- Three new, first-level-appropriate origin feats for this campaign shell ---
  {
    id: "pathfinder",
    name: "Pathfinder (Origin)",
    description: "You read the land by scent and echo; gain Survival proficiency and a small overland navigation edge.",
    apply(p) {
      if (!p.proficiencies) p.proficiencies = { skills: [] };
      if (!p.proficiencies.skills.includes("Survival")) p.proficiencies.skills.push("Survival");
      p.travelBonus = (p.travelBonus || 0) + 1; // used by exploration phase (ASCII map pacing)
      p.notes = [...(p.notes||[]), "Pathfinder: Survival proficiency; +1 travel pacing"];
    }
  },
  {
    id: "torchbearer",
    name: "Torchbearer (Origin)",
    description: "You keep the flame; start with extra torches and see better by emberlight.",
    apply(p) {
      p.inventory = p.inventory || [];
      p.inventory.push({ id:"torch", name:"Torch", type:"light" });
      p.inventory.push({ id:"torch", name:"Torch", type:"light" });
      p.inventory.push({ id:"torch", name:"Torch", type:"light" });
      p.lightRadiusBonus = (p.lightRadiusBonus || 0) + 1; // used by visibility calc
      p.notes = [...(p.notes||[]), "Torchbearer: +3 Torches; +1 light radius"];
    }
  },
  {
    id: "silver_tongue",
    name: "Silver Tongue (Origin)",
    description: "Your words carry weight; gain Persuasion proficiency and a small bonus to parley.",
    apply(p) {
      if (!p.proficiencies) p.proficiencies = { skills: [] };
      if (!p.proficiencies.skills.includes("Persuasion")) p.proficiencies.skills.push("Persuasion");
      p.parleyBonus = (p.parleyBonus || 0) + 2;
      p.notes = [...(p.notes||[]), "Silver Tongue: Persuasion proficiency; +2 parley"];
    }
  },

  // --- NEW: Background/Origin feats now available ---
  {
    id: "tavern_brawler",
    name: "Tavern Brawler",
    description: "You’ve trained to fight with whatever is at hand. Unarmed strikes deal 1d4; you’re proficient with improvised weapons; you gain a small edge to initiate a grapple after a hit.",
    apply(p) {
      p.combat = p.combat || {};
      p.combat.unarmedDie = "1d4";
      p.combat.improvisedWeaponProficient = true;
      p.combat.grappleEdge = Math.max(1, p.combat.grappleEdge || 1);
      p.notes = [...(p.notes||[]), "Tavern Brawler: unarmed 1d4, improvised proficient, +edge to grapple after a hit"];
    }
  },
  {
    id: "skulker",
    name: "Skulker",
    description: "You are hard to pin down in the shadows. Dim light doesn’t impose disadvantage on your Stealth checks, and missing with a ranged attack doesn’t reveal you.",
    apply(p) {
      p.stealthPerks = p.stealthPerks || {};
      p.stealthPerks.dimLightNoDisadvantage = true;
      p.stealthPerks.remainHiddenOnMiss = true;
      p.notes = [...(p.notes||[]), "Skulker: no disadvantage in dim light; stay hidden on a missed ranged attack"];
    }
  },
  {
    id: "magic_initiate_cleric",
    name: "Magic Initiate (Cleric)",
    description: "You learn the clerical arts. You know the cantrips Guidance and Sacred Flame, and you can cast Cure Wounds once per long rest (without a slot).",
    apply(p) {
      p.spells = p.spells || { known: [], perDay: {} };
      const addKnown = (id) => { if (!p.spells.known.includes(id)) p.spells.known.push(id); };
      addKnown("guidance");
      addKnown("sacred_flame");
      p.spells.perDay["cure_wounds"] = p.spells.perDay["cure_wounds"] || { perDay: 1, used: 0, refresh: "long_rest" };
      p.notes = [...(p.notes||[]), "Magic Initiate (Cleric): Guidance, Sacred Flame; Cure Wounds 1/day"];
    }
  },
  {
    id: "magic_initiate_wizard",
    name: "Magic Initiate (Wizard)",
    description: "You dabble in arcana. You know the cantrips Mage Hand and Fire Bolt, and you can cast Magic Missile once per long rest (without a slot).",
    apply(p) {
      p.spells = p.spells || { known: [], perDay: {} };
      const addKnown = (id) => { if (!p.spells.known.includes(id)) p.spells.known.push(id); };
      addKnown("mage_hand");
      addKnown("fire_bolt");
      p.spells.perDay["magic_missile"] = p.spells.perDay["magic_missile"] || { perDay: 1, used: 0, refresh: "long_rest" };
      p.notes = [...(p.notes||[]), "Magic Initiate (Wizard): Mage Hand, Fire Bolt; Magic Missile 1/day"];
    }
  }
];

export function getFeatById(id) {
  return ORIGIN_FEATS.find(f => f.id === id) || null;
}
