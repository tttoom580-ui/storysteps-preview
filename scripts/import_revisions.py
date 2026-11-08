"""Import bilingual CHAPTER manuscripts; fail closed on incomplete structures.
Usage: python scripts/import_manuscripts.py ../upload
"""
import gzip, hashlib, json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1])
def clean(s): return re.sub(r'[*`]', '', s).strip()
meta={
'1A':('The Day Our Star Went Missing','校園懸疑','園遊會還沒開始，學校最重要的星星卻消失了。'),
'2A':('The Last Token of Moonpine Gate','奇幻仙俠','六個學徒拿不到銅牌，另一份名冊卻寫著已經發完。'),
'3B':('Hear My Song Before You Say Love','成年戀愛','音樂節響起她寫的歌，海報上卻是另一個人的名字。'),
'4A':('The Unranked Cartographer: A City of Borrowed Warnings','都市高武','最強的人說路是安全的，她的舊地圖卻說那座橋早已封閉。'),
'5A':('The Two Seals of Bellwater','間諜懸疑','一封二十二年前的密信，蓋上了不該存在的第二枚印章。'),
'6A':('The Villainess Who Defended Herself','穿書懸疑','她醒在反派的死刑當天，逮捕令卻比大火更早寫好。')}
filenames={
'1A':'StorySteps_1A_星星不見的那一天_重寫完整25章.md',
'2A':'2A_山門的最後一枚銅牌_25章完整雙語稿.md',
'3B':'StorySteps_3B_這次告白請先聽完我的歌_完整25章.md',
'4A':'4A_零段位情報員_第01至25章.md',
'5A':'5A_驛站密信_兩枚印章之下_25章重新生成完整稿.md',
'6A':'6A_反派的辯護人_25章完整雙語稿 (1).md'}

answers='BA CB AC BA AB CA BC AB BC AB AC BA CA BC AB CA BC AB CA BC AB AC BA CA BC'.split()
explanations=[
['雨蘭親自留下出口狀況的照片，避免只依賴缺少照片與簽名的報告。','考慮新租約前，需要三百份在地連署、合格安全檢查與可行預算。'],
['私人回憶不代表已取得公開放映的同意，因此錄音須依授權分類。','保留收據正本，讓委員會查閱副本，才能追溯財務資料。'],
['修繕前，建築尚不能安全容納觀眾，因此取消室內放映。','梅提醒她把自己的工作時間與合理薪資納入預算。'],
['屋頂修繕超出小型團隊可獨力完成的範圍，不能核發安全證明。','主建築繼續關閉，活動暫時使用安全的庭院。'],
['雨蘭尊重拒絕連署的居民，據實記錄選擇。','風與灰塵會損傷脆弱的膠片，原始影片必須妥善保護。'],
['即使秦不收工錢，材料仍有支出，必須留下收據以記錄真實成本。','顧問指出好意不能代替清楚的價格與成本。'],
['合格工程師受邀檢查戲院的結構與必要修繕。','雨蘭要求同時展示戲院與停車場提案，讓學生自行比較。'],
['標示模型、展示物的狀態與使用權，避免把草案或未授權資料當成定案。','資料庫追蹤問題、證據、缺漏與負責人，讓問題能被處理。'],
['傳單不實宣稱雨蘭承諾封閉兩條道路。','她退還誤以為戲院已開放而繳付的款項，並保留收據。'],
['屋頂雖需昂貴修繕，但不必拆除整棟建築。','三百份連署仍須由在地居民在紙上簽署並查驗，網頁數字無法取代。'],
['調整運料時段，是為了避免妨礙市場開市。','工人發現後牆上方有沉重舊水箱，必須先安全移除。'],
['銀手鐲是以前製作的舞台道具，並非被偷走的貴重珠寶。','家屬不願讓受冤屈的經驗被公開展示，團隊尊重其選擇。'],
['工程師發現磁性門閂有時妨礙側門正常關閉。','男孩指出估算數字抄錯後，她當著訪客修正。'],
['訪談者未同意公開放映，不能直接將訪談拿來展示。','信用合作社建議分階段放款，後續付款依已確認的進度安排。'],
['修補材料需要乾燥、穩定與持續監測，不能為趕進度忽略裂縫。','本章已查驗的連署達到二百六十份。'],
['戲院尚不具備避難所資格，居民被引導到合格的學校避難所。','受保護的支撐結構撐住風暴，但部分外板仍須更換。'],
['募款收入指定用於風災修繕，而不是慶祝活動。','委員會需要研究、安全報告與查驗連署，不能用集會聲量代替。'],
['無障礙坡道可能占用店家需要的人行道與運送空間。','徐承認原本的停車場位置會阻擋重要送貨動線。'],
['查閱早期節目目錄是為了核對戲院創辦者的說法。','對權屬不明的收藏保留紀錄並尋求同意，不能直接公開或出售。'],
['主要修繕符合計畫，但入口仍須改善排水。','三百份已查驗連署只取得申請聽證的資格，並不直接取得租約。'],
['成立董事會讓責任由多人承擔，避免營運只依賴雨蘭。','診所警告腸胃病毒流行後，團隊延後共食活動。'],
['宣傳冊使用照片超出授權範圍，所以撤回並聯繫家屬更正。','初步核可只允許最後階段施工，不能取代最終檢查。'],
['兩個提案取得相同發言機會，讓居民公平比較。','帳目不足以支持指控，不能將未證實說法當成事實。'],
['議會給新成立的非營利董事會有條件營運租約，仍有安全、保險與帳務要求。','獨立的交通提案繼續走正常審查程序。'],
['戲院取得獨立的使用核可後，才能正式讓觀眾入場。','最後的燈不是無限獲利的承諾，而是明天能繼續負責任地開門。']]
catalog_path=ROOT/'public/catalog.js'
catalog=json.loads(catalog_path.read_text().split('=',1)[1].rstrip(';\n'))
manifest=json.loads((ROOT/'public/content-manifest.json').read_text())
previews=json.loads((ROOT/'app/story-previews.json').read_text())
report=[]
for code,(title,genre,hook) in meta.items():
 p=SOURCE/filenames[code]; s=p.read_text(); sections=re.split(r'(?m)^## CHAPTER ',s); intro=sections[0]
 zh=re.sub(r'^\d[A-Z]｜','',intro.splitlines()[0].lstrip('# ').strip('《》'))
 if code=='3B':zh='這次告白，請先聽完我的歌'
 desc=next((clean(re.sub(r'^.*?(?:故事簡介|簡介)[：:]?', '', line)).lstrip('： ') for line in intro.splitlines() if re.search(r'簡介.*[：:]',line)),None)
 if not desc:
  desc=next(line.strip() for line in intro.splitlines() if re.match(r'^[\u4e00-\u9fff\d]',line) and len(line)>80)
 oldid='ss-r2-l'+code[0]+'-'+code[1].lower()
 # New narratives get new chapter IDs; progress from the previous story remains in the backup/history.
 bookid=oldid if code in ['3B','6A'] else 'ss-r3-l'+code[0]+'-'+code[1].lower()
 level=int(code[0]); chapters=[]; metas=[]; missing=[]
 assert len(sections)==26,(code,len(sections))
 for i,section in enumerate(sections[1:],1):
  header=section.splitlines()[0].split('｜'); assert int(header[0])==i
  body=section.split('### 本章新目標詞')[0].split('### 正文與翻譯',1)[1]
  pairs=re.findall(r'\*\*EN\*\*\s*(.*?)\*\*繁中\*\*\s*(.*?)(?=\*\*EN\*\*|\Z)',body,re.S)
  assert len(pairs)==body.count('**EN**')==body.count('**繁中**') and len(pairs)>0,(code,i,'pair')
  paragraphs=[{'en':clean(en),'zh':clean(z)} for en,z in pairs]
  assert all(x['en'] and x['zh'] for x in paragraphs)
  words=[]
  for row in re.findall(r'(?m)^\|\s*`?L\d+-[^\n]+',section):
   cells=[clean(c) for c in row.split('|')[1:]]
   assert len(cells)>=6,(code,i,row)
   eid,original,pos,form,meaning=cells[:5]
   words.append(dict(word=form,original=original,meaning=meaning,entryId=eid,pos=pos,referenceLevel=level,source='原稿語境詞表'))
  assert len(words)==(21 if i==25 else 20),(code,i,'words',len(words))
  quiz=section.split('### 理解測驗',1)[1]
  qb=re.findall(r'\*\*(?:Q)?([12])\.\s*(.*?)\*\*(.*?)(?=\*\*(?:Q)?[12]\.\s|\Z)',quiz,re.S)
  assert len(qb)==2,(code,i,'quiz')
  questions=[]
  for qi,question,rest in qb:
   opts=re.findall(r'(?m)^\s*(?:- )?([ABC])\.\s*(.+)',rest)
   assert [o[0] for o in opts]==list('ABC'),(code,i,qi,'options')
   if code=='4B': answer=answers[i-1][int(qi)-1]; explanation=explanations[i-1][int(qi)-1]
   else:
    am=re.search(r'\*\*(?:答案|正解)：([ABC])[^\n]*?\*\*\s*([^\n]+)',rest)
    assert am,(code,i,qi,'answer');answer,explanation=am.groups()
   questions.append(dict(question=clean(question),options=[clean(o[1]) for o in opts],answer='ABC'.index(answer),explanation=clean(explanation)))
  cid=f'{bookid}-{i}'; en=' '.join(x['en'] for x in paragraphs)
  wc=len(re.findall(r"[A-Za-z]+(?:[’'-][A-Za-z]+)*",en)); assert wc>=500,(code,i,wc)
  for w in words:
   if not re.search(r'(?<!\w)'+re.escape(w['word'])+r'(?!\w)',en,re.I):missing.append({'chapter':i,'entryId':w['entryId'],'form':w['word']})
  chapters.append(dict(id=cid,title=header[1],zh=header[2],paragraphs=paragraphs,words=words,questions=questions))
  metas.append(dict(id=cid,title=header[1],zh=header[2],number=i,available=True,wordCount=wc))
  z=paragraphs[0]['zh']; previews['chapters'][cid]=z[:155]+'…' if len(z)>155 else z
 ids=[w['entryId'] for c in chapters for w in c['words']]; assert len(ids)==len(set(ids))==501
 plan=(SOURCE/f'L{level}_{code[1]}本_25章配詞.md').read_text()
 expected=re.findall(r'L\d+-\d+',plan); assert set(ids)==set(expected),(code,'canonical IDs')
 for i,c in enumerate(chapters,1):
  part=re.split(r'(?m)^## 第\d+章.*$',plan)[i]
  assert set(w['entryId'] for w in c['words'])==set(re.findall(r'L\d+-\d+',part)),(code,i,'plan chapter')
 raw=json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode(); packed=gzip.compress(raw,mtime=0)
 filename=bookid+'-'+hashlib.sha256(packed).hexdigest()[:12]+'.bin'; (ROOT/'public/books'/filename).write_bytes(packed)
 catalog=[x for x in catalog if x['id'] not in [oldid,bookid]]
 if oldid!=bookid: manifest['books'].pop(oldid,None)
 catalog.append(dict(id=bookid,title=title,zh=zh,level='1000以下' if level==1 else f'{(level-1)*1000}–{level*1000}',vocabularyRange=code[1],genre=genre,tags=[genre,'新作'],desc=desc,hook=hook,color=['#655784','#64826c','#55738a','#917147','#59677a','#71628d'][level-1],chapters=metas,learningReviewRequired=True,importNote='25 章英中原稿已匯入，附詞表與測驗；語言自然度及分級難度仍待編輯複核。'))
 manifest['books'][bookid]={'url':'./books/'+filename,'chapters':25}
 previews[bookid]={'hook':hook,'intro':desc}
 report.append(dict(code=code,id=bookid,title=zh,source=p.name,sourceSHA256=hashlib.sha256(s.encode()).hexdigest(),chapters=25,paragraphPairs=sum(len(c['paragraphs']) for c in chapters),questions=50,targetEntries=len(ids),minEnglishWords=min(c['wordCount'] for c in metas),maxEnglishWords=max(c['wordCount'] for c in metas),nonExactSurfaceMatches=missing,quizRepairs=50 if code=='4B' else 0))
 print(code,zh,len(chapters),'chapters',sum(len(c['paragraphs']) for c in chapters),'pairs','nonexact forms',len(missing))
catalog_path.write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'public/content-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'app/story-previews.json').write_text(json.dumps(previews,ensure_ascii=False,indent=2)+'\n')
(ROOT/'content-import-20261108-revisions.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

