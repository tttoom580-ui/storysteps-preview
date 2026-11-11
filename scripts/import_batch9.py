"""Parse and import the nine supplied independent bilingual novels, non-destructively.

--parse-only writes reviewable parsed assets and a validation report. Run the default
import only after the pending eleven-book rewrite has been installed.
"""
from pathlib import Path
from collections import defaultdict
import argparse,gzip,hashlib,json,re,statistics

R=Path(__file__).resolve().parents[1];P=R/'public';S=R.parent/'upload';D=R/'verification/import-new9'
SELECTION={
 '1A':('StorySteps_1A_山頂上的藍色風車_全新第5版_完整25章.md','山頂上的藍色風車','The Blue Windmill on the Hill','山村成長','停轉的藍色風車，藏著一個山村必須一起回答的問題。',['成長','山村','合作冒險']),
 '1B':('StorySteps_1B_蒲公英鎮的慢慢巴士_全新第6版_完整25章.md','蒲公英鎮的慢慢巴士','The Slow Bus of Dandelion Town','毛絨動物童話','空站牌旁，浣熊柯伊決定替走不遠的鄰居找一條路。',['毛絨動物','友誼','成長']),
 '2A':('2A_聽不見咒語的靈獸醫師_第7版_25章完整雙語稿.md','聽不見咒語的靈獸醫師','The Healer Who Listened to Beasts','凡人修仙','不肯飛的鹿，讓沒有靈根的月聽見學院忽略的聲音。',['奇幻仙俠','靈獸','女性成長']),
 '2B':('2B_雨季借你一把傘_第6版_25章完整雙語稿.md','雨季借你一把傘','An Umbrella for the Rainy Season','成年校園戀愛','從一座上鎖的傘架開始，他們練習把雨傘與心意交給彼此。',['校園戀愛','合作','慢熱戀愛']),
 '3A':('StorySteps_3A_第六版_雲線以上請聽第三聲_完整25章.md','雲線以上，請聽第三聲','Above the Fog, Wait for the Third Signal','高山規則推理','三條山站規則、失聯的觀測員，還有不該回答的無線電聲。',['規則推理','懸疑','救援']),
 '3B':('StorySteps_3B_第六版_把海風留在最後一格_完整25章.md','把海風留在最後一格','The Last Frame of the Harbor','海港影像戀愛','受潮的舊底片，拍下了港口從未好好說完的往事。',['成年戀愛','海港','影像修復']),
 '4B':('4B_1994，榕灣週報的最後一頁_全25章.md','1994，榕灣週報的最後一頁','The Last Page of the Banyan Bay Weekly','年代女性職場','她接手瀕臨停刊的週報，卻拒絕用新聞的沉默交換贊助。',['年代文','女性成長','地方報紙']),
 '5A':('5A_沙海種子庫_最後一袋雨_25章全新第七版.md','沙海種子庫：最後一袋雨','The Seed Vault of Sunreach: A Harvest That Was Not Promised','沙漠科幻懸疑','種子數目對不上，村落的明天卻已被寫進獨家取水合約。',['近未來','女性成長','懸疑']),
 '5B':('5B_雲鶴歸巢_與你修一條天空的路_25章全新第六版.md','雲鶴歸巢：與你修一條天空的路','The Skyway We Built for the Returning Cranes','成年雙男主仙俠','當雲鶴找不到歸途，兩個男人沿著浮空群島重修天空的路。',['雙男主','奇幻仙俠','合作冒險']),
}
LEVELS=['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000','6000–7000']
clean=lambda s:re.sub(r'(?m)^---+\s*$','',re.sub(r'[*`]','',s)).strip()
wc=lambda s:len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s))
norm=lambda s:''.join(re.findall(r'\w',s.casefold()))
apost=lambda s:s.casefold().replace('’',"'").replace('‘',"'")
has=lambda s,w:bool(re.search(r'(?<![a-z])'+re.escape(apost(w))+r'(?![a-z])',apost(s)))

def parse(code,info,cat,manifest):
 fn,zh,title,genre,hook,tags=info;source=(S/fn).read_text();parts=re.split(r'(?m)^## CHAPTER ',source)
 assert len(parts)==26,(fn,'chapter headings',len(parts)-1)
 bid='ss-r9-l'+code[0]+'-'+code[1].lower();chapters=[];metas=[];allids=[];sentences=defaultdict(set);issues=[]
 reference=next(b for b in cat if re.search(r'l'+code[0]+'-'+code[1].lower()+'$',b['id']) and b['id'].startswith(('ss-r2-','ss-r3-','ss-r4-','ss-r5-')))
 original=json.loads(gzip.decompress((P/manifest['books'][reference['id']]['url']).read_bytes()))
 for i,part in enumerate(parts[1:],1):
  heading=part.splitlines()[0].split('｜');assert len(heading)>=3 and int(heading[0])==i,(fn,i,'heading')
  body=part.split('### 正文與翻譯',1)[1].split('### 本章新目標詞',1)[0]
  pairs=re.findall(r'\*\*EN\*\*\s*(.*?)\*\*繁中\*\*\s*(.*?)(?=\*\*EN\*\*|\Z)',body,re.S)
  assert pairs and len(pairs)==body.count('**EN**')==body.count('**繁中**'),(fn,i,'unpaired prose')
  paras=[dict(en=clean(e),zh=clean(z)) for e,z in pairs];assert all(p['en'] and p['zh'] for p in paras),(fn,i,'blank prose')
  words=[]
  for row in part.split('### 本章新目標詞',1)[1].split('### 理解測驗',1)[0].splitlines():
   if not re.match(r'^\|\s*`?L[1-7]-',row):continue
   cells=[clean(x) for x in row.split('|')[1:-1]];assert len(cells)>=6,(fn,i,'table cells')
   eid,orig,pos,form,meaning,evidence=cells[:6]
   words.append(dict(word=form,original=orig,meaning=meaning,entryId=eid,pos=pos,referenceLevel=int(code[0]),source='上傳原稿語境詞表'))
  assert len(words)==(21 if i==25 else 20),(fn,i,'target count',len(words))
  assert {w['entryId'] for w in words}=={w['entryId'] for w in original[i-1]['words']},(fn,i,'assigned IDs differ')
  assert len({apost(w['word']) for w in words})==len(words),(fn,i,'duplicated displayed target')
  allids.extend(w['entryId'] for w in words)
  # Final-chapter files include whole-book validation appendices; these are not quiz explanations.
  quiz=re.split(r'(?m)^##\s+',part.split('### 理解測驗',1)[1],maxsplit=1)[0];questions=[]
  qparts=list(re.finditer(r'(?m)^\*\*(?:Q)?(\d+)\.\s*(.*?)\*\*\s*$',quiz))
  assert len(qparts)==2,(fn,i,'quiz headings',len(qparts))
  for qi,mt in enumerate(qparts):
   assert int(mt[1]) in [qi+1,(i-1)*2+qi+1],(fn,i,'quiz order');end=qparts[qi+1].start() if qi+1<len(qparts) else len(quiz);rest=quiz[mt.end():end]
   opts=re.findall(r'(?m)^\s*(?:-\s*)?([ABC])\.\s*(.+)',rest);assert [x[0] for x in opts]==list('ABC'),(fn,i,'quiz options')
   raw=clean(rest);answer=re.search(r'(?:答案|正解|Answer)\s*[：:]\s*([ABC])[。.．]?\s*(.*)',raw,re.S);assert answer,(fn,i,'answer')
   letter,exp=answer.groups();exp=re.sub(r'^[\s｜|]*(?:繁中解析|解析)?\s*[：:]?\s*','',exp).strip();exp=re.sub(r'\n\s*---.*$','',exp,flags=re.S).strip();assert exp,(fn,i,'blank explanation')
   qs=dict(question=clean(mt[2]),options=[clean(v) for _,v in opts],answer='ABC'.index(letter),explanation=exp)
   assert len(set(qs['options']))==3,(fn,i,'duplicated quiz choices');questions.append(qs)
  en=' '.join(p['en'] for p in paras);count=wc(en);assert count>=500,(fn,i,'short chapter',count)
  for w in words:
   assert w['meaning'],(fn,i,'blank meaning',w['word'])
   if not has(en,w['word']):issues.append(dict(chapter=i,kind='missing_exact_target',word=w['word']))
  for pi,para in enumerate(paras):
   for sentence in re.split(r'(?<=[.!?])\s+',para['en']):
    if wc(sentence)>=12:sentences[' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",sentence.casefold()))].add(i)
  ch=dict(id=f'{bid}-{i}',title=clean(heading[1]),zh=clean(heading[2]),paragraphs=paras,words=words,questions=questions)
  chapters.append(ch);metas.append(dict(id=ch['id'],title=ch['title'],zh=ch['zh'],number=i,available=True,wordCount=count))
 assert len(set(allids))==len(allids)==501,(fn,'unique IDs')
 repeated=[dict(sentence=s,chapters=sorted(v)) for s,v in sentences.items() if len(v)>1]
 intro=parts[0];desc=''
 match=re.search(r'(?m)^\*\*(?:故事)?簡介[：:]?\*\*\s*[：:]?\s*(.+)',intro)
 if match:desc=clean(match[1])
 if not desc:
  match=re.search(r'(?m)^## 故事簡介\s*\n+([^#\n][^\n]+)',intro)
  if match:desc=clean(match[1])
 if not desc:desc=next((clean(x) for x in intro.splitlines() if len(clean(x))>60 and not x.startswith(('#','*','-'))),hook)
 meta=dict(id=bid,zh=zh,title=title,level=LEVELS[int(code[0])-1],genre=genre,tags=['新作',*tags],desc=desc,hook=hook,color=['#71877b','#ab9365','#627d82','#8b7f9f','#a0876a'][int(code[0])-1],cover='./covers/'+bid+'-20261110.webp',chapters=metas,vocabularyRange=code[1],learningReviewRequired=True,readable=True,importNote='完整 25 章英中原稿；已核對正文、配詞 ID 與測驗格式，仍可持續語言與情節校訂。')
 report=dict(id=bid,title=zh,source=fn,sourceSHA256=hashlib.sha256(source.encode()).hexdigest(),chapters=25,questions=50,uniqueTargetIds=501,minEnglishWords=min(c['wordCount'] for c in metas),maxEnglishWords=max(c['wordCount'] for c in metas),missingTargets=issues,repeatedLongSentencePatterns=len(repeated),repeatedSentences=repeated)
 return meta,chapters,report

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--parse-only',action='store_true');args=ap.parse_args();D.mkdir(parents=True,exist_ok=True);(D/'parsed').mkdir(exist_ok=True)
 cat=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'));manifest=json.loads((P/'content-manifest.json').read_text());outputs=[];reports=[]
 for code,info in SELECTION.items():
  meta,cs,report=parse(code,info,cat,manifest);outputs.append((meta,cs));reports.append(report)
  (D/'parsed'/(meta['id']+'.json')).write_text(json.dumps(cs,ensure_ascii=False,indent=2)+'\n')
  (D/'parsed'/(meta['id']+'-metadata.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
 (D/'validation.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps([{k:v for k,v in r.items() if k!='repeatedSentences'} for r in reports],ensure_ascii=False,indent=2))
 if args.parse_only:return
 assert all(not r['missingTargets'] for r in reports),[(r['id'],r['missingTargets']) for r in reports if r['missingTargets']]
 pre=json.loads((R/'app/story-previews.json').read_text());guide=json.loads((R/'app/reading-guide.json').read_text())
 for meta,cs in outputs:
  bid=meta['id'];assert all(b['id']==bid or norm(b['zh'])!=norm(meta['zh']) for b in cat),(bid,'duplicate existing title')
  assert (P/meta['cover']).is_file(),(bid,'cover not installed')
  raw=gzip.compress(json.dumps(cs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);name=bid+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin';(P/'books'/name).write_bytes(raw)
  cat=[b for b in cat if b['id']!=bid]+[meta];manifest['books'][bid]=dict(url='./books/'+name,chapters=25)
  pre[bid]=dict(hook=meta['hook'],intro=meta['desc']);guide['books'][bid]=dict(sample=' '.join(cs[0]['paragraphs'][0]['en'].split()[:65])+'…')
  for c in cs:
   pre.setdefault('chapters',{})[c['id']]=c['paragraphs'][0]['zh'];en=' '.join(p['en'] for p in c['paragraphs']);lengths=[wc(s) for s in re.split(r'[.!?]+\s+',en) if s.strip()];guide['chapters'][c['id']]=dict(meanSentence=round(statistics.mean(lengths),1),maxSentence=max(lengths),lastScene=c['paragraphs'][-1]['zh'])
 (P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n');(P/'content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
 (R/'app/story-previews.json').write_text(json.dumps(pre,ensure_ascii=False,indent=2)+'\n');(R/'app/reading-guide.json').write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':'))+'\n')
 (R/'content-import-batch9.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
 print('Imported nine books. Catalog:',len(cat),'chapters:',sum(len(b['chapters']) for b in cat))

if __name__=='__main__':main()
