
// engine/sceneRouter.js — augmented minimal registry router
let currentScene = null;
const registry = new Map();
export function registerScene(name, sceneObj){ registry.set(name, sceneObj); }
export function changeScene(nameOrObj, data){
  const scene = (typeof nameOrObj==='string') ? registry.get(nameOrObj) : nameOrObj;
  if (currentScene && typeof currentScene.cleanup==='function'){ try{ currentScene.cleanup(); }catch{} }
  currentScene = scene;
  if (currentScene && typeof currentScene.start==='function'){ currentScene.start(data||{}); }
  return currentScene;
}
export function getCurrentScene(){ return currentScene; }
