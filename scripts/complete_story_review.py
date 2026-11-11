"""Apply evidence-backed repairs and audit every currently published manuscript.

Does not equate structural checks or an ending inspection with a full literary edit.
Authored additions are kept separately so the patch and its provenance are reviewable.
"""
from pathlib import Path
from collections import Counter, defaultdict
import gzip, hashlib, json, re, sys

R = Path(__file__).resolve().parents[1]
P = R / 'public'
DATA = json.loads((R / 'verification/story-review-20261109-repairs.json').read_text())
manifest = json.loads((P / 'content-manifest.json').read_text())
log_path=R/'verification/story-review-20261109-changes.json'
if log_path.exists() and json.loads(log_path.read_text()).get('manifestHash')==hashlib.sha256((P/'content-manifest.json').read_bytes()).hexdigest():
    print('Authored repairs already applied to this manifest; run audit_story_release.py to recheck.')
    sys.exit(0)
catalog = json.loads((P / 'catalog.js').read_text().split('=', 1)[1].rstrip(';\n'))
books = {b['id']: json.loads(gzip.decompress((P / manifest['books'][b['id']]['url']).read_bytes())) for b in catalog}
before = {bid: json.dumps(cs, ensure_ascii=False, separators=(',', ':')) for bid, cs in books.items()}
meanings = defaultdict(Counter)
for cs in books.values():
    for c in cs:
        for w in c['words']:
            if w.get('meaning', '').strip():
                meanings[w['word'].casefold()][w['meaning']] += 1

def has(text, word):
    return bool(re.search(r'(?<![a-z])' + re.escape(word.casefold()) + r'(?![a-z])', text.casefold()))

changes = []
for bid, cs in books.items():
    for c in cs:
        cid = c['id']
        if cid in DATA['extraQuestions'] and len(c['questions']) < 2:
            question, options, answer, explanation = DATA['extraQuestions'][cid]
            c['questions'].append(dict(question=question, options=options, answer=answer, explanation=explanation))
            changes.append(dict(chapter=cid, kind='authored_second_question'))
        if cid in DATA['targetPassages']:
            pi, en, zh = DATA['targetPassages'][cid]
            if en not in ' '.join(p['en'] for p in c['paragraphs']):
                c['paragraphs'][pi]['en'] += ' ' + en
                c['paragraphs'][pi]['zh'] += zh
                changes.append(dict(chapter=cid, kind='restore_missing_targets', paragraph=pi+1))
        for w in c['words']:
            if not w.get('meaning', '').strip():
                key = w['word'].casefold()
                w['meaning'] = DATA['missingMeanings'].get(key) or DATA['contextMeanings'].get(key) or meanings[key].most_common(1)[0][0]
                changes.append(dict(chapter=cid, kind='fill_meaning', word=w['word']))
        if bid == 'import-seventh-light':
            for w in c['words']:
                if w['word'].casefold() in DATA['contextMeanings']:
                    w['meaning'] = DATA['contextMeanings'][w['word'].casefold()]

# Names introduced in the English text stay consistent throughout this translation.
name_replacements = {
    '莉亞': '黎雅', '莉雅': '黎雅', '托馬斯': '托瑪斯', '尼科': '尼可',
    '岡田花': '哈娜・奧卡福', '花是知名': '哈娜是知名', '花借來': '哈娜借來',
    '花做了': '哈娜做了', '花教授': '哈娜教授', '和花、': '和哈娜、', '米拉與花': '米拉與哈娜',
}
for c in books['import-seventh-light']:
    for p in c['paragraphs']:
        for a, b in name_replacements.items():
            p['zh'] = p['zh'].replace(a, b)
    for q in c['questions']:
        for a, b in name_replacements.items():
            q['explanation'] = q['explanation'].replace(a, b)

# Restore the order inside two paragraphs as well as between the scenes.
c=books['import-seventh-light'][5]
p=c['paragraphs'][4]
lead,discovery=p['en'].split(' At the bottom they found',1)
lead=lead.replace('but he climbed anyway.', 'but he waited on the landing for the shaft to be checked.')
p['en']=lead
zhlead,zhdiscovery=p['zh'].split('在底部',1) if '在底部' in p['zh'] else (p['zh'],'')
p['zh']='當晚，托瑪斯沿著藍色痕跡追到倉庫火爐後的一道裂縫。狹窄豎井一路通往海邊，冷風自下往上灌，底部傳來像機器呼吸的低沉聲響。平常話多的尼可看見梯子搖晃，變得膽怯；這次他留在平台上，等候檢查。'
c['paragraphs'][3]['en']+=' After the check, Tomas retrieved an oilcloth-wrapped message from the reachable lower landing while the others watched the water: FOLLOW WHERE THE DYE BLEEDS AT LOW TIDE. He folded the note with unusual care. His rage finally had an orientation, a route, and a witness willing to help him walk it.'
c['paragraphs'][3]['zh']+='檢查後，托瑪斯從可以安全抵達的下層平台取回一封油布包住的訊息，其他人則留意水位：「退潮時，沿著染料滲出的方向走。」他異常仔細地摺好紙條。他的憤怒終於有了方向、一條路，以及願意陪他走下去的見證人。'
c=books['import-seventh-light'][22]
p=c['paragraphs'][3]
for lang,marker in [('en','When the unsigned plums'),('zh','無名李子送來後')]:
    at=p[lang].find(marker)
    if at>=0:
        if lang=='en':
            # This trailing detail belongs after the basket arrives that evening.
            end=p[lang].find('.',at)
            p[lang]=p[lang][:at]+p[lang][end+1:]
        else:
            end=p[lang].find('。',at)
            p[lang]=p[lang][:at]+p[lang][end+1:]

def replace(bid, number, pi, en, zh):
    c = books[bid][number-1]
    c['paragraphs'][pi] = dict(en=en, zh=zh)
    changes.append(dict(chapter=c['id'], kind='ending_or_continuity_edit', paragraph=pi+1))

replace('ss-r5-l1-b',25,4,
    "Before they left, the friends made the room tidy for the next group. A family stopped at the door to ask about a short trip to Shell Bay for the next public art day. Uma showed them the calendar: during the first trial month, there would be one open art day every week. She checked the lamp twice, then turned it off. Sela wrote one word on the empty program cover: 'Together.' She added Daro's name, Uma's, and the names of the other helpers. Then the three friends said goodbye and walked home by the sea. Sela's show was finished. Tomorrow someone else would open the door, turn on the lamp, and begin a different story.",
    "離開前，朋友們把房間整理整齊，留給下一組使用。一家人在門口停下，詢問下次公共藝術日時到貝殼灣短途旅行的事。烏瑪指給他們看日曆：試行第一個月，每週會有一次開放藝術日。她檢查燈具兩次，才把燈關上。塞拉在空白節目單封面寫下一個字：「一起。」她接著寫上達洛、烏瑪和其他幫手的名字。三個朋友道別，沿海走回家。塞拉的表演已經完成。明天會有人打開門、亮起燈，開始另一個故事。")

c=books['ss-r5-l5-b'][24]
for lang, marker in [('en',' Every repaired line on the map'),('zh','地圖上每條修復的線')]:
    c['paragraphs'][-1][lang]=c['paragraphs'][-1][lang].split(marker)[0]
changes.append(dict(chapter=c['id'],kind='remove_repeated_romantic_ending'))

replace('ss-r6-l6-b',25,4,
    "Yu said yes to one coffee, and they met on a free afternoon. Yan listened while she described her new work. She asked about his life too, without taking responsibility for arranging it. When the cups were empty, each left for a different train. Yu had enjoyed his company; she did not need to turn that pleasure into a promise. On the journey home she recorded rain against the window and labelled the sound with her own name and date. At her apartment she finished a local interview report for the morning. Yan would receive a message when she wished to write. She set down the recorder, opened the window a little, and listened to the rain without needing to keep it.",
    "林予答應喝一次咖啡，兩人約在一個休假的下午見面。周晏聽她談新工作；她也問起他的生活，但不把安排他的人生當成自己的責任。杯子空了之後，兩人各自去搭不同的列車。她喜歡他的陪伴，卻不必立刻把那份愉快變成承諾。回家途中，她錄下雨敲車窗的聲音，標上自己的名字和日期。回到住處，她完成隔天要交的地方訪談報告。想寫訊息時，她會再聯絡周晏。她放下錄音機，把窗戶推開一點，聽著不必保存下來的雨聲。")

c=books['ss-r3-l2-a'][24]
c['paragraphs'][-1]['en']=c['paragraphs'][-1]['en'].replace('Before leaving, Nian found another question in the notes: Nian chose to study the art of fair decisions rather than seek power.','Before leaving, Nian wrote down what she wanted to study next: how to make fair decisions when the records disagreed.')
c['paragraphs'][-1]['zh']=c['paragraphs'][-1]['zh'].replace('離開前，念在筆記裡找到另一個問題：念選擇研究公平決策之道，而非追求權力。','離開前，念記下自己接著想研究的事：當紀錄互相矛盾時，該如何作出公平的決定。')
changes.append(dict(chapter=c['id'],kind='replace_statement_mislabeled_as_question'))

c=books['ss-r8-l6-b'][24]
c['paragraphs'][2]['en']=c['paragraphs'][2]['en'].replace('Gu Yu departed for his fellowship that morning.', 'Gu Yu was due to leave for his fellowship later that morning.')
c['paragraphs'][2]['zh']=c['paragraphs'][2]['zh'].replace('顧嶼當天早上出發參加研究計畫。','顧嶼預定當天稍晚出發參加研究計畫。')
c['paragraphs'][2]['zh']=c['paragraphs'][2]['zh'].replace('顧嶼當天早上出發去研修。','顧嶼預定當天稍晚出發去研修。')
# Check the actual translation rather than relying on one historical spelling.
if c['paragraphs'][2]['zh'].startswith('顧嶼那天早上出發'):
    c['paragraphs'][2]['zh']=c['paragraphs'][2]['zh'].replace('顧嶼那天早上出發','顧嶼預定當天稍晚出發',1)
final=c['paragraphs'][4]
en=final['en'];zh=final['zh']
en_core,en_tail=en.split(' A renowned transport scholar',1)
zh_core,zh_tail=zh.split('一名知名運輸學者',1)
c['paragraphs'][3]['en']+=' A renowned transport scholar'+en_tail.split(' Cheng saw a villa')[0]
c['paragraphs'][3]['zh']+='一名知名運輸學者'+zh_tail.split('方澄看見')[0]
c['paragraphs'][4]['en']=en_core.replace('Home was not a station', 'Beyond the tracks, a villa caught the morning sun. Every dwelling along the line held lives that would continue after she left. Home was not a station')
c['paragraphs'][4]['zh']=zh_core.replace('家不是要求', '鐵道外，一棟別墅映著晨光。沿線每一處住家，都有在她離開後仍會繼續的生活。家不是要求')
c['paragraphs']=[c['paragraphs'][i] for i in [0,1,3,2,4]]
changes.append(dict(chapter=c['id'],kind='resolve_departure_timeline_and_restore_final_image'))

c=books['ss-r7-l6-a'][24]
c['paragraphs'][1]['en']=c['paragraphs'][1]['en'].replace('Before the meeting ended,','At the final safety meeting before coronation night,')
c['paragraphs'][1]['zh']=c['paragraphs'][1]['zh'].replace('會議結束前，','加冕之夜前的最後一次安全會議上，')
# Move the technical review before the performance, and let the curtain close once.
tail_en=' A child carefully pronounced every vowel in the final song.'
tail_zh=' 一個孩子仔細唱出終曲裡每個母音。'
c['paragraphs'][5]['en']=c['paragraphs'][5]['en'].replace(tail_en,'')
c['paragraphs'][5]['zh']=c['paragraphs'][5]['zh'].replace(tail_zh,'')
c['paragraphs'][2]['en']+=tail_en
c['paragraphs'][2]['zh']+=tail_zh
p=c['paragraphs'][4]
head,tail=p['en'].split(' The new final scene seemed to stun',1)
p['en']=head
c['paragraphs'][2]['en']+=' The new final scene seemed to stun'+tail.split(' The city treasury')[0]
c['paragraphs'][3]['en']+=' The city treasury'+tail.split(' The city treasury',1)[1].split(' Nilo checked')[0]
c['paragraphs'][5]['en']+=' Nilo checked'+tail.split(' Nilo checked',1)[1]
zh_mark='新的終幕'
if zh_mark not in p['zh']:
    zh_mark='新的最後場景'
# Preserve a faithful translation of the edited final scene rather than guessing text splits.
p['zh']='落幕後，艾薇邀莉奧拉加入劇團，擔任普通的劇本讀者。莉奧拉接受，也同意工作者可以質疑或拒絕她的建議。她仍不知道是否有路能回到艾莉絲原來的世界。小說從未解釋這個問題，她也不會編造輕易的答案。她協助收椅子，把安全帳簿放回公共書架。觀眾回家，工人領到有紀錄的工資，明天還會有新的排練。沒有人必須以死亡完成最後一幕，下一頁屬於他們所有人。'
c['paragraphs'][2]['zh']+='新的終幕令觀眾一時驚愕，接著才響起掌聲。一輪輪音樂帶著表演者走出圓圈。'
c['paragraphs'][3]['zh']+='儀式後，市財務部公布最後的公共經費報表。'
c['paragraphs'][5]['zh']+='尼洛檢查過，確定沒有危險振動傳到下層舞台。'
c['paragraphs']=[c['paragraphs'][i] for i in [5,1,0,2,3,4]]
changes.append(dict(chapter=c['id'],kind='move_preparation_before_performance_and_close_on_curtain'))

# Concrete sequencing errors introduced by earlier inserted paragraphs.
orders={6:[0,1,2,4,3],7:[0,1,2,4,3],23:[0,1,2,5,3,4],25:[0,1,4,2,3]}
for num,order in orders.items():
    c=books['import-seventh-light'][num-1]
    c['paragraphs']=[c['paragraphs'][i] for i in order]
    inverse={old+1:new+1 for new,old in enumerate(order)}
    for q in c['questions']:
        q['question']=re.sub(r'第 (\d+) 段',lambda mt:'第 '+str(inverse[int(mt[1])])+' 段',q['question'])
        q['explanation']=re.sub(r'第 (\d+) 段',lambda mt:'第 '+str(inverse[int(mt[1])])+' 段',q['explanation'])
    changes.append(dict(chapter=c['id'],kind='restore_scene_order',order=[i+1 for i in order]))

for cs in books.values():
    for c in cs:
        if c['id']=='import-seventh-light-6':
            c['questions'][1]=dict(question='What do the group do before anyone uses the shaft ladder?',options=['They ask the guard to check the shaft and test the first rung from the landing.','They send Niko down alone immediately.','They open every lower gate at high tide.'],answer=0,explanation='眾人先請守衛從上方檢查豎井，並在平台測試第一個梯階，才繼續取回訊息。')
        for q in c['questions']:
            if '原文證據：' in q['explanation']:
                evidence=q['explanation'].split('原文證據：',1)[1].split('\n本段對照：')[0]
                matching=[i for i,p in enumerate(c['paragraphs']) if evidence in p['en']]
                assert len(matching)==1,(c['id'],evidence,'ambiguous or stale quiz evidence')
                q['question']=re.sub(r'第 (\d+) 段',f'第 {matching[0]+1} 段',q['question'])
            # Keep cloze explanations aligned with their cited paragraph after edits.
            mt=re.search(r'第 (\d+) 段',q['question'])
            if mt and '本段對照：' in q['explanation']:
                q['explanation']=q['explanation'].split('本段對照：')[0]+'本段對照：'+c['paragraphs'][int(mt[1])-1]['zh']

c=books['ss-r5-l3-a'][21]
for w in c['words']:
    if w.get('original')=='outdoor':w['word']='outdoor'
# The signalling scene happens on the island before the rescue boarding.
c['paragraphs']=[c['paragraphs'][i] for i in [2,0,1,3,4]]
changes.append(dict(chapter=c['id'],kind='restore_outdoor_adjective_and_rescue_scene_order'))
c=books['ss-r5-l3-a'][17]
for p in c['paragraphs']:
    p['en']=p['en'].replace(' Even a small detail mattered when the sea could change the path between one hour and the next.','')
    p['zh']=p['zh'].replace('當大海可能在一小時內改變道路時，再小的細節也很重要。','')
changes.append(dict(chapter=c['id'],kind='remove_repeated_ending_sentence'))

kiln_endings=json.loads((R/'verification/kiln-ending-revisions-20261110.json').read_text())
for number,(en,zh) in kiln_endings.items():
    c=books['ss-r7-l2-a'][int(number)-1]
    c['paragraphs'][-1]=dict(en=en,zh=zh)
    changes.append(dict(chapter=c['id'],kind='replace_recycled_kiln_chapter_ending'))
for c in books['ss-r7-l2-a']:
    # These are the four recurring filler paragraphs, not a unique event scene.
    # All target terms and the source events for the two questions remain elsewhere.
    del c['paragraphs'][1]
    changes.append(dict(chapter=c['id'],kind='remove_recycled_kiln_paragraph'))

for b in catalog:
    cs=books[b['id']]
    for c, meta in zip(cs,b['chapters']):
        wc=len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",' '.join(p['en'] for p in c['paragraphs'])))
        meta['wordCount']=wc
        if 'wordCount' in c:c['wordCount']=wc
    raw_text=json.dumps(cs,ensure_ascii=False,separators=(',',':'))
    if raw_text!=before[b['id']]:
        raw=gzip.compress(raw_text.encode(),mtime=0)
        name=b['id']+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin'
        (P/'books'/name).write_bytes(raw)
        manifest['books'][b['id']]['url']='./books/'+name

(P/'content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
(P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
log_path.write_text(json.dumps(dict(manifestHash=hashlib.sha256((P/'content-manifest.json').read_bytes()).hexdigest(),changes=changes,meaningProvenance='Existing nonempty glossary entries, with 43 authored inflection definitions and contextual overrides; not an independent dictionary certification.'),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(changedBooks=sum(json.dumps(cs,ensure_ascii=False,separators=(',',':'))!=before[bid] for bid,cs in books.items()),changes=len(changes)),ensure_ascii=False))
