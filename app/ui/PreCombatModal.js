// app/ui/PreCombatModal.js — simple DOM modal (drop-in, no framework)
export function showPreCombatModal({ title = "Encounter", text = "", enemies = [], onBegin, onCancel }) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "1000";

  const card = document.createElement("div");
  card.style.background = "#1b1f2a";
  card.style.color = "#e6eefb";
  card.style.border = "1px solid #2b3242";
  card.style.borderRadius = "12px";
  card.style.padding = "16px 18px";
  card.style.minWidth = "320px";
  card.style.maxWidth = "520px";
  card.style.boxShadow = "0 10px 40px rgba(0,0,0,0.5)";

  const h = document.createElement("h3");
  h.textContent = title;
  h.style.margin = "0 0 8px"; h.style.fontSize = "18px";

  const p = document.createElement("p");
  p.textContent = text;
  p.style.margin = "0 0 10px"; p.style.fontSize = "14px"; p.style.lineHeight = "1.4";

  const list = document.createElement("ul");
  list.style.margin = "0 0 12px"; list.style.padding = "0 0 0 16px"; list.style.fontSize = "13px";
  enemies.forEach(e => {
    const li = document.createElement("li");
    li.textContent = (typeof e === "string") ? e : (e?.name || "Enemy");
    list.appendChild(li);
  });

  const row = document.createElement("div");
  row.style.display = "flex"; row.style.gap = "8px"; row.style.justifyContent = "flex-end";

  function btn(label){
    const b = document.createElement("button");
    b.textContent = label;
    b.style.border = "1px solid #2b3242";
    b.style.background = "#263045";
    b.style.color = "#e6eefb";
    b.style.borderRadius = "8px";
    b.style.padding = "6px 10px";
    b.style.cursor = "pointer";
    b.onkeydown = (ev)=>{ if(ev.key==="Enter"||ev.key===" ") b.click(); };
    return b;
  }

  const cancel = btn("Back");
  cancel.onclick = () => { try { overlay.remove(); } catch {}; if (onCancel) onCancel(); };
  const begin = btn("Begin");
  begin.onclick = () => { try { overlay.remove(); } catch {}; if (onBegin) onBegin(); };

  row.appendChild(cancel); row.appendChild(begin);

  card.appendChild(h);
  card.appendChild(p);
  if (enemies.length) {
    const cap = document.createElement("div");
    cap.textContent = "Enemies:";
    cap.style.margin = "6px 0 4px"; cap.style.fontSize = "12px"; cap.style.opacity = "0.85";
    card.appendChild(cap);
    card.appendChild(list);
  }
  card.appendChild(row);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  return { close(){ try { overlay.remove(); } catch {} } };
}
