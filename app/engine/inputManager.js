
// engine/inputManager.js — augmented minimal manager with movement snapshot
const bindings = new Map();
const listeners = new Set();
const state = { up:false, down:false, left:false, right:false };
export function bind(key, command){ bindings.set(key, command); }
export function onCommand(cb){ listeners.add(cb); return ()=>listeners.delete(cb); }
export function dispatchKey(key){ const cmd=bindings.get(key); if(!cmd) return false; for(const cb of listeners) cb(cmd); return true; }
export function dispatch(command, payload){ for(const cb of listeners) cb(command, payload); }
export function attachDOM(){
  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k)) e.preventDefault();
    if(k==='w'||k==='arrowup') state.up=true;
    if(k==='s'||k==='arrowdown') state.down=true;
    if(k==='a'||k==='arrowleft') state.left=true;
    if(k==='d'||k==='arrowright') state.right=true;
  }, {passive:false});
  window.addEventListener('keyup', e=>{
    const k=e.key.toLowerCase();
    if(k==='w'||k==='arrowup') state.up=false;
    if(k==='s'||k==='arrowdown') state.down=false;
    if(k==='a'||k==='arrowleft') state.left=false;
    if(k==='d'||k==='arrowright') state.right=false;
  }, {passive:true});
}
export function movementState(){ return { ...state }; }
