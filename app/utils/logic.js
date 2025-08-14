export function isWeapon(item){ return item && (item.type==='melee' || item.type==='ranged'); }
export function isArmor(item){ return item && item.type && ['light','medium','heavy'].includes(item.type); }
export function isShield(item){ return item && item.type==='shield'; }
export function isTwoHanded(item){ return !!(item?.properties||[]).some(p => p.toLowerCase().includes('two-handed')); }
export function isUsableItem(item){ return item && (item.type==='potion' || item.type==='light' || item.uses); }
