// app/ui/RestUI.js
// Short Rest overlay — uses hit dice & dice.js integration.

import { rollWithDetail } from "../utils/dice.js";
import { getState } from "../state/stateStore.js";

let root = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlayer() {
  const state = getState();
  return (state && state.player) || null;
}

function getHpSnapshot(player) {
  const current =
    typeof player.hp === "number"
      ? player.hp
      : typeof player.currentHp === "number"
      ? player.currentHp
      : null;

  const max =
    typeof player.maxHp === "number"
      ? player.maxHp
      : typeof player.hpMax === "number"
      ? player.hpMax
      : typeof player.maxHP === "number"
      ? player.maxHP
      : null;

  return { current, max };
}

function setPlayerHp(player, newHp, max) {
  const clamped = Math.max(0, Math.min(newHp, max));
  if (typeof player.hp === "number") {
    player.hp = clamped;
  } else if (typeof player.currentHp === "number") {
    player.currentHp = clamped;
  }
}

function getHitDice(player) {
  const hd = player.hitDice || {};
  const size = Number.isFinite(hd.size) ? hd.size : 8;
  const total = Number.isFinite(hd.total) ? hd.total : 0;
  const spent = Number.isFinite(hd.spent) ? hd.spent : 0;
  const remaining = Math.max(0, total - spent);
  return { size, total, spent, remaining };
}

function setHitDice(player, { size, total, spent }) {
  if (!player.hitDice) {
    player.hitDice = {};
  }
  if (Number.isFinite(size)) player.hitDice.size = size;
  if (Number.isFinite(total)) player.hitDice.total = total;
  if (Number.isFinite(spent)) player.hitDice.spent = spent;
}

function getConMod(player) {
  if (typeof player.conMod === "number") return player.conMod;
  if (typeof player.constitutionMod === "number") return player.constitutionMod;
  if (typeof player.con === "number") {
    return Math.floor((player.con - 10) / 2);
  }
  return 0;
}

function rollHitDieWithDetail(size) {
  const result = rollWithDetail(`1d${size}`);
  if (!result) {
    const fallback = 1 + Math.floor(Math.random() * size);
    return {
      dieRoll: fallback,
      total: fallback,
      rolls: [fallback],
      modifier: 0
    };
  }

  const rolls = Array.isArray(result.rolls) ? result.rolls : [];
  const dieRoll = typeof rolls[0] === "number" ? rolls[0] : result.total;

  return {
    dieRoll,
    total: result.total,
    rolls,
    modifier: result.modifier ?? 0
  };
}

// ---------------------------------------------------------------------------
// UI Module
// ---------------------------------------------------------------------------

const RestUI = {
  open(options = {}) {
    const type = options.type || "short";

    if (root) {
      this.close(false);
    }

    const player = getPlayer();
    const session = { totalHealed: 0, diceSpent: 0 };

    // Overlay
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "#222",
      color: "#eee",
      padding: "20px",
      border: "2px solid #555",
      width: "460px",
      maxHeight: "75%",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 0 12px rgba(0,0,0,0.8)",
      fontFamily: "serif"
    });

    const title = document.createElement("h2");
    title.textContent = "Take a Short Rest";
    panel.appendChild(title);

    const desc = document.createElement("p");
    desc.textContent =
      "You bind wounds and try to steady your breath as the darkness presses in.";
    panel.appendChild(desc);

    const statusP = document.createElement("p");
    const diceP = document.createElement("p");
    panel.appendChild(statusP);
    panel.appendChild(diceP);

    const logDiv = document.createElement("div");
    Object.assign(logDiv.style, {
      flex: "1 1 auto",
      overflowY: "auto",
      marginTop: "4px",
      marginBottom: "8px",
      fontSize: "13px",
      lineHeight: "1.4",
      borderTop: "1px solid #444",
      borderBottom: "1px solid #444",
      paddingTop: "4px",
      paddingBottom: "4px"
    });
    panel.appendChild(logDiv);

    function appendLog(line) {
      const p = document.createElement("p");
      p.textContent = line;
      p.style.margin = "0 0 2px 0";
      logDiv.appendChild(p);
      logDiv.scrollTop = logDiv.scrollHeight;
    }

    function refreshStatus() {
      if (!player) {
        statusP.textContent = "No active character found.";
        diceP.textContent = "";
        return;
      }

      const { current, max } = getHpSnapshot(player);
      const hd = getHitDice(player);

      statusP.textContent = `HP: ${current}/${max}  (+${session.totalHealed} this rest)`;
      diceP.textContent = `Hit Dice: ${hd.remaining}d${hd.size} remaining (spent this rest: ${session.diceSpent})`;
    }

    if (player) {
      appendLog("You settle in, watching the shadows while your wounds are tended.");
    }

    // Buttons
    const buttonsDiv = document.createElement("div");
    Object.assign(buttonsDiv.style, {
      display: "flex",
      justifyContent: "space-between",
      gap: "8px",
      marginTop: "8px"
    });

    // Left (Spend Hit Die)
    const leftButtons = document.createElement("div");
    leftButtons.style.display = "flex";
    leftButtons.style.gap = "8px";

    const rollBtn = document.createElement("button");
    rollBtn.textContent = "Spend 1 Hit Die";
    rollBtn.onclick = () => {
      if (!player) return;

      const { current, max } = getHpSnapshot(player);
      const hd = getHitDice(player);

      if (hd.remaining <= 0) {
        appendLog("You have no hit dice left.");
        return;
      }
      if (current >= max) {
        appendLog("You are already at full health.");
        return;
      }

      const conMod = getConMod(player);
      const detail = rollHitDieWithDetail(hd.size);
      const heal = Math.max(0, detail.dieRoll + conMod);

      const newHp = Math.min(current + heal, max);
      setPlayerHp(player, newHp, max);

      // Persist HD usage
      setHitDice(player, {
        size: hd.size,
        total: hd.total,
        spent: hd.spent + 1
      });

      session.diceSpent += 1;
      session.totalHealed += heal;

      appendLog(
        `You spend 1d${hd.size}: rolled ${detail.dieRoll}${
          conMod ? ` (CON ${conMod >= 0 ? "+" : ""}${conMod})` : ""
        }, healing ${heal} HP.`
      );

      refreshStatus();
    };

    leftButtons.appendChild(rollBtn);

    // Right (Cancel / Finish)
    const rightButtons = document.createElement("div");
    rightButtons.style.display = "flex";
    rightButtons.style.gap = "8px";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => this.close(false);

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Finish Rest";
    confirmBtn.onclick = () => this.close(true);

    rightButtons.appendChild(cancelBtn);
    rightButtons.appendChild(confirmBtn);

    buttonsDiv.appendChild(leftButtons);
    buttonsDiv.appendChild(rightButtons);
    panel.appendChild(buttonsDiv);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    root = overlay;
    refreshStatus();
  },

  close(didRest = false) {
    if (root?.parentNode) root.parentNode.removeChild(root);
    root = null;

    window.dispatchEvent(
      new CustomEvent("rest:short:completed", {
        detail: { didRest, type: "short" }
      })
    );

    if (didRest) {
      window.dispatchEvent(
        new CustomEvent("autosave:trigger", {
          detail: { reason: "short_rest" }
        })
      );
    }
  }
};

export default RestUI;