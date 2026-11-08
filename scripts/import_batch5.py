"""Import the explicitly selected fifth manuscript batch; preserve unchanged book IDs."""
from pathlib import Path
import re,json,gzip,hashlib
R=Path(__file__).resolve().parents[1];S=R.parent/'upload'
selection={
'1B':('StorySteps_1B_貝殼灣的影子節_全新第4版_完整25章.md','貝殼灣的影子節','The Shadow Festival of Shell Bay','溫暖奇幻','最吵的節日裡，一隻水豚決定為安靜的人留下一束光。'),
'2A':('2A_不會飛的信使替群山點燈_25章全新完整雙語稿.md','不會飛的信使，替群山點燈','The Courier Who Could Not Fly','修行奇幻','她沒有飛行天賦，卻要把風暴的警告送過整片群山。'),
'2B':('2B_不必編造的約會_25章完整雙語稿.md','不必編造的約會','A Date We Did Not Invent','校園戀愛','一張被誤會的合照，讓兩個對手開始練習假約會。'),
'3A':('StorySteps_全新3A_第二聲鐘響前離開白沙灘_完整25章.md','第二聲鐘響前，離開白沙灘','Before the Second Bell','孤島懸疑','荒島只留下三條規則；第二聲鐘響時，你還在白沙灘嗎？'),
'3B':('StorySteps_3B_兩把鑰匙同一座舞台_完整25章.md','兩把鑰匙，同一座舞台','Two Keys, One Stage','慢熱戀愛','舊車站只容得下一個夢想，他們卻都不肯交出鑰匙。'),
'4A':('4A_第九街區不接受單人通關_全25章.md','第九街區，不接受單人通關','Ward Nine: No One Clears Alone','城市副本','五個人進場，五個人簽名；最快的出口，未必讓每個人都能抵達。'),
'4B':('4B_1996晨光照相館的第二張底片_全25章.md','1996，晨光照相館的第二張底片','The Second Negative at Morning Light Studio','年代成長','對街一小時就能沖印，她家的二十六年，還能留下什麼？'),
'5A':('5A_第十三道潮痕_鐘樓不肯說的時間_25章全新完整稿.md','第十三道潮痕：鐘樓不肯說的時間','The Thirteenth Tide Mark: When the Bell Was Wrong','港城懸疑','潮鐘晚響十一分鐘，整座城市的安全地圖可能都是錯的。'),
'5B':('5B_封存試煉_未被允許遺忘的人_25章重新生成完整稿.md','封存試煉：未被允許遺忘的人','The Sealed Ascension Trial: Names That Refused to Fade','雙男主仙俠','二十七人進入試煉後失去姓名，十一年後，一面鏡子留下最後的動作。'),
'6A':('6A_王庭第七份證詞_全新第三部25章雙語小說.md','王庭第七份證詞','The Seventh Statement','王庭懸疑','六名證人指向同一個人，第七份證詞，卻署著死者的名字。'),
'6B':('6B_這次我把自己的名字留在門上_全新25章雙語小說.md','這次，我把自己的名字留在門上','The Name on My Own Door','女性成長戀愛','他刪去她的設計署名，她就離開婚約，為自己重新開一扇門。')}

def clean(x):return re.sub(r'(?m)^---+\s*$', '', re.sub(r'[*`]', '', x)).strip()
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
  quiz=part.split('### 理解測驗',1)[1];quiz=re.sub(r'(?m)^([12])\. \*\*(.+?)\*\*',r'**Q\1. \2**',quiz);questions=[]
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
 bookid=oldid if old['zh']==zh else 'ss-r5-l'+code[0]+'-'+code[1].lower()
 for i,c in enumerate(chapters):c['id']=metas[i]['id']=bookid+'-'+str(i+1)
 intro=parts[0];desc=next((clean(re.sub(r'^.*?(?:故事簡介|簡介)[：:]?', '', line)).lstrip('： ') for line in intro.splitlines() if re.search(r'簡介.*[：:]',line)),None)
 if not desc:desc=next((clean(line) for line in intro.splitlines() if re.match(r'^[\u4e00-\u9fff\d]',line) and len(line)>80),hook)
 raw=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);filename=bookid+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin';outputs.append((R/'public/books'/filename,raw))
 b={**old,'id':bookid,'zh':zh,'title':title,'genre':genre,'tags':[genre,'新作'],'desc':desc,'hook':hook,'chapters':metas,'learningReviewRequired':True,'importNote':'25 章英中原稿已匯入，附詞表與測驗；語言自然度及分級難度仍待編輯複核。'}
 if bookid!=oldid:b.pop('cover',None)
 # Discard old narrative previews so replacements never show retired text.
 pre.pop(oldid,None)
 if 'chapters' in pre:pre['chapters']={k:v for k,v in pre['chapters'].items() if not k.startswith(oldid+'-')}
 cat[cat.index(old)]=b;manifest['books'].pop(oldid);manifest['books'][bookid]={'url':'./books/'+filename,'chapters':25};pre[bookid]={'hook':hook,'intro':desc}
 report.append(dict(code=code,title=zh,action='replace' if bookid!=oldid else 'update',oldId=oldid,id=bookid,source=fn,sha256=hashlib.sha256(s.encode()).hexdigest(),chapters=25,questions=50,minEnglishWords=min(m['wordCount'] for m in metas),nonExactMatches=miss));print(code,bookid,len(chapters),'chapters, missing forms',len(miss))
assert all(not r['nonExactMatches'] for r in report),[(r['code'],r['nonExactMatches']) for r in report if r['nonExactMatches']]
# Do not mutate the live catalog until the entire batch validates.
for path,raw in outputs:path.write_bytes(raw)
(R/'public/catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n');(R/'public/content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n');(R/'app/story-previews.json').write_text(json.dumps(pre,ensure_ascii=False,indent=2)+'\n');(R/'content-import-batch5.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
