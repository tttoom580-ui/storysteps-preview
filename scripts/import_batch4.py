"""Import the explicitly selected fourth manuscript batch; preserve unchanged book IDs."""
from pathlib import Path
import re,json,gzip,hashlib
R=Path(__file__).resolve().parents[1];S=R.parent/'upload'
selection={
'1A':('StorySteps_1A_鈴聲過後的每一封信_全新第3版25章.md','鈴聲過後的每一封信','Every Letter After the Bell','溫暖成長','她的第一天郵務工作，從一封找不到地址的紅信開始。'),
'1B':('StorySteps_1B_河流兩岸的紅繩_重寫完整25章.md','河流兩岸的紅繩','The Red Rope Across the River','溫暖奇幻','雨季來臨前，她在橋上看見一道不能忽略的裂縫。'),
'2A':('2A_鐘聲之外還有一行字_25章全新雙語稿.md','鐘聲之外，還有一行字','The Line Beyond the Bell','山城懸疑','警鐘不該響第二次，手冊上卻多出一行被忽略的字。'),
'2B':('2B_凌晨四點咖啡還是熱的_25章完整雙語稿.md','凌晨四點，咖啡還是熱的','Coffee at Four in the Morning','職場戀愛','她帶著行李來上夜班，四點的燈卻照亮了另一種人生。'),
'3B':('StorySteps_3B_被改掉的那句話_完整25章.md','被改掉的那句話','The Lines They Tried to Erase','劇團戀愛','排練開始時，母親角色的每一句台詞都消失了。'),
'4B':('4B_1997青禾市場的第二張招牌_第01至25章 (1).md','1997，青禾市場的第二張招牌','The Second Sign of Qinghe Market','年代成長','九十天後市場就要拆了，她還想再掛起第二張招牌。'),
'5A':('5A_明燈基金_第三輛車的帳_25章重新生成完整稿.md','明燈基金：第三輛車的帳','The Ledger of the Missing Bus','都市懸疑','帳上付了三輛車的錢，熱浪裡卻只有兩輛車抵達。'),
'5B':('5B_山海邊境_失蹤者仍在等待_25章重新生成完整稿.md','山海邊境，失蹤者仍在等待','Beyond the Tide Gate: The Vanished Survey','雙男主仙俠','七個人失蹤後，只有一枚時間不對的羅盤回到岸上。'),
'6A':('6A_反派的辯護人_25章完整雙語稿 (1)(1).md','反派的辯護人，決定先替自己翻案','The Villainess Who Defended Herself','穿書懸疑','她醒在反派的死刑當天，逮捕令卻比大火更早寫好。'),
'6B':('6B_退房之前請把真話說完_25章完整雙語稿(1).md','退房之前，請把真話說完','Before Checkout, Tell Me the Truth','慢熱戀愛','旅館即將被賣掉，那個欠她一句真話的人卻回來了。')}
def clean(x):return re.sub(r'[*`]', '', x).strip()
def canon(ch):return [{k:v for k,v in c.items() if k!='id'} for c in ch]
cat=json.loads((R/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'));manifest=json.loads((R/'public/content-manifest.json').read_text());pre=json.loads((R/'app/story-previews.json').read_text());report=[];outputs=[]
for code,(fn,zh,title,genre,hook) in selection.items():
 p=S/fn;s=p.read_text();parts=re.split(r'(?m)^## CHAPTER ',s);assert len(parts)==26,(code,len(parts))
 old=next(b for b in cat if re.match(r'ss-r\d+-l'+code[0]+'-'+code[1].lower()+'$',b['id']));oldid=old['id'];oldch=json.loads(gzip.decompress((R/'public'/manifest['books'][oldid]['url']).read_bytes()))
 chapters=[];metas=[];miss=[]
 for i,part in enumerate(parts[1:],1):
  h=part.splitlines()[0].split('｜');assert int(h[0])==i
  body=part.split('### 本章新目標詞')[0].split('### 正文與翻譯',1)[1]
  pairs=re.findall(r'\*\*EN\*\*\s*(.*?)\*\*繁中\*\*\s*(.*?)(?=\*\*EN\*\*|\Z)',body,re.S);assert len(pairs)==body.count('**EN**')==body.count('**繁中**') and pairs,(code,i,'pairs')
  paragraphs=[{'en':clean(e),'zh':clean(z)} for e,z in pairs];assert all(p['en'] and p['zh'] for p in paragraphs)
  words=[]
  for row in re.findall(r'(?m)^\|\s*`?L\d+-[^\n]+',part):
   v=[clean(x) for x in row.split('|')[1:]];assert len(v)>=6
   eid,orig,pos,form,meaning=v[:5];words.append(dict(word=form,original=orig,meaning=meaning,entryId=eid,pos=pos,referenceLevel=int(code[0]),source='原稿語境詞表'))
  assert len(words)==(21 if i==25 else 20),(code,i,'words',len(words))
  quiz=part.split('### 理解測驗',1)[1];questions=[]
  for n,q,rest in re.findall(r'\*\*(?:Q)?([12])\.\s*(.*?)\*\*(.*?)(?=\*\*(?:Q)?[12]\.\s|\Z)',quiz,re.S):
   opts=re.findall(r'(?m)^\s*(?:- )?([ABC])\.\s*(.+)',rest);assert [o[0] for o in opts]==list('ABC'),(code,i,'options')
   answer=re.search(r'\*\*(?:答案|正解)：([ABC])[^\n]*?\*\*\s*([^\n]+)',rest);assert answer,(code,i,'answer')
   a,exp=answer.groups();questions.append(dict(question=clean(q),options=[clean(o[1]) for o in opts],answer='ABC'.index(a),explanation=clean(exp)))
  assert len(questions)==2,(code,i,'quiz')
  en=' '.join(p['en'] for p in paragraphs);wc=len(re.findall(r"[A-Za-z]+(?:[’'-][A-Za-z]+)*",en));assert wc>=500,(code,i,wc)
  for w in words:
   if not re.search(r'(?<!\w)'+re.escape(w['word'])+r'(?!\w)',en,re.I):miss.append({'chapter':i,'word':w['word']})
  chapters.append(dict(id=oldid+'-'+str(i),title=h[1],zh=h[2],paragraphs=paragraphs,words=words,questions=questions));metas.append(dict(id=oldid+'-'+str(i),title=h[1],zh=h[2],number=i,available=True,wordCount=wc))
 ids=[w['entryId'] for c in chapters for w in c['words']];assert len(ids)==len(set(ids))==501
 plan=re.split(r'(?m)^## 第\d+章.*$',(S/f'L{code[0]}_{code[1]}本_25章配詞.md').read_text())[1:]
 assert len(plan)==25
 for i,c in enumerate(chapters):assert set(w['entryId'] for w in c['words'])==set(re.findall(r'L\d+-\d+',plan[i])),(code,i,'plan')
 same=canon(chapters)==canon(oldch)
 if same:
  report.append(dict(code=code,title=zh,action='unchanged',id=oldid,source=fn,sha256=hashlib.sha256(s.encode()).hexdigest(),chapters=25,questions=50,nonExactMatches=miss));print(code,'unchanged');continue
 bookid=oldid if old['zh']==zh else 'ss-r4-l'+code[0]+'-'+code[1].lower()
 for i,c in enumerate(chapters):c['id']=metas[i]['id']=bookid+'-'+str(i+1)
 intro=parts[0];desc=next((clean(re.sub(r'^.*?(?:故事簡介|簡介)[：:]?', '', line)).lstrip('： ') for line in intro.splitlines() if re.search(r'簡介.*[：:]',line)),None)
 if not desc:desc=next(line.strip() for line in intro.splitlines() if re.match(r'^[\u4e00-\u9fff\d]',line) and len(line)>80)
 raw=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);filename=bookid+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin';outputs.append((R/'public/books'/filename,raw))
 b={**old,'id':bookid,'zh':zh,'title':title,'genre':genre,'tags':[genre,'新作'],'desc':desc,'hook':hook,'chapters':metas,'learningReviewRequired':True,'importNote':'25 章英中原稿已匯入，附詞表與測驗；語言自然度及分級難度仍待編輯複核。'}
 if bookid!=oldid:b.pop('cover',None)
 cat[cat.index(old)]=b;manifest['books'].pop(oldid);manifest['books'][bookid]={'url':'./books/'+filename,'chapters':25};pre[bookid]={'hook':hook,'intro':desc}
 report.append(dict(code=code,title=zh,action='replace' if bookid!=oldid else 'update',oldId=oldid,id=bookid,source=fn,sha256=hashlib.sha256(s.encode()).hexdigest(),chapters=25,questions=50,minEnglishWords=min(m['wordCount'] for m in metas),nonExactMatches=miss));print(code,bookid,len(chapters),'chapters, missing forms',len(miss))
# Do not mutate the live catalog until the entire batch validates.
for path,raw in outputs:path.write_bytes(raw)
(R/'public/catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n');(R/'public/content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n');(R/'app/story-previews.json').write_text(json.dumps(pre,ensure_ascii=False,indent=2)+'\n');(R/'content-import-batch4.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
