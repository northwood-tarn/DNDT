import { getDiscoveryJournal } from "../state/discoveryState.js";
import { getSecretJournalEntries } from "../secrets/secretState.js";
import { getQuestJournal } from "../state/questState.js";

export function createJournalViewModel(saveGame, options = {}) {
  const quests = getQuestJournal(saveGame, options.questStatus ? { status: options.questStatus } : {});
  const discoveries = getDiscoveryJournal(saveGame, options.mapId || null);
  return {
    activeQuests: quests.filter((quest) => quest.status === "active"),
    completedQuests: quests.filter((quest) => quest.status === "completed"),
    failedQuests: quests.filter((quest) => quest.status === "failed"),
    discoveries,
    secrets: getSecretJournalEntries(saveGame, options.secretDefinitions || [], options),
  };
}

export default class JournalOverlay {
  constructor() { this._ctx=null;this._open=false;this._root=null; }
  open(ctx,params={}) { this.close();this._ctx=ctx;this._open=true;const model=createJournalViewModel(params.saveGame,params);if(typeof document!=="undefined")this._render(model);return model; }
  update() {}
  render() {}
  close() { if(this._root?.parentNode)this._root.parentNode.removeChild(this._root);this._root=null;this._open=false; }
  _render(model){const root=document.createElement("section");root.className="journal-overlay";root.setAttribute("aria-label","Journal");const panel=document.createElement("div");panel.className="journal-panel";panel.innerHTML="<h1>Journal</h1>";panel.append(this._questSection("Active",model.activeQuests),this._secretSection(model.secrets),this._questSection("Completed",model.completedQuests),this._discoverySection(model.discoveries));const close=document.createElement("button");close.type="button";close.textContent="Close";close.addEventListener("click",()=>this.close());panel.append(close);root.append(panel);document.body.append(root);this._root=root}
  _questSection(title,quests){const section=document.createElement("section"),heading=document.createElement("h2");heading.textContent=title;section.append(heading);if(!quests.length){const empty=document.createElement("p");empty.textContent="None";section.append(empty)}for(const quest of quests){const article=document.createElement("article"),h=document.createElement("h3");h.textContent=quest.title;article.append(h);for(const objective of Object.values(quest.objectives||{})){if(objective.status==="hidden")continue;const p=document.createElement("p");p.textContent=`${objective.status}: ${objective.id}`;article.append(p)}section.append(article)}return section}
  _discoverySection(entries){const section=document.createElement("section"),heading=document.createElement("h2");heading.textContent="Discoveries";section.append(heading);for(const entry of entries){const p=document.createElement("p");p.textContent=`${entry.label||entry.targetId} — ${entry.state}`;section.append(p)}return section}
  _secretSection(entries){const section=document.createElement("section"),heading=document.createElement("h2");heading.textContent="Secrets";section.append(heading);for(const entry of entries){const article=document.createElement("article"),h=document.createElement("h3"),p=document.createElement("p");h.textContent=entry.title;p.textContent=entry.text;article.append(h,p);section.append(article)}return section}
}
