
import { isTwoHanded, isShield, isArmor, isWeapon } from "../utils/logic.js";
import { battlesRequiredForLevel, getClassFeaturesForLevel } from "../utils/progressionRules.js";
import { weapons } from "../data/weapons.js";
import { armor } from "../data/armor.js";
import { consumables } from "../data/consumables.js";

function resolveItem(name) {
  return weapons[name] || armor[name] || consumables[name] || { name, type: "unknown" };
}

function resolveItems(list) {
  return list.map(resolveItem);
}

function applyChoiceEffects(config, player) {
  if (!config.selectedChoices) return;
  config.selectedChoices.forEach(effect => {
    if (effect.features) {
      player.features.push(...effect.features);
    }
    if (effect.spells) {
      player.knownSpells.push(...effect.spells);
    }
  });
}

function resolveEquipment(equip) {
  return {
    weapon: equip.weapon ? resolveItem(equip.weapon) : null,
    armor: equip.armor ? resolveItem(equip.armor) : null
  };
}

export function createPlayer(config) {
  const player = {
    id: config.id || null,
    name: config.name,
    classId: config.classId,
    class: config.class,
    level: 1,
    xp: 0,
    hp: config.hp || 10,
    maxHp: config.hp || 10,
    spellSlots: {},
    inventory: resolveItems(config.inventory || []),
    equipped: resolveEquipment(config.equipped || {}),
    knownSpells: config.knownSpells || [],
    features: config.features || [],
    battlesWonThisLevel: 0,
    sorceryPoints: config.class === "Sorcerer" ? 1 : 0,
    metamagic: config.class === "Sorcerer" ? config.metamagic || null : null,
    metamagicPassive: config.class === "Sorcerer" ? ["Subtle", "Careful"] : [],

    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      console.log(`${this.name} takes ${amount} damage (HP: ${this.hp}/${this.maxHp})`);
    },

    heal(amount) {
      this.hp = Math.min(this.maxHp, this.hp + amount);
      console.log(`${this.name} heals ${amount} HP (HP: ${this.hp}/${this.maxHp})`);
    },

    longRest() {
      this.hp = this.maxHp;
      if (this.class === "Sorcerer") this.sorceryPoints = this.level;
      console.log(`${this.name} has taken a long rest.`);
    },

    registerBattleVictory() {
      this.battlesWonThisLevel += 1;
      console.log(`${this.name} has won ${this.battlesWonThisLevel} battles at level ${this.level}`);
    },

    levelUp() {
      import("../utils/progressionRules.js").then(({ battlesRequiredForLevel, getClassFeaturesForLevel }) => {
        const required = battlesRequiredForLevel(this.level);
        if (this.battlesWonThisLevel >= required) {
          this.level += 1;
          this.maxHp += 5;
          this.hp = this.maxHp;
          this.battlesWonThisLevel = 0;
          if (this.class === "Sorcerer") this.sorceryPoints = this.level;
          const newFeatures = getClassFeaturesForLevel(this.class, this.level);
          this.features.push(...newFeatures);
          console.log(`${this.name} has reached level ${this.level}!`);
        } else {
          console.log(`${this.name} is not eligible to level up.`);
        }
      });
    },

    equipItem(item) {
      if (isArmor(item)) {
        this.equipped.armor = item;
      } else if (isShield(item)) {
        this.equipped.offhand = item;
      } else if (isWeapon(item)) {
        if (isTwoHanded(item)) {
          this.equipped.weapon = item;
          this.equipped.offhand = null;
        } else if (!this.equipped.weapon) {
          this.equipped.weapon = item;
        } else {
          this.equipped.offhand = item;
        }
      }
      console.log(`${this.name} equips ${item.name}`);
    },

    addItem(item) {
      this.inventory.push(item);
      console.log(`${item.name} added to inventory.`);
    },

    useItem(item) {
      if (item.type === "potion" && item.effect?.includes("HP")) {
        const match = item.effect.match(/(\d+)d(\d+) \+ (\d+)/);
        if (match) {
          const [, count, sides, bonus] = match.map(Number);
          const roll = Array.from({ length: count }, () => Math.ceil(Math.random() * sides)).reduce((a, b) => a + b, 0);
          const healAmount = roll + bonus;
          this.heal(healAmount);
        }
      }

      if (item.uses === 1) {
        this.inventory = this.inventory.filter(i => i !== item);
      }
    },

    toJSON() {
      return {
        id: this.id,
        name: this.name,
        classId: this.classId,
        class: this.class,
        level: this.level,
        xp: this.xp,
        hp: this.hp,
        maxHp: this.maxHp,
        spellSlots: this.spellSlots,
        inventory: this.inventory,
        equipped: this.equipped,
        knownSpells: this.knownSpells,
        features: this.features,
        battlesWonThisLevel: this.battlesWonThisLevel,
        sorceryPoints: this.sorceryPoints,
        metamagic: this.metamagic,
        metamagicPassive: this.metamagicPassive
      };
    }
  };

  applyChoiceEffects(config, player);
  return player;
}
