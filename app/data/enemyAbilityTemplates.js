export const ENEMY_ABILITY_TEMPLATES = {
  weapon_attack: {
    id: "weapon_attack",
    kind: "weapon_attack",
    required: ["weaponId"],
  },
  natural_attack: {
    id: "natural_attack",
    kind: "natural_attack",
    required: ["naturalAttackId", "name", "damage", "damageType"],
  },
  bonus_dash: {
    id: "bonus_dash",
    kind: "feature_action",
    actionKind: "dash",
    actionType: "bonus_action",
    requiresTarget: false,
  },
  spell_action: {
    id: "spell_action",
    kind: "spell_action",
    required: ["spellId"],
  },
  self_heal: {
    id: "self_heal",
    kind: "self_heal",
    required: ["healing"],
  },
};

export function getEnemyAbilityTemplate(id) {
  return ENEMY_ABILITY_TEMPLATES[id] || null;
}

export function enemyAbilityTemplateIds() {
  return Object.keys(ENEMY_ABILITY_TEMPLATES);
}
