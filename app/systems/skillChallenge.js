// systems/skillChallenge.js
// Minimal skill challenge helper for dialogue choices.
import { logSystem } from '../engine/log.js';

function d20() { return Math.floor(Math.random() * 20) + 1; }

export function attemptSkill(actor, skill = "Survival", dc = 10) {
  const bonus = (actor?.skills && typeof actor.skills[skill] === 'number') ? actor.skills[skill] : 0;
  const roll = d20();
  const total = roll + bonus;
  const success = total >= dc;
  logSystem(`Skill check: ${skill} DC ${dc} — roll ${roll} + ${bonus} = ${total} → ${success ? "SUCCESS" : "FAIL"}`);
  return { success, roll, total, bonus };
}

// Added: startSkillChallenge orchestrator (multi-stage, uses attemptSkill). 
// API: startSkillChallenge({ id, stages, maxFailures=1, onCompleteSuccess, onCompleteFail }, ctx)
export async function startSkillChallenge(challengeDef, ctx={}){
  const log = (ctx && ctx.log) || (typeof logSystem !== 'undefined' ? logSystem : console.log);
  const actor = (ctx && ctx.actor) || (typeof state !== 'undefined' && state.player) || { skills: {} };
  const movePlayerTo = ctx && ctx.movePlayerTo;
  const applyDamage = ctx && ctx.applyDamage;
  const addTime = ctx && ctx.addTime;

  const stages = Array.isArray(challengeDef?.stages) ? challengeDef.stages : [];
  const maxFailures = challengeDef?.maxFailures ?? 1;
  let fails = 0;
  for (let i=0; i<stages.length; i++){
    const st = stages[i];
    // pick skill: if provided in ctx.choice, else first allowed
    let chosenSkill = st.skills && st.skills[0] || 'Athletics';
    if (ctx && typeof ctx.chooseSkill === 'function'){
      chosenSkill = await ctx.chooseSkill(st.skills || [chosenSkill], st);
    }
    const dc = st.dc ?? 10;
    const res = attemptSkill(actor, chosenSkill, dc);
    log(`Challenge[${challengeDef.id}] — Stage ${i+1}: ${st.name} — ${chosenSkill} vs DC ${dc} → ${res.success ? "SUCCESS" : "FAIL"}`);
    if (res.success){
      if (typeof st.onStageSuccess === 'function'){ try{ st.onStageSuccess(ctx, res); }catch{} }
    } else {
      fails++;
      if (typeof st.onStageFail === 'function'){ try{ st.onStageFail(ctx, res); }catch{} }
      if (fails >= maxFailures){
        if (typeof challengeDef.onCompleteFail === 'function'){ try{ challengeDef.onCompleteFail(ctx, { fails }); }catch{} }
        return { success: false, fails };
      }
    }
  }
  if (typeof challengeDef.onCompleteSuccess === 'function'){ try{ challengeDef.onCompleteSuccess(ctx, {}); }catch{} }
  return { success: true, fails };
}
