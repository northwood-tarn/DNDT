export function battlesRequiredForLevel(level){
  if(level<=1) return 1;
  if(level===2) return 2;
  if(level===3) return 3;
  return 4;
}
export function getClassFeaturesForLevel(cls, level){
  const gains = [];
  if(level===2) gains.push({name:`${cls} Training`, description:`You advance to level ${level}.`, type:'Passive'});
  if(level===3) gains.push({name:`${cls} Technique`, description:`New technique unlocked.`, type:'Passive'});
  return gains;
}
