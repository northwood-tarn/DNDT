// app/engine/log.js
// Console logger with in-memory ring buffer + DOM appender to #messageLog.

const MAX_LINES = 500;
const buffer = [];

function appendToDom(line) {
  try {
    let logEl = document.getElementById('messageLog');
    if (!logEl) {
      // Auto-create log container if missing
      const bottom = document.getElementById('bottomLog');
      if (bottom) {
        logEl = document.createElement('div');
        logEl.id = 'messageLog';
        logEl.className = 'log';
        bottom.appendChild(logEl);
      }
    }
    if (!logEl) return;

    const div = document.createElement('div');
    div.textContent = line;
    logEl.appendChild(div);

    // keep scroll pinned to bottom
    if (logEl.parentElement) {
      logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
    }
    logEl.scrollTop = logEl.scrollHeight;
  } catch {}
}

export function logMessage(message, type = 'system') {
  const line = `[${type.toUpperCase()}] ${message}`;
  buffer.push(line);
  if (buffer.length > MAX_LINES) buffer.shift();
  try { console.log(line); } catch {}
  appendToDom(line);
  return line;
}

export const logExplore = (msg) => logMessage(msg, 'explore');
export const logCombat  = (msg) => logMessage(msg, 'combat');
export const logSystem  = (msg) => logMessage(msg, 'system');

export function getLog() {
  return buffer.slice();
}

export function clearLog() {
  buffer.length = 0;
  try {
    const logEl = document.getElementById('messageLog');
    if (logEl) logEl.innerHTML = '';
  } catch {}
}