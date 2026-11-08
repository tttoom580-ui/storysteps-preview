from pathlib import Path
import json,gzip,re,hashlib,csv,statistics
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'));manifest=json.loads((root/'public/content-manifest.json').read_text());previews=json.loads((root/'app/story-previews.json').read_text())
changes={
'ss-r2-l1-a':{
0:('The bell above the shop door rang at seven a.m. Rina was early. The sun lit the fruit by the window. She put down a fresh cake. Mr. Park was waiting on the old couch, a bag held against his chest. "There is money missing," he said. Rina looked at the food she had made. Yesterday, she had counted every sale before she went home. "How much?" she asked. He did not answer at once. Outside, the street was still quiet. Soon people would come to Morning Corner for breakfast. Rina had always liked that part of the day. Today she wished the bell would stop. She opened her small book and waited for him to speak.', '早上七點，店門上的鈴響了。莉娜提早到了。陽光照著窗旁的水果，她放下剛做好的蛋糕。老闆朴先生坐在舊沙發上，胸前抱著一個袋子。「錢少了，」他說。莉娜望著自己做好的食物。昨天回家前，她明明數過每筆收入。「少了多少？」她問。他沒有立刻回答。外面的街道還很安靜，再過不久，客人就會來晨光角落吃早餐。她一向喜歡這個時刻，今天卻希望門鈴別再響了。她翻開小冊子，等他開口。'),
5:('That afternoon, Ben found Rina alone by the back door. "You can go home," he said. "I can finish here." She shook her head. If she left now, would Mark tell everyone she was afraid to stay? But staying quiet felt wrong too. "I like this shop," she said. "I do not like feeling small in it." Ben sat beside her. He did not tell her to be brave. He just waited. At last she opened her book. She would not change a number because someone spoke loudly. She would check it. That was one thing she could do before the door closed.', '那天下午，班在後門旁發現獨自坐著的莉娜。「妳可以回家，」他說，「剩下的我來。」她搖頭。如果現在走，馬克會不會說她心虛？可是一直不出聲，她也受不了。「我喜歡這間店，」她說，「但我不喜歡在這裡覺得自己什麼都不是。」班坐到她旁邊，沒叫她勇敢，只安靜等著。最後，她翻開小冊子。她不會因為有人說話大聲，就改掉一個數字。她會查清楚。至少在關門前，這件事她做得到。')},
'ss-r2-l2-b':{
0:('Lin Xia saw her new partner before he saw her. Ethan Chen was sitting in the campus café, discussing the temperature of his coffee as if it were a national problem. A short beard made him look older than twenty-three. On his coat was a bright watermelon pin. Xia almost laughed. Then she remembered him rejecting her plan last month. She was twenty-two, in her final year, and the student radio room was about to close. She needed a new show to save it. She did not need his calm personality telling her why she would fail. "Wrong table?" he asked when she stopped. "I hope so," she said.', '林夏先看見了她的新搭檔，對方還沒注意到她。陳以森坐在校園咖啡館裡，討論咖啡的溫度，認真得像在處理國家大事。短鬍子讓他看起來比二十三歲成熟，外套上卻別著一枚鮮豔的西瓜徽章。夏差點笑出來，隨即想起上個月他否決她提案的樣子。她二十二歲，即將畢業，學生廣播室卻要關了。她需要一個新節目挽救它，不需要他那冷靜的個性再告訴她一次，為什麼她會失敗。「找錯桌了？」她停下時，他問。「希望是，」她說。'),
4:('At the garden gate, Mr. Gao stopped them. "Please show the plants too," he said. "Not just my worried face." Xia lowered the camera. She had been planning to use his face for the opening shot. "All right," she said, and wrote down his request. Ethan moved closer to photograph the yellow leaf, keeping the nearby homes out of the picture. "We should ask for the soil test," he said. Xia waited for a speech about her mistakes. None came. "I thought you were going to tell me how to do my job." He looked up. "You already heard him." For once, she had no quick reply.', '到了花園門口，高先生叫住他們。「也請拍植物，」他說，「不要只拍我擔心的臉。」夏放下攝影機。她剛才確實想用他的表情當開場。「好，」她說，把要求記下來。以森靠近拍那片黃葉，避開附近住家的畫面。「我們應該問問土壤檢測結果，」他說。夏等著他指教自己哪裡做錯了，他卻沒再說下去。「我以為你又要教我怎麼工作。」「妳已經聽見他的話了。」他抬頭說。這一次，她竟想不出立刻回嘴的話。')},
'ss-r2-l3-a':{
2:('Mira pulled open the first drawer. A label said it was acceptable to ask for help. Under it lay a coconut, a broken stool, and a child\'s drawing. "Lost property," Hale said. But the objects were wet. Water began to drip onto Mira\'s shoes, although the ceiling was dry. She touched the drawing and heard a cruel voice mock a child. Another voice whispered about envy. Mira lifted her hand. The voices stopped. She wanted to explore the drawer, but she would not gamble with June\'s last letter. She put it safely inside her coat. A second drawer smelled of hay and tobacco. A card showed twin brothers outside a barn. Laundry hung behind them. One brother had written a sincere account of a storm. The other had crossed out a sentence. Mira tried to connect the crossed-out words to the drawing. Then she heard a whistle. It came from neither brother. Hale took one glance at her and reached for the drawer. "I advise you to leave those alone." Mira held it open with her foot. On the next card, a father rested his chin on his hands beside a bottle. Someone had changed the dose written on its label. An ordinary mistake could cause extreme harm. These were not just stories. Someone had changed them, and people outside these walls might still be living with the results. Mira noted the card numbers. When she looked back at the first drawer, the coconut had split. Inside was a thin red thread.', '米拉拉開第一個抽屜。標籤寫著：尋求幫助是可以接受的。下面放著椰子、壞板凳和一張孩子的畫。「失物，」黑爾說。但物品都是濕的。天花板明明乾燥，水卻開始滴到米拉的鞋上。她碰了一下畫，便聽見殘酷的聲音嘲笑一個孩子，另一個聲音低聲說著嫉妒。她一縮手，聲音就停了。她想探索抽屜，卻不願拿妹妹最後的信冒險，於是先把信收進外套。第二個抽屜有乾草與菸草的氣味。卡片上是一對站在穀倉外的雙胞胎，身後晾著洗好的衣物。一人誠懇地記下風暴經過，另一人劃掉了一句話。米拉試著把劃掉的字與畫連起來，忽然聽見口哨。那不是任何一個兄弟吹的。黑爾瞥了她一眼，伸手要關抽屜。「我勸妳別碰。」米拉用腳抵住。下一張卡上，父親用手托著下巴，旁邊放著藥瓶，有人改了標籤上的劑量。一個平常的錯誤，也可能造成極大的傷害。這些不只是故事。有人改寫了它們，而牆外的人也許還在承受後果。米拉記下卡片編號，再回頭時，第一個抽屜裡的椰子已經裂了，裡面露出一條細紅線。')}
}
for b in catalog:
 path=root/'public'/manifest['books'][b['id']]['url'];chs=json.loads(gzip.decompress(path.read_bytes()))
 if b['id'] in changes:
  for index,(en,zh) in changes[b['id']].items():chs[0]['paragraphs'][index]={'en':en,'zh':zh}
  for w in chs[0]['words']:
   assert re.search(r'(?<!\w)'+re.escape(w['word'])+r'(?!\w)',' '.join(p['en'] for p in chs[0]['paragraphs']),re.I),(b['id'],w['word'])
  b['chapters'][0]['wordCount']=len(re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*",' '.join(p['en'] for p in chs[0]['paragraphs'])))
  b['importNote']='首章已做開場與敘事修訂；全書配詞與難度已機器檢查，其餘章節仍待逐段精修。'
  raw=gzip.compress(json.dumps(chs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);name=b['id']+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin';(root/'public/books'/name).write_bytes(raw);manifest['books'][b['id']]['url']='./books/'+name
  previews['chapters'][chs[0]['id']]=chs[0]['paragraphs'][0]['zh']
 if b['id']=='ss-r2-l1-a': b['desc']='錢又少了，新經理把目光轉向莉娜。老闆沉默，朋友想替她出頭，她卻只問了一句：「可以讓我看數字嗎？」為了留在喜歡的小店，她開始記下每筆交易。直到一段河邊影片，拍到了不該出現的車。'
 if b['id']=='ss-r2-l2-b': b['desc']='林夏想保住即將關閉的廣播室，卻被分到最討厭的搭檔：上個月親手否決她提案的陳以森。她靠直覺，他每句話都要追問。鏡頭一開，兩人連沉默都合不來——偏偏想贏這場比賽，他們只能站在一起。'
 if b['id']=='ss-r2-l3-a': b['desc']='妹妹留下最後一封信後失蹤了。米拉循線走進沒有指針的圖書館，發現妹妹的名字還在登記簿上，簽名卻有一筆不對。管理員微笑著說，可以替她回答。可門口第一條規則明明寫著：不能替別人作答。'
 if b['id'] in changes:previews[b['id']]={'hook':b['hook'],'intro':b['desc']}
(root/'public/catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n');(root/'public/content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
# Transparent screening: exact forms, without pretending to be a CEFR/word-frequency test.
words={}
for row in csv.DictReader((root.parent/'upload/全部詞彙_級別書本章節對照.csv').open(encoding='utf-8-sig')):
 for w in re.findall(r'[a-z]+',row['原表詞條'].lower()):words[w]=min(int(row['原表級別']),words.get(w,99))
guide={'books':{},'chapters':{}};audit=[]
for b in catalog:
 chs=json.loads(gzip.decompress((root/'public'/manifest['books'][b['id']]['url']).read_bytes()));lv=['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000','6000–7000'].index(b['level'])+1
 guide['books'][b['id']]={'sample':' '.join(chs[0]['paragraphs'][0]['en'].split()[:65])+'…'}
 for c in chs:
  en=' '.join(p['en'] for p in c['paragraphs']);tokens=re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*",en);sent=re.split(r'[.!?]+(?:["”])?\s+',en);lens=[len(re.findall(r'[A-Za-z]+',x)) for x in sent if x.strip()]
  end=c['paragraphs'][-1]['zh'];scene=''.join(re.findall(r'.*?[。！？](?:[」”])?|.+$',end)[:2]);guide['chapters'][c['id']]={'meanSentence':round(statistics.mean(lens),1),'maxSentence':max(lens),'lastScene':scene}
  preview=''.join(re.findall(r'.*?[。！？](?:[」”])?|.+$',c['paragraphs'][0]['zh'])[:3]);previews['chapters'][c['id']]=preview
  if b['id'] in changes:
   above=sorted(set(w.lower() for w in tokens if words.get(w.lower(),0)>lv));unknown=sorted(set(w.lower() for w in tokens if w.lower() not in words));audit.append({'chapter':c['id'],'wordCount':len(tokens),'averageSentenceWords':round(statistics.mean(lens),1),'longestSentenceWords':max(lens),'aboveAssignedLevelExactForms':above,'unmatchedExactFormsIncludingNamesAndInflections':unknown,'abstractPlotReview':'需人工評估推理、制度與人物關係負擔','revised':c['id'].endswith('-1')})
(root/'app/reading-guide.json').write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':')))
(root/'app/story-previews.json').write_text(json.dumps(previews,ensure_ascii=False,indent=2)+'\n')
(root/'editorial-audit.json').write_text(json.dumps({'scope':'Three books / 75 chapters screened; three first chapters revised. Exact surface matching is not a standardized proficiency assessment.','chapters':audit},ensure_ascii=False,indent=2))
print('Screened',len(audit),'chapters; revised three openings; generated guides for',len(guide['chapters']))
