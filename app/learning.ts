export const dayKey=(time:number)=>new Date(time).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
export function streak(records:string[],now=Date.now()){const days=new Set(records);let t=now,n=0;if(!days.has(dayKey(t)))t-=86400000;while(days.has(dayKey(t))){n++;t-=86400000}return n}
export function nextReview(stage:number,known:boolean,now=Date.now()){const s=known?Math.min(stage+1,5):0;return {stage:s,due:now+(known?[1,3,7,14,30][s-1]*86400000:600000)}}
