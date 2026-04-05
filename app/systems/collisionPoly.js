
// systems/collisionPoly.js
export function pointInPolygon(x, y, poly){
  let inside = false;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++){
    const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
    const inter = ((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-9) + xi);
    if (inter) inside = !inside;
  }
  return inside;
}
export function blockMove(nx, ny, polys){
  for (const poly of polys){
    if (pointInPolygon(nx, ny, poly)){ return { x:nx, y:ny, blocked:true }; }
  }
  return { x:nx, y:ny, blocked:false };
}
