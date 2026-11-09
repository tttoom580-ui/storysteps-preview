import {useState} from 'react';
import type {Chapter,Word} from './types';
import {normalizeWord} from './dictionary';
export function ReaderTip(){const [show,setShow]=useState(()=>{try{return !localStorage.getItem('storysteps-reader-hint-v1')}catch{return true}});if(!show)return null;return <aside className="reader-tip"><p>點任一英文單字就能查義；<mark>底線標記</mark>是本章目標詞。段落下的「段落工具」可翻譯、收藏或勘誤。</p><button className="secondary" onClick={()=>{setShow(false);try{localStorage.setItem('storysteps-reader-hint-v1','seen')}catch{}}}>知道了</button></aside>}
const easy=new Set('a an the be am is are was were been go goes going went gone get gets getting got come came do does did done have has had i you he she it we they my your his her our their to of in on at and or but for from with as by that this these those not no yes can will would'.split(' '));
export function challengingWords(chapter:Chapter):Word[]{return [...chapter.words].sort((a,b)=>Number(easy.has(normalizeWord(a.word)))-Number(easy.has(normalizeWord(b.word)))||(b.referenceLevel||0)-(a.referenceLevel||0)||b.word.length-a.word.length).slice(0,6)}
