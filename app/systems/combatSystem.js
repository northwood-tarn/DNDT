// systems/combatSystem.js — dialogue-driven combat tree builder (center panel)
import { rollWithDetail } from "../utils/dice.js";
import { getEnemyStats } from "../data/enemies.js";
import { logCombat } from "../engine/log.js";
import { state } from "../state/stateStore.js";

function getPlayer() {
  const p = state.player || {};
  return {
    id: p.id || "aya",
    name: p.name || "Aya",
    level: p.level || 1,
    ac: p.ac ?? 16,
    hp: p.hp ?? 12,
    maxHp: p.maxHp ?? 12,
    attackBonus: p.attackBonus ?? 5,
    damage: p.damage || "1d8+3",
  };
}
function getEnemies() {
  return (state.combat?.enemies || []).map(e => {
    const base = getEnemyStats(e.id) || {};
    const hpMax = base.maxHp ?? base.hp ?? 7;
    return {
      id: e.id,
      name: base.name || e.id,
      ac: base.ac ?? 12,
      hp: e.hp ?? base.hp ?? hpMax,
      maxHp: hpMax,
      attackBonus: base.attackBonus ?? 3,
      damage: base.damage || "1d6+2"
    };
  });
}
function isAlive(x){ return x.hp > 0; }
function attackRoll(attacker, defender){
  const r = rollWithDetail("1d20");
  const total = r.total + (attacker.attackBonus || 0);
  const nat = r.roll || r.total;
  const crit = nat === 20;
  const hit = !crit && nat === 1 ? false : (crit || total >= defender.ac);
  return { nat, total, crit, hit };
}
function rollDamage(expr){
  const { total } = rollWithDetail(expr);
  return Math.max(0, total);
}
function summarize(foes){
  return foes.filter(isAlive).map(e => `${e.name} ${e.hp}/${e.maxHp}`).join(", ") || "—";
}

export function buildCombatDialogueTree({ description="A nearby house—floorboards creak; two goblins snarl in the dark." }={}){
  const pc = getPlayer();
  const foes = getEnemies();
  const order = ["PC"].concat(foes.map((_,i)=>`E${i}`));
  let round = 1;
  let turn = 0;

  const tree = {
    id: "combat_dialogue",
    lines: [
      { 
        speaker: "Scene", 
        text: description, 
        choices: [{ text: "Continue", next: 1 }]   // visible option so keys work
      },
      { speaker: "", text: "", choices: [] },
      { speaker: "Choose a target", text: "", choices: [] },
      { speaker: "", text: "", next: 1 },
      { speaker: "System", text: "Combat ends.", end: true }
    ]
  };

  function alive(){ return foes.filter(isAlive); }
  function endState(){
    if (pc.hp <= 0) { tree.lines[4].text = "You fall. Defeat."; return "defeat"; }
    if (alive().length === 0) { tree.lines[4].text = "Enemies lie still. Victory!"; return "victory"; }
    return null;
  }

  function setHub(){
    const status = `You: ${pc.hp}/${pc.maxHp} | Foes: ${summarize(foes)}`;
    const who = order[turn];
    if (who === "PC"){
      tree.lines[1].speaker = `Round ${round}`;
      tree.lines[1].text = `Your turn. ${status}`;
      tree.lines[1].choices = [
        { text: "Melee Attack", next: 2, onChoose: () => buildTargetList() },
        { text: "Dodge (until next turn)", next: 3, onChoose: () => { pc.dodging = true; logCombat("Aya takes the Dodge action."); enemyPhase(); } }
      ];
    } else {
      tree.lines[1].speaker = `Round ${round}`;
      tree.lines[1].text = `Enemy turn. ${status}`;
      tree.lines[1].choices = [
        { text: "Continue", next: 3, onChoose: () => enemyPhase() }
      ];
    }
  }

  function advance(){
    const end = endState();
    if (end){ tree.lines[1].next = 4; return; }
    turn = (turn + 1) % order.length;
    if (turn === 0) { round += 1; pc.dodging = false; }
    setHub();
  }

  function buildTargetList(){
    const choices = alive().map((e, idx) => ({
      text: `Attack ${e.name} (${e.hp}/${e.maxHp})`,
      next: 3,
      onChoose: () => {
        const ar = attackRoll(pc, e);
        logCombat(`Aya attacks ${e.name}: d20=${ar.nat} ${ar.crit ? "(CRIT)" : ""} total ${ar.total} vs AC ${e.ac}.`);
        if (ar.hit){
          const dmg = ar.crit ? rollDamage(pc.damage) + rollDamage(pc.damage) : rollDamage(pc.damage);
          e.hp = Math.max(0, e.hp - dmg);
          logCombat(`Hit for ${dmg}. ${e.name} now ${e.hp}/${e.maxHp}.`);
        } else {
          logCombat("Miss.");
        }
        advance();
      }
    }));
    tree.lines[2].choices = choices.length ? choices : [{ text:"No valid targets", next:1 }];
  }

  function enemyPhase(){
    let count = foes.length;
    while (count-- > 0){
      const who = order[turn];
      if (who === "PC") break;
      const idx = parseInt(who.slice(1),10);
      const e = foes[idx];
      if (e && isAlive(e)){
        const ar = attackRoll(e, pc);
        logCombat(`${e.name} attacks Aya: d20=${ar.nat} ${ar.crit ? "(CRIT)" : ""} total ${ar.total} vs AC ${pc.ac}.`);
        let hit = ar.hit;
        if (pc.dodging){
          const ar2 = attackRoll(e, pc);
          logCombat(`Dodge → disadvantage: second roll ${ar2.nat} (total ${ar2.total}).`);
          hit = ((ar.total >= ar2.total) ? ar : ar2).hit;
        }
        if (hit){
          const dmg = ar.crit ? rollDamage(e.damage) + rollDamage(e.damage) : rollDamage(e.damage);
          pc.hp = Math.max(0, pc.hp - dmg);
          logCombat(`${e.name} hits for ${dmg}. Aya ${pc.hp}/${pc.maxHp}.`);
        } else {
          logCombat(`${e.name} misses.`);
        }
      }
      turn = (turn + 1) % order.length;
      if (turn === 0) { round += 1; pc.dodging = false; }
      if (endState()) break;
    }
    setHub();
  }

  setHub();
  return tree;
}
