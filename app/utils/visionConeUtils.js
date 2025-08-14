export function getFacingConeTiles(actor, range=6){
  const out=[]; const {x,y,facing='N'}=actor;
  for(let dy=-range; dy<=range; dy++){
    for(let dx=-range; dx<=range; dx++){
      const tx=x+dx, ty=y+dy; if(!dx && !dy) continue;
      if(facing==='N' && dy<0 && Math.abs(dx)<=-dy) out.push([tx,ty]);
      if(facing==='S' && dy>0 && Math.abs(dx)<=dy) out.push([tx,ty]);
      if(facing==='E' && dx>0 && Math.abs(dy)<=dx) out.push([tx,ty]);
      if(facing==='W' && dx<0 && Math.abs(dy)<=-dx) out.push([tx,ty]);
    }
  }
  return out;
}
