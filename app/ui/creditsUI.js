// app/ui/CreditsUI.js
// Simple scrollable credits overlay (UI, not a scene)

let root = null;

const CREDITS_LINES = [
  "In grateful acknowledgement of the following adventurers:",
  "",
  "Elminster Aumar",
  "Mordenkainen",
  "Bigby",
  "Tenser",
  "Tasha",
  "Vecna",
  "Strahd von Zarovich",
  "Drizzt Do'Urden",
  "Bruenor Battlehammer",
  "Catti-brie",
  "Wulfgar",
  "Regis",
  "Raistlin Majere",
  "Caramon Majere",
  "Tasslehoff Burrfoot",
  "Laurana Kanan",
  "Volo Geddarm",
  "Jarlaxle Baenre",
  "The Raven Queen",
  "",
  "And all the unnamed heroes who delved too deep."
];

const CreditsUI = {
  open() {
    if (root) {
      this.close();
    }

    const overlay = document.createElement("div");
    overlay.className = "credits-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.85)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    });

    const panel = document.createElement("div");
    panel.className = "credits-panel";
    Object.assign(panel.style, {
      background: "#111",
      color: "#eee",
      padding: "24px",
      border: "2px solid #444",
      width: "480px",
      maxHeight: "80%",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 0 20px rgba(0,0,0,0.8)",
      fontFamily: "serif"
    });

    const title = document.createElement("h1");
    title.textContent = "Credits";
    title.style.margin = "0 0 8px 0";
    title.style.fontSize = "28px";
    panel.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = "In honour of the tales that came before.";
    subtitle.style.margin = "0 0 16px 0";
    subtitle.style.fontStyle = "italic";
    subtitle.style.fontSize = "14px";
    panel.appendChild(subtitle);

    const scroll = document.createElement("div");
    scroll.className = "credits-scroll";
    Object.assign(scroll.style, {
      flex: "1 1 auto",
      overflowY: "auto",
      marginBottom: "12px",
      paddingRight: "8px",
      fontSize: "14px",
      lineHeight: "1.6"
    });

    for (const line of CREDITS_LINES) {
      const p = document.createElement("p");
      p.textContent = line;
      p.style.margin = "0 0 4px 0";
      scroll.appendChild(p);
    }

    panel.appendChild(scroll);

    const buttons = document.createElement("div");
    buttons.className = "credits-buttons";
    Object.assign(buttons.style, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px"
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => {
      this.close();
    });
    buttons.appendChild(closeBtn);

    panel.appendChild(buttons);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    root = overlay;
  },

  close() {
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    root = null;
    window.dispatchEvent(new CustomEvent("credits:closed"));
  }
};

export default CreditsUI;