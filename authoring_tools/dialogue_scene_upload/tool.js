import { ACTS, CANONICAL_EFFECTS, LIST_FIELDS, REQUIRED_HEADER_FIELDS, compileDialogue, isCanonicalId, parseDialogueSource } from "./dialogueSource.js";

const $ = (id) => document.getElementById(id);
const kinds = ["pc","npc","companion","area","map","scene","entry","encounter","trigger","flag","item","service"];
const sample = `---
format.version: 1
act: 1_Greyharbour
scene.id: scene:forest.gate
scene.title: Forest Gate
dialogue.type: full
location.id: map:forest.gate
trigger.id: trigger:forest.gate.guards
participants:
  - npc:gate.captain
frequency: once
required.flags: []
forbidden.flags: []
start.effects: []
bypass.effects: []
completion.effects: []
success.destination: null
failure.destination: encounter:forest.gate.guards
---

Guards move backwards and forwards before the forest gate.

oa. Approach openly. //start conversation with gate captain//
ob. Try to sneak past. //team stealth dc 15//
oc. Attack. //start.combat=encounter:forest.gate.guards//`;

let parsed = null;
let header = {};
let resolutions = {};
let additions = [];
let catalogue = JSON.parse(localStorage.getItem("dndt.dialogue.ids") || "[]");

function saveCatalogue(){ localStorage.setItem("dndt.dialogue.ids", JSON.stringify(catalogue)); }
function fieldValue(field){ const value=header[field]; return LIST_FIELDS.has(field) ? (value||[]).join("\n") : value===null ? "null" : String(value??""); }
function readField(field,value){ if(LIST_FIELDS.has(field)) return value.split("\n").map(v=>v.trim()).filter(Boolean); if(value.trim()==="null") return null; if(field==="format.version") return Number(value); return value.trim(); }

function renderFields(){
  $("fields").classList.remove("empty"); $("fields").innerHTML="";
  REQUIRED_HEADER_FIELDS.forEach(field=>{
    const label=document.createElement("label"); label.className="field"; label.innerHTML=`<span>${field}</span>`;
    let input;
    if(field==="act"||field==="dialogue.type"||field==="frequency"){
      input=document.createElement("select");
      const values=field==="act"?ACTS:field==="dialogue.type"?["full","vignette","emberside"]:["once","repeat"];
      input.innerHTML=values.map(v=>`<option value="${v}">${v}</option>`).join(""); input.value=fieldValue(field);
    } else if(LIST_FIELDS.has(field)){ input=document.createElement("textarea"); input.rows=2; input.value=fieldValue(field); }
    else { input=document.createElement("input"); input.value=fieldValue(field); }
    input.addEventListener("input",()=>{ header[field]=readField(field,input.value); renderFlags(); refresh(); });
    label.append(input); $("fields").append(label);
  });
}

const flagUses=[
  ["required.flags","Required"],["forbidden.flags","Forbidden"],["start.effects","On start"],["bypass.effects","On bypass"],["completion.effects","On complete"]
];
function flagSet(field,flag,checked){
  let list=[...(header[field]||[])]; const effect=`set.flag=${flag}`;
  const value=field.endsWith("effects")?effect:flag; list=list.filter(v=>v!==value); if(checked) list.push(value); header[field]=list; renderFields(); refresh();
}
function renderFlags(){
  const flags=[...new Set([...catalogue.filter(e=>e.kind==="flag").map(e=>e.id),...Object.entries(header).filter(([k])=>k.includes("flag")||k.includes("effects")).flatMap(([,v])=>(v||[]).flatMap(x=>String(x).match(/flag:[a-z0-9.]+/g)||[]))])].sort();
  if(!flags.length){$("flags").className="empty";$("flags").textContent="No flags in the catalogue.";return}
  $("flags").className=""; $("flags").innerHTML=`<div class="flag-row flag-head"><span>Flag</span>${flagUses.map(([,l])=>`<span>${l}</span>`).join("")}</div>`;
  flags.forEach(flag=>{const row=document.createElement("div");row.className="flag-row";row.innerHTML=`<code>${flag}</code>`;flagUses.forEach(([field])=>{const label=document.createElement("label"),box=document.createElement("input");box.type="checkbox";const value=field.endsWith("effects")?`set.flag=${flag}`:flag;box.checked=(header[field]||[]).includes(value);box.addEventListener("change",()=>flagSet(field,flag,box.checked));label.append(box);row.append(label)});$("flags").append(row)});
}

function renderCatalogue(){
  const q=$("search").value.toLowerCase(); const shown=catalogue.filter(e=>`${e.id} ${e.label} ${(e.aliases||[]).join(" ")} ${e.kind}`.toLowerCase().includes(q));
  $("catalogue").className=shown.length?"catalogue":"catalogue empty"; $("catalogue").innerHTML=shown.length?"":"No matching catalogue entries.";
  shown.forEach(entry=>{const row=document.createElement("div");row.className="catalogue-row";row.innerHTML=`<code>${entry.id}</code><span>${entry.label||""}</span><small>${entry.kind}</small>`;$("catalogue").append(row)});
}

function suggestedLabel(id){return id.split(":").pop().split(".").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}
function renderParticipantPrompts(){
  const missing=(header.participants||[]).filter(id=>!catalogue.some(entry=>entry.id===id));
  $("participantPrompts").innerHTML="";
  missing.forEach(id=>{const kind=id.split(":")[0];const row=document.createElement("div");row.className="participant-prompt";const label=document.createElement("input");label.value=suggestedLabel(id);row.innerHTML=`<strong>New narrative ${kind}</strong><code>${id}</code>`;const button=document.createElement("button");button.textContent="Create";button.addEventListener("click",()=>addEntry(kind,id,label.value.trim()));row.append(label,button);$("participantPrompts").append(row)});
}

function renderOptions(){
  if(!parsed?.options.length){$("options").className="empty";$("options").textContent="No dialogue options found.";return}
  $("options").className="";$("options").innerHTML="";
  parsed.options.forEach(option=>{const card=document.createElement("div");card.className="option";card.innerHTML=`<strong>${option.label}.</strong> ${option.text}`;
    option.annotations.forEach(id=>{const a=parsed.annotations.find(x=>x.id===id),current={...a,...resolutions[id]};const row=document.createElement("div");row.className="annotation";row.innerHTML=`<em>//${a.text}//</em>`;const select=document.createElement("select");select.innerHTML=`<option value="">Choose effect</option>${CANONICAL_EFFECTS.map(e=>`<option>${e}</option>`).join("")}`;select.value=current.effect||"";const arg=document.createElement("input");arg.placeholder="canonical ID or value";arg.value=current.argument||"";const change=()=>{resolutions[id]={effect:select.value,argument:arg.value.trim()};refresh()};select.addEventListener("change",change);arg.addEventListener("input",change);row.append(select,arg);card.append(row)});$("options").append(card)});
}

function refresh(){
  if(!parsed)return; const result=compileDialogue(parsed,{header,resolutions,catalogue,catalogueAdditions:additions});
  const {errors,warnings}=result.validation; $("status").className="status"; $("status").innerHTML=errors.length?`<div class="errors"><strong>${errors.length} error${errors.length===1?"":"s"}</strong><ul>${errors.map(e=>`<li>${e}</li>`).join("")}</ul></div>`:`<div class="valid"><strong>Ready to export.</strong></div>`;
  if(warnings.length) $("status").innerHTML+=`<div class="warnings"><strong>${warnings.length} warning${warnings.length===1?"":"s"}</strong><ul>${warnings.map(w=>`<li>${w}</li>`).join("")}</ul></div>`;
  $("output").value=result.package?JSON.stringify(result.package,null,2):"Export is locked until all errors are resolved."; $("export").disabled=!result.package;
}

function parse(){parsed=parseDialogueSource($("source").value);header=structuredClone(parsed.header);resolutions={};parsed.annotations.forEach(a=>{if(a.resolved)resolutions[a.id]={effect:a.effect,argument:a.argument}});renderFields();renderFlags();renderParticipantPrompts();renderOptions();refresh()}
async function loadFile(file){
  if(!file)return;
  const extension=file.name.split(".").pop()?.toLowerCase();
  if(!["md","txt"].includes(extension)){alert("Upload a .md or .txt dialogue file.");return}
  $("source").value=await file.text();
  parse();
}
function addEntry(kind,id,label){if(!isCanonicalId(id)||!id.startsWith(`${kind}:`)){alert(`Use ${kind}: followed by lowercase words separated by full stops.`);return false}if(catalogue.some(e=>e.id===id)){alert("That ID is already in the catalogue.");return false}const entry={id,kind,label:label||id,aliases:[],status:"active",source:null};catalogue.push(entry);additions.push(entry);saveCatalogue();renderCatalogue();renderFlags();renderParticipantPrompts();refresh();return true}

$("source").value=sample; $("newKind").innerHTML=kinds.map(k=>`<option>${k}</option>`).join("");
$("parse").addEventListener("click",parse); $("file").addEventListener("change",e=>loadFile(e.target.files[0]));
const dropZone=$("dropZone");
["dragenter","dragover"].forEach(type=>dropZone.addEventListener(type,event=>{event.preventDefault();dropZone.classList.add("dragging")}));
["dragleave","drop"].forEach(type=>dropZone.addEventListener(type,event=>{event.preventDefault();dropZone.classList.remove("dragging")}));
dropZone.addEventListener("drop",event=>loadFile(event.dataTransfer.files[0]));
$("addFlag").addEventListener("click",()=>{if(addEntry("flag",$("newFlag").value.trim(),$("newFlag").value.trim()))$("newFlag").value=""});
$("addId").addEventListener("click",()=>{if(addEntry($("newKind").value,$("newId").value.trim(),$("newLabel").value.trim())){$("newId").value="";$("newLabel").value=""}});
$("search").addEventListener("input",renderCatalogue); $("export").addEventListener("click",async()=>{
  $("export").disabled=true; $("saveStatus").textContent="Saving…";
  try{
    const response=await fetch("/api/dialogue/save",{method:"POST",headers:{"Content-Type":"application/json"},body:$("output").value});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Save failed.");
    $("saveStatus").textContent=`Saved to ${result.path}`;
  }catch(error){$("saveStatus").textContent=error.message}
  finally{$("export").disabled=!compileDialogue(parsed,{header,resolutions,catalogue,catalogueAdditions:additions}).package}
});
renderCatalogue();
