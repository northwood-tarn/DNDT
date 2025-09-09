// app/ui/DefeatModal.js — load or return to main menu (drop-in DOM)
export function showDefeatModal({ onLoadGame, onMainMenu }) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.7)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "1000";

  const card = document.createElement("div");
  card.style.background = "#1b1f2a";
  card.style.color = "#e6eefb";
  card.style.border = "1px solid #2b3242";
  card.style.borderRadius = "12px";
  card.style.padding = "18px 20px";
  card.style.minWidth = "320px";
  card.style.maxWidth = "520px";
  card.style.boxShadow = "0 10px 40px rgba(0,0,0,0.5)";

  const h = document.createElement("h3");
  h.textContent = "You have fallen";
  h.style.margin = "0 0 8px"; h.style.fontSize = "18px";

  const p = document.createElement("p");
  p.textContent = "What would you like to do?";
  p.style.margin = "0 0 12px"; p.style.fontSize = "14px"; p.style.lineHeight = "1.4";

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

  const load = btn("Load Game");
  load.onclick = () => { try { overlay.remove(); } catch {}; if (onLoadGame) onLoadGame(); };

  const main = btn("Main Menu");
  main.onclick = () => { try { overlay.remove(); } catch {}; if (onMainMenu) onMainMenu(); };

  row.appendChild(load); row.appendChild(main);
  card.appendChild(h); card.appendChild(p); card.appendChild(row);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  return { close(){ try { overlay.remove(); } catch {} } };
}
