
// renderer/shellMount.js — mount helpers for your existing shell
export const shell = {
  top: document.getElementById('topBar'),
  left: document.getElementById('left'),
  center: document.getElementById('center'),
  right: document.getElementById('right'),
  bottom: document.getElementById('bottomLog'),
};
function clear(el){ if(!el) return; while(el.firstChild) el.removeChild(el.firstChild); }
export function mountCenter(node){ clear(shell.center); shell.center?.appendChild(node); }
export function mountRight(node){ clear(shell.right); shell.right?.appendChild(node); }
export function mountLeft(node){ clear(shell.left); shell.left?.appendChild(node); }
export function clearCenter(){ clear(shell.center); } export function clearRight(){ clear(shell.right); } export function clearLeft(){ clear(shell.left); }
export function setTop(text){ if (shell.top) shell.top.textContent = text||''; }
