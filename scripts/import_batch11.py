"""Import eight supplied StorySteps manuscripts, two as in-place revisions.
Automated quality checks are not literary certification.
"""
from pathlib import Path
from collections import defaultdict
import gzip,hashlib,json,re,statistics
R=Path(__file__).resolve().parents[1];P=R/'public';S=R/'incoming/batch11'
cp=P/'catalog.js';mp=P/'content-manifest.json'
cat=json.loads(cp.read_text().split('=',1)[1].rstrip(';\n'));manifest=json.loads(mp.read_text())
pv=R/'app/story-previews.json';previews=json.loads(pv.read_text())
gp=R/'app/reading-guide.json';guide=json.loads(gp.read_text())
sp=R/'app/reading-guide-samples.json';samples=json.loads(sp.read_text())
levels=['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000','6000–7000']
specs={
'1a_green':('ss-r11-l1-a','雨後的綠色箱子','The Green Box After the Rain','校園成長','綠箱子消失後，園藝社透過合作和證據找回大家的花園。'),
'2b_ten':('ss-r11-l2-b','十點之後，還有人在等','Someone Is Still Here After Ten','成年校園戀愛','深夜失物招領的廣播室，留下一封找不到寄件人的藍色信封。'),
'3a_fog':('ss-r9-l3-a','雲線以上，請聽第三聲','Above the Fog, Wait for the Third Signal','高山規則推理','三條山站規則、失聯的觀測員，還有不該回答的無線電聲。'),
'3b_sky':('ss-r11-l3-b','把星空借給每一個人','The Sky We Carry Together','成年慢熱戀愛','移動星空展被迫在免費教育與觀眾個資之間做選擇。'),
'5b_trial':('ss-r5-l5-b','封存試煉：未被允許遺忘的人','The Sealed Ascension Trial: Names That Refused to Fade','雙男主仙俠','封存十一年的登天試煉，留下被抹去的姓名與不肯說謊的鏡子。'),
'5b_cloud':('ss-r11-l5-b','雲獸不肯飛：兩個凡人的春天','The Cloud Herd: A Spring for Two Grounded Cultivators','雙男主仙俠','受傷雲獸不肯再飛，兩個凡人沿著草甸找回遷徙的天空。'),
'6a_ward':('ss-r11-l6-a','王室療養院，不准替病人說謊',"The Queen's Silent Ward",'穿書醫療懸疑','穿成療養院總監的她發現被稱作失語的病人其實想作證。'),
'6b_pool':('ss-r11-l6-b','水道不為誰停留','The Lane I Choose','成年女性成長','前競技泳者回到公共泳池，捍衛無障礙設施與自己的職涯選擇。')}
token=re.compile(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*")
clean=lambda s:re.sub(r'[*'+chr(96)+r']','',re.sub(r'(?m)^---+\s*$','',s)).strip()
def present(text,form):
 text=text.casefold().replace('’',"'");form=form.casefold().replace('’',"'")
 return bool(re.search(r'(?<![a-z])'+re.escape(form)+r'(?![a-z])',text))
def parse_quiz(part,key,i):
 lines=part.split('### 理解測驗',1)[1].splitlines();entries=[];current=None
 for line in lines:
  t=line.strip()
  if t=='---' or t.startswith('## '):break
  mt=(re.match(r'^\*\*(?:Q)?(\d{1,2})\.\s+(.+?)\*\*\s*$',t) or
      re.match(r'^(\d{1,2})\.\s+\*\*(.+?)\*\*\s*$',t) or
      re.match(r'^(\d{1,2})\.\s+([^*].*\?)\s*$',t))
  if mt and ('?' in mt[2] or '？' in mt[2]):
   if current:entries.append(current)
   current={'question':clean(mt[2]),'rest':[]}
  elif current:current['rest'].append(line)
 if current:entries.append(current)
 if len(entries)!=2:raise ValueError((key,i,'question-headings',len(entries)))
 questions=[]
 for row in entries:
  rest='\n'.join(row['rest']);opts=re.findall(r'(?m)^\s*(?:-\s*)?([ABC])[.．]\s*(.+?)\s*$',rest)
  ans=re.search(r'(?:答案|正解|Answer)\s*[：:]\s*([ABC])(?=[。．.\s*]|$)[。．.]?\s*(?:繁中解析|解析)?\s*[：:]?\s*(?:\*\*)?\s*([^\n]*)',rest,re.I)
  if len(opts)!=3 or not ans:raise ValueError((key,i,'question-parse',row['question'],len(opts),rest[:120]))
  exp=clean(ans[2]).strip(' 。')
  if not exp:raise ValueError((key,i,'explanation missing'))
  questions.append({'question':row['question'],'options':[clean(o) for _,o in opts],'answer':'ABC'.index(ans[1]),'explanation':exp})
 return questions
results=[]
for key,(bid,zh,title,genre,hook) in specs.items():
 text=(S/(key+'.md')).read_text(encoding='utf-8-sig')
 parts=re.split(r'(?m)^##\s+CHAPTER\s+',text)
 if len(parts)!=26:raise ValueError((key,'wrong chapter count',len(parts)-1))
 level=int(key[0]);AB=key.split('_')[0][-1].upper()
 existing=next((b for b in cat if b['id']==bid),None)
 if existing and existing['zh']!=zh:raise ValueError((key,'existing title mismatch',existing['zh']))
 cs=[];metas=[];ids=[];seen=defaultdict(set)
 for i,part in enumerate(parts[1:],1):
  cols=part.splitlines()[0].split('｜')
  if len(cols)<3 or int(cols[0])!=i:raise ValueError((key,i,'bad heading'))
  body=part.split('### 正文與翻譯',1)[1].split('### 本章新目標詞',1)[0]
  pairs=re.findall(r'(?m)^\s*\*\*EN\*\*\s*(.*?)^\s*\*\*繁中\*\*\s*(.*?)(?=^\s*\*\*EN\*\*|\Z)',body,re.S|re.M)
  if len(pairs)!=body.count('**EN**') or len(pairs)!=body.count('**繁中**') or not pairs:raise ValueError((key,i,'EN/ZH mismatch'))
  ps=[{'en':clean(en),'zh':clean(tw)} for en,tw in pairs]
  if any(not p['en'] or not p['zh'] for p in ps):raise ValueError((key,i,'empty paragraph'))
  words=[]
  for row in part.split('### 本章新目標詞',1)[1].split('### 理解測驗',1)[0].splitlines():
   if not re.match(r'^\|\s*'+chr(96)+r'?L[1-7]-',row):continue
   cells=[clean(s) for s in row.split('|')[1:-1]]
   if len(cells)<6:raise ValueError((key,i,'glossary cells'))
   eid,orig,pos,form,meaning,evidence=cells[:6]
   words.append({'entryId':eid,'original':orig,'word':form,'pos':pos,'meaning':meaning,'referenceLevel':level,'source':'上傳原稿語境詞表'})
  if len(words)!=(21 if i==25 else 20):raise ValueError((key,i,'word count',len(words)))
  whole=' '.join(p['en'] for p in ps)
  count=len(token.findall(whole))
  if count<500:raise ValueError((key,i,'under 500',count))
  missing=[w['word'] for w in words if not present(whole,w['word'])]
  if missing:raise ValueError((key,i,'missing assigned vocabulary',missing))
  qs=parse_quiz(part,key,i)
  cid=bid+'-'+str(i)
  cs.append({'id':cid,'title':clean(cols[1]),'zh':clean(cols[2]),'paragraphs':ps,'words':words,'questions':qs})
  metas.append({'id':cid,'title':clean(cols[1]),'zh':clean(cols[2]),'number':i,'available':True,'wordCount':count})
  ids.extend(w['entryId'] for w in words)
  previews.setdefault('chapters',{})[cid]=ps[0]['zh'][:160]
  en=whole;lengths=[len(token.findall(x)) for x in re.split(r'(?<=[.!?])\s+',en) if x.strip()]
  guide.setdefault('chapters',{})[cid]={'meanSentence':round(statistics.mean(lengths),1),'maxSentence':max(lengths),'lastScene':ps[-1]['zh'][:100]}
  for p in ps:
   for sentence in re.split(r'(?<=[.!?])\s+',p['en']):
    if len(token.findall(sentence))>=12:seen[' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",sentence.casefold()))].add(i)
 if len(ids)!=501 or len(set(ids))!=501:raise ValueError((key,'duplicate assigned IDs'))
 if existing:
  old=json.loads(gzip.decompress((P/manifest['books'][bid]['url']).read_bytes()))
  for a,b in zip(cs,old):
   if set(w['entryId'] for w in a['words'])!=set(w['entryId'] for w in b['words']):raise ValueError((key,'changed IDs',a['id']))
 data=gzip.compress(json.dumps(cs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
 filename=bid+'-'+hashlib.sha256(data).hexdigest()[:12]+'.bin'
 (P/'books'/filename).write_bytes(data)
 manifest['books'][bid]={'url':'./books/'+filename,'chapters':25}
 if existing:
  existing.update({'title':title,'genre':genre,'hook':hook,'chapters':metas,'tags':['更新稿',genre],'readable':True,'learningReviewRequired':True,'importNote':'新版25章已匯入並通過結構檢查；英中語意與整體情節仍待完整校訂。'})
  b=existing
 else:
  b={'id':bid,'title':title,'zh':zh,'level':levels[level-1],'vocabularyRange':AB,'genre':genre,'tags':['新作',genre],'desc':hook,'hook':hook,'color':'#71628d','chapters':metas,'learningReviewRequired':True,'readable':True,'importNote':'全文25章已上架；字數與詞表測驗通過自動檢查，仍待英中語意終稿校訂。'}
  cat.append(b)
 previews[bid]={'hook':hook,'intro':b['desc']}
 sample=' '.join(cs[0]['paragraphs'][0]['en'].split()[:65])+'…'
 guide.setdefault('books',{})[bid]={'sample':sample}
 samples.setdefault('books',{})[bid]={'sample':sample}
 results.append({'id':bid,'title':zh,'action':'update' if existing else 'new','chapters':25,'pairs':sum(len(c['paragraphs']) for c in cs),'questions':50,'targetEntries':501,'minWords':min(m['wordCount'] for m in metas),'maxWords':max(m['wordCount'] for m in metas),'repeatedLongSentencePatterns':sum(len(v)>1 for v in seen.values()),'resource':'./books/'+filename,'editoriallyCertified':False})
cp.write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n')
mp.write_text(json.dumps(manifest,separators=(',',':'))+'\n')
pv.write_text(json.dumps(previews,ensure_ascii=False,indent=2)+'\n')
gp.write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':')))
sp.write_text(json.dumps(samples,ensure_ascii=False,separators=(',',':')))
(R/'verification/import-batch11.json').write_text(json.dumps({'scope':'Only automated checks, not full linguistic or literary certification','booksBefore':len(cat)-6,'booksAfter':len(cat),'results':results},ensure_ascii=False,indent=2)+'\n')
print('BATCH11_IMPORT',json.dumps({'booksAfter':len(cat),'results':[{'id':x['id'],'action':x['action'],'repeats':x['repeatedLongSentencePatterns']} for x in results]},ensure_ascii=False))
