
export const classFeatures = {
  Fighter: {
    5: [{ feature: "Extra Attack", note: "When you take the Attack action, you can make two attacks." }]
  },

  Paladin: {
    5: [{ feature: "Extra Attack", note: "When you take the Attack action, you can make two attacks." }],
    6: [
      {
        feature: "Aura Manifestation",
        note: "Unlock aura system. You can maintain one aura mode at a time.",
        config: {
          type: "aura_core",
          stacking: "exclusive",
          switchPolicy: { inCombat: "oncePerTurn", outOfCombat: "free" },
          defaultRadiusFeet: 10
        }
      },
      {
        feature: "Aura of Protection",
        note: "Self: add CHA to saving throws. Enemies in your aura take a small penalty to saves vs your effects.",
        config: {
          type: "aura",
          mode: "protection",
          radiusFeet: 10,
          selfBuff: { saveBonusAll: "CHA_mod" },
          enemyDebuff: { savePenaltyVsYourEffects: -1 }
        }
      }
    ],
    7: [
      {
        feature: "Sanctified Presence",
        condition: { subclass: "Sacred" },
        note: "Self: advantage on saves vs charm/fear. Enemies: disadvantage on saves vs your charm/fear effects.",
        config: {
          type: "aura",
          mode: "sanctified_presence",
          radiusFeet: 10,
          selfBuff: { advantageOnSaves: ["charm", "fear"] },
          enemyDebuff: { disadvantageOnSavesVsYourTags: ["charm", "fear"] }
        }
      },
      {
        feature: "Aura of Alacrity",
        condition: { subclass: "Glory" },
        note: "Self: +10 ft speed. Enemies: -10 ft speed while in your aura.",
        config: {
          type: "aura",
          mode: "alacrity",
          radiusFeet: 10,
          selfBuff: { speedBonus: 10 },
          enemyDebuff: { speedPenalty: 10 }
        }
      },
      {
        feature: "Aura of Pursuit",
        condition: { subclass: "Vengeance" },
        note: "Self: +10 ft speed when moving toward your Vow target. Enemies (not your Vow target): -2 to opportunity attack rolls against you.",
        config: {
          type: "aura",
          mode: "pursuit",
          radiusFeet: 10,
          selfBuff: { speedBonusTowardVowTarget: 10 },
          enemyDebuff: { aooPenaltyVsYou: -2, excludeTarget: "Vow" }
        }
      }
    ],
    10: [{
      feature: "Aura of Courage",
      note: "Self: immune to frightened. Enemies: disadvantage on saving throws against your fear effects.",
      config: {
        type: "aura",
        mode: "courage",
        radiusFeet: 10,
        selfBuff: { immuneTo: ["frightened"] },
        enemyDebuff: { disadvantageOnSavesVsYourTags: ["fear"] }
      }
    }]
  },

  Warlock: {
    4: [{
      feature: "Spiral of Retribution",
      note: "Once per long rest, after you have been hit 3+ times since your last turn, lash out with patron power as a reaction, dealing force damage that scales with proficiency and additional hits.",
      config: {
        type: "patron_eruption",
        uses: "longRest:1",
        trigger: "on_being_hit_after_warmup",
        warmupHits: 3,
        baseDicePerProficiency: "1d6",
        bankPerAdditionalHit: "1d6",
        maxBankDice: null,
        damageType: "force",
        rangeFeet: 60,
        consumesAllBanked: true,
        oncePerRound: true
      }
    }],
    5: [{ feature: "Extra Attack", condition: { pact: "Blade" }, note: "When you take the Attack action with your pact weapon, you can make two attacks." }],
    11: [{
      feature: "Mystic Arcanum",
      note: "Choose one 6th-level spell as an Arcanum. Cast it once per long rest without expending a slot.",
      config: { type: "mystic_arcanum", uses: "longRest:1", noSlot: true,
        spellChoices: ["circle_of_death","investiture_of_the_patron","mental_prison","disintegrate"] }
    }]
  }
};


// ---------- Helpers ----------

export function hasExtraAttackAt5(actor) {
  const cls = actor.class;
  const lvl = actor.level || 1;
  if (!cls || lvl < 5) return false;

  const entries = classFeatures[cls]?.[5] || [];
  for (const e of entries) {
    if (e.feature !== "Extra Attack") continue;
    const cond = e.condition;
    if (!cond) return true;
    // Conditional grant: Pact of the Blade
    if (cond.pact && String(actor.pact || "").toLowerCase() === String(cond.pact).toLowerCase()) return true;
    if (cond.subclass && String(actor.subclass || "").toLowerCase() === String(cond.subclass).toLowerCase()) return true;
  }
  return false;
}

// Returns aura policy (stacking/switch rules/radius defaults)
export function getAuraCorePolicy() {
  const core = (classFeatures.Paladin?.[6] || []).find(e => e.config?.type === "aura_core");
  return core?.config || { type: "aura_core", stacking: "exclusive", switchPolicy: { inCombat: "oncePerTurn", outOfCombat: "free" }, defaultRadiusFeet: 10 };
}

// Returns all aura feature entries the actor qualifies for by level/subclass
export function listPaladinAuras(actor) {
  const lvl = actor.level || 1;
  const subclass = String(actor.subclass || "").toLowerCase();
  const feats = classFeatures.Paladin || {};
  const out = [];
  for (const key of Object.keys(feats)) {
    const req = Number(key);
    if (Number.isNaN(req) || lvl < req) continue;
    for (const entry of feats[req]) {
      if (entry.config?.type !== "aura") continue;
      const cond = entry.condition;
      if (cond?.subclass && String(cond.subclass).toLowerCase() != subclass) continue;
      out.push(entry);
    }
  }
  return out;
}

// Convenience: Return a single aura entry by mode string ("protection", "courage", "pursuit", etc.), or null.
export function getPaladinAuraByMode(actor, mode) {
  const auras = listPaladinAuras(actor);
  return auras.find(a => a.config?.mode === mode) || null;
}

// Spear-of-Retribution access
export function getSpearOfRetributionConfig() {
  const wl = classFeatures.Warlock?.[4] || [];
  const wle = wl.find(e => e.feature === "Spiral of Retribution");
  if (wle) return wle.config || null;
  const pal = classFeatures.Paladin?.[3] || [];
  const entry = pal.find(e => e.feature === "Spear of Retribution");
  return entry?.config || null;
}

export default classFeatures;
