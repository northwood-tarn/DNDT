import assert from "node:assert/strict";
import { canTraverseElevation, resolveHazardEntry, validateTacticalTerrain } from "../../app/combat/tacticalTerrain.js";
import { resolveCombatAftermath } from "../../app/encounters/aftermath.js";
import { beginTraversal, createTraversalMap, getAvailableRoutes, traverseRoute, validateTraversalMap } from "../../app/exploration/grandTraversal.js";
import { returnTransition, transitionSaveGame } from "../../app/flow/transitionState.js";
import { createJournalViewModel } from "../../app/overlays/JournalOverlay.js";
import { createCharacterViewModel } from "../../app/overlays/CharacterOverlay.js";
import { createStatusEffectsViewModel } from "../../app/overlays/StatusEffectsOverlay.js";
import { createTargetInfoViewModel } from "../../app/overlays/TargetInfoOverlay.js";
import { getResaleRate, listSellableHoldings, sellHolding } from "../../app/npc/merchant.js";
import { executeNpcOffer, listAvailableNpcOffers } from "../../app/npc/services.js";
import { createEmptySaveGameState, setStoryFlag } from "../../app/state/saveGameState.js";
import { startQuest } from "../../app/state/questState.js";

export function runRuntimeSystemTests(){traversesPersistentGrandMaps();routesAndReturnsAcrossModes();appliesCombatAftermath();resolvesTacticalTerrain();buildsJournalPresentationModel();runsMerchantTransactions();buildsCharacterAndTargetViews()}
function mapFixture(){return createTraversalMap({id:"map:test.grand",nodes:[{id:"node:start",label:"Start"},{id:"node:gate",label:"Gate",triggerId:"trigger:test.gate"}],edges:[{id:"edge:start.gate",from:"node:start",to:"node:gate",requirements:{requiredFlags:["flag:gate.open"]}}]})}
function traversesPersistentGrandMaps(){const map=mapFixture();assert.deepEqual(validateTraversalMap(map),[]);let save=beginTraversal(createEmptySaveGameState(),map,"node:start");assert.equal(getAvailableRoutes(save,map).length,0);save=setStoryFlag(save,"flag:gate.open");const moved=traverseRoute(save,map,"edge:start.gate");assert.equal(moved.to,"node:gate");assert.equal(moved.triggerId,"trigger:test.gate");assert.equal(moved.saveGame.world.location.nodeId,"node:gate")}
function routesAndReturnsAcrossModes(){let save=createEmptySaveGameState({overrides:{world:{location:{mode:"grand",mapId:"map:test.grand",nodeId:"node:start"}}}});const combat=transitionSaveGame(save,{type:"combat",id:"encounter:test"},{pushReturn:true});assert.equal(combat.route.toScene,"combat");const returned=returnTransition(combat.saveGame);assert.equal(returned.route.type,"grand");assert.equal(returned.saveGame.world.location.nodeId,"node:start")}
function appliesCombatAftermath(){const definition={id:"quest:test.aftermath",title:"Aftermath",objectives:[{id:"objective:test.aftermath.win",text:"Win",initialStatus:"active"}]};let save=startQuest(createEmptySaveGameState(),definition);const result=resolveCombatAftermath(save,{outcome:"victory",loot:{gold:4,items:[{id:"gold_earring"}]},flags:{"flag:test.won":true},quests:[{type:"objective",questId:definition.id,objectiveId:definition.objectives[0].id,status:"completed"}],discoveries:[{mapId:"map:test",targetId:"node:test",state:"completed"}],destination:{type:"grand",id:"map:test",nodeId:"node:test"}});assert.equal(result.saveGame.inventory.currency.gold,4);assert.equal(result.saveGame.quests[definition.id].objectives[definition.objectives[0].id].status,"completed");assert.equal(result.route.toScene,"exploration")}
function resolvesTacticalTerrain(){const grid={elevation:new Map([["0,0",0],["1,0",1],["2,0",3]]),hazards:new Map([["1,0",[{id:"hazard:fire",damage:"1d6"}]]])};assert.equal(canTraverseElevation(grid,{x:0,y:0},{x:1,y:0}).ok,true);assert.equal(canTraverseElevation(grid,{x:1,y:0},{x:2,y:0}).ok,false);assert.equal(resolveHazardEntry(grid,{x:1,y:0},{id:"hero"})[0].hazardId,"hazard:fire");assert.deepEqual(validateTacticalTerrain(grid),[])}
function buildsJournalPresentationModel(){const quest={id:"quest:test.journal",title:"Journal Test",objectives:[]};const save=startQuest(createEmptySaveGameState(),quest);assert.equal(createJournalViewModel(save).activeQuests[0].title,"Journal Test")}
function runsMerchantTransactions(){
  const character={id:"merchant-test",slot:"active",characterDraft:{identity:{characterName:"Trader"}},resolvedCharacterSheet:{identity:{backgroundId:"merchant"},abilities:{charisma:{modifier:3}},proficiencies:{skills:["persuasion"],expertise:[]},proficiencyBonus:2}};
  let save=createEmptySaveGameState({initialGold:100,overrides:{party:{activeSlot:"active",slots:["active"],characterRecords:{active:character}},inventory:{shared:[{id:"rope_50_ft",quantity:2}],currency:{gold:100}}}});
  assert.deepEqual(getResaleRate(save),{percentage:59,charismaModifier:3,persuasionBonus:2,backgroundBonus:4});
  assert.equal(listSellableHoldings(save)[0].unitPrice,1);
  const sold=sellHolding(save,"rope_50_ft",1);assert.equal(sold.ok,true);assert.equal(sold.saveGame.inventory.currency.gold,101);save=sold.saveGame;
  const npc={id:"npc:test.merchant",services:[{id:"service:test.shop",offers:[{id:"offer:test.potion",kind:"item",itemId:"healing_potion",price:50,stock:1,requirements:{requiredFlags:["flag:test.potions"]}}]}]};
  assert.equal(listAvailableNpcOffers(save,npc).length,0);
  save=setStoryFlag(save,"flag:test.potions");
  const bought=executeNpcOffer(save,npc,"offer:test.potion");assert.equal(bought.ok,true);assert.equal(bought.saveGame.inventory.currency.gold,51);assert.equal(bought.saveGame.inventory.shared.some((entry)=>entry.id==="healing_potion"),true);
  assert.equal(listAvailableNpcOffers(bought.saveGame,npc).length,0);
}
function buildsCharacterAndTargetViews(){
  const sheet={identity:{characterName:"Test Hero",level:3,className:"Fighter"},abilities:{strength:{score:16,modifier:3}},proficiencyBonus:2,proficiencies:{skills:["athletics"],expertise:[],savingThrows:["strength"],armor:[],weapons:[],tools:[]},combatBasics:{armorClass:16,initiativeBonus:1,speed:6,passivePerception:11},durability:{maxHp:24},resources:[],features:[],spellcasting:{canCast:false}};
  const character=createCharacterViewModel({sheet,runtime:{hp:20,maxHp:24}});assert.equal(character.title,"Test Hero");assert.equal(character.combat[0].value,"20 / 24");
  const actor={id:"enemy:test",name:"Test Enemy",team:"enemies",hp:5,maxHp:10,tempHp:0,ac:13,speed:6,position:{x:2,y:3},conditions:[{id:"prone",label:"Prone",duration:{remaining:1}}],activeEffects:[],resistances:["cold"],immunities:[],conditionImmunities:[],resources:[]};
  assert.equal(createStatusEffectsViewModel({actor}).conditions[0].value,"1 round remaining");
  const target=createTargetInfoViewModel(actor);assert.equal(target.summary[1].value,"5 / 10");assert.equal(target.defences[0].value,"Cold");
}
