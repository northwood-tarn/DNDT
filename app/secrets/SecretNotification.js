export function presentSecretNotifications(events, options = {}) {
  const messages = (events || []).filter((event) => event.type === "secret.uncovered" && event.message).map((event) => event.message);
  if (typeof options.onMessage === "function") for (const message of messages) options.onMessage(message);
  if (typeof document === "undefined" || options.render === false) return messages;
  let region = document.querySelector("[data-secret-notifications]");
  if (!region) {
    installStyles();
    region = document.createElement("section");
    region.dataset.secretNotifications = "";
    region.className = "secret-notifications";
    region.setAttribute("aria-live", "assertive");
    region.setAttribute("aria-atomic", "true");
    document.body.append(region);
  }
  for (const message of messages) {
    const notice = document.createElement("p");
    notice.className = "secret-notification";
    notice.textContent = message;
    region.append(notice);
    const duration = Math.max(0, Number(options.durationMs) || 5000);
    if (duration) globalThis.setTimeout(() => notice.remove(), duration);
  }
  return messages;
}

function installStyles() {
  if (document.querySelector("[data-secret-notification-styles]")) return;
  const style = document.createElement("style");
  style.dataset.secretNotificationStyles = "";
  style.textContent = ".secret-notifications{position:fixed;left:50%;top:9%;z-index:80;display:grid;gap:8px;width:min(620px,calc(100vw - 40px));transform:translateX(-50%);pointer-events:none}.secret-notification{margin:0;padding:14px 18px;border:1px solid rgba(199,181,128,.55);background:rgba(10,14,11,.94);box-shadow:0 12px 34px rgba(0,0,0,.45);color:#e7dfc7;text-align:center;font:600 17px/1.4 Georgia,serif}";
  document.head.append(style);
}
