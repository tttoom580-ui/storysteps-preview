export const DIRECT_CHAPTERS=5;
export const REWARD_CHAPTERS=4;
export function blockForChapter(number,total=25){
 if(!Number.isInteger(number)||number<1||number>total)throw new RangeError('章節不存在');
 if(number<=DIRECT_CHAPTERS)return null;
 const start=DIRECT_CHAPTERS+1+Math.floor((number-DIRECT_CHAPTERS-1)/REWARD_CHAPTERS)*REWARD_CHAPTERS;
 return {start,end:Math.min(total,start+REWARD_CHAPTERS-1)};
}
export function appendGrant(existing,story,start,source,now=Date.now()){
 if(!['launch-gift','rewarded-ad'].includes(source))throw new Error('無效解鎖來源');
 const block=blockForChapter(start);if(!block||block.start!==start)throw new Error('無效章節區段');
 const grants=Array.isArray(existing)?existing:[];
 if(grants.some(g=>g.story===story&&g.start===start))return grants;
 return [...grants,{story,start,end:block.end,source,grantedAt:now}];
}
