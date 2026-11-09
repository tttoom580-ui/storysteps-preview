"""Import six additional independent supplied stories; never replace a different narrative."""
from pathlib import Path
import re,json,gzip,hashlib,statistics
R=Path(__file__).resolve().parents[1];S=R.parent/'upload'
selection={'2B': ('2B_燈熄之後星星仍在_25章完整雙語稿.md', '燈熄之後，星星仍在', 'Stars After the Lights Go Out', '校園戀愛', '兩位成年學生合作守住舊星象館，也在星空下練習尊重彼此的選擇。'), '3B': ('StorySteps_3B_把夜路畫成星圖_完整25章.md', '把夜路畫成星圖', 'The Map We Drew After Dark', '城市成長戀愛', '速寫社與修理社競爭補助，卻一起走進夜班工作者真正需要的城市。'), '4B': ('4B_1995最後一班渡輪的午餐_全25章.md', '1995，最後一班渡輪的午餐', 'Lunch on the Last Ferry', '年代女性創業', '即將撤掉餐食櫃檯的渡輪，承載一群女性重建安心午餐的決心。'), '5B': ('5B_星債未償_我們替夜空記住名字_25章全新第五版.md', '星債未償：我們替夜空記住名字', 'The Constellations We Owed Each Other', '雙男主仙俠', '星盤修復師與前觀星官沿廢棄觀星臺，追尋被售出的誓約與記憶。'), '6B': ('6B_最後一班夜車我要自己決定終點_全新第四部25章雙語小說.md', '最後一班夜車，我要自己決定終點', 'The Last Night Train Is Mine to Choose', '成年職場戀愛', '時刻規劃師評估海岸夜車，也重新安排照顧、感情與自己的未來。')}
levels=['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000','6000–7000']
def clean(s):return re.sub(r'(?m)^---+\s*$','',re.sub(r'[*`]','',s)).strip()
cat=json.loads((R/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'));manifest=json.loads((R/'public/content-manifest.json').read_text());pre=json.loads((R/'app/story-previews.json').read_text());guide=json.loads((R/'app/reading-guide.json').read_text());outputs=[];report=[]
for code,(fn,zh,title,genre,hook) in selection.items():
 bookid='ss-r8-l'+code[0]+'-'+code[1].lower();source=(S/fn).read_text();parts=re.split(r'(?m)^## CHAPTER ',source);assert len(parts)==26,(fn,len(parts))
 samecode=next(b for b in cat if b['id'].startswith(('ss-r5-l','ss-r4-l','ss-r3-l','ss-r2-l')) and re.search(r'l'+code[0]+'-'+code[1].lower()+'$',b['id']))
 oldchs=json.loads(gzip.decompress((R/'public'/manifest['books'][samecode['id']]['url']).read_bytes()));expected=[{w['entryId'] for w in c['words']} for c in oldchs];chapters=[];metas=[];missing=[]
 for i,part in enumerate(parts[1:],1):
  h=part.splitlines()[0].split('｜');assert int(h[0])==i and len(h)>=3,(fn,i,h)
  body=part.split('### 本章新目標詞')[0].split('### 正文與翻譯',1)[1];pairs=re.findall(r'\*\*EN\*\*\s*(.*?)\*\*繁中\*\*\s*(.*?)(?=\*\*EN\*\*|\Z)',body,re.S);assert len(pairs)==body.count('**EN**')==body.count('**繁中**') and pairs
  paras=[{'en':clean(e),'zh':clean(z)} for e,z in pairs];assert all(p['en'] and p['zh'] for p in paras)
  words=[]
  for row in re.findall(r'(?m)^\|\s*`?L\d+-[^\n]+',part):
   v=[clean(x) for x in row.split('|')[1:]];eid,orig,pos,form,meaning=v[:5];words.append(dict(word=form,original=orig,meaning=meaning,entryId=eid,pos=pos,referenceLevel=int(code[0]),source='上傳原稿語境詞表'))
  assert len(words)==(21 if i==25 else 20),(fn,i,'word count',len(words));assert {w['entryId'] for w in words}==expected[i-1],(fn,i,'target IDs differ')
  quiz=part.split('### 理解測驗',1)[1];quiz=re.sub(r'(?m)^([12])\. ([^\n]+)$',r'**\1. \2**',quiz);questions=[]
  for n,q,rest in re.findall(r'\*\*(?:Q)?([12])\.\s*(.*?)\*\*(.*?)(?=\*\*(?:Q)?[12]\.\s|\Z)',quiz,re.S):
   opts=re.findall(r'(?m)^\s*(?:- )?([ABC])\.\s*(.+)',rest);assert [o[0] for o in opts]==list('ABC'),(fn,i,'options')
   a=re.search(r'(?:答案|正解|Answer)\s*[：:]\s*(?:\*\*)?\s*([ABC])[。.．]?\s*(?:\*\*)?([^\n]+)',rest);assert a,(fn,i,'answer');letter,exp=a.groups();exp=clean(exp).lstrip('｜　 ');exp=re.sub(r'^解析[：:]','',exp).strip();questions.append(dict(question=clean(q),options=[clean(o[1]) for o in opts],answer='ABC'.index(letter),explanation=exp))
  assert len(questions)==2 and all(q['explanation'] for q in questions),(fn,i,'questions')
  en=' '.join(p['en'] for p in paras);wc=len(re.findall(r"[A-Za-z]+(?:[’'-][A-Za-z]+)*",en));assert wc>=500,(fn,i,'wc',wc)
  for w in words:
   if not re.search(r'(?<!\w)'+re.escape(w['word'])+r'(?!\w)',en,re.I):missing.append({'chapter':i,'word':w['word']})
  ch=dict(id=f'{bookid}-{i}',title=clean(h[1]),zh=clean(h[2]),paragraphs=paras,words=words,questions=questions);chapters.append(ch);metas.append(dict(id=ch['id'],title=ch['title'],zh=ch['zh'],number=i,available=True,wordCount=wc))
  pre.setdefault('chapters',{})[ch['id']]=paras[0]['zh'];lens=[len(re.findall(r'[A-Za-z]+',s)) for s in re.split(r'[.!?]+\s+',en) if s.strip()];guide['chapters'][ch['id']]={'meanSentence':round(statistics.mean(lens),1),'maxSentence':max(lens),'lastScene':paras[-1]['zh']}
 assert len({w['entryId'] for c in chapters for w in c['words']})==501;assert not missing,(fn,missing)
 intro=parts[0];desc=next((clean(re.sub(r'^.*?(?:故事簡介|簡介)[：:]?','',line)).lstrip('： ') for line in intro.splitlines() if re.search(r'簡介.*[：:]',line)),None)
 if not desc:desc=next((line for line in intro.splitlines() if len(line)>60 and line[0] not in '#*>-'),hook)
 raw=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);filename=f'{bookid}-{hashlib.sha256(raw).hexdigest()[:12]}.bin';outputs.append((R/'public/books'/filename,raw));meta=dict(id=bookid,zh=zh,title=title,level=levels[int(code[0])-1],genre=genre,tags=[genre,'新作'],desc=desc,hook=hook,color='#423d64',chapters=metas,vocabularyRange=code[1],learningReviewRequired=True,importNote='25 章英中原稿已匯入；已核對配詞 ID、正文形式與測驗結構，尚未完成真人逐章校訂。')
 norm=lambda x:re.sub(r'\W','',x.casefold())
 assert all(b['id']==bookid or norm(b['zh'])!=norm(zh) for b in cat),(zh,'duplicate title')
 cat=[b for b in cat if b['id']!=bookid]+[meta];manifest['books'][bookid]={'url':'./books/'+filename,'chapters':25};pre[bookid]={'hook':hook,'intro':desc};guide['books'][bookid]={'sample':' '.join(chapters[0]['paragraphs'][0]['en'].split()[:65])+'…'};report.append(dict(id=bookid,title=zh,source=fn,sourceSha256=hashlib.sha256(source.encode()).hexdigest(),chapters=25,questions=50,uniqueTargetIds=501,minEnglishWords=min(c['wordCount'] for c in metas),maxEnglishWords=max(c['wordCount'] for c in metas)))
for p,raw in outputs:p.write_bytes(raw)
(R/'public/catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n');(R/'public/content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n');(R/'app/story-previews.json').write_text(json.dumps(pre,ensure_ascii=False,indent=2)+'\n');(R/'app/reading-guide.json').write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':')));(R/'content-import-batch8.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
