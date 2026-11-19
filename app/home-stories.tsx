import {stories} from './content';
import type {Story} from './types';
import {levelLabel,rangeLabel} from './vocabulary-range';
export function ReadingGuide(){return <details className="reading-start-guide" aria-label="A B 範圍與閱讀指南"><summary>詞彙分級與每天一章的閱讀計畫</summary><div><h3>A／B 代表什麼？</h3><p><strong>A 本練前約 500 詞，B 本練後約 500 詞。</strong>這是本站同級配詞順序，部分詞表各有 501 詞；不是故事上下集。每天一章，25 天讀完一本，再用幾天複習，約一個月一本；兩個月讀同級 A、B 各一本，接觸並複習約 1,000 個目標詞。讀過不代表已熟記。</p><p>詞彙來源參考配合教育部 108 英語文課綱編修、由大考中心公布的《高中英文參考詞彙表》（官方六級）；A、B 是各級的專案分冊，第七級為自訂延伸。正文也可能出現其他級別、人名及變化形。<a href="./vocabulary.html">查看實際正文詞表覆蓋率</a> · <a href="./about.html#vocabulary-source">分級來源</a></p></div></details>}
export function HomeStories({onBook}:{onBook:(s:Story)=>void}){
 const ids=['import-rain-bell','ss-r2-l1-b','ss-r10-l2-b','import-last-garden','import-two-histories','import-third-gate'];
 const books=ids.map(id=>stories.find(s=>s.id===id)).filter((s):s is Story=>!!s&&s.learningReviewRequired===false&&Boolean(s.cover));
 return <section className="home-stories" aria-labelledby="home-stories-title"><div className="section-heading"><div><h2 id="home-stories-title">六本校訂精選</h2><p>每本 25 章整本免費。情節、英中對照、詞彙與測驗皆有逐章 AI 校訂紀錄。</p></div><a className="text-link" href="./library.html">全部 {stories.length} 本 →</a></div><div className="home-story-grid">{books.map(s=><button className="home-story-card" key={s.id} onClick={()=>onBook(s)}><div className="home-story-art">{s.cover&&<img src={s.cover} alt={s.zh+'封面'} loading="lazy"/>}<span className="home-story-badge">已完成 AI 全文校訂</span><span className="home-story-category">{levelLabel(s.level)} · {s.genre}</span></div><div className="home-story-copy"><h3>{s.zh}</h3><p>{s.hook}</p><span>{rangeLabel(s)} · 看故事介紹 ↗</span></div></button>)}</div></section>;
}
