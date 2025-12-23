// app/scenes/CharacterSelect.js — panes with blue headings, Lucky fallback, 2‑col abilities, Skilled picker (refined)

import { sceneManager } from "../engine/sceneManager.js";
import ExplorationScene from "./ExplorationScene.js";
import DocksideIntro from "../areas/00_dockside/Dockside.js";
import { state } from "../state/stateStore.js";
import { classes } from "../data/classes.js";
import { backgrounds } from "../data/backgrounds.js";
import { ORIGIN_FEATS as feats } from "../data/feats.js";
import { proficiencyForLevel } from "../rules/proficiency.js";
import { applyStarterInventory } from "../systems/starterInventory.js";
import { initSlotsFor, refreshPerDayFeats } from "../engine/spellSlots.js";

function mountInto(pane, el) {
  const host = (Shell.shell && Shell.shell[pane.toLowerCase()]) || document.getElementById(pane.toLowerCase());
  if (typeof Shell[`mount${pane}`] === "function") { try { Shell[`mount${pane}`](el); return; } catch {} }
  if (host) { host.innerHTML = ""; host.appendChild(el); }
}

const ALL_SKILLS = ["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"];

const selection = { name:"", class:null, background:null, feat:null, featPicks:{} };
const confirmed = { name:null, class:null, background:null, feat:null };

function el(tag, props={}, styles={}) { const n = document.createElement(tag); Object.assign(n, props); Object.assign(n.style, styles); return n; }
const getFeat = (idOrName)=> feats.find(f=> f.id===idOrName || f.name===idOrName) || null;
const abilityMod = (v)=> Math.floor((v-10)/2);
const modStr = (m)=> (m>=0?`+${m}`:`${m}`);

function luckyFallbackHTML() {
  return `<p class="muted">This background’s feat is <b>in development</b>; for now you gain <b>Lucky</b>.</p>
<p><b>Lucky</b>: You have 3 luck points per long rest. When you roll a d20 for an attack, ability check, or saving throw, spend 1 point to reroll and choose the result.</p>`;
}

function classHeadingHTML(k) {
  const c = classes?.[k]; if (!c) return "";
  const base = c.baseAbilities || { STR:10, DEX:10, CON:10, INT:10, WIS:10, CHA:10 };
  const arr = `STR ${base.STR} (${modStr(abilityMod(base.STR))})  DEX ${base.DEX} (${modStr(abilityMod(base.DEX))})  CON ${base.CON} (${modStr(abilityMod(base.CON))})
INT ${base.INT} (${modStr(abilityMod(base.INT))})  WIS ${base.WIS} (${modStr(abilityMod(base.WIS))})  CHA ${base.CHA} (${modStr(abilityMod(base.CHA))})`;
  const summary = c.summary || c.description || "";
  return `<div class="section-title">${k.toUpperCase()}</div>
<div>${summary}</div>
<div style="margin-top:8px" class="muted">Ability array:</div>
<pre class="mono" style="margin:0">${arr}</pre>`;
}

function descBackgroundHTML(k) {
  const b = backgrounds?.[k]; if (!b) return "";
  const skills = (b.skills||[]).map(s=>`<i>${s}</i>`).join(", ") || "(none)";
  let html = `<div>${b.summary || b.description || ""}</div>
<div style="margin-top:8px"><span class="muted">Skills:</span> ${skills}</div>`;
  const featId = b.featId || b.feat;
  if (featId) {
    const F = getFeat(featId);
    if (F) {
      html += `<div style="margin-top:8px"><span class="muted">Feat:</span> <b>${F.name}</b></div><div>${F.description}</div>`;
    } else {
      html += `<div style="margin-top:8px"><span class="muted">Feat:</span> <b>${featId}</b></div>`;
    }
    if (b.featImplemented === false) html += `<div style="margin-top:8px">${luckyFallbackHTML()}</div>`;
  } else {
    // No feat wired: show Lucky fallback
    html += `<div style="margin-top:8px">${luckyFallbackHTML()}</div>`;
  }
  return html;
}

function descFeatHTML(k) {
  const f = getFeat(k); if (!f) return "";
  return `<div class="section-title">${(f.name||f.id).toUpperCase()}</div><div>${f.description || ""}</div>`;
}

function makeDropdown(options, placeholder="Choose…") {
  const wrap = el("div", {}, { position:"relative" });
  const btn = el("button", { textContent: placeholder, className:"btn", type:"button" }, { width:"100%", textAlign:"left" });
  const list = el("div", {}, {
    position:"absolute", zIndex:"20", left:"0", right:"0", top:"calc(100% + 4px)",
    background:"#101826", border:"1px solid #22314d", borderRadius:"6px",
    display:"none", maxHeight:"220px", overflow:"auto"
  });
  options.forEach(k => {
    const item = el("div", { textContent: k }, { padding:"6px 8px", cursor:"pointer" });
    item.addEventListener("mouseenter", () => { btn.dataset.hoverValue = k; if (wrap.onhover) wrap.onhover(k); });
    item.addEventListener("mouseleave", () => { btn.dataset.hoverValue = ""; if (wrap.onleave) wrap.onleave(); });
    item.addEventListener("click", () => { btn.textContent = k; wrap.value = k; list.style.display = "none"; if (wrap.onchange) wrap.onchange(k); });
    list.appendChild(item);
  });
  btn.addEventListener("click", () => { list.style.display = list.style.display === "none" ? "block" : "none"; });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) { list.style.display = "none"; if (wrap.onleave) wrap.onleave(); } });
  wrap.appendChild(btn); wrap.appendChild(list);
  return wrap;
}

function buildLeft(onPreviewHTML, clearPreview, onAffirmChanged) {
  const left = el("div", {}, { display:"grid", gap:"12px", height:"100%" });

  function stackedRow(labelText, inputEl, onConfirm) {
    const row = el("div");
    const label = el("div", { textContent: labelText }, { marginBottom:"6px" });
    const line = el("div", {}, { display:"grid", gridTemplateColumns:"1fr auto", gap:"8px" });
    const confirmBtn = el("button", { textContent:"Confirm", className:"btn btn-confirm" });
    confirmBtn.disabled = true;
    confirmBtn.addEventListener("click", () => { onConfirm(); clearPreview(); });
    line.appendChild(inputEl); line.appendChild(confirmBtn);
    row.appendChild(label); row.appendChild(line);
    return { row, confirmBtn };
  }

  // Name
  const nameInput = el("input", { type:"text", value:"", autofocus:true }, { width:"100%" });
  const nameRow = stackedRow("Name", nameInput, () => { confirmed.name = selection.name || ""; onAffirmChanged(); });
  nameInput.addEventListener("input", () => {
    selection.name = nameInput.value.trim();
    nameRow.confirmBtn.disabled = !selection.name || confirmed.name === selection.name;
    onAffirmChanged();
  });
  left.appendChild(nameRow.row);

  // Class
  const classDrop = makeDropdown(Object.keys(classes||{}), "Choose a class…");
  let classRow;
  classDrop.onhover = (k)=> onPreviewHTML(classHeadingHTML(k));
  classDrop.onleave = clearPreview;
  classDrop.onchange = (k)=> { selection.class = k; classRow.confirmBtn.disabled = !selection.class || confirmed.class === selection.class; onAffirmChanged(); };
  classRow = stackedRow("Class", classDrop, () => { confirmed.class = selection.class; classRow.confirmBtn.disabled = true; onAffirmChanged(); });
  left.appendChild(classRow.row);

  // Background
  const bgDrop = makeDropdown(Object.keys(backgrounds||{}), "Choose a background…");
  let bgRow;
  bgDrop.onhover = (k)=> onPreviewHTML(descBackgroundHTML(k));
  bgDrop.onleave = clearPreview;
  bgDrop.onchange = (k)=> { selection.background = k; bgRow.confirmBtn.disabled = !selection.background || confirmed.background === selection.background; onAffirmChanged(); };
  bgRow = stackedRow("Background", bgDrop, () => { confirmed.background = selection.background; bgRow.confirmBtn.disabled = true; onAffirmChanged(); });
  left.appendChild(bgRow.row);

  // Feat
  const featDrop = makeDropdown(feats.map(f=>f.name), "Choose an origin feat…");
  let featRow;
  featDrop.onhover = (k)=> onPreviewHTML(descFeatHTML(k));
  featDrop.onleave = clearPreview;
  featDrop.onchange = (k)=> {
    selection.feat = k;
    // Keep Confirm enabled for Skilled so user can reopen picker
    const isSkilled = (getFeat(selection.feat)?.id === "skilled");
    featRow.confirmBtn.disabled = !selection.feat || (!isSkilled && confirmed.feat === selection.feat);
    onAffirmChanged();
  };
  featRow = stackedRow("Feat", featDrop, () => {
    confirmed.feat = selection.feat;
    // Do not disable the button for Skilled so it can reopen
    const isSkilled = (getFeat(confirmed.feat)?.id === "skilled");
    if (!isSkilled) featRow.confirmBtn.disabled = true;
    if (isSkilled) openSkilledPicker(() => onAffirmChanged());
    onAffirmChanged();
  });
  left.appendChild(featRow.row);

  return { root:left };
}

function buildCenter(setterCb) {
  const center = el("div", {}, { height:"100%" });
  const setHTML = (html)=> { center.innerHTML = html || ""; };
  setterCb(setHTML);
  return center;
}


function computeSkills() {
  const PB = proficiencyForLevel(1);
  const profs = computeLiveProficiencies();
  const map = {"Acrobatics":"DEX","Animal Handling":"WIS","Arcana":"INT","Athletics":"STR","Deception":"CHA","History":"INT","Insight":"WIS","Intimidation":"CHA","Investigation":"INT","Medicine":"WIS","Nature":"INT","Perception":"WIS","Performance":"CHA","Persuasion":"CHA","Religion":"INT","Sleight of Hand":"DEX","Stealth":"DEX","Survival":"WIS"};
  const ab = currentAbilities();
  const res = {};
  for (const sk of ALL_SKILLS) {
    const abil = map[sk];
    const mod = Math.floor((ab[abil] - 10) / 2);
    res[sk] = mod + (profs.has(sk) ? PB : 0);
  }
  return { bonuses: res, proficient: Array.from(profs) };
}
function computeLiveProficiencies() {
  const prof = new Set();
  if (confirmed.background) {
    const b = backgrounds[confirmed.background];
    (b?.skills || []).forEach(s => prof.add(s));
  }
  // Consider both confirmed and current selection for feat effects,
  // so Skilled updates immediately after picker save.
  const featConfirmed = getFeat(confirmed.feat);
  const featSelected  = getFeat(selection.feat);
  const isSkilled = (featConfirmed?.id === "skilled") || (featSelected?.id === "skilled");
  if (isSkilled) (selection.featPicks?.skilled || []).forEach(s => prof.add(s));
  if (featConfirmed?.id === "silver_tongue" || featSelected?.id === "silver_tongue") prof.add("Persuasion");
  if (featConfirmed?.id === "pathfinder"   || featSelected?.id === "pathfinder")   prof.add("Survival");
  return prof;
}

function currentAbilities() {
  const base = classes[confirmed.class]?.baseAbilities || { STR:10, DEX:10, CON:10, INT:10, WIS:10, CHA:10 };
  return base;
}

function buildRight() {
  const wrap = el("div", {}, { position:"relative", height:"100%", textAlign:"left" });

  const kv = el("div"); // Name/Class/Background/Feat area

  // sections
  const abilitiesTitle = el("div", { textContent:"ABILITIES", className:"section-title" }, { marginTop:"12px" });
  const abilitiesGrid = el("div", {}, { display:"grid", gridTemplateColumns:"auto auto", columnGap:"24px", rowGap:"4px", marginTop:"6px" });

  const skillsTitle = el("div", { textContent:"SKILLS", className:"section-title" }, { marginTop:"18px" });
  const skillsGrid = el("div", {}, { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", fontSize:"11px" });

  wrap.appendChild(kv);
  wrap.appendChild(abilitiesTitle);
  wrap.appendChild(abilitiesGrid);
  wrap.appendChild(skillsTitle);
  wrap.appendChild(skillsGrid);

  const startBtn = el("button", { textContent:"Start Adventure", className:"btn" }, {
    position:"absolute", left:"8px", bottom:"8px"
  });
  startBtn.style.display = "none";
  wrap.appendChild(startBtn);

  function renderKV() {
    kv.innerHTML = "";
    const row = (label, value) => {
      const l = el("div", { textContent: label.toUpperCase(), className:"section-title" }, { marginTop:"8px", marginBottom:"2px" });
      const v = el("div", { textContent: value || "—" });
      kv.appendChild(l); kv.appendChild(v);
    };
    row("Name", confirmed.name || "");
    row("Class", confirmed.class || "");
    row("Background", confirmed.background || "");
    row("Feat", confirmed.feat || "");
  }

  function renderAbilities() {
    abilitiesGrid.innerHTML = "";
    const order = [["STR","DEX"],["CON","INT"],["WIS","CHA"]];
    const ab = currentAbilities();
    order.forEach(([a,b])=>{
      const A = el("div",{textContent:`${a} ${ab[a]} (${modStr(abilityMod(ab[a]))})`});
      const B = el("div",{textContent:`${b} ${ab[b]} (${modStr(abilityMod(ab[b]))})`});
      abilitiesGrid.appendChild(A); abilitiesGrid.appendChild(B);
    });
  }

  function renderSkills() {
    skillsGrid.innerHTML = "";
    const PB = proficiencyForLevel(1);
    const profs = computeLiveProficiencies();
    const map = {"Acrobatics":"DEX","Animal Handling":"WIS","Arcana":"INT","Athletics":"STR","Deception":"CHA","History":"INT","Insight":"WIS","Intimidation":"CHA","Investigation":"INT","Medicine":"WIS","Nature":"INT","Perception":"WIS","Performance":"CHA","Persuasion":"CHA","Religion":"INT","Sleight of Hand":"DEX","Stealth":"DEX","Survival":"WIS"};
    const entries = ALL_SKILLS.map(sk=>{
      const abil = map[sk]; const mod = abilityMod(currentAbilities()[abil]);
      const bonus = mod + (profs.has(sk)?PB:0);
      return `${sk}: ${bonus>=0?`+${bonus}`:bonus}`;
    });
    const half = Math.ceil(entries.length/2);
    const c1 = el("div"); const c2 = el("div");
    entries.slice(0,half).forEach(t=> c1.appendChild(el("div",{textContent:t})));
    entries.slice(half).forEach(t=> c2.appendChild(el("div",{textContent:t})));
    skillsGrid.appendChild(c1); skillsGrid.appendChild(c2);
  }

  function renderStart() {
    const ok = confirmed.name && confirmed.class && confirmed.background && confirmed.feat;
    startBtn.disabled = !ok;
    startBtn.style.display = ok ? "block" : "none";
    if (ok) 
startBtn.onclick = async () => {
  const abs = currentAbilities();
  const mods = {}; for (const k of Object.keys(abs)) mods[k] = Math.floor((abs[k]-10)/2);
  const skills = computeSkills();
  state.player = {
    name: confirmed.name, class: confirmed.class, background: confirmed.background, feat: confirmed.feat,
    level: 1, proficiencyBonus: proficiencyForLevel(1),
    abilities: abs, abilityMods: mods,
    skills: skills.bonuses,
    proficiencies: { skills: skills.proficient },
    x:1, y:1, hp:10, maxHp:10, inventory:[], senses:{},
    lastSceneKey: 'DocksideIntro', sceneLabel: 'Dockside (Night Rain)'
  };
  try { initSlotsFor(state.player); } catch(e) { console.warn('slot init failed', e); }
  try { refreshPerDayFeats(state.player); } catch(e) { console.warn('feat refresh failed', e); }

  // Legacy bridge for modules that still read window.player
  try { window.player = state.player; } catch {}
  // Autosave on entry
  try { await savePlayer(state.player, 'autosave'); } catch(e) { console.warn('autosave failed', e); }
    try { applyStarterInventory(state.player); } catch(e) { console.warn('starter inv failed', e); }
  
  try { sceneManager.replace(DocksideIntro); } catch(e) { console.error('scene switch failed', e); }
};

  }

  return {
    root: wrap,
    renderAll() { renderKV(); renderAbilities(); renderSkills(); renderStart(); }
  };
}

function openSkilledPicker(onSave) {
  const overlay = el("div", {}, {
    position:"fixed", inset:"0", background:"rgba(0,0,0,.35)", display:"flex",
    alignItems:"center", justifyContent:"center", zIndex:"9999",
    fontFamily: "var(--mono)" // ensure no Times
  });
  const card = el("div", {}, { background:"#0e1520", border:"1px solid #22314d", borderRadius:"10px", padding:"12px", width:"420px", fontFamily:"var(--mono)" });
  const title = el("div", { textContent:"Pick 3 skills (Skilled)" }, { marginBottom:"8px" });
  const grid = el("div", {}, { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", maxHeight:"260px", overflow:"auto" });

  const picks = new Set(selection.featPicks.skilled || []);
  ALL_SKILLS.forEach(s=>{
    const row = el("label", {}, { display:"flex", alignItems:"center", gap:"6px" });
    const cb = el("input", { type:"checkbox", checked:picks.has(s) });
    cb.addEventListener("change", ()=>{
      if (cb.checked) { if (picks.size<3) picks.add(s); else { cb.checked=false; } }
      else picks.delete(s);
    });
    row.appendChild(cb); row.appendChild(el("span",{textContent:s}));
    grid.appendChild(row);
  });

  const bar = el("div", {}, { display:"flex", gap:"8px", justifyContent:"flex-end", marginTop:"10px" });
  const cancel = el("button", { textContent:"Cancel", className:"btn" });
  const save = el("button", { textContent:"Save", className:"btn" });
  cancel.onclick = ()=> document.body.removeChild(overlay);
  save.onclick = ()=> {
    if (picks.size !== 3) return; // require exactly 3
    selection.featPicks.skilled = Array.from(picks);
    document.body.removeChild(overlay);
    if (onSave) onSave();
  };

  card.appendChild(title); card.appendChild(grid); bar.appendChild(cancel); bar.appendChild(save); card.appendChild(bar);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export default {
  start() {
    
    // Guard: allow typing A/S/D/W and arrows in inputs by swallowing global movement keys during CharacterCreate
    const __swallowKeysForInputs = (e) => {
      const k = e.key;
      const isMove = k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' ||
                     k === 'w' || k === 'a' || k === 's' || k === 'd' ||
                     k === 'W' || k === 'A' || k === 'S' || k === 'D';
      if (!isMove) return;
      const ae = document.activeElement;
      if (!ae) return;
      const isEditable = ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable;
      if (isEditable) {
        // Let the character go into the input, just stop it from reaching the global handler
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', __swallowKeysForInputs, true);
setTop("NEW GAME | Create your character");

    let setCenterHTML = null;
    const centerPane = buildCenter((setter)=> { setCenterHTML = setter; });

    const right = buildRight();
    const left = buildLeft(
      (html)=> setCenterHTML && setCenterHTML(html || ""),
      ()=> setCenterHTML && setCenterHTML(""),
      ()=> right.renderAll()
    );

    mountInto("Left", left.root);
    mountInto("Center", centerPane);
    mountInto("Right", right.root);
    right.renderAll();
  }
};