import { getConditionRules } from "../combat/effects.js";
import { createInformationModal, titleCase } from "./modalView.js";

export function createStatusEffectsViewModel(input = {}) {
  const actor = input.actor || input.actorInstance?.state || input.runtime || {};
  const conditions = (actor.conditions || []).map((condition) => {
    const id = typeof condition === "string" ? condition : condition.id;
    const rules = getConditionRules(id);
    return { label: condition.label || rules.name || titleCase(id), value: describeDuration(condition.duration || condition.expires) };
  });
  const effects = (actor.activeEffects || []).map((effect) => ({ label: effect.label || titleCase(effect.id || effect.stat || effect.type), value: describeEffect(effect) }));
  return { title: `${input.name || actor.name || "Character"} — Status`, conditions, effects };
}

export default class StatusEffectsOverlay {
  constructor(){this._open=false;this._root=null;this._previousFocus=null;this._onKeyDown=(event)=>{if(event.key==="Escape")this.close()};}
  open(ctx,params={}){this.close();this._ctx=ctx;this._open=true;this._previousFocus=globalThis.document?.activeElement;const model=createStatusEffectsViewModel(params);if(typeof document!=="undefined")this._render(model);return model;}
  update(){} render(){}
  close(){this._root?.remove();this._root=null;this._open=false;if(typeof document!=="undefined")document.removeEventListener("keydown",this._onKeyDown);this._previousFocus?.focus?.();}
  _render(model){const modal=createInformationModal({className:"status-effects-overlay",title:model.title,sections:[{title:"Conditions",entries:model.conditions},{title:"Active Effects",entries:model.effects}],onClose:()=>this.close()});document.body.append(modal.root);this._root=modal.root;document.addEventListener("keydown",this._onKeyDown);modal.close.focus();}
}

function describeDuration(duration){if(!duration)return"Active";if(typeof duration==="number")return`${duration} round${duration===1?"":"s"}`;if(duration.remaining!=null)return`${duration.remaining} round${duration.remaining===1?"":"s"} remaining`;if(duration.timing)return`Until ${titleCase(duration.timing)}`;return"Active"}
function describeEffect(effect){const parts=[];if(effect.amount)parts.push(`${effect.amount>=0?"+":""}${effect.amount} ${titleCase(effect.stat)}`);if(effect.duration)parts.push(describeDuration(effect.duration));return parts.join(" · ")||"Active"}
