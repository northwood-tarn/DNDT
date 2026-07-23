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
  healing_potion: "consumable-healing-potion.png",
  dash: "tactic-dash.png",
  cunning_action_dash: "tactic-dash.png",
  spell_rhythm: "ability-spell-rhythm.png",
  device_smoke_vial: "device-smoke-vial.png",
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
  const filename = ICONS[stableId] || CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS.ability;
  return { category, url: new URL(filename, ICON_ROOT).href, isFallback: !ICONS[stableId] };
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
