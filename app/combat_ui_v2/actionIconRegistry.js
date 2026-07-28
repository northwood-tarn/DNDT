const ICON_ROOT = new URL("./icons/trial/", import.meta.url);

const ICONS = Object.freeze({
  shortsword: "../weapons/shortsword.png",
  piercing_shortsword: "../weapons/shortsword.png",
  longsword: "../weapons/longsword.png",
  flaming_longsword: "../weapons/longsword.png",
  greatsword: "../weapons/greatsword.png",
  greatsword_of_wounding: "../weapons/greatsword.png",
  maul: "../weapons/maul.png",
  glaive: "../weapons/glaive.png",
  dagger: "../weapons/dagger.png",
  venomous_dagger: "../weapons/dagger.png",
  battleaxe: "../weapons/battleaxe.png",
  battleaxe_of_fury: "../weapons/battleaxe.png",
  warhammer: "../weapons/warhammer.png",
  thunder_hammer: "../weapons/warhammer.png",
  quarterstaff: "../weapons/quarterstaff.png",
  blessed_quarterstaff: "../weapons/quarterstaff.png",
  rapier: "../weapons/rapier.png",
  frost_brand_rapier: "../weapons/rapier.png",
  scimitar: "../weapons/scimitar.png",
  shocking_scimitar: "../weapons/scimitar.png",
  handaxe: "../weapons/handaxe.png",
  exploding_handaxe: "../weapons/handaxe.png",
  longbow: "../weapons/longbow.png",
  bow_of_accuracy: "../weapons/longbow.png",
  shortbow: "../weapons/shortbow.png",
  silent_bow: "../weapons/shortbow.png",
  mace: "../weapons/mace.png",
  fireball: "spell-fireball.png",
  cure_wounds: "spell-cure-wounds.png",
  counterspell: "../spells/counterspell.png",
  detect_magic: "../spells/detect_magic.png",
  dispel_magic: "../spells/dispel_magic.png",
  divine_smite: "../spells/divine_smite.png",
  eyebite: "../spells/eyebite.png",
  minor_magic: "../spells/minor_magic.png",
  yolandes_regal_presence: "../spells/yolandes_regal_presence.png",
  radiant_smite: "../spells/radiant_smite.png",
  blinding_smite: "../spells/blinding_smite.png",
  staggering_smite: "../spells/staggering_smite.png",
  greater_radiant_smite: "../spells/greater_radiant_smite.png",
  healing_potion: "consumable-healing-potion.png",
  dash: "tactic-dash.png",
  cunning_action_dash: "../abilities/cunning_action_dash.png",
  cunning_action_disengage: "../abilities/cunning_action_disengage.png",
  cunning_action_hide: "../abilities/cunning_action_hide.png",
  spell_rhythm: "ability-spell-rhythm.png",
  action_surge: "../abilities/action_surge.png",
  weapon_mastery: "../abilities/weapon_mastery.png",
  extra_attack_plus_1: "../abilities/extra_attack_plus_1.png",
  extra_attack_plus_2: "../abilities/extra_attack_plus_2.png",
  breath_weapon_red: "../abilities/breath_weapon_red.png",
  second_wind: "../abilities/second_wind.png",
  duelist_flourish: "../abilities/duelist_flourish.png",
  duelist_evasive_step: "../abilities/duelist_evasive_step.png",
  duelist_deadly_precision: "../abilities/duelist_deadly_precision.png",
  champion_execute: "../abilities/champion_execute.png",
  unyielding_stance: "../abilities/unyielding_stance.png",
  rage: "../abilities/rage.png",
  reckless_attack: "../abilities/reckless_attack.png",
  berserker_execute: "../abilities/berserker_execute.png",
  primal_roar: "../abilities/primal_roar.png",
  savage_momentum: "../abilities/savage_momentum.png",
  cunning_action: "../abilities/cunning_action.png",
  reliable_talent: "../abilities/reliable_talent.png",
  umbral_guise: "../abilities/umbral_guise.png",
  ultraviolence: "../abilities/ultraviolence.png",
  rogue_weapon_mastery: "../abilities/rogue_weapon_mastery.png",
  sneak_attack: "../abilities/sneak_attack.png",
  evasion: "../abilities/evasion.png",
  secrets_exposed: "../abilities/secrets_exposed.png",
  dark_presence: "../abilities/dark_presence.png",
  thieves_tools: "../abilities/thieves_tools.png",
  expertise: "../abilities/expertise.png",
  killers_patience: "../abilities/killers_patience.png",
  assassinate: "../abilities/assassinate.png",
  lethal_ambush: "../abilities/lethal_ambush.png",
  low_blow: "../abilities/low_blow.png",
  exploit_weakness: "../abilities/exploit_weakness.png",
  quick_rigging: "../abilities/quick_rigging.png",
  bombmaker: "../abilities/bombmaker.png",
  grenado_formula: "../abilities/grenado_formula.png",
  safe_geometry: "../abilities/safe_geometry.png",
  free_recipe: "../abilities/free_recipe.png",
  master_of_mixtures: "../abilities/master_of_mixtures.png",
  double_rig: "../abilities/double_rig.png",
  catastrophic_charge: "../abilities/catastrophic_charge.png",
  aura_of_protection: "../abilities/aura_of_protection.png",
  aura_of_courage: "../abilities/aura_of_courage.png",
  aura_of_alacrity: "../abilities/aura_of_alacrity.png",
  aura_of_renewal: "../abilities/aura_of_renewal.png",
  sanctified_presence: "../abilities/sanctified_presence.png",
  vow_of_enmity: "../abilities/vow_of_enmity.png",
  relentless_pursuit: "../abilities/relentless_pursuit.png",
  natures_aegis: "../abilities/natures_aegis.png",
  athletic_prowess: "../abilities/athletic_prowess.png",
  legends_surge: "../abilities/legends_surge.png",
  chains_of_vengeance: "../abilities/chains_of_vengeance.png",
  executioners_verdict: "../abilities/executioners_verdict.png",
  glorious_challenge: "../abilities/glorious_challenge.png",
  ability_score_improvement: "../abilities/ability_score_improvement.png",
  device_acid_paper: "../devices/acid_paper.png",
  device_fire_paper: "../devices/fire_paper.png",
  device_grave_paper: "../devices/grave_paper.png",
  device_greater_acid_paper: "../devices/greater_acid_paper.png",
  device_greater_fire_paper: "../devices/greater_fire_paper.png",
  device_greater_grave_paper: "../devices/greater_grave_paper.png",
  device_greater_lightning_paper: "../devices/greater_lightning_paper.png",
  device_lightning_paper: "../devices/lightning_paper.png",
  device_poison_vial: "../devices/poison_vial.png",
  device_greater_poison_vial: "../devices/greater_poison_vial.png",
  device_acid_grenado: "../devices/acid_grenado.png",
  device_lightning_grenado: "../devices/lightning_grenado.png",
  device_saint_paper: "../devices/saint_paper.png",
  device_tar_vial: "../devices/tar_vial.png",
  device_greater_tar_vial: "../devices/greater_tar_vial.png",
  device_smoke_vial: "../devices/smoke_vial.png",
  device_greater_smoke_vial: "../devices/greater_smoke_vial.png",
  device_makeshift_fan: "../devices/makeshift_fan.png",
  device_thunder_wire: "../devices/thunder_wire.png",
  device_fire_grenado: "../devices/fire_grenado.png",
  device_frost_grenado: "../devices/frost_grenado.png",
  device_grave_dirt_grenado: "../devices/grave_dirt_grenado.png",
  shield: "reaction-shield.png",
});

const WEAPON_BADGES = Object.freeze({
  flaming_longsword: "flame.png",
  venomous_dagger: "poison_bead.png",
  greatsword_of_wounding: "blood_bead.png",
  thunder_hammer: "storm_cloud.png",
  frost_brand_rapier: "snowflake.png",
  bow_of_accuracy: "target.png",
  exploding_handaxe: "lit_bomb.png",
  shocking_scimitar: "lightning_bolt.png",
  blessed_quarterstaff: "praying_hands.png",
  piercing_shortsword: "jagged_x.png",
  battleaxe_of_fury: "bicep.png",
  silent_bow: "psychic_head.png",
});

const CATEGORY_FALLBACKS = Object.freeze({
  weapon: "../weapons/longsword.png",
  spell: "spell-fireball.png",
  consumable: "consumable-healing-potion.png",
  tactic: "tactic-dash.png",
  ability: "ability-spell-rhythm.png",
  channel_divinity: "ability-spell-rhythm.png",
  device: "device-smoke-vial.png",
  reaction: "reaction-shield.png",
});

export function actionIconCategory(action = {}) {
  if (action.cost === "reaction" || action.economy === "reaction") return "reaction";
  if (action.tags?.weapon || action.iconCategory === "weapon") return "weapon";
  if (action.tags?.spell || action.kind === "spell" || action.iconCategory === "spell") return "spell";
  if (action.tags?.device || action.iconCategory === "device") return "device";
  if (action.type === "consumable" || action.iconCategory === "consumable") return "consumable";
  if (action.resourceId === "channel_divinity" || action.iconCategory === "channel_divinity") return "channel_divinity";
  if (["dash", "dodge", "hide", "disengage"].includes(action.type) || ["hide", "disengage"].includes(action.actionKind) || action.iconCategory === "tactic") return "tactic";
  return "ability";
}

export function resolveActionIcon(action = {}) {
  const category = actionIconCategory(action);
  const stableId = action.iconId || action.sourceSpellId || action.secondaryChoiceId || action.id;
  const directSpellIcon = category === "spell" && stableId ? `../spells/${stableId}.png` : null;
  const filename = ICONS[stableId] || directSpellIcon || CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS.ability;
  return { category, url: new URL(filename, ICON_ROOT).href, isFallback: !ICONS[stableId] && !directSpellIcon };
}

export function createActionIconImage(action, className = "action-icon-art") {
  const resolved = resolveActionIcon(action);
  const stableId = action.iconId || action.sourceSpellId || action.secondaryChoiceId || action.id;
  const container = document.createElement("div");
  container.className = className;
  container.dataset.iconCategory = resolved.category;
  container.dataset.iconFallback = String(resolved.isFallback);

  const base = document.createElement("img");
  base.className = "action-icon-base-layer";
  base.src = resolved.url;
  base.alt = "";
  base.draggable = false;
  container.append(base);

  const badgeFilename = WEAPON_BADGES[stableId];
  if (badgeFilename) {
    const badge = document.createElement("img");
    badge.className = "action-icon-badge-layer";
    badge.src = new URL(`./icons/weapon_badges/${badgeFilename}`, import.meta.url).href;
    badge.alt = "";
    badge.draggable = false;
    container.append(badge);
  }
  return container;
}
