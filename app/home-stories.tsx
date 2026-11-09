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
 const picks=['ss-r7-l1-b','ss-r7-l2-a','ss-r7-l3-a','ss-r8-l2-b'];
 const order=(s:Story)=>picks.includes(s.id)?picks.indexOf(s.id):99;
 const books=[...stories].sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0)||order(a)-order(b)||a.id.localeCompare(b.id)).slice(0,4);
 const hasData=books.some(b=>counts[b.id]>0);
 return <><section className="reading-start-guide" aria-label="A B 範圍與閱讀指南"><div><span className="eyebrow">A／B 代表什麼？</span><p><strong>A 本練前約 500 詞，B 本練後約 500 詞。</strong>以本站同級配詞順序拆分；部分原表實際為 501 詞。A／B 是配詞範圍，並非故事上下集，同範圍可選不同故事。分級參考配合教育部 108 英語文課綱編修、由大考中心公布的高中英文參考詞彙表；官方詞彙表共六級；本站第七級為自訂進階配詞。A／B 拆分屬本站學習安排，舊書配詞仍待逐項核對。<a href="./about.html#vocabulary-source">查看分級來源</a></p></div><div><span className="eyebrow">怎麼讀？</span><ol><li>每天讀一章，25 天讀完一本，再留幾天複習，約一個月完成。</li><li>先讀英文；需要時點字查詞、開段落中文或聽朗讀。</li><li>同級 A、B 各選一本，約兩個月接觸 1,000 個目標詞；搭配章末測驗與間隔複習，逐步記熟。</li></ol></div></section><section className="home-stories" aria-labelledby="home-stories-title"><div className="section-heading"><div><span className="eyebrow">YOUR NEXT OBSESSION</span><h1 id="home-stories-title">{hasData?'熱門故事，先翻開這幾本。':'先翻開這幾本，故事馬上開始。'}</h1><p className="popular-note">{hasData?'依近 30 天自願參與研究的首章開讀紀錄排序，其餘補上精選作品。':'人氣資料累積中，先從懸疑、戀愛與溫暖奇幻精選開始。'}</p></div></div><div className="home-story-grid">{books.map((s,i)=><button className="home-story-card" key={s.id} onClick={()=>onBook(s)}><div className="home-story-art">{s.cover&&<img src={s.cover} alt={s.zh+'封面'} loading={i<2?'eager':'lazy'}/>}<span className="home-story-badge">{counts[s.id]>0?'人氣開讀':'精選故事'}</span><span className="home-story-category">{s.level} · {s.genre}</span></div><div className="home-story-copy"><h2>{s.zh}</h2><p>{s.hook||s.desc}</p><span>先看中文介紹 ↗</span></div></button>)}</div>{hasData&&<p className="fine">僅反映參與研究的瀏覽器；不同裝置可能重複，不代表全站人數。</p>}</section></>;
}
