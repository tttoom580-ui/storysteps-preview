import {stories} from './content';
export type ReaderState={books:string[];seen:Record<string,number>;resume:Record<string,string>;lookups:Record<string,number>;level:number;testTaken:boolean;quotes:{id:string;chapter:string;index:number}[];lastBackup:number};
export const emptyReader=():ReaderState=>({books:[],seen:{},resume:{},lookups:{},level:1,testTaken:false,quotes:[],lastBackup:0});
export function cleanState(x:any):ReaderState{
 const s=emptyReader();if(!x||typeof x!=='object')return s;
 s.books=Array.isArray(x.books)?[...new Set<string>(x.books.filter((id:any)=>stories.some(b=>b.id===id)))].slice(0,200):[];
 for(const b of stories){if(Number.isInteger(x.seen?.[b.id]))s.seen[b.id]=Math.max(0,Math.min(25,x.seen[b.id]));if(b.chapters.some(c=>c.id===x.resume?.[b.id]&&c.available))s.resume[b.id]=x.resume[b.id];if(Number.isFinite(x.lookups?.[b.id]))s.lookups[b.id]=Math.max(0,Math.min(10000,Math.floor(x.lookups[b.id])))}
 s.level=Number.isInteger(x.level)?Math.min(7,Math.max(1,x.level)):1;s.testTaken=x.testTaken===true;
 s.quotes=Array.isArray(x.quotes)?x.quotes.filter((q:any)=>typeof q.id==='string'&&q.id.length<100&&stories.some(b=>b.chapters.some(c=>c.id===q.chapter&&c.available))&&Number.isInteger(q.index)&&q.index>=0&&q.index<100).slice(0,200).map((q:any)=>({id:q.id,chapter:q.chapter,index:q.index})):[];
 s.lastBackup=Number.isFinite(x.lastBackup)?Math.max(0,Math.min(Date.now(),x.lastBackup)):0;return s;
}
export function validateBackup(x:any){if(x?.format!=='storysteps-learning'||![1,2].includes(x.version)||!Array.isArray(x.progress)||!Array.isArray(x.vocab)||x.progress.length>5000||x.vocab.length>10000)throw Error('不是支援的拾頁備份，或資料量超出限制。');
 const progress=x.progress.filter((p:any)=>p&&typeof p==='object'&&stories.some(b=>b.chapters.some(c=>c.available&&c.id===p.chapter))).map((p:any)=>({chapter:p.chapter,score:Number.isInteger(p.score)?Math.max(0,Math.min(100,p.score)):0,completed:Number.isFinite(p.completed)?Math.max(0,Math.min(Date.now(),p.completed)):Date.now()}));
 const vocab=x.vocab.filter((v:any)=>v&&typeof v==='object'&&typeof v.word==='string'&&/^\p{L}+(?:'\p{L}+)*$/u.test(v.word)&&v.word.length<=40&&typeof v.meaning==='string'&&v.meaning.trim()&&v.meaning.length<=200).map((v:any)=>({word:v.word,meaning:v.meaning,stage:Number.isInteger(v.stage)?Math.max(0,Math.min(5,v.stage)):0,due:Number.isFinite(v.due)?Math.max(0,Math.min(Date.now()+30*86400000,v.due)):Date.now()}));
 const grants=Array.isArray(x.grants)?x.grants.filter((g:any)=>g&&typeof g==='object'&&stories.some(b=>b.id===g.story)&&[6,10,14,18,22].includes(g.start)&&['launch-gift','rewarded-ad'].includes(g.source)).map((g:any)=>({story:g.story,start:g.start,source:g.source,grantedAt:Number.isFinite(g.grantedAt)?Math.min(Date.now(),Math.max(0,g.grantedAt)):Date.now()})):[];return {progress:[...new Map(progress.map((p:any)=>[p.chapter,p])).values()],vocab:[...new Map(vocab.map((v:any)=>[v.word,v])).values()],state:cleanState(x.state),grants};
}
