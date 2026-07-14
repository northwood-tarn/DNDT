import { keyOf } from "./grid.js";
export function terrainAt(grid,pos){return grid.terrain?.get?.(keyOf(pos))||grid.terrain?.[keyOf(pos)]||"normal"}
export function elevationAt(grid,pos){return Number(grid.elevation?.get?.(keyOf(pos))??grid.elevation?.[keyOf(pos)]??0)||0}
export function elevationStepCost(grid,from,to){const rise=elevationAt(grid,to)-elevationAt(grid,from);return rise>0?Math.ceil(rise):0}
export function canTraverseElevation(grid,from,to,options={}){const rise=Math.abs(elevationAt(grid,to)-elevationAt(grid,from));const max=options.maxElevationStep??1;return rise<=max?{ok:true,cost:elevationStepCost(grid,from,to)}:{ok:false,cost:Infinity,reason:`elevation change ${rise} exceeds ${max}`}}
export function hazardsAt(grid,pos){const hazards=grid.hazards instanceof Map?grid.hazards.get(keyOf(pos)):grid.hazards?.[keyOf(pos)];return Array.isArray(hazards)?hazards:hazards?[hazards]:[]}
export function resolveHazardEntry(grid,pos,actor){return hazardsAt(grid,pos).filter(h=>h.active!==false).map(h=>({hazardId:h.id,actorId:actor.id,save:h.save||null,damage:h.damage||null,condition:h.condition||null}))}
export function validateTacticalTerrain(grid){const errors=[];for(const [key,value] of entries(grid.elevation)){if(!Number.isFinite(Number(value)))errors.push(`elevation ${key} must be numeric`)}for(const [key,list] of entries(grid.hazards)){for(const hazard of Array.isArray(list)?list:[list])if(!hazard?.id)errors.push(`hazard ${key} requires id`)}return errors}
function entries(value){return value instanceof Map?[...value.entries()]:Object.entries(value||{})}
