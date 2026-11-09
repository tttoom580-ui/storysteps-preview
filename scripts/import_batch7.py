"""Import six additional independent supplied stories; never replace a different narrative."""
from pathlib import Path
import re,json,gzip,hashlib,statistics
R=Path(__file__).resolve().parents[1];S=R.parent/'upload'
selection={
'1B':('StorySteps_1B_雪谷的七種聲音_全新第5版_完整25章.md','雪谷的七種聲音','Seven Sounds of Cloudpine Valley','自然冒險','鳥鳴消失的雪谷裡，三位山地夥伴沿著七種聲音迎接春天。'),
'2A':('2A_沒有火種的修窯師_25章完整雙語稿.md','沒有火種的修窯師','The Kiln Keeper Without a Flame Seed','工藝修行','她沒有火種，卻要用一雙會修繕的手守住整個山谷的苗圃。'),
'3A':('StorySteps_3A_零號月台的三條規則_完整25章.md','零號月台的三條規則','The Three Rules of Platform Zero','車站懸疑','沒有車次的列車、錯動的牆鐘與紅色門後的失蹤技師，三條規則究竟保護誰？'),
'4A':('4A_失物檔案館_城市遺忘的那一天_全25章.md','失物檔案館：城市遺忘的那一天','The Archive of Things Not Lost','都市遊戲懸疑','午夜的清冊開始申領失物，她必須證明一座城市仍有人記得。'),
'5A':('5A_紅色母帶_誰有權借走她的聲音_25章全新第五版.md','紅色母帶：誰有權借走她的聲音','The Red Reel: The Voice No One Could Own','劇團懸疑','開場曲裡完美的聲音不屬於說書人，一卷紅色母帶藏著她被借走的選擇。'),
'6A':('6A_最後一幕不准有人犧牲_全新第四部25章雙語小說.md','最後一幕，不准有人犧牲','No One Dies for the Final Act','穿書劇場懸疑','她穿成注定因舞台事故被處死的監督，決定先讓每一個人安全謝幕。')}
levels=['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000','6000–7000']
def clean(s):return re.sub(r'(?m)^---+\s*$','',re.sub(r'[*`]','',s)).strip()
cat=json.loads((R/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'));manifest=json.loads((R/'public/content-manifest.json').read_text());pre=json.loads((R/'app/story-previews.json').read_text());guide=json.loads((R/'app/reading-guide.json').read_text());outputs=[];report=[]
for code,(fn,zh,title,genre,hook) in selection.items():
 bookid='ss-r7-l'+code[0]+'-'+code[1].lower();source=(S/fn).read_text();parts=re.split(r'(?m)^## CHAPTER ',source);assert len(parts)==26,(fn,len(parts))
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
  quiz=part.split('### 理解測驗',1)[1];questions=[]
  for n,q,rest in re.findall(r'\*\*(?:Q)?([12])\.\s*(.*?)\*\*(.*?)(?=\*\*(?:Q)?[12]\.\s|\Z)',quiz,re.S):
   opts=re.findall(r'(?m)^\s*(?:- )?([ABC])\.\s*(.+)',rest);assert [o[0] for o in opts]==list('ABC'),(fn,i,'options')
   a=re.search(r'\*\*(?:答案|正解|Answer)\s*[：:]\s*([ABC])[^\n]*?\*\*\s*([^\n]+)',rest);assert a,(fn,i,'answer');letter,exp=a.groups();exp=clean(exp).lstrip('｜　 ');exp=re.sub(r'^解析[：:]','',exp).strip();questions.append(dict(question=clean(q),options=[clean(o[1]) for o in opts],answer='ABC'.index(letter),explanation=exp))
  assert len(questions)==2 and all(q['explanation'] for q in questions),(fn,i,'questions')
  en=' '.join(p['en'] for p in paras);wc=len(re.findall(r"[A-Za-z]+(?:[’'-][A-Za-z]+)*",en));assert wc>=500,(fn,i,'wc',wc)
  for w in words:
   if not re.search(r'(?<!\w)'+re.escape(w['word'])+r'(?!\w)',en,re.I):missing.append({'chapter':i,'word':w['word']})
  ch=dict(id=f'{bookid}-{i}',title=clean(h[1]),zh=clean(h[2]),paragraphs=paras,words=words,questions=questions);chapters.append(ch);metas.append(dict(id=ch['id'],title=ch['title'],zh=ch['zh'],number=i,available=True,wordCount=wc))
  pre.setdefault('chapters',{})[ch['id']]=paras[0]['zh'];lens=[len(re.findall(r'[A-Za-z]+',s)) for s in re.split(r'[.!?]+\s+',en) if s.strip()];guide['chapters'][ch['id']]={'meanSentence':round(statistics.mean(lens),1),'maxSentence':max(lens),'lastScene':paras[-1]['zh']}
 assert len({w['entryId'] for c in chapters for w in c['words']})==501;assert not missing,(fn,missing)
 intro=parts[0];desc=next((clean(re.sub(r'^.*?(?:故事簡介|簡介)[：:]?','',line)).lstrip('： ') for line in intro.splitlines() if re.search(r'簡介.*[：:]',line)),None)
 if not desc:desc=next(line for line in intro.splitlines() if len(line)>100 and line[0] not in '#*>-')
 raw=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);filename=f'{bookid}-{hashlib.sha256(raw).hexdigest()[:12]}.bin';outputs.append((R/'public/books'/filename,raw));meta=dict(id=bookid,zh=zh,title=title,level=levels[int(code[0])-1],genre=genre,tags=[genre,'新作'],desc=desc,hook=hook,color='#423d64',chapters=metas,vocabularyRange=code[1],learningReviewRequired=True,importNote='25 章英中原稿已匯入；已核對配詞 ID、正文形式與測驗結構，尚未完成真人逐章校訂。')
 norm=lambda x:re.sub(r'\W','',x.casefold())
 assert all(b['id']==bookid or norm(b['zh'])!=norm(zh) for b in cat),(zh,'duplicate title')
 cat=[b for b in cat if b['id']!=bookid]+[meta];manifest['books'][bookid]={'url':'./books/'+filename,'chapters':25};pre[bookid]={'hook':hook,'intro':desc};guide['books'][bookid]={'sample':' '.join(chapters[0]['paragraphs'][0]['en'].split()[:65])+'…'};report.append(dict(id=bookid,title=zh,source=fn,sourceSha256=hashlib.sha256(source.encode()).hexdigest(),chapters=25,questions=50,uniqueTargetIds=501,minEnglishWords=min(c['wordCount'] for c in metas),maxEnglishWords=max(c['wordCount'] for c in metas)))
for p,raw in outputs:p.write_bytes(raw)
(R/'public/catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n');(R/'public/content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n');(R/'app/story-previews.json').write_text(json.dumps(pre,ensure_ascii=False,indent=2)+'\n');(R/'app/reading-guide.json').write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':')));(R/'content-import-batch7.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
