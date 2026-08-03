import { getDiscoveryState, revealDiscovery, visitDiscovery } from "../state/discoveryState.js";
import { hasStoryFlag, normalizeSaveGameState, setSaveGameLocation } from "../state/saveGameState.js";

export function createTraversalMap(input = {}) {
  return { id: input.id || null, title: input.title || "", nodes: (input.nodes || []).map(node => ({ ...node })), edges: (input.edges || []).map(edge => ({ bidirectional: true, ...edge })) };
}
export function validateTraversalMap(input) {
  const map=createTraversalMap(input), errors=[], ids=new Set();
  if(!map.id) errors.push("map id is required");
  for(const node of map.nodes){if(!node.id)errors.push("node id is required");if(ids.has(node.id))errors.push(`duplicate node ${node.id}`);ids.add(node.id)}
  for(const edge of map.edges){if(!edge.id)errors.push("edge id is required");if(!ids.has(edge.from)||!ids.has(edge.to))errors.push(`edge ${edge.id} references unknown node`)}
  return errors;
}
export function beginTraversal(saveGame,mapInput,nodeId){const map=createTraversalMap(mapInput);const errors=validateTraversalMap(map);if(errors.length)throw new Error(errors.join("; "));if(!map.nodes.some(n=>n.id===nodeId))throw new Error(`Unknown traversal node: ${nodeId}`);let save=setTraversal(saveGame,map.id,nodeId,null);save=revealDiscovery(save,map.id,nodeId,{label:map.nodes.find(n=>n.id===nodeId)?.label});return visitDiscovery(save,map.id,nodeId,{label:map.nodes.find(n=>n.id===nodeId)?.label})}
export function getAvailableRoutes(saveGame,mapInput){const map=createTraversalMap(mapInput),save=normalizeSaveGameState(saveGame),current=save.world.traversal[map.id]?.nodeId;return map.edges.filter(edge=>edge.from===current||(edge.bidirectional&&edge.to===current)).map(edge=>({...edge,destinationId:edge.from===current?edge.to:edge.from})).filter(edge=>requirementsMet(save,edge.requirements)&&nodeIsVisible(save,map,map.nodes.find(node=>node.id===edge.destinationId)))}
export function traverseRoute(saveGame,mapInput,edgeId){const map=createTraversalMap(mapInput),route=getAvailableRoutes(saveGame,map).find(edge=>edge.id===edgeId);if(!route)throw new Error(`Traversal route is unavailable: ${edgeId}`);const previous=normalizeSaveGameState(saveGame).world.traversal[map.id]?.nodeId;let save=setTraversal(saveGame,map.id,route.destinationId,edgeId);const node=map.nodes.find(n=>n.id===route.destinationId);save=revealDiscovery(save,map.id,route.destinationId,{label:node?.label});save=visitDiscovery(save,map.id,route.destinationId,{label:node?.label});return{saveGame:save,from:previous,to:route.destinationId,edge:route,triggerId:node?.triggerId||null}}
function setTraversal(saveGame,mapId,nodeId,edgeId){let save=normalizeSaveGameState(saveGame);save=normalizeSaveGameState({...save,world:{...save.world,traversal:{...save.world.traversal,[mapId]:{mapId,nodeId,lastEdgeId:edgeId,updatedAt:new Date().toISOString()}}}});return setSaveGameLocation(save,{mapId,nodeId,mode:"grand"})}
function requirementsMet(save,requirements={}){return !(requirements.requiredFlags||[]).some(f=>!hasStoryFlag(save,f))&&!(requirements.forbiddenFlags||[]).some(f=>hasStoryFlag(save,f))}
function nodeIsVisible(save,map,node){if(!node)return false;const authored=node.discovery?.state||node.discoveryState||"visible";return !["hidden","locked"].includes(getDiscoveryState(save,map.id,node.id,{defaultState:authored}))}
