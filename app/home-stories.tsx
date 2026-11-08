import {useEffect,useState} from 'react';
import {stories} from './content';
import type {Story} from './types';
import {studyEndpoint} from './study-service';

// Popularity uses opted-in first-chapter opens, never editorial scores.
export function HomeStories({onBook}:{onBook:(s:Story)=>void}){
 const [counts,setCounts]=useState<Record<string,number>>({});
 useEffect(()=>{const controller=new AbortController();let live=true;const t=setTimeout(()=>controller.abort(),10000);
  window.fetch(studyEndpoint+'/stats',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(live)setCounts(Object.fromEntries((Array.isArray(d.firstOpen)?d.firstOpen:[]).filter((r:any)=>stories.some(s=>s.id===r.book)&&Number.isFinite(Number(r.readers))&&Number(r.readers)>0).map((r:any)=>[r.book,Number(r.readers)])))}).catch(()=>{}).finally(()=>clearTimeout(t));
  return()=>{live=false;controller.abort();clearTimeout(t)};
 },[]);
 const picks=['tomorrow','ss-r5-l3-a','ss-r5-l2-b','ss-r5-l1-b'];
 const order=(s:Story)=>picks.includes(s.id)?picks.indexOf(s.id):99;
 const books=[...stories].sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0)||order(a)-order(b)||a.id.localeCompare(b.id)).slice(0,4);
 const hasData=books.some(b=>counts[b.id]>0);
 return <section className="home-stories" aria-labelledby="home-stories-title"><div className="section-heading"><div><span className="eyebrow">YOUR NEXT OBSESSION</span><h1 id="home-stories-title">{hasData?'熱門故事，先翻開這幾本。':'先翻開這幾本，故事馬上開始。'}</h1><p className="popular-note">{hasData?'依近 30 天自願參與研究的首章開讀紀錄排序，其餘補上精選作品。':'人氣資料累積中，先從懸疑、戀愛與溫暖奇幻精選開始。'}</p></div></div><div className="home-story-grid">{books.map((s,i)=><button className="home-story-card" key={s.id} onClick={()=>onBook(s)}><div className="home-story-art">{s.cover&&<img src={s.cover} alt={s.zh+'封面'} loading={i<2?'eager':'lazy'}/>}<span className="home-story-badge">{counts[s.id]>0?'人氣開讀':'精選故事'}</span><span className="home-story-category">{s.level} · {s.genre}</span></div><div className="home-story-copy"><h2>{s.zh}</h2><p>{s.hook||s.desc}</p><span>先看中文介紹 ↗</span></div></button>)}</div>{hasData&&<p className="fine">僅反映參與研究的瀏覽器；不同裝置可能重複，不代表全站人數。</p>}</section>;
}
