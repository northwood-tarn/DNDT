import { getActiveCharacterRecord } from "../state/saveGameState.js";
import { createInformationModal, signed, titleCase } from "./modalView.js";

export function createCharacterViewModel(input = {}) {
  const record = input.record || (input.saveGame ? getActiveCharacterRecord(input.saveGame) : null);
  const sheet = input.sheet || record?.resolvedCharacterSheet;
  if (!sheet) throw new Error("Character sheet data is required");
  const runtime = input.runtime || record?.runtime || {};
  return {
    title: sheet.identity?.characterName || "Character",
    subtitle: [sheet.identity?.speciesName, sheet.identity?.className, sheet.identity?.subclassName, `Level ${sheet.identity?.level || 1}`].filter(Boolean).join(" · "),
    abilities: Object.entries(sheet.abilities || {}).map(([id, ability]) => ({ label: titleCase(id), value: `${ability.score} (${signed(ability.modifier)})` })),
    combat: [
      entry("HP", `${runtime.hp ?? sheet.durability?.maxHp ?? "—"} / ${runtime.maxHp ?? sheet.durability?.maxHp ?? "—"}`),
      entry("Armour Class", sheet.combatBasics?.armorClass), entry("Initiative", signed(sheet.combatBasics?.initiativeBonus || 0)),
      entry("Speed", sheet.combatBasics?.speed), entry("Proficiency", signed(sheet.proficiencyBonus || 0)),
      entry("Passive Perception", sheet.combatBasics?.passivePerception),
    ],
    proficiencies: [
      entry("Skills", names(sheet.proficiencies?.skills)), entry("Expertise", names((sheet.proficiencies?.expertise || []).map((item) => typeof item === "string" ? item : item.id))),
      entry("Saving Throws", names(sheet.proficiencies?.savingThrows)), entry("Armour", names(sheet.proficiencies?.armor)),
      entry("Weapons", names(sheet.proficiencies?.weapons)), entry("Tools", names(sheet.proficiencies?.tools)),
    ],
    resources: (runtime.resources || sheet.resources || []).map((resource) => entry(resource.name || titleCase(resource.id), `${resource.current ?? resource.max ?? 0} / ${resource.max ?? 0}`)),
    spellcasting: sheet.spellcasting?.canCast ? [entry("Spellcasting Ability", titleCase(sheet.spellcasting.ability)), entry("Spell Save DC", sheet.spellcasting.spellSaveDc), entry("Spell Attack", signed(sheet.spellcasting.spellAttackBonus || 0))] : [],
    features: (sheet.features || []).map((feature) => entry(feature.name || titleCase(feature.id), feature.description || feature.summary || "")),
  };
}

export default class CharacterOverlay {
  constructor() { this._open=false;this._root=null;this._previousFocus=null;this._onKeyDown=(event)=>{if(event.key==="Escape")this.close()}; }
  open(ctx, params={}) { this.close();this._ctx=ctx;this._open=true;this._previousFocus=globalThis.document?.activeElement;const model=createCharacterViewModel(params);if(typeof document!=="undefined")this._render(model);return model; }
  update() {} render() {}
  close() { this._root?.remove();this._root=null;this._open=false;if(typeof document!=="undefined")document.removeEventListener("keydown",this._onKeyDown);this._previousFocus?.focus?.(); }
  _render(model) { const sections=[{title:model.subtitle||"Summary",entries:model.combat},{title:"Abilities",entries:model.abilities},{title:"Proficiencies",entries:model.proficiencies},{title:"Resources",entries:model.resources},{title:"Spellcasting",entries:model.spellcasting},{title:"Features",entries:model.features}];const modal=createInformationModal({className:"character-overlay",title:model.title,sections,onClose:()=>this.close()});document.body.append(modal.root);this._root=modal.root;document.addEventListener("keydown",this._onKeyDown);modal.close.focus(); }
}

function entry(label,value){return{label,value:value==null||value===""?"—":String(value)}}
function names(values=[]){return values.length?values.map(titleCase).join(", "):"—"}
