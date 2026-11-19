import VocabularyGame from './vocabulary-game';
import ChapterPractice,{type PracticeWord} from './chapter-practice';
import {mergePracticeMistakes} from './chapter-practice-model.mjs';
import {ProductConsent,FeedbackBox,LearningReport,DiscoveryBoards,TrialOffer,ProductDashboard,useReadingTime,productEvent,productConsent} from './product-insights';
import GoogleSignIn from './google-sign-in';
import MixedParagraph from './mixed-reading';
import {mixChapter} from './mixed-tokens.mjs';
import mixedAlignments from './mixed-alignments.json';
import {genreGroups,matchesGenre} from './story-genres';
import {trackReading,AnalyticsChoice} from './launch-analytics';
import BackupPanel from './backup-panel';
import {DriveBackupControls,useDriveBackup} from './drive-backup';
import ReadingPassport from './reading-passport';
import {MistakeReview,ForYou,LocalReadingInsights,QuickTaste,rememberQuizMistakes} from './engagement';
import {markLocalSaved} from './storage-status';
import {challengingWords} from './reader-help';
import {HomeStories,ReadingGuide} from './home-stories';
import NewReleases from './new-releases';
import {ReadingCalendar,useReadingDays} from './reading-calendar';
import {WeeklyGoal,ReadingSupport,SentenceReport,EndMarker,StudyChoice,GlobalStudy} from './reading-growth';
import {sendEvent} from './study-service';
import {StoryPreview,DiscoveryPicker,StudyExport,useReaderComfort,recordReading} from './discovery';
import {siteFetch as fetch} from './static-api';
'use client';
import {canRead} from './reading-access';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Library,Bookmark,ArrowUpRight,ArrowRight,ChevronLeft,ChevronRight,Search,Lock,Check,Headphones,Pause,Volume2,X,MessageCircle,Sparkles,Flame,Clock,Menu,Sun,Moon,RotateCcw,User,GraduationCap} from 'lucide-react';
import ReadingAccess from './rewarded';
import {premiumBookCount,premiumDescription,usePremium} from './premium';
import {StoryInsights} from './story-insights';
import {RewardPanel,usePassportSession} from './passport';
import SponsorSlot from './sponsor-slot';
import {useReadingFeatures,ReadingCenter,Analytics,ChapterCommunity,QuoteButton,readingPost} from './reading-features';
import {stories,levels,upcomingStories,editorialLabel} from './content';
import {readerOffer,isFreeBook,freeBookCount,previewChapters,premiumPriceTwd} from './offer';
import type {Story,Chapter,Word} from './types';
import {dayKey,streak,nextReview} from './learning';
import {difficultyLabel,rangeLabel,levelLabel} from './vocabulary-range';
import {normalizeWord, findDefinition,findExpandedDefinition} from './dictionary';

const reviewedAlignments: Record<string,Record<string,{paragraph:number;translation?:string;after?:string;prefix?:string;meaning?:string}>>=mixedAlignments;
const animalAvatars=[
 {id:'cat',label:'橘貓',position:'0% 0%'},
 {id:'rabbit',label:'白兔',position:'100% 0%'},
 {id:'panda',label:'小貓熊',position:'0% 100%'},
 {id:'dog',label:'小狗',position:'100% 100%'}
];
const mainLinks=[['home','發現故事'],['library','分級書城'],['words','單字口袋'],['center','閱讀中心']];
const freeHomeBooks=readerOffer.freeBookIds
 .map(id=>stories.find(story=>story.id===id))
 .filter((story):story is Story=>Boolean(story));
const freeHomeShelves=levels
 .map(level=>({level,books:freeHomeBooks.filter(story=>story.level===level)}))
 .filter(shelf=>shelf.books.length>0);
const starterPicks=[
 {id:'ss-r2-l2-a',label:'英文起步',hook:'跟著一本神祕說明書，走進不一樣的修仙日常。'},
 {id:'import-rain-bell',label:'喜歡懸疑',hook:'晴天突然響起的警鐘，藏著十二年前的秘密。'},
 {id:'ss-r2-l1-b',label:'想看療癒',hook:'從一份早餐開始，慢慢打開整個村莊的心。'}
].map(pick=>({...pick,story:freeHomeBooks.find(book=>book.id===pick.id)!})).filter(pick=>pick.story);
const trialBooks=stories.filter(story=>!isFreeBook(story.id));
const trialGenres=new Set<string>();
const distinctTrialBooks=trialBooks.filter(story=>{
 if(trialGenres.has(story.genre))return false;
 trialGenres.add(story.genre);
 return true;
});
const trialPicks=[...new Set([...trialBooks.filter(story=>story.id.startsWith('ss-r15-')),...distinctTrialBooks,...trialBooks])].slice(0,6);
const expandedTrialBooks=[...trialPicks,...trialBooks.filter(story=>!trialPicks.includes(story))];
const allMeta=stories.flatMap(s=>s.chapters);
const totalWritten=allMeta.filter(c=>c.available).length;
const principal=stories[0];
const primaryTopics=['全部題材',...genreGroups.map(group=>group.name)];
const shelfTopics=[...new Set(stories.map(story=>story.genre))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
const extraTopics=[...new Set([...shelfTopics,...stories.flatMap(story=>story.plotTags||[])])].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
const startingShelves=[
 {label:'第一次讀英文小說',level:'1000以下',genre:'全部題材',free:true},
 {label:'想追懸疑劇情',level:'全部',genre:'懸疑推理',free:false},
 {label:'想讀戀愛',level:'全部',genre:'愛情戀愛',free:false},
 {label:'喜歡遊戲冒險',level:'全部',genre:'遊戲冒險',free:false},
];
type SavedWord=Word&{stage:number;due:number;chapter?:string;sentence?:string;sentenceZh?:string;paragraph?:number};
function EditorialStatus({story}:{story:Story}){
 return <span className={'editorial-status '+(editorialLabel(story)==='校訂中'?'editorial-pending':'editorial-reviewed')}>{editorialLabel(story)}</span>;
}
export default function Home(){
 const [view,setView]=useState('home'),[level,setLevel]=useState('全部'),[query,setQuery]=useState(''),[range,setRange]=useState('全部範圍'),[genre,setGenre]=useState('全部題材'),[bookId,setBookId]=useState('tomorrow'),[chapter,setChapter]=useState<Chapter|null>(null),[chapterId,setChapterId]=useState('tomorrow-1'),[chapterError,setChapterError]=useState(''),[loadingChapter,setLoadingChapter]=useState(false),[progress,setProgress]=useState<any[]>([]),[vocab,setVocab]=useState<SavedWord[]>([]),[activity,setActivity]=useState<string[]>([]),[owned,setOwned]=useState<string[]>([]),[testReader,setTestReader]=useState(false),[signed,setSigned]=useState(false),[loaded,setLoaded]=useState(false),[cloudError,setCloudError]=useState(false),[name,setName]=useState('閱讀者'),[feedback,setFeedback]=useState<any[]>([]),[busy,setBusy]=useState(false),[toast,setToast]=useState(''),[modal,setModal]=useState(''),[word,setWord]=useState<(Word&{error?:string})|null>(null),[translated,setTranslated]=useState<number[]>([]),[fontSize,setFontSize]=useState(window.matchMedia('(max-width:900px)').matches?20:21),[theme,setTheme]=useState(()=>{try{return JSON.parse(localStorage.getItem('storysteps-comfort')||'{}').theme==='night'?'night':'paper'}catch{return 'paper'}}),[toc,setToc]=useState(false),[speaking,setSpeaking]=useState(false),[rate,setRate]=useState('0.85'),[answers,setAnswers]=useState<number[]>([]),[submitted,setSubmitted]=useState(false),[score,setScore]=useState(0),[reviewAll,setReviewAll]=useState(false),[flipped,setFlipped]=useState(false),[reviewed,setReviewed]=useState(0),[reviewIndex,setReviewIndex]=useState(0),[last,setLast]=useState('tomorrow-1'),[savedBooks,setSavedBooks]=useState<string[]>([]),[onlySaved,setOnlySaved]=useState(false),[editorialFilter,setEditorialFilter]=useState('全部校訂狀態');
 const premium=usePremium();
 const [measurementRevision,setMeasurementRevision]=useState(0);
 useEffect(()=>{const update=()=>setMeasurementRevision(value=>value+1);window.addEventListener('storysteps-product-consent-changed',update);return()=>window.removeEventListener('storysteps-product-consent-changed',update);},[]);

 const originalParagraph=useRef<number|null>(null);
 useReadingTime(chapter?.id||'',view==='reader'&&!loadingChapter&&!chapterError);
 useEffect(()=>{
  if(!chapter||originalParagraph.current===null)return;
  const index=originalParagraph.current;originalParagraph.current=null;
  const timer=setTimeout(()=>document.getElementById('paragraph-'+index)?.scrollIntoView({block:'center',behavior:'smooth'}),350);
  return()=>clearTimeout(timer);
 },[chapter]);

 const [showAllTrialBooks,setShowAllTrialBooks]=useState(false);
 const [showReview,setShowReview]=useState(false);
 useEffect(()=>setShowReview(false),[chapterId]);
 const [checkoutBook,setCheckoutBook]=useState<string>();
 function showCheckout(id?:string){trackReading('pass_view',id);setCheckoutBook(id);setModal('');navigate('access')}
 const chapterReadable=(id:string,number:number)=>canRead(id,number)||premium.booksOwned.includes(id);
 const comfort=useReaderComfort(chapter,view==='reader');
 const habit=useReadingDays(activity,view==='reader'?chapter?.id||null:null);
 const [allWords,setAllWords]=useState(false);
 const [hasResume,setHasResume]=useState(false);
 const [wordFilter,setWordFilter]=useState('');
 const [mixedReading,setMixedReading]=useState(()=>{try{return localStorage.getItem('storysteps-mixed-reading')==='yes'}catch{return false}});
 const [mixedHints,setMixedHints]=useState(true);
 const [practiceQueue,setPracticeQueue]=useState<SavedWord[]|null>(null);
 useEffect(()=>{setMixedHints(true)},[chapterId]);
 const readingAnchor=useRef<{id:string;top:number}|null>(null);
 function toggleMixedReading(){
  const paragraphs=[...document.querySelectorAll<HTMLElement>('[data-paragraph]')];
  const anchor=paragraphs.find(node=>node.getBoundingClientRect().bottom>110);
  readingAnchor.current=anchor?{id:anchor.id,top:anchor.getBoundingClientRect().top}:null;
  stop();closeWord(false);setMixedReading(value=>!value);
 }
 useLayoutEffect(()=>{
  try{localStorage.setItem('storysteps-mixed-reading',mixedReading?'yes':'no')}catch{}
  const anchor=readingAnchor.current;
  if(anchor){const node=document.getElementById(anchor.id);if(node)window.scrollBy(0,node.getBoundingClientRect().top-anchor.top)}
  readingAnchor.current=null;
 },[mixedReading]);

 const [avatarId,setAvatarId]=useState(()=>{try{return localStorage.getItem('storysteps-avatar')||''}catch{return ''}});
 const avatar=animalAvatars.find(option=>option.id===avatarId);
 function chooseAvatar(id:string){
  try{localStorage.setItem('storysteps-avatar',id);setAvatarId(id);setModal('');setToast('頭像已更新');}
  catch{setToast('這個瀏覽器目前無法儲存頭像。')}
 }

 useEffect(()=>{trackReading('visit');recordReading('visit');try{const c=JSON.parse(localStorage.getItem('storysteps-comfort')||'null');if(c){setFontSize(Math.max(17,Math.min(29,Number(c.font)||21)));setTheme(c.theme==='night'?'night':'paper')}}catch{}},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='night'?'dark':'light';try{localStorage.setItem('storysteps-comfort',JSON.stringify({font:fontSize,theme}))}catch{}},[fontSize,theme]);
 useEffect(()=>setAllWords(false),[chapterId]);
 useEffect(()=>{
  if(view!=='reader'||!chapter)return;
  const end=document.querySelector('.chapter-pagination');if(!end)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){trackReading('chapter_end',bookId,chapter.id);observer.disconnect()}},{threshold:.5});
  observer.observe(end);return()=>observer.disconnect();
 },[view,chapter,bookId]);
 const [onlyFree,setOnlyFree]=useState(false);
 usePassportSession(view==='reader'?chapter?.id||null:null,signed);
 const feature=useReadingFeatures(signed,loaded);
 useEffect(()=>{if(feature.ready)setSavedBooks(feature.state.books)},[feature.ready,feature.state.books]);
 const requestRef=useRef(0),voiceRef=useRef<SpeechSynthesisUtterance|null>(null),dialogRef=useRef<HTMLElement|null>(null);
 const wordTrigger=useRef<HTMLButtonElement|null>(null);
 const lookupRequest=useRef(0);
 const [wordAbove,setWordAbove]=useState(false);
 const inlineLookup=view==='reader'&&!!word&&!modal;
 const modalOpen=!!modal||!!word&&!inlineLookup;
 const chapterWords=useMemo(()=>new Map(chapter?.words.filter(w=>w.meaning).map(w=>{
  const key=normalizeWord(w.word);
  const meaning=mixedReading?reviewedAlignments[chapter.id]?.[key]?.meaning:undefined;
  return [key,meaning?{...w,meaning}:w] as const;
 })),[chapter,mixedReading]);
 const savedWords=useMemo(()=>new Map(vocab.filter(w=>w.meaning).map(w=>[normalizeWord(w.word),w])),[vocab]);
 function closeWord(restoreFocus=true){
  lookupRequest.current++;
  setWord(null);
  if(restoreFocus)wordTrigger.current?.focus({preventScroll:true});
  wordTrigger.current=null;
 }
 useEffect(()=>{
  if(!inlineLookup)return;
  const dismiss=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){
    event.preventDefault();
    closeWord(true);
   }
  };
  const outside=(event:PointerEvent)=>{
   if(event.target instanceof Element && !event.target.closest('.inline-word,.word-dock,.chapter-words'))closeWord();
  };
  document.addEventListener('keydown',dismiss);
  document.addEventListener('pointerdown',outside);
  return ()=>{
   document.removeEventListener('keydown',dismiss);
   document.removeEventListener('pointerdown',outside);
  };
 },[inlineLookup]);
 const story=stories.find(s=>s.id===bookId)||principal;
 const currentMeta=allMeta.find(c=>c.id===chapterId);
 const resumeStory=view==='center'&&hasResume?stories.find(s=>s.chapters.some(c=>c.id===last)):undefined;
 const resumeChapter=resumeStory?.chapters.find(c=>c.id===last);
 const canResume=!!resumeStory&&!!resumeChapter?.available&&chapterReadable(resumeStory.id,resumeChapter.number);
 const reachedPreviewEnd=view==='reader'&&currentMeta?.number===previewChapters&&!chapterReadable(story.id,previewChapters+1);
 const nextFreeBook=reachedPreviewEnd
  ? stories.find(s=>isFreeBook(s.id)&&s.level===story.level&&s.primaryGenre===story.primaryGenre)
    || stories.find(s=>isFreeBook(s.id)&&s.level===story.level)
    || freeHomeBooks[0]
  : undefined;
 const done=progress.filter(p=>allMeta.some(c=>c.id===p.chapter)).length;
 const due=vocab.filter(w=>w.due<=Date.now()),queue=practiceQueue|| (reviewAll?vocab:due),reviewWord=queue[reviewIndex];
 const visibleWords=view==='words'?vocab.filter(w=>[w.word,w.meaning||''].some(value=>value.toLowerCase().includes(wordFilter.trim().toLowerCase()))):[];
 function startReview(all=false){setPracticeQueue(null);setReviewAll(all);setReviewIndex(0);setFlipped(false);setReviewed(0);navigate('review');}
 useEffect(()=>{refresh();const params=new URLSearchParams(window.location.search);if(params.has('drive-backup'))setView('center');if(params.has('purchase')){setView('access');const pending=stories.find(book=>book.id===params.get('purchase'))?.id;setCheckoutBook(pending);trackReading('pass_view',pending)}const topic=params.get('genre');if(topic&&genreGroups.some(group=>group.name===topic)){setGenre(topic);setView('library');}const sharedBook=params.get('book'),sharedChapter=params.get('chapter');if(sharedChapter&&allMeta.some(c=>c.id===sharedChapter)){void read(sharedChapter)}else if(sharedBook&&stories.some(s=>s.id===sharedBook)){trackReading('book_open',sharedBook);setBookId(sharedBook);setView('book')}try{const previous=localStorage.getItem('storysteps-last');if(previous&&allMeta.some(c=>c.id===previous)){setLast(previous);setHasResume(true)}setSavedBooks(JSON.parse(localStorage.getItem('storysteps-books')||'[]'))}catch{}return()=>{if('speechSynthesis'in window)window.speechSynthesis.cancel()}},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{if(!modalOpen)return;const old=document.activeElement as HTMLElement;const el=dialogRef.current;el?.focus();const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){setModal('');closeWord();}if(e.key==='Tab'&&el){const nodes=[...el.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',handle);return()=>{document.removeEventListener('keydown',handle);old?.focus({preventScroll:true})}},[modalOpen]);
 async function refresh(){try{const r=await fetch('/api/learn');if(!r.ok)throw Error();const d=await r.json() as any;setSigned(d.signed);setTestReader(!!d.testReader);setCloudError(false);if(d.signed){setName(d.name);setOwned(d.owned||[]);setProgress(d.progress);setVocab(d.vocab);setActivity(d.activity||[]);setFeedback(d.feedback)}else{try{const g=JSON.parse(localStorage.getItem('storysteps-guest')||'{}');setProgress(g.progress||[]);setVocab(g.vocab||[]);setActivity(g.activity||[])}catch{}}}catch{setCloudError(true)}setLoaded(true)}
 const driveBackup=useDriveBackup({available:Boolean(premium.googleClientId),accountSync:true,signedIn:premium.googleSignedIn,onRestore:()=>{refresh();const restored=localStorage.getItem('storysteps-last');if(restored&&allMeta.some(chapter=>chapter.id===restored)){setLast(restored);setHasResume(true);}}});
 function saveGuest(p:any[],v:SavedWord[],a:string[]){try{localStorage.setItem('storysteps-guest',JSON.stringify({progress:p,vocab:v,activity:a}));markLocalSaved();return true}catch{setToast('無法保存到瀏覽器，請檢查儲存權限。');return false}}
 async function action(d:any){if(busy||!loaded||cloudError)return false;setBusy(true);try{if(signed){const r=await fetch('/api/learn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const j=await r.json() as any;if(!r.ok)throw Error(j.error);await refresh();if(d.action==='save')trackReading('word_save',story.id,chapter?.id||'');return j}if(d.action==='feedback'){const next=[...feedback,{...d,id:String(Date.now())}];localStorage.setItem('storysteps-local-feedback',JSON.stringify(next));setFeedback(next);setToast('已保存在此瀏覽器，尚未送出站主。');return {ok:true}}let p=[...progress],v=[...vocab],a=[...activity];let sc=0;if(d.action==='complete'&&chapter){sc=chapter.questions.filter((q,i)=>q.answer===d.answers[i]).length;const prev=p.find(x=>x.chapter===chapter.id);p=p.filter(x=>x.chapter!==chapter.id);p.push({chapter:chapter.id,score:Math.max(sc,prev?.score||0),completed:Date.now()});a=[...new Set([...a,dayKey(Date.now())])]}if(d.action==='save'){v=v.filter(w=>w.word!==d.word);v.push({word:d.word,meaning:d.meaning,chapter:chapter?.id,sentence:chapter?.paragraphs.find(p=>p.en.toLowerCase().includes((word?.original||d.word).toLowerCase()))?.en,sentenceZh:chapter?.paragraphs.find(p=>p.en.toLowerCase().includes((word?.original||d.word).toLowerCase()))?.zh,paragraph:chapter?.paragraphs.findIndex(p=>p.en.toLowerCase().includes((word?.original||d.word).toLowerCase())),stage:0,due:Date.now()})}if(d.action==='remove')v=v.filter(w=>w.word!==d.word);if(d.action==='review')v=v.map(w=>w.word===d.word?{...w,...nextReview(w.stage,d.known)}:w);if(!saveGuest(p,v,a))return false;setProgress(p);setVocab(v);setActivity(a);if(d.action==='complete'&&chapter)readingPost({action:'guestComplete',chapter:chapter.id,answers:d.answers}).catch(()=>{});if(d.action==='save')trackReading('word_save',story.id,chapter?.id||'');return {ok:true,score:sc}}catch(e:any){setToast(e.message||'儲存失敗，請重試。');return false}finally{setBusy(false)}}
 async function savePracticeMistakes(entries:PracticeWord[]){
  if(busy||!loaded||cloudError)return false;
  setBusy(true);
  try{
   const merged=mergePracticeMistakes(vocab,entries) as SavedWord[];
   if(signed){
    for(const entry of entries){
     const response=await fetch('/api/learn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',...entry})});
     if(!response.ok)throw Error();
    }
    await refresh();
   }else{if(!saveGuest(progress,merged,activity))return false;setVocab(merged);}
   return true;
  }catch{setToast('錯字尚未保存，請重試。');return false}finally{setBusy(false)}
 }
 function reviewPracticeWords(entries:PracticeWord[]){
  setPracticeQueue(mergePracticeMistakes([],entries));setReviewIndex(0);setFlipped(false);setReviewed(0);navigate('review');
 }
 function stop(){if('speechSynthesis'in window)window.speechSynthesis.cancel();setSpeaking(false)}
 function speak(text:string){if(!('speechSynthesis'in window)){setToast('此瀏覽器不支援朗讀。');return}stop();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=Number(rate);u.onend=u.onerror=()=>setSpeaking(false);voiceRef.current=u;setSpeaking(true);window.speechSynthesis.speak(u)}
 function navigate(v:string){if(v!=='reader'){const url=new URL(location.href);url.searchParams.delete('chapter');url.searchParams.delete('book');url.searchParams.delete('purchase');if(v==='access')url.searchParams.set('purchase','');history.replaceState(null,'',url)}comfort.pause();stop();setView(v);if(v==='book'||v==='reader')refresh();closeWord();setToc(false);window.scrollTo(0,0)}
 function openShelf(shelf:typeof startingShelves[number]){
  setLevel(shelf.level);setGenre(shelf.genre);setOnlyFree(shelf.free);setOnlySaved(false);
  setQuery('');setRange('全部範圍');setEditorialFilter('全部校訂狀態');navigate('library');
 }
 function book(s:Story){trackReading('book_open',s.id);recordReading('book_preview',s.id);setBookId(s.id);feature.update(x=>({...x,seen:{...x.seen,[s.id]:s.chapters.filter(c=>c.available).length}}));navigate('book');const url=new URL(location.href);url.searchParams.set('book',s.id);history.replaceState(null,'',url)}
 async function read(id:string){const s=stories.find(s=>s.chapters.some(c=>c.id===id));if(!s){setToast('這篇舊版故事已改版，請從新書開始。');return}const meta=s.chapters.find(c=>c.id===id)!;if(bookId!==s.id||(view!=='book'&&view!=='reader'))trackReading('book_open',s.id);setBookId(s.id);setChapterId(id);setChapter(null);setChapterError('');setTranslated([]);setAnswers([]);setSubmitted(false);navigate('reader');setLoadingChapter(false);const seq=++requestRef.current;if(!meta.available){setChapterError('本章正在創作中。現在可以先閱讀第 1 章，或留下你想追更的回饋。');return}setLoadingChapter(true);try{const r=await fetch('/api/chapter?id='+encodeURIComponent(id));const data=await r.json() as any;if(seq!==requestRef.current)return;if(!r.ok){setChapterError(data.error||'章節無法載入');return}setChapter(data);trackReading('chapter_start',s.id,id);feature.opened(s,id);const url=new URL(location.href);url.searchParams.set('book',s.id);url.searchParams.set('chapter',id);url.searchParams.delete('purchase');history.replaceState(null,'',url);setLast(id);setHasResume(true);try{localStorage.setItem('storysteps-last',id);markLocalSaved()}catch{}}catch{if(seq===requestRef.current)setChapterError('連線失敗，請重新載入章節。')}finally{if(seq===requestRef.current)setLoadingChapter(false)}}
 async function lookup(raw:string,trigger?:HTMLButtonElement){
  const request=++lookupRequest.current;
  const w=normalizeWord(raw);
  trackReading('word_lookup',story.id,chapter?.id||'');
  wordTrigger.current=trigger||null;
  const rect=trigger?.getBoundingClientRect();
  setWordAbove(!!rect&&rect.top>window.innerHeight/2);
  const curated=view==='reader'?chapterWords.get(w):undefined;
  const definition=curated||savedWords.get(w)||findDefinition(w);
  setWord(definition?{...definition,word:w}:{word:w,meaning:'',error:'正在查詢擴充詞庫…'});
  if(!definition){
   try{
    const expanded=await findExpandedDefinition(w);
    if(request!==lookupRequest.current)return;
    setWord(expanded?{...expanded,word:w}:{word:w,meaning:'',error:'詞庫尚未收錄此字，可能是專有名詞或特殊字形。可開啟下方外部字典查詢。'});
   }catch{
    if(request===lookupRequest.current)setWord({word:w,meaning:'',error:'擴充詞庫暫時無法載入，請再點一次單字或使用下方外部字典。'});
   }
  }
  feature.update(s=>({...s,lookups:{...s.lookups,[story.id]:(s.lookups[story.id]||0)+1}}));
 }
 const mixedChapter=useMemo(()=>mixedReading&&chapter?mixChapter(chapter.paragraphs,chapter.words,reviewedAlignments[chapter.id]):null,[chapter,mixedReading]);
 const readerText=useMemo(()=>{
  function tokenize(value:string){
   return value.split(/(\p{L}+(?:['’]\p{L}+)*)/gu).map((part,i)=>{
    if(!/^\p{L}/u.test(part))return part;
    const w=normalizeWord(part);
    return <button key={i} type="button" data-lookup={part} className={'inline-word '+(savedWords.has(w)?'saved-word ':'')+(chapterWords.has(w)?'target-word':'')} aria-label={'查詢 '+part}>{part}</button>;
   });
  }
  return chapter?{title:tokenize(chapter.title),paragraphs:chapter.paragraphs.map(p=>tokenize(p.en))}:null;
 },[chapter,chapterWords,savedWords]);
 function saveBook(id:string){if(!feature.ready){setToast('書架載入中，請稍後再試。');return}feature.update(s=>({...s,books:s.books.includes(id)?s.books.filter(x=>x!==id):[...s.books,id],seen:{...s.seen,[id]:s.seen[id]??stories.find(b=>b.id===id)!.chapters.filter(c=>c.available).length}}))}
 function Cover({s,large=false}:{s:Story;large?:boolean}){return <div className={'cover '+(large?'cover-large':'')} style={{background:s.color}}>{s.cover?<img src={s.cover} alt={s.zh+' AI 插畫封面'} loading={large?'eager':'lazy'}/>:<div className="cover-graphic" aria-hidden="true"><span className="orbit"/><span className="orbit second"/><span className="cover-number">{String(stories.indexOf(s)+1).padStart(2,'0')}</span></div>}<div className="cover-shade"/><span className="cover-series">{s.series?`${s.series} · VOL. ${s.volume}`:'STORYSTEPS ORIGINAL'}</span><div className="cover-words"><span>{s.genre}</span><h3>{s.series?(s.zh.split('：').slice(1).join('：')||s.zh):s.zh}</h3><p>{s.title}</p></div><div className="cover-footer">拾頁原創 <span>25 CHAPTERS</span></div></div>}
 function Card({s}:{s:Story}){const ready=s.chapters.filter(c=>c.available).length;return <article className="book-card" data-book={s.id}><button className="cover-button" onClick={()=>book(s)} aria-label={'查看 '+s.zh}><Cover s={s}/></button><div className="book-card-copy"><a className="title-button" href={'./stories/'+s.id+'/'} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();book(s)}}}><h3>{s.zh}</h3></a><p className="book-hook">{s.hook}</p><small className="card-level">{difficultyLabel(s)}</small><p className="fine">{[s.primaryGenre||s.genre,...(s.plotTags||[])].join(" · ")}</p><a className="card-preview-link" href={'./stories/'+s.id+'/'} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();book(s)}}}>查看故事 →</a><div className="card-bottom"><span>{savedBooks.includes(s.id)&&ready>(feature.state.seen[s.id]||0)?`新增 ${ready-(feature.state.seen[s.id]||0)} 章 · `:''}{ready===25?(isFreeBook(s.id)?'全本免費':`免費試讀 ${previewChapters} 章`):`已上架 ${ready} / 25 章`}</span><button aria-label={(savedBooks.includes(s.id)?'移除收藏 ':'收藏 ')+s.zh} className={savedBooks.includes(s.id)?'is-saved':''} onClick={()=>saveBook(s.id)}><Bookmark size={17} fill={savedBooks.includes(s.id)?'currentColor':'none'}/></button></div></div></article>}
 const filtered=stories.filter(s=>(!onlyFree||isFreeBook(s.id))&&(editorialFilter==='全部校訂狀態'||editorialFilter===editorialLabel(s))&&(level==='全部'||s.level===level)&&(range==='全部範圍'||s.vocabularyRange===range)&&matchesGenre(s,genre)&&(!onlySaved||savedBooks.includes(s.id))&&(s.title+s.zh+s.desc+(s.tags||[]).join(' ')+(s.plotTags||[]).join(' ')+(s.primaryGenre||'')).toLowerCase().includes(query.toLowerCase().replace(/^#/,'')));
 useEffect(()=>{
  if(view!=='library'||!productConsent())return;
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){productEvent('book_impression',(entry.target as HTMLElement).dataset.book||'');observer.unobserve(entry.target);}
  },{threshold:.5});
  document.querySelectorAll('.book-card[data-book]').forEach(element=>observer.observe(element));
  return()=>observer.disconnect();
 },[view,query,genre,level,onlyFree,onlySaved,measurementRevision]);
 return <div className={'app theme-'+theme+' view-'+view+(view==='reader'&&comfort.focus?' focus-reading':'')}><header className="header"><button className="brand" onClick={()=>navigate('home')}><img className="brand-wordmark" src="./brand/storysteps-logo-v2.webp" alt="拾頁 StorySteps" width="138" height="52"/></button><nav className="desktop-nav" aria-label="主要導覽">{mainLinks.map(([id,label])=><button key={id} className={view===id?'active':''} onClick={()=>navigate(id)}>{label}</button>)}</nav><div className="header-actions"><button className="header-pass" aria-current={view==='access'?'page':undefined} onClick={()=>showCheckout()}>免費閱讀與通行證</button><button className="theme-toggle" aria-label={theme==='night'?'切換淺色模式':'切換黑暗模式'} aria-pressed={theme==='night'} title={theme==='night'?'切換淺色模式':'切換黑暗模式'} onClick={()=>setTheme(t=>t==='night'?'paper':'night')}>{theme==='night'?<Sun size={20}/>:<Moon size={20}/>}</button><button className="avatar" aria-label="閱讀設定" onClick={()=>setModal('profile')}>{avatar?<span className="animal-avatar" style={{backgroundPosition:avatar.position}} aria-hidden="true"/>:signed?name.slice(0,1):<User size={19}/>}</button></div></header>
 <div className={'layout '+(view==='reader'?'reading-layout':'')}>
 <main id="main-content">{cloudError&&<div className="notice">無法載入帳號紀錄。<button onClick={refresh}>重新連線</button></div>}
 {view==='center'?<><section className="reading-hub" aria-labelledby="reading-hub-title">
  <header className="reading-hub-lead">
   <div className="reading-hub-intro">
    <div className="reading-hub-profile">
     <button className="hub-avatar-button" aria-label={avatar?`更換頭像，目前為${avatar.label}`:'選擇頭像'} title="更換頭像" onClick={()=>setModal('avatars')}>
      {avatar?<span className="animal-avatar" style={{backgroundPosition:avatar.position}} aria-hidden="true"/>:<User size={22}/>}
     </button>
     <h1 id="reading-hub-title">我的閱讀</h1>
    </div>
    {canResume&&resumeStory&&resumeChapter?
     <div className="resume-copy"><strong>{resumeStory.zh}</strong><p>第 {resumeChapter.number} 章 · {resumeChapter.zh}</p></div>:
     <p className="resume-empty">挑一本想讀的小說，開始你的閱讀紀錄。</p>}
    <button className="primary" onClick={()=>canResume?read(last):navigate('library')}>
     {canResume?'接續閱讀':'到書庫挑書'} <ArrowRight size={17}/>
    </button>
   </div>
   {canResume&&resumeStory?.cover&&<img className="resume-cover" src={resumeStory.cover} alt="" width="90" height="135"/>}
  </header>
  <section className="feature-panel" aria-label="登入與同步"><h2>{premium.googleSignedIn?'Google 帳號已登入':'把閱讀紀錄帶到下一台裝置'}</h2>{premium.googleClientId&&!premium.googleSignedIn?<GoogleSignIn clientId={premium.googleClientId} onChange={premium.refresh}/>:null}<DriveBackupControls backup={driveBackup} onSignIn={()=>showCheckout()}/><button className="text-link" onClick={()=>{const el=document.querySelector<HTMLDetailsElement>('#reading-data');if(el){el.open=true;el.scrollIntoView({behavior:'smooth'});}}}>下載備份與還原</button></section><LearningReport progress={progress} vocab={vocab}/><ReadingPassport progress={progress} onRead={read}/>{premium.productAdmin&&<ProductDashboard/>}
  <div className="reading-hub-sections">
   <details><summary><Flame size={18} aria-hidden="true"/><span>閱讀目標與紀錄</span><ChevronRight size={17} aria-hidden="true"/></summary><ReadingCalendar habit={habit}/><WeeklyGoal progress={progress} lastBackup={feature.state.lastBackup} onCenter={()=>{const section=document.querySelector<HTMLDetailsElement>('#reading-data');if(section){section.open=true;section.scrollIntoView({behavior:'smooth'})}}}/><LocalReadingInsights progress={progress}/></details>
   <details><summary><Bookmark size={18} aria-hidden="true"/><span>複習與收藏</span><ChevronRight size={17} aria-hidden="true"/></summary><MistakeReview onRead={read}/><ReadingCenter feature={feature} progress={progress} vocab={vocab} signed={signed} onRead={read} refresh={refresh}/></details>
   <details id="reading-data" open={driveBackup.returnedFromGoogle||undefined}><summary><Library size={18} aria-hidden="true"/><span>備份與跨裝置同步</span><ChevronRight size={17} aria-hidden="true"/></summary><ProductConsent/><BackupPanel onRestore={refresh}/><StudyExport/><StudyChoice/></details>
   <details><summary><Sparkles size={18} aria-hidden="true"/><span>推薦閱讀</span><ChevronRight size={17} aria-hidden="true"/></summary><ForYou state={feature.state} progress={progress} onRead={read} onBook={book}/></details>
  </div>
 </section></>:view==='analytics'?<><GlobalStudy/></>:view==='ranking'?<StoryInsights onRead={read}/>:view==='home'?<><section className="home-intro" aria-labelledby="start-here-title">
  <div className="home-intro-copy">
   <div className="home-hero-content">
    <h1 id="start-here-title"><span>把英文讀成故事。</span><small>{freeBookCount} 本小說整本免費讀</small></h1>
    <p className="home-lead">從喜歡的故事開始，點一下單字就能看中文。</p><p className="fine">{stories.length} 本分級小說 · 其餘作品免費試讀前 {previewChapters} 章</p>
    <div className="home-hero-actions">
     <a href="#free-shelf" className="home-hero-cta">挑一本免費小說 <ArrowRight size={18} aria-hidden="true"/></a>
     {hasResume&&<button className="home-hero-resume" onClick={()=>read(last)}>接續上次閱讀</button>}
    </div>
   </div>
   <div className="home-hero-art" aria-hidden="true">
    {[freeHomeBooks[2],freeHomeBooks[0],freeHomeBooks[freeHomeBooks.length-1]].map(s=>s?.cover&&
     <img key={s.id} src={s.cover} alt="" width="320" height="480" decoding="async"/>)}
   </div>
  </div>
  <nav className="home-hero-actions" aria-label="依興趣選書">
   {startingShelves.map(shelf=><button key={shelf.label} className="secondary" onClick={()=>openShelf(shelf)}>{shelf.label} <ArrowRight size={15} aria-hidden="true"/></button>)}
  </nav>
  <section className="starter-shelf" aria-labelledby="starter-title">
   <div className="starter-heading"><h2 id="starter-title">今天，從哪個故事開始？</h2><p>三本精選，全本免費。點一下直接讀第一章。</p></div>
   <div className="starter-grid">{starterPicks.map(({story:s,label,hook})=><a className="starter-card" key={s.id} href={'?book='+s.id+'&chapter='+s.chapters[0].id} onClick={event=>{if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();read(s.chapters[0].id)}}}>
    <div className="starter-art"><img src={s.cover} alt="" width="320" height="480" decoding="async"/><span>{label}</span></div>
    <div className="starter-copy"><h3>{s.zh}</h3><p>{hook}</p><small>程度：{s.level} · 全本免費</small><strong>開始閱讀 <ArrowRight size={16}/></strong></div>
   </a>)}</div>
  </section>
  <div className="home-shelf-heading" id="free-shelf"><h2>全本免費書架</h2><span>每本 25 章</span></div>
  <div className="home-picks">
   {freeHomeShelves.map(({level,books})=><section key={level} className="home-tier" aria-label={level+' 詞彙級距'}>
    <h3>{levelLabel(level)} <span>{level}</span></h3>
    <div className="home-tier-books">
     {books.map(s=><button className="home-pick" key={s.id} onClick={()=>read(s.chapters[0].id)} aria-label={`免費讀《${s.zh}》第 1 章`}>
      <span className="home-cover" style={{backgroundColor:s.color}}>
       <span className="home-play"><BookOpen size={17} aria-hidden="true"/></span>
       {s.cover&&<img src={s.cover} alt="" width="320" height="480" loading={level===freeHomeShelves[0]?.level?'eager':'lazy'} decoding="async"/>}
      </span>
      <span className="home-book-copy"><b>{s.zh}</b><span className="home-book-hook">{s.hook}</span><small>程度：{s.level} · 全本免費</small><span className="home-start">開始閱讀 <ArrowRight size={14} aria-hidden="true"/></span></span>
     </button>)}
    </div>
   </section>)}
  </div>
 </section>
 <HomeStories onBook={book}/>
 <section className="trial-shelf" aria-labelledby="trial-shelf-title">
  <div className="trial-shelf-header">
   <div><h2 id="trial-shelf-title">免費試讀 {previewChapters} 章</h2><p>{premiumBookCount} 本小說，每本可讀前 {previewChapters} 章。</p></div>
   <button className="secondary" onClick={()=>navigate('library')}>前往分級書城 <ArrowRight size={16}/></button>
  </div>
  <ul className="trial-shelf-grid" id="trial-books">
   {(showAllTrialBooks?expandedTrialBooks:trialPicks).map(story=><li key={story.id}>
    <button className="trial-book" onClick={()=>read(story.chapters[0].id)} aria-label={`試讀《${story.zh}》第 1 章`}>
     <span className="trial-cover" style={{backgroundColor:story.color}}>
      {story.cover&&<img src={story.cover} alt="" width="320" height="480" loading="lazy" decoding="async"/>}
      <span className="home-play"><ArrowRight size={16} aria-hidden="true"/></span>
     </span>
     <span className="trial-book-copy"><b>{story.zh}</b><span className="home-book-hook">{story.hook}</span><small>程度：{story.level} · 前 {previewChapters} 章免費</small></span>
    </button>
   </li>)}
  </ul>
  {trialBooks.length>trialPicks.length&&<button className="trial-expand secondary" aria-expanded={showAllTrialBooks} aria-controls="trial-books" onClick={()=>setShowAllTrialBooks(value=>!value)}>{showAllTrialBooks?'收起其他試讀書':`展開全部 ${premiumBookCount} 本試讀小說`}</button>}
 </section>
 {progress.length>0&&<div className="home-progress"><ReadingCalendar habit={habit} compact onCenter={()=>navigate('center')}/><WeeklyGoal progress={progress} compact lastBackup={feature.state.lastBackup} onCenter={()=>navigate('center')}/></div>}
 <DiscoveryBoards onRead={read}/><ReadingGuide/></>:view==='library'?<><div className="page-top shelf-intro"><div><h1>{onlySaved?'我的收藏':'分級書城'}</h1><p>{stories.length} 本可讀 · {freeBookCount} 本整本免費</p></div></div>{upcomingStories.length>0&&<details className="feature-panel"><summary>即將上架 · {upcomingStories.length} 本</summary><ul>{upcomingStories.map(b=><li key={b.id}>{b.zh} · 正文尚未完整，不計入可讀數量</li>)}</ul></details>}<section className="shelf-controls" aria-label="找故事">
  <div className="search-row"><label><Search size={18}/><input aria-label="搜尋故事" placeholder="搜尋故事、秘密、校園…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <button className={'icon-text '+(onlyFree?'selected':'')} aria-pressed={onlyFree} onClick={()=>setOnlyFree(!onlyFree)}>整本免費</button>
   <button className={'icon-text '+(onlySaved?'selected':'')} aria-pressed={onlySaved} onClick={()=>setOnlySaved(!onlySaved)}><Bookmark size={17}/>已收藏</button>
  </div>
  <div className="level-tabs" role="group" aria-label="參考詞表級距">{['全部',...levels].map(l=><button className={level===l?'selected':''} key={l} onClick={()=>setLevel(l)}>{l==='全部'?'全部':(levels.indexOf(l)===6?'延伸級':'第 '+(levels.indexOf(l)+1)+' 級')+' · '+l}{l!=='全部'&&!stories.some(s=>s.level===l)&&<small> · 即將上架</small>}</button>)}</div>
  <div className="genre-heading"><h2>今天想讀哪一種故事？</h2><span>先選題材，再挑程度</span></div><div className="shelf-topics genre-grid" role="group" aria-label="故事題材">
   {primaryTopics.map(topic=><button key={topic} type="button" aria-pressed={genre===topic} onClick={()=>setGenre(topic)}><span>{topic}</span><small>{stories.filter(story=>matchesGenre(story,topic)).length}</small></button>)}
  </div>
  <label className="topic-picker">細分題材
   <select aria-label="更多題材" value={extraTopics.includes(genre)?genre:''} onChange={event=>setGenre(event.target.value||genre)}>
    <option value="">{genreGroups.some(group=>group.name===genre)?genre+'全部作品':'所有細分題材'}</option>
    {extraTopics.filter(topic=>!genreGroups.some(group=>group.name===genre)||genreGroups.find(group=>group.name===genre)!.pattern.test(topic)).map(topic=><option key={topic} value={topic}>{topic}</option>)}
   </select>
  </label>
  <details className="shelf-extra"><summary>更多篩選</summary><div className="search-row"><select aria-label="內容校訂狀態" value={editorialFilter} onChange={e=>setEditorialFilter(e.target.value)}><option>全部校訂狀態</option><option>校訂完成</option><option>校訂中</option></select><select aria-label="單字範圍" value={range} onChange={e=>setRange(e.target.value)}><option value="全部範圍">全部範圍</option><option value="A">A 本 · 前約 500 詞</option><option value="B">B 本 · 後約 500 詞</option><option value="custom">故事自選詞彙</option><option value="pending">詞表整理中</option></select></div></details>
 </section><details className="shelf-extras" id="discover-more"><summary>新書與快速試讀</summary><NewReleases onBook={book} onRead={read}/><QuickTaste options={filtered.slice(0,12)} onRead={read} onBook={book}/></details><div className="shelf-summary"><span>找到 {filtered.length} 本故事{level!=='全部'&&!stories.some(s=>s.level===level)?' · 此級距即將上架':''}</span></div><SponsorSlot placement="書城精選"/><div className="books-grid">{filtered.map(s=><Card key={s.id} s={s}/>)}</div>{!filtered.length&&<div className="empty"><Library size={34}/><h2>這個書架還沒有故事</h2><p>{level!=='全部'&&!stories.some(s=>s.level===level)?'這個級距尚未有完成上架的作品，可以先選其他級距試讀。':'試試其他關鍵字，或先把喜歡的書加入收藏。'}</p><button className="primary" onClick={()=>{setLevel('全部');setGenre('全部題材');setOnlySaved(false);setOnlyFree(false);setQuery('');setRange('全部範圍');setEditorialFilter('全部校訂狀態')}}>瀏覽全部故事</button></div>}</>:view==='book'?<><button className="back-link" onClick={()=>navigate('library')}><ChevronLeft size={17}/>回分級書城</button><section className="book-detail"><div className="detail-cover"><Cover s={story} large/></div><div className="detail-copy"><div className="detail-meta"><span>{difficultyLabel(story)}</span><span>{isFreeBook(story.id)?'全本免費':`前 ${previewChapters} 章免費`}</span></div><h1>{story.zh}</h1><p className="detail-en">{story.title}</p><StoryPreview key={story.id} story={story} onRead={read}/><details className="book-learning-details"><summary>程度、詞彙與校訂紀錄</summary><p>{rangeLabel(story)}。{story.vocabularyRange==="A"||story.vocabularyRange==="B"?"A、B 本依同一級的配詞順序分冊。":""}目錄列出各章英文正文長度。</p><p>{[story.primaryGenre||story.genre,...(story.plotTags||[])].join(" · ")}</p><p><EditorialStatus story={story}/> <a href="./editorial-progress.html">查看校訂紀錄</a></p>{story.importNote&&<p>{story.importNote}</p>}{story.vocabularySummary&&<p>每章至少 {story.vocabularySummary.perChapter} 個目標詞，全書 {story.vocabularySummary.uniqueTargets} 個不同詞條。</p>}{story.coverage&&<p>參考第 {story.coverage.referenceLevel} 級目標詞。正文精確詞形覆蓋率 {story.coverage.exactCoverage}%。級距代表目標詞安排，全文也會出現其他程度的詞。</p>}<a href="./vocabulary.html">詞彙來源與計算方式</a></details><div className="detail-actions"><button className="primary" onClick={()=>read(story.chapters.find(c=>c.available&&chapterReadable(story.id,c.number)&&!progress.some(p=>p.chapter===c.id))?.id||story.chapters[0].id)}>開始免費閱讀 <ArrowRight size={18}/></button><button className="secondary" onClick={()=>saveBook(story.id)}><Bookmark size={18}/>{savedBooks.includes(story.id)?'已加入書架':'加入書架'}</button></div><p className="fine">{isFreeBook(story.id)?'整本 25 章永久免費，不必看廣告或解鎖。':`前 ${previewChapters} 章可直接免費閱讀。後續章節待通行證開賣後開放，目前不收款。`}<br/>AI 輔助原創與翻譯；若遇到不自然的句子，歡迎勘誤。</p></div></section><div className="section-heading"><h2>章節目錄 <small>／ 25 章</small></h2><span className="fine">每個秘密，都有下一頁。</span></div><div className="chapter-grid">{story.chapters.map(c=><button key={c.id} onClick={()=>read(c.id)} className={!c.available?'unpublished':''}><span className="chapter-number">{String(c.number).padStart(2,'0')}</span><div><b>{c.zh}</b><small>{c.title}{c.wordCount>0&&" · 英文正文 "+c.wordCount.toLocaleString()+" 詞"}</small></div><span className={'chapter-status '+(c.available&&c.number<=previewChapters?'free':'')}>{!c.available?'創作中':isFreeBook(story.id)?'免費':c.number<=previewChapters?(progress.some(p=>p.chapter===c.id)?<Check size={15}/>:'免費試讀'):chapterReadable(story.id,c.number)?<><Check size={12}/>已解鎖</>:<><Lock size={12}/>尚未開放</>}</span></button>)}</div><SponsorSlot placement="作品目錄頁尾"/></>:view==='reader'?<><div className="reader-header"><button onClick={()=>book(story)}><ChevronLeft size={17}/>{story.zh}</button><button className="mobile-toc" aria-expanded={toc} aria-controls="chapter-toc" onClick={()=>setToc(!toc)}><Menu size={17}/>章節目錄</button></div><div className="reader-layout"><aside id="chapter-toc" className={'reader-toc '+(toc?'show':'')} aria-label="章節目錄"><div>{story.chapters.map(c=><button key={c.id} onClick={()=>read(c.id)} className={c.id===chapterId?'selected':''}><span>{String(c.number).padStart(2,'0')}</span><b>{c.zh}</b>{!c.available?<small>待更</small>:c.number>previewChapters?(chapterReadable(story.id,c.number)?<Check size={12}/>:<Lock size={12}/>):progress.some(p=>p.chapter===c.id)?<Check size={12}/>:null}</button>)}</div></aside><div className="reader-body">{loadingChapter?<div className="empty" role="status"><BookOpen className="pulse" size={36}/><h2>翻到下一頁…</h2></div>:chapterError?<div className="locked-page"><div className="lock-circle">{currentMeta?.number&&currentMeta.number>previewChapters&&currentMeta.available?<Lock size={28}/>:<BookOpen size={28}/>}</div><span className="eyebrow">CHAPTER {currentMeta?.number}</span><h1>{currentMeta?.zh}</h1><p>{chapterError}</p>{currentMeta?.available&&currentMeta.number>previewChapters&&<RewardPanel key={story.id+chapterId} story={story.id} chapter={chapterId} onRead={read}/>}<div className="locked-actions">{currentMeta?.number&&currentMeta.number>previewChapters&&currentMeta.available?<button className="primary" onClick={()=>showCheckout(story.id)}>查看閱讀通行證 <ArrowRight size={17}/></button>:<button className="primary" onClick={()=>read(story.chapters[0].id)}>讀免費第一章</button>}<button className="secondary" onClick={()=>read(chapterId)}>重新載入</button></div><button className="text-link" onClick={()=>book(story)}>返回章節目錄</button>{story.series&&<div className="series-preview-links"><p>想先看看後續卷的走向？各卷首章皆可試讀。</p>{stories.filter(s=>s.seriesId===story.seriesId&&s.id!==story.id).map(s=><button className="text-link" key={s.id} onClick={()=>book(s)}>卷 {s.volume} · {s.level}</button>)}</div>}</div>:chapter&&<article className="reader-paper" onClick={event=>{
  const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button[data-lookup]'):null;
  if(button?.dataset.lookup)lookup(button.dataset.lookup,button);
 }} onKeyDown={event=>{
  if(event.key==='ArrowDown'&&inlineLookup&&event.target===wordTrigger.current){event.preventDefault();dialogRef.current?.focus({preventScroll:true})}
 }}><header className="reader-title">
  <p className="reader-chapter-number">第 {currentMeta?.number} 章 <span>/ {story.chapters.length}</span></p>
  <h1 lang="en">{readerText?.title}</h1><p className="reader-chapter-zh">{chapter.zh}</p>
 </header><div className="reader-tools">
  <button className={'mixed-toggle '+(mixedReading?'selected':'')} aria-pressed={mixedReading} onClick={toggleMixedReading}>邪修法</button>
  {mixedReading&&<div className="mixed-study-mode" role="group" aria-label="邪修閱讀模式"><button aria-pressed={mixedHints} onClick={()=>setMixedHints(true)}>學習版</button><button aria-pressed={!mixedHints} onClick={()=>{closeWord(false);setMixedHints(false)}}>複習版・隱藏詞義</button></div>}
  <button onClick={()=>speaking?stop():speak(chapter.paragraphs.map(p=>p.en).join(' '))}>{speaking?<Pause size={17}/>:<Headphones size={17}/>}<span>{speaking?'停止朗讀':mixedReading?'英文原文朗讀':'朗讀'}</span></button>
  <button onClick={()=>mixedReading?toggleMixedReading():setTranslated(translated.length===chapter.paragraphs.length?[]:chapter.paragraphs.map((_,i)=>i))}>{mixedReading?'回英文原文':translated.length===chapter.paragraphs.length?'收起中文':'顯示中文'}</button>
  <details className="reader-settings"><summary>閱讀設定</summary><div className="reader-settings-options">
   <button aria-label="縮小文字" onClick={()=>setFontSize(Math.max(17,fontSize-2))}>A−</button>
   <button aria-label="放大文字" onClick={()=>setFontSize(Math.min(29,fontSize+2))}>A+</button>
   <button aria-label="切換閱讀色彩" onClick={()=>setTheme(theme==='night'?'paper':'night')}>{theme==='night'?<Sun size={17}/>:<Moon size={17}/>}</button>
   <select aria-label="閱讀行距" value={comfort.line} onChange={e=>comfort.setLine(Number(e.target.value))}><option value={1.6}>緊湊行距</option><option value={1.9}>標準行距</option><option value={2.2}>寬鬆行距</option></select>
   <select aria-label="朗讀速度" value={rate} onChange={e=>{stop();setRate(e.target.value)}}>{['0.7','0.85','1'].map(r=><option key={r}>{r}</option>)}</select>
   <button onClick={()=>comfort.setFocus(!comfort.focus)}>{comfort.focus?'退出專注閱讀':'專注閱讀'}</button>
   {currentMeta&&<a className="text-link" href={'?book='+encodeURIComponent(story.id)+'&chapter='+encodeURIComponent(currentMeta.id)}>本章固定網址</a>}
  </div></details>
 </div><button className="text-link share-chapter" onClick={async()=>{const url=new URL(location.pathname,location.origin);url.searchParams.set('book',story.id);url.searchParams.set('chapter',chapter.id);try{await navigator.clipboard.writeText(url.href);setToast('本章閱讀連結已複製')}catch{setToast('請使用閱讀設定中的「本章固定網址」複製連結')}}}>複製本章連結</button><p className="reader-inline-tip">{mixedChapter?`本章 ${mixedChapter.count} 個正文目標詞。${mixedHints?'學習版顯示詞義；切換複習版試著回想。':'複習版已隱藏詞義，點「揭曉詞義」逐字對答案。'}〔〕標示原文用詞，可點字查詞。`:'點英文單字看中文，按「返回原文」繼續閱讀。'}</p><div className={'prose '+(mixedReading?'mixed-prose':'')} style={{fontSize,lineHeight:comfort.line}}>{chapter.paragraphs.map((p,i)=><section id={'paragraph-'+i} data-paragraph={i} key={chapter.id+'-'+i+'-'+mixedHints}>{mixedChapter?<><MixedParagraph {...mixedChapter.paragraphs[i]} hints={mixedHints}/><details className="mixed-original"><summary>看這段英文</summary><p lang="en">{readerText?.paragraphs[i]}</p></details></>:<p style={{lineHeight:comfort.line}}>{readerText?.paragraphs[i]}</p>}{!mixedReading&&translated.includes(i)&&<p className="translation">{p.zh}</p>}<details className="paragraph-tools"><summary aria-label="段落工具" title="段落工具">⋯</summary><button hidden={mixedReading} className="paragraph-translate" onClick={()=>setTranslated(translated.includes(i)?translated.filter(n=>n!==i):[...translated,i])}>{translated.includes(i)?'收起中文 −':'中文 ＋'}</button><QuoteButton chapter={chapter} index={i} story={story} state={feature.state} update={feature.update}/><SentenceReport story={story} chapter={chapter} index={i}/></details></section>)}</div><EndMarker story={story} chapter={chapter}/><ChapterPractice key={chapter.id} chapter={chapter} onMistakes={savePracticeMistakes} onReview={reviewPracticeWords}/>{reachedPreviewEnd&&<TrialOffer book={story.id}/>}<button className="secondary" onClick={()=>{setMixedReading(false);setTranslated([]);document.querySelector('.prose')?.scrollIntoView({behavior:'smooth'});}}>遮住中文，再讀一次</button><div className="chapter-pagination">{currentMeta?.number===25?<button className="primary" onClick={()=>navigate('library')}>讀完這本，挑下一本 <Check size={17}/></button>:currentMeta?.number===previewChapters&&!chapterReadable(story.id,previewChapters+1)?<button className="primary" onClick={()=>{productEvent('offer_click',story.id);showCheckout(story.id);}}>繼續讀第 {previewChapters+1} 章 <ArrowRight size={17}/></button>:<button className="primary" onClick={()=>{trackReading('next_chapter',story.id,chapter.id);sendEvent('next_chapter',story.id,chapter.id);read(story.chapters[currentMeta?.number||1].id)}}>繼續第 {(currentMeta?.number||1)+1} 章 <ChevronRight size={17}/></button>}<button className="chapter-review-link" aria-expanded={showReview} aria-controls="chapter-review" onClick={()=>setShowReview(value=>!value)}>{showReview?'收起測驗與複習':'測驗與複習'}</button></div>{reachedPreviewEnd&&<p className="preview-price">{premiumDescription}{!premium.checkout&&<small>通行證尚未開賣</small>}</p>}{nextFreeBook&&<section className="next-free" aria-label="下一本整本免費小說">
  {nextFreeBook.cover&&<img src={nextFreeBook.cover} loading="lazy" alt=""/>}
  <div><span className="fine">目前讀到第 {previewChapters}／{story.chapters.length} 章</span>
   <h2>已到《{story.zh}》試讀最後一章</h2>
   <p>本書已完成 {story.chapters.filter(c=>progress.some(p=>p.chapter===c.id)).length}／{story.chapters.length} 章。第 {previewChapters+1}–{story.chapters.length} 章{premium.checkout?'可用通行證開通':'尚未開放'}。</p>
   <p>NT${premiumPriceTwd} 一次付費，規劃開放購買時書單內作品的後續章節。</p>
   <button className="secondary" onClick={()=>showCheckout(story.id)}>查看通行證方案</button>
   <h3>接著免費讀《{nextFreeBook.zh}》</h3><p>{nextFreeBook.hook}</p>
   <button className="secondary" onClick={()=>read(nextFreeBook.chapters[0].id)}>免費讀第 1 章 <ArrowRight size={17}/></button>
  </div>
 </section>}<div className="reader-extras" id="chapter-review" hidden={!showReview}>
  <details><summary>閱讀測驗{chapter.questions.length?' · '+chapter.questions.length+' 題':''}</summary><section className="quiz">{chapter.questions.map((q,i)=><fieldset key={i}><legend>{q.question}</legend>{q.options.map((o,j)=><label key={j} className={submitted?(j===q.answer?'correct':answers[i]===j?'wrong':''):answers[i]===j?'picked':''}><input type="radio" name={'q'+i} checked={answers[i]===j} disabled={submitted} onChange={()=>setAnswers(a=>{const next=[...a];next[i]=j;return next})}/><span>{String.fromCharCode(65+j)}</span>{o}{submitted&&j===q.answer&&<Check size={16}/>}</label>)}{submitted&&<p className="explanation">{q.explanation}</p>}</fieldset>)}{submitted?<div className="quiz-result"><Check size={18}/>{chapter.questions.length?`${score} / ${chapter.questions.length} 答對 · `:''}已保存閱讀紀錄 <button onClick={()=>{setSubmitted(false);setAnswers([])}}>再試一次</button></div>:<button className="primary" disabled={busy||!loaded||cloudError} onClick={async()=>{if(chapter.questions.some((_,i)=>!Number.isInteger(answers[i]))){setToast('先選一個答案，看看你有沒有發現線索。');return}const r=await action({action:'complete',chapter:chapter.id,answers});if(r){if(chapter.questions.length)trackReading('quiz_complete',story.id,chapter.id);trackReading('chapter_complete',story.id,chapter.id);recordReading('chapter_complete',story.id,chapter.id);setScore(r.score);setSubmitted(true);if(!rememberQuizMistakes(chapter,answers))setToast('閱讀進度已保存，但錯題本無法寫入本機。');else setToast(r.passportNotice||(signed?'已保存到你的帳號':'已保存到這台裝置'))}}}>完成本章 <Check size={17}/></button>}</section></details>
  <details><summary>本章單字</summary><section className="chapter-words">{chapter.vocabularyPlan&&<p className="vocabulary-verification">{chapter.vocabularyPlan.referenceLevel>0?`目標詞來自參考第 ${chapter.vocabularyPlan.referenceLevel} 級`:'已核對自訂進階詞表（非官方第7級）'} · 本章 {chapter.vocabularyPlan.targetCount} 個目標詞 · 全書 {chapter.vocabularyPlan.bookUniqueTargetCount} 個不同目標詞。<small>本章首次列為目標：{chapter.vocabularyPlan.newTargetCount} 詞；其餘為複習。首次列為目標不代表從未出現在前文。</small></p>}<p className="fine">依詞表級別、字長與入門字清單挑選；不代表你的實際難度。點字收藏，再回單字口袋複習。</p><button className="text-link" onClick={()=>setAllWords(!allWords)}>{allWords?'收起其他目標詞':`查看全部 ${chapter.words.length} 個目標詞`}</button><div>{(allWords?chapter.words:challengingWords(chapter)).map(w=><button key={w.word} onClick={()=>w.meaning?setWord({...w,word:normalizeWord(w.word),source:w.source||'本章詞彙'}):lookup(w.word)}><b>{w.word}</b><span>{w.meaning||'點選查中文'}</span><Bookmark size={16}/></button>)}</div></section></details>
  <details><summary>章節交流</summary><ChapterCommunity chapter={chapter} signed={true}/></details>
 </div></article>}</div></div></>:view==='access'?<ReadingAccess onRead={read} premium={premium} checkoutBook={checkoutBook}/>:view==='words'?<section className="word-pocket" aria-labelledby="word-pocket-title">
 <header className="word-pocket-head">
  <div><h1 id="word-pocket-title">單字口袋</h1><p>{vocab.length} 個收藏 · {due.length} 個待複習</p></div>
  {vocab.length>0&&<button className="primary" onClick={()=>startReview(!due.length)}>{due.length?'開始複習':'練習全部單字'} <RotateCcw size={16}/></button>}
 </header>
 <VocabularyGame words={vocab} disabled={busy||!loaded||cloudError} onReview={(word,known)=>action({action:"review",word,known})} onSpeak={speak}/>
 {vocab.length>0?<section className="word-collection" aria-labelledby="word-collection-title">
  <div className="word-collection-head">
   <h2 id="word-collection-title">我的收藏</h2>
   <label className="word-pocket-search"><Search size={17} aria-hidden="true"/><input type="search" aria-label="搜尋收藏單字" placeholder="搜尋單字或詞義" value={wordFilter} onChange={event=>setWordFilter(event.target.value)}/></label>
  </div>
  {visibleWords.length?<ul className="vocabulary-grid">{visibleWords.map(v=><li key={v.word}>
   <button className="vocabulary-definition" onClick={()=>v.meaning?setWord(v):lookup(v.word)}><b lang="en">{v.word}</b><span>{v.meaning||'查詢詞義'}</span></button>
   {(v as SavedWord & {chapter?:string}).chapter&&<button className="text-link" onClick={()=>{originalParagraph.current=(v.paragraph??-1)>=0?v.paragraph!:null;void read(v.chapter!);}}>回到故事原文</button>}{v.sentence&&<p className="fine" lang="en">{v.sentence}</p>}<div className="vocabulary-card-foot">
    <small className={v.due<=Date.now()?'word-due':''}>{v.due<=Date.now()?'待複習':new Date(v.due).toLocaleDateString('zh-TW',{month:'numeric',day:'numeric',timeZone:'Asia/Taipei'})+' 複習'}</small>
    <button aria-label={'朗讀 '+v.word} onClick={()=>speak(v.word)}><Volume2 size={17}/></button>
    <button aria-label={'移除 '+v.word} disabled={busy} onClick={()=>action({action:'remove',word:v.word})}><X size={16}/></button>
   </div>
  </li>)}</ul>:<p className="word-no-results" role="status">找不到符合的單字。</p>}
  {due.length>0&&<button className="text-link" onClick={()=>startReview(true)}>練習全部單字 <ArrowRight size={16}/></button>}
 </section>:<div className="word-pocket-empty">
  <Bookmark size={29} aria-hidden="true"/><h2>還沒有收藏的單字</h2><p>讀故事時點一個英文單字，再按「收藏單字」。</p>
  <button className="secondary" onClick={()=>read(last)}>去讀一章 <ArrowRight size={16}/></button>
 </div>}
 <details className="word-pocket-backup"><summary>學習備份</summary><BackupPanel onRestore={refresh}/></details>
</section>:view==='review'?<><button className="back-link" onClick={()=>navigate('words')}><ChevronLeft size={17}/>單字口袋</button><div className="review-area"><h1>單字複習</h1><p className="review-count">這回合已練習 {reviewed} 次</p>{reviewWord?<><button className="flashcard" onClick={()=>setFlipped(!flipped)}><span>{flipped?'中文詞義':'先試著回想'}</span><h2>{reviewWord.word}</h2><p>{flipped?(reviewWord.meaning||'點下方查詞義更新這個舊版單字'):'點一下，翻開答案'}</p></button>{reviewWord.sentence&&<section className="feature-panel"><p lang="en">{reviewWord.sentence}</p>{reviewWord.sentenceZh&&<details><summary>查看原句中文</summary><p>{reviewWord.sentenceZh}</p></details>}</section>}{flipped&&<div className="review-buttons"><button className="secondary" disabled={busy} onClick={async()=>{if(await action({action:'review',word:reviewWord.word,known:false})){setReviewed(reviewed+1);setFlipped(false);if(reviewAll||practiceQueue)setReviewIndex(reviewIndex+1)}}}>還不熟 · 10 分鐘後</button><button className="primary" disabled={busy} onClick={async()=>{if(await action({action:'review',word:reviewWord.word,known:true})){setReviewed(reviewed+1);setFlipped(false);if(reviewAll||practiceQueue)setReviewIndex(reviewIndex+1)}}}>記住了 <Check size={17}/></button></div>}<button className="text-link" onClick={()=>lookup(reviewWord.word)}>查詞義／聽發音</button></>:<div className="empty"><Check size={35}/><h2>這一輪，完成了。</h2><p>還不熟的字會在 10 分鐘後回到待複習清單。</p><button className="primary" onClick={()=>navigate('words')}>回單字口袋</button></div>}</div></>:<><div className="page-top"><div><span className="eyebrow">SMALL STEPS, REAL STORIES</span><h1>你讀過的每一頁，都算數。</h1><p>{signed?'學習紀錄已跟著你的帳號保存。':'閱讀紀錄保存在此瀏覽器，可至閱讀中心下載備份。'}</p></div></div><div className="metrics"><div><Flame size={22}/><b>{streak(activity)}</b><span>連續閱讀天數</span></div><div><BookOpen size={22}/><b>{done}<small> / {totalWritten}</small></b><span>新版故事完成章節</span></div><div><Bookmark size={22}/><b>{vocab.length}</b><span>已收藏單字</span></div></div><div className="section-heading"><h2>閱讀足跡</h2></div><div className="history">{[...progress].sort((a,b)=>b.completed-a.completed).map(p=>{const c=allMeta.find(c=>c.id===p.chapter);return <button key={p.chapter} onClick={()=>c?read(c.id):setToast('舊版閱讀紀錄仍保存；請選讀新版故事。')}><span className="history-icon"><Check size={18}/></span><div><b>{c?.zh||'舊版故事 · '+p.chapter}</b><small>{c?.title||'已保留改版前的學習紀錄'} · {new Date(p.completed).toLocaleDateString('zh-TW')}</small></div><ArrowUpRight size={17}/></button>})}</div>{!progress.length&&<div className="empty"><BookOpen size={35}/><h2>你的故事，從第一章開始。</h2><button className="primary" onClick={()=>read('tomorrow-1')}>讀第一章</button></div>}</>}
 {view==='reader'&&chapter&&!loadingChapter&&!chapterError&&<details className="page-reading-support"><summary>更多閱讀輔助</summary><ReadingSupport key={chapter.id+"support"} story={story} chapter={chapter} progress={progress} onBook={book} onTranslate={()=>setTranslated(chapter.paragraphs.map((_,i)=>i))}/></details>}<FeedbackBox book={view==='reader'?story.id:''} chapter={view==='reader'?chapter?.id||'':''}/><footer><div><b>拾頁 <span>StorySteps</span></b><p>再一章，就好。</p></div><div><a href="./library.html">完整書目</a><a href="./about.html">關於拾頁</a><a href="./demos.html">操作示範</a><a href="./dictionary/ECDICT-LICENSE.txt">擴充詞庫授權</a><a href="./privacy.html">隱私政策</a><a href="./contact.html">聯絡與勘誤</a><a href="./editorial.html">校訂狀態</a><a href="./teachers.html">教師資源</a><a href="./teacher-sample.html">免費學習單</a><a href="./partners.html">商業合作</a><a href="./analytics-guide.html">營運資料說明</a><button className="footer-privacy" onClick={()=>setModal('privacy')}>網站與隱私</button></div><small>© 2026 StorySteps · 原創故事閱讀實驗</small></footer></main></div><nav className="mobile-nav" aria-label="手機主要導覽">{[['home','首頁',BookOpen],['library','書庫',Library],['words','單字',Bookmark],['center','閱讀',GraduationCap]].map(([id,label,Icon]:any)=><button key={id} aria-current={(view===id||(id==='library'&&['book','reader'].includes(view)))?'page':undefined} className={(view===id||(id==='library'&&['book','reader'].includes(view)))?'active':''} onClick={()=>navigate(id)}><Icon size={21}/><span>{label}</span></button>)}</nav>
 <div className="lookup-announcement" role="status" aria-atomic="true">{inlineLookup&&word?[word.word,word.meaning||word.error].join('，'):''}</div>{(modal||word)&&<div className={inlineLookup?'word-dock '+(wordAbove?'word-dock-top':'word-dock-bottom'):'overlay'} onClick={()=>{if(!inlineLookup){setModal('');closeWord()}}}><section ref={dialogRef} tabIndex={-1} className={'modal '+(word?'word-modal':'')} role="dialog" aria-modal={inlineLookup?undefined:true} aria-label={word?'單字中文翻譯':modal==='avatars'?'選擇頭像':'拾頁資訊'} onClick={e=>e.stopPropagation()}><button className="close" aria-label={inlineLookup?'返回原文':'關閉視窗'} onClick={()=>{setModal('');closeWord(inlineLookup)}}><X size={21}/></button>{word?<><h2 lang="en">{word.word}</h2>{word.original&&word.original.toLowerCase()!==word.word.toLowerCase()&&<p className="fine">查到的原形：{word.original}</p>}{word.error?<><p role="status">{word.error}</p><div className="modal-actions"><a className="text-link" href={'https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/'+encodeURIComponent(word.word)} target="_blank" rel="noreferrer">外部字典 <ArrowUpRight size={16}/></a></div></>:<><p className="word-meaning">{word.meaning}</p><span className="fine">{word.source||'已收藏詞義'}</span></>}<div className="modal-actions"><button className="secondary" onClick={()=>speak(word.word)}><Volume2 size={18}/>發音</button><button className="primary" disabled={busy||!loaded||cloudError||!!word.error||!word.meaning} onClick={async()=>{const exists=vocab.some(v=>v.word===word.word);if(await action({action:exists?'remove':'save',word:word.word,meaning:word.meaning}))setToast(exists?'已移出單字口袋':'已收藏，下次複習再見。')}}><Bookmark size={17}/>{vocab.some(v=>v.word===word.word)?'已收藏 · 移除':'收藏單字'}</button></div></>:modal==='feedback'?<><span className="eyebrow">LET'S WRITE THE NEXT CHAPTER</span><h2>下一個故事，想讀什麼？</h2><p>故事太難、反轉不夠、想追更？告訴我們。回饋不會公開；目前回饋僅保存在此瀏覽器，不會自動傳送。</p><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const r=await action({action:'feedback',kind:f.get('kind'),rating:Number(f.get('rating')),budget:f.get('budget'),message:f.get('message')});if(r){setModal('');setToast('回饋已保存，謝謝你幫拾頁寫下一章。')}}}><div className="form-grid"><label>回饋類型<select name="kind">{['使用建議','內容勘誤','題材推薦'].map(v=><option key={v}>{v}</option>)}</select></label><label>整體體驗<select name="rating" required defaultValue=""><option value="" disabled>選擇評分</option>{[5,4,3,2,1].map(n=><option value={n} key={n}>{n} / 5</option>)}</select></label></div><label>你的想法<textarea required minLength={5} maxLength={2000} rows={4} name="message" placeholder="可以寫書名、章節，或說說你最想看的題材。"/></label><button disabled={busy} className="primary">{busy?'儲存中…':'儲存本機回饋'} <ArrowRight size={17}/></button></form>{!!feedback.length&&<details><summary>我的近期回饋（{feedback.length}）</summary>{feedback.map(f=><p key={f.id}><b>{f.kind} · {f.rating}/5</b><br/>{f.message}</p>)}</details>}</>:modal==='paywall'?<><span className="eyebrow">THE STORY CONTINUES</span><h2>後續章節尚未開放</h2><RewardPanel key={story.id} story={story.id} chapter={chapterId} onRead={id=>{setModal('');read(id)}}/></>:modal==='avatars'?<>
 <h2>選擇頭像</h2>
 <div className="avatar-options">{animalAvatars.map(option=><button key={option.id} type="button" aria-pressed={avatarId===option.id} onClick={()=>chooseAvatar(option.id)}>
  <span className="animal-avatar" style={{backgroundPosition:option.position}} aria-hidden="true"/>
  <span>{option.label}</span>
 </button>)}</div>
 </>:modal==='profile'?<><span className="eyebrow">READ AT YOUR OWN PACE</span><h2>你的閱讀空間</h2>{premium.googleClientId&&<button className="secondary" onClick={()=>showCheckout()}>{premium.googleSignedIn?'管理 Google 登入':'使用 Google 登入'}</button>}<button className="text-link" onClick={()=>setModal('avatars')}>更換頭像</button><p>現在有 {freeBookCount} 本整本免費。通行證規劃 NT${premiumPriceTwd} 一次付費，目前尚未開賣；完整規格請見「免費閱讀與通行證」。</p><p>進度與解鎖預設保存在此瀏覽器。閱讀中心可自願啟用匿名跨裝置同步，也可以下載學習備份。</p><button className="primary" onClick={()=>{setModal('');navigate('center')}}>開啟閱讀中心</button></>:modal==='privacy'?<><span className="eyebrow">YOUR DATA</span><h2>閱讀紀錄，怎麼保存？</h2><StudyChoice/><AnalyticsChoice/><p><button className="text-link" onClick={()=>{setModal('');navigate('analytics')}}>歷史閱讀研究資料</button></p><p>此 GitHub Pages 版本的閱讀進度、生字本、書架、句子收藏與簽到日期保存在目前瀏覽器。清除網站資料會刪除紀錄，請至閱讀中心下載備份。目前沒有開通付款功能；{freeBookCount} 本完整免費，其餘故事開放前 {previewChapters} 章免費試讀。可到閱讀中心自願啟用同步金鑰跨裝置合併閱讀資料，未啟用時紀錄只保存在本機。新增雲端閱讀研究與段落文字回報目前暫停。既有歷史研究樣本依原政策處理，不代表全部訪客；即使使用隨機代碼也不是完全匿名。段落勘誤請經由聯絡頁由你自行送出，不會自動傳送給站主。</p><p>查詞僅使用內建詞庫；未收錄的字可由你選擇開啟外部字典。朗讀由瀏覽器語音服務提供。封面與故事內容為原專案取回的資料，本站目前只保留 AdSense 驗證資訊；展示廣告預設關閉，沒有讀者明確選擇不會載入 Google 廣告腳本。未來若啟用，Google 及其合作夥伴可能使用 Cookie 和裝置資訊提供或衡量廣告；請見正式隱私政策。</p><p><a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google 如何使用合作夥伴網站資料</a> · <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">管理 Google 廣告偏好</a></p><button className="secondary" onClick={()=>{try{localStorage.removeItem('storysteps-ad-choice-v1')}catch{}window.location.reload()}}>重設本機廣告選擇</button></>:<><span className="eyebrow">STORIES FIRST</span><h2>讓英文成為<br/>想讀下去的理由。</h2><p>拾頁把連載故事和分級英文放在一起。分級書城包含校園、懸疑、奇幻、歷史與戀愛。匯入小說對應原表第 1–6 級，實際完稿與校訂進度會標示在各書頁面。</p><p>《明天，別來學校》及部分匯入小說已收錄 25 章；目前書庫共有 {stories.length} 本、{totalWritten} 章，內容校訂進度會標示於書籍頁面。原創故事由 AI 輔助創作；匯入作品保留使用者提供的正文與翻譯，編輯校訂中的內容會另行標示。</p><p>已驗證書籍會顯示原表級別、每章配詞與全書不重複詞數；舊書級距仍代表寫作取向。讀完不等於已熟記全部單字。請搭配查詞與間隔複習。</p><p>{freeBookCount} 本指定小說整本免費。其他故事開放前 {previewChapters} 章免費試讀。已製作的故事封面採用 AI 插畫。</p><button className="primary" onClick={()=>setModal('feedback')}>告訴我們，你想追哪一本</button></>}</section></div>}
 {toast&&<div className="toast" role="status">{toast}<button aria-label="關閉通知" onClick={()=>setToast('')}><X size={16}/></button></div>}
 </div>
}
