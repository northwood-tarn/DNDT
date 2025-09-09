
// scenes/ExplorationSpriteScene.V2.js
import { createWorldView } from '../renderer/pixiWorldView.js';
import { mountCenter, setTop } from '../renderer/shellMount.js';

let view=null;
export const ExplorationSpriteSceneV2 = {
  async start({ tmj='data/fields.tmj.json', title='Exploration' } = {}){
    setTop(title);
    const host = document.createElement('div');
    mountCenter(host);
    view = createWorldView({ width: 608, height: 592, designScreensHigh: 2.2, playerSizePx: 0.027, speed: 2.6 });
    view.mount(host);
    await view.loadFromTMJ(tmj);
  },
  cleanup(){ try{ view?.destroy(); }catch{} view=null; }
};
