export function taipeiDay(time=Date.now()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(time);const v=t=>p.find(x=>x.type===t).value;return `${v('year')}-${v('month')}-${v('day')}`}
const number=s=>Date.parse(s+'T00:00:00Z')/86400000;
export function validDay(s,now=Date.now()){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(number(s))&&new Date(number(s)*86400000).toISOString().slice(0,10)===s&&s<=taipeiDay(now)&&s>='2020-01-01'}
export function cleanDays(raw,now=Date.now()){return [...new Set((Array.isArray(raw)?raw:[]).filter(x=>validDay(x,now)))].sort().slice(-3650)}
export function dayStats(activity,checkins,now=Date.now()){
 const days=cleanDays([...(Array.isArray(activity)?activity:[]),...(Array.isArray(checkins)?checkins:[])],now),set=new Set(days),today=taipeiDay(now);let longest=0,run=0,prev=-Infinity;
 for(const d of days){const n=number(d);run=n===prev+1?run+1:1;longest=Math.max(longest,run);prev=n}
 let cursor=number(today),streak=0;if(!set.has(today))cursor--;
 while(set.has(new Date(cursor*86400000).toISOString().slice(0,10))){streak++;cursor--}
 return {days,today,total:days.length,streak,longest,checked:set.has(today)};
}
export function readingTick(total,delta,visible){return visible?Math.min(60000,total+Math.max(0,Math.min(2000,delta))):total}
