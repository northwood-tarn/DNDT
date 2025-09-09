// app/scenes/CombatScene.js — consumes state.combat.actors (unified contract)
// No construction of actors here; this scene only runs combat.

import { mountCenter, setTop } from "../renderer/shellMount.js";
import { renderChoiceList, enableChoiceHotkeys, disableChoiceHotkeys, setChoiceScope } from "../ui/choiceHotkeys.js";
import { state } from "../state/stateStore.js";
import { logCombat } from "../engine/log.js";
import { ensureTurnEconomy, resetTurnEconomy, canUseAction, canUseBonus, canUseMove, spendAction, spendBonus, spendMove, isMeleeRange, getDistanceFromPC, setDistanceFromPC } from "../systems/turnEconomy.js";
import { rollWithDetail } from "../utils/dice.js";

function el(tag, attrs = {}, children = []){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  children.forEach(c => e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return e;
}
function p(t){ return `<p style="margin:6px 0">${t}</p>`; }
function strong(t){ return `<strong>${t}</strong>`; }
function mountHTML(html){
  const div = el("div", { style: { whiteSpace: "pre-wrap", lineHeight: "1.45", fontSize:"0.95rem" } });
  div.innerHTML = html;
  mountCenter(div);
  setChoiceScope(document.getElementById("center"));
  try { disableChoiceHotkeys(); } catch {}
  return div;
}

function renderHPBar(cur, max){
  const outer = el("div", { style:{ width:"140px", height:"8px", border:"1px solid #22314d", borderRadius:"6px", background:"#0f1725", marginRight:"6px" } });
  const pct = Math.max(0, Math.min(1, (max>0?cur/max:0)));
  const inner = el("div", { style:{ width:`${Math.floor(pct*100)}%`, height:"100%", borderRadius:"6px", background: pct>0.5 ? "#9bb7ff" : "#6c7fbf" } });
  outer.appendChild(inner);
  const txt = el("span", { textContent: ` ${cur}/${max}`, style:{ fontSize:"10px", opacity:"0.8" }});
  const wrap = el("div", { style:{ display:"flex", alignItems:"center", gap:"4px" }}, [outer, txt]);
  return wrap;
}
function paintInitiativePane(order, activeId){
  const right = document.getElementById("right");
  if (!right) return;
  right.innerHTML = "";
  const table = el("div", { style:{ fontFamily:"inherit", fontSize:"12px", width:"100%" } });
  table.appendChild(el("div", { className:"section-title", textContent:"Initiative Order", style:{ marginBottom:"6px" } }));
  order.forEach(ent => {
    const isActive = ent.id === activeId;
    const row = el("div", { style:{
      padding:"6px 6px",
      marginBottom:"6px",
      border:"1px solid #22314d",
      borderRadius:"8px",
      background: isActive ? "#0e1520" : "transparent",
      opacity: (ent.hp|0)<=0 ? 0.45 : 1
    }});
    const top = el("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"baseline" } }, [
      el("div", { textContent:`${ent.init ?? 0}` }),
      el("div", { textContent: ent.name || ent.id, style:{ fontWeight:"600" }}),
      el("div", { textContent:`AC ${ent.ac ?? "?"}` })
    ]);
    const hpLine = renderHPBar(ent.hp|0, ent.maxHp|0 || ent.hp|0 || 1);
    row.appendChild(top);
    row.appendChild(hpLine);
    if (isActive) {
      const econ = ensureTurnEconomy(ent);
      const tag = (label, used) => el("span", { textContent: label, style:{
        fontSize:"11px", padding:"2px 6px", borderRadius:"6px", border:"1px solid #22314d",
        marginRight:"6px", background: used ? "transparent" : "#182235", opacity: used ? 0.45 : 1
      }});
      row.appendChild(el("div", { style:{ marginTop:"6px" }}, [
        tag("Action", econ.actionUsed),
        tag("Bonus",  econ.bonusUsed),
        tag("Move",   econ.moveUsed)
      ]));
    }
    table.appendChild(row);
  });
  right.appendChild(table);
}

function toHit(attacker, targetAC, adv = 0){
  const r1 = rollWithDetail("1d20");
  const r2 = rollWithDetail("1d20");
  const d20 = adv > 0 ? Math.max(r1.total, r2.total) : adv < 0 ? Math.min(r1.total, r2.total) : r1.total;
  const total = d20 + (attacker.attackBonus|0);
  const hit = d20 === 20 || (total >= targetAC && d20 !== 1);
  return { d20, total, ac: targetAC, hit, rolls:[r1.total, r2.total], adv };
}
function rollDmg(expr){ const r = rollWithDetail(expr ?? "1d6"); return Math.max(0, r.total); }

export default {
  async start() {
    const sc = state.combat;
    if (!sc || !Array.isArray(sc.actors) || sc.actors.length === 0) {
      mountHTML(p(strong("Combat cannot start — no actors from loader.")));
      return;
    }

    setTop(sc.title || "Combat");

    // Use canonical actors from loader
    const actors = sc.actors.map(a => ({ ...a }));
    actors.forEach(a => ensureTurnEconomy(a));

    // Roll initiative (once at entry)
    actors.forEach(a => { a.init = (rollWithDetail("1d20").total + (a.dexMod|0)); });
    actors.sort((a,b)=> (b.init|0) - (a.init|0));

    const PC = actors.find(a=>a.kind==='pc') || actors[0];
    let round = 1, turnIdx = 0, current = actors[0];
    const WAIT_SHORT = 800, WAIT = 1500;

    function alive(a){ return (a.hp|0) > 0; }
    function foes(){ return actors.filter(a=>a.kind==='npc' && alive(a)); }
    function centerLog(lines){ mountHTML(lines.join("")); }
    function refreshRight(){ paintInitiativePane(actors, current.id); }

    function startOfRound(){
      (sc.triggers||[]).forEach(t => {
        if (t.type==='spawn' && t.at==='roundStart' && t.round===round) {
          const e = {
            kind:'npc', id: t.actor?.enemyId || 'spawned',
            name: (t.actor?.enemyKey || 'foe').replace(/_/g,' '),
            ac: t.actor?.ac ?? 12, hp: t.actor?.hp ?? 2, maxHp: t.actor?.hp ?? 2,
            attackBonus: t.actor?.attackBonus ?? 2, damage: t.actor?.damage || '1d6',
            weapon: t.actor?.weapon || 'shortbow', distanceFromPC: t.actor?.distanceFromPC ?? 30, dexMod: 0
          };
          ensureTurnEconomy(e);
          e.init = (rollWithDetail("1d20").total + (e.dexMod|0));
          actors.push(e);
          actors.sort((a,b)=> (b.init|0) - (a.init|0));
          logCombat(t.announceText || `A ${e.name} rushes in!`);
        }
      });
    }
    function nextLivingIndex(start){
      for (let i=1;i<=actors.length;i++){
        const idx = (start+i) % actors.length;
        if (alive(actors[idx])) return idx;
      }
      return -1;
    }
    function checkEnd(){
      if (!alive(PC)) { centerLog([p(strong("You fall. Defeat."))]); return true; }
      if (foes().length === 0) { centerLog([p(strong("Enemies lie still. Victory!"))]); return true; }
      return false;
    }
    function beginTurn(){
      if (checkEnd()) return;
      if (turnIdx === 0) startOfRound();
      current = actors[turnIdx];
      resetTurnEconomy(current);
      refreshRight();
      if (current.kind === 'pc') return renderPC();
      return renderNPC(current);
    }
    function endTurn(){
      const next = nextLivingIndex(turnIdx);
      if (next === -1) { round += 1; turnIdx = actors.findIndex(alive); }
      else turnIdx = next;
      setTimeout(beginTurn, WAIT_SHORT);
    }

    function renderPC(){
      const list = foes();
      const b = mountHTML([ p(strong("Your turn")), p("Choose a target / action:") ].join(""));
      const opts = [];
      list.forEach(e => {
        const inMelee = isMeleeRange(e);
        const mode = inMelee ? "melee" : "ranged";
        const disadv = (mode==='ranged' && isMeleeRange({distanceFromPC:5})) ? " (disadv at 5ft!)" : "";
        opts.push({
          label: `Attack ${e.name} — ${mode}${disadv}`,
          onSelect: ()=>{
            if (!canUseAction(PC)) return;
            const adv = (mode==='ranged' && isMeleeRange({distanceFromPC:5})) ? -1 : 0;
            const res = toHit(PC, e.ac|0, adv);
            if (res.hit){
              const dmg = rollDmg(PC.damage || (mode==='melee'?'1d8+2':'1d6+2'));
              e.hp = Math.max(0, (e.hp|0) - dmg);
              centerLog([ p(strong(`You attack ${e.name}.`)),
                p(`To hit: ${res.adv===-1?`min(${res.rolls[0]}, ${res.rolls[1]})`:`${res.d20}`} + ${PC.attackBonus|0} = ${res.total} vs AC ${res.ac} → HIT`),
                p(`Damage: ${dmg}`) ]);
            } else {
              centerLog([ p(strong(`You attack ${e.name}.`)),
                p(`To hit: ${res.adv===-1?`min(${res.rolls[0]}, ${res.rolls[1]})`:`${res.d20}`} + ${PC.attackBonus|0} = ${res.total} vs AC ${res.ac} → MISS`) ]);
            }
            spendAction(PC); refreshRight(); setTimeout(endTurn, WAIT);
          }
        });
      });
      renderChoiceList(b, opts);
      enableChoiceHotkeys({ scopeEl: b });
    }

    function renderNPC(enemy){
      const inMelee = isMeleeRange(enemy);
      const res = toHit(enemy, PC.ac|0, 0);
      if (res.hit){
        const dmg = rollDmg(enemy.damage || '1d6+1');
        PC.hp = Math.max(0, (PC.hp|0) - dmg);
        centerLog([ p(strong(`${enemy.name}${inMelee?' strikes.':' shoots.'}`)),
          p(`To hit: ${res.d20} + ${enemy.attackBonus|0} = ${res.total} vs AC ${res.ac} → HIT`),
          p(`Damage: ${dmg}`) ]);
      } else {
        centerLog([ p(strong(`${enemy.name}${inMelee?' swings.':' shoots.'}`)),
          p(`To hit: ${res.d20} + ${enemy.attackBonus|0} = ${res.total} vs AC ${res.ac} → MISS`) ]);
      }
      refreshRight(); setTimeout(endTurn, 900);
    }

    mountHTML(p("A nearby house—floorboards creak; two goblins snarl in the dark."));
    paintInitiativePane(actors, actors[0]?.id);
    beginTurn();
  }
};
