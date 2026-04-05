export function qualifiesForSneakAttack(a,d,allies=[]){ return !!(a.hasAdvantage || allies.some(x=>Math.abs(x.x-d.x)+Math.abs(x.y-d.y)===1 && x!==a && x.hp>0)); }
