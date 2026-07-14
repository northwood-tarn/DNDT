import { createStatusEffectsViewModel } from "./StatusEffectsOverlay.js";
import { createInformationModal, titleCase } from "./modalView.js";

export function createTargetInfoViewModel(actor = {}) {
  if (!actor.id && !actor.name) throw new Error("Target actor data is required");
  const status = createStatusEffectsViewModel({ actor, name: actor.name });
  return {
    title: actor.name || actor.id,
    summary: [entry("Team", titleCase(actor.team)),entry("HP",`${actor.hp ?? "—"} / ${actor.maxHp ?? "—"}`),entry("Temporary HP",actor.tempHp || 0),entry("Armour Class",actor.ac),entry("Speed",actor.speed),entry("Position",actor.position?`${actor.position.x}, ${actor.position.y}`:"—")],
    defences: [entry("Resistances",names(actor.resistances)),entry("Immunities",names(actor.immunities)),entry("Condition Immunities",names(actor.conditionImmunities))],
    conditions: status.conditions,
    resources: (actor.resources || []).map((resource)=>entry(resource.name||titleCase(resource.id),`${resource.current??resource.max??0} / ${resource.max??0}`)),
  };
}

export default class TargetInfoOverlay {
  constructor(){this._open=false;this._root=null;this._previousFocus=null;this._onKeyDown=(event)=>{if(event.key==="Escape")this.close()};}
  open(ctx,params={}){this.close();this._ctx=ctx;this._open=true;this._previousFocus=globalThis.document?.activeElement;const model=createTargetInfoViewModel(params.actor||params.target||params);if(typeof document!=="undefined")this._render(model);return model;}
  update(){} render(){}
  close(){this._root?.remove();this._root=null;this._open=false;if(typeof document!=="undefined")document.removeEventListener("keydown",this._onKeyDown);this._previousFocus?.focus?.();}
  _render(model){const modal=createInformationModal({className:"target-info-overlay",title:model.title,sections:[{title:"Combat",entries:model.summary},{title:"Defences",entries:model.defences},{title:"Conditions",entries:model.conditions},{title:"Resources",entries:model.resources}],onClose:()=>this.close()});document.body.append(modal.root);this._root=modal.root;document.addEventListener("keydown",this._onKeyDown);modal.close.focus();}
}
function entry(label,value){return{label,value:value==null||value===""?"—":String(value)}}
function names(values=[]){return values.length?values.map(titleCase).join(", "):"—"}
