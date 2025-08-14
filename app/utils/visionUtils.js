import { state } from '../engine/stateStore.js';
export function updateVisibility(grid=state.tileGrid, px=state.player.x, py=state.player.y){
  if(!grid) return;
  const R=6;
  for(let x=0;x<grid.length;x++){
    for(let y=0;y<grid[0].length;y++){
      const dx=x-px, dy=y-py;
      const d=Math.sqrt(dx*dx+dy*dy);
      const vis=d<=R;
      const t=grid[x][y];
      t.visible=vis; if(vis) t.explored=true; t.isLit=vis || t.lightSource===true;
    }
  }
}
