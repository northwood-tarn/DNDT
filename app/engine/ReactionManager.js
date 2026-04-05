// app/engine/ReactionManager.js
// Centralized reactions (player-facing prompt + slot spending).
// Currently supports the SHIELD spell trigger.
// Usage: const used = await considerShield(state, ctx, log);
//
// ctx = {
//   attackerId: string,
//   attackTotal: number,          // d20 + attack bonus
//   targetAC: number,             // defender's current AC (before Shield)
//   isMagicMissile: boolean       // true when the incoming effect is Magic Missile
// }

function ensureSpellSlots(p) {
  // Expect p.spellSlots like { level1: { max: N, current: N }, ... }
  if (!p.spellSlots) p.spellSlots = { level1: { max: 0, current: 0 } };
  return p.spellSlots;
}

function findKnownSpell(p, id) {
  const list = p?.spells?.known || [];
  return list.includes(id);
}

function spendLevel1Slot(p) {
  const slots = ensureSpellSlots(p);
  if (!slots.level1 || typeof slots.level1.current !== "number") return false;
  if (slots.level1.current <= 0) return false;
  slots.level1.current -= 1;
  return true;
}

function promptYesNo(message) {
  // Minimal DOM prompt that returns a Promise<boolean>. Falls back to window.confirm.
  if (typeof document === "undefined") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(message) : false);
  }
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "99999";
    const card = document.createElement("div");
    card.style.background = "#0e1520";
    card.style.border = "1px solid #22314d";
    card.style.borderRadius = "10px";
    card.style.padding = "14px";
    card.style.width = "420px";
    card.style.fontFamily = "var(--mono, monospace)";
    const text = document.createElement("div");
    text.textContent = message;
    text.style.marginBottom = "10px";
    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.justifyContent = "flex-end";
    const noBtn = document.createElement("button");
    noBtn.textContent = "No";
    noBtn.className = "btn";
    const yesBtn = document.createElement("button");
    yesBtn.textContent = "Cast Shield (1st‑level slot)";
    yesBtn.className = "btn btn-confirm";
    noBtn.onclick = () => { document.body.removeChild(overlay); resolve(false); };
    yesBtn.onclick = () => { document.body.removeChild(overlay); resolve(true); };
    bar.appendChild(noBtn); bar.appendChild(yesBtn);
    card.appendChild(text); card.appendChild(bar);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

export async function considerShield(state, ctx, log = ()=>{}) {
  try { log = typeof log === "function" ? log : ()=>{}; } catch {}
  const defender = state?.combat?.player;
  if (!defender) return false;

  // Must know Shield and have a 1st-level slot
  const knows = findKnownSpell(defender, "shield");
  if (!knows) return false;

  const slots = ensureSpellSlots(defender);
  if (!slots.level1 || slots.level1.current <= 0) { log("No 1st‑level spell slots left for Shield."); return false; }

  const wouldHit = ctx.attackTotal >= ctx.targetAC;
  const shieldCouldSave = ctx.attackTotal < (ctx.targetAC + 5);
  const mmAutoValid = !!ctx.isMagicMissile;

  if (!(mmAutoValid || (wouldHit && shieldCouldSave))) {
    // No need/benefit
    return false;
  }

  const why = mmAutoValid ? "Magic Missile incoming (Shield negates it)" : `Attack total ${ctx.attackTotal} vs AC ${ctx.targetAC} — Shield would raise AC to ${ctx.targetAC + 5} (turning hit into miss)`;
  const ok = await promptYesNo(`Reaction: Cast SHIELD?\n${why}`);
  if (!ok) return false;

  // Spend slot
  if (!spendLevel1Slot(defender)) { log("Failed to spend a 1st‑level slot."); return false; }

  log("You cast Shield (reaction): +5 AC until the start of your next turn.");
  // We let the caller apply the +5 for the current resolution; for persistence, you can set a short-lived flag:
  defender._shieldJustCast = true; // hint for UI if needed
  return true;
}
