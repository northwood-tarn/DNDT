// text-mode engine/sceneRouter.js
// Minimal scene router that avoids DOM/window. Use with sceneManager and inputManager.

let currentScene = null;

export function changeScene(newScene, data) {
  if (currentScene && typeof currentScene.cleanup === 'function') {
    currentScene.cleanup();
  }
  currentScene = newScene;
  if (currentScene && typeof currentScene.start === 'function') {
    currentScene.start(data);
  }
  return currentScene;
}

export function getCurrentScene() {
  return currentScene;
}
