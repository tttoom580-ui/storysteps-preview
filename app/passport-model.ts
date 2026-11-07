export const ranks=[{name:'初頁旅人',xp:0},{name:'青銅探索者',xp:350},{name:'白銀收藏家',xp:1050},{name:'黃金領航員',xp:2800},{name:'白金漫遊者',xp:5250},{name:'鑽石編年者',xp:8750},{name:'傳說藏書家',xp:14000}];
export function rankFor(xp:number){const index=ranks.reduce((n,r,i)=>xp>=r.xp?i:n,0);return {current:ranks[index],next:ranks[index+1]||null}}
export function monthStart(now=Date.now()){const d=new Date(now+8*3600000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)-8*3600000}
