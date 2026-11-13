"""Revise a single verified bilingual scene and clarify two quiz explanations.

A deliberately narrow, reviewable editorial patch. Do not label the entire book
complete based on one chapter. The old paragraph must match exactly.
"""
from pathlib import Path
import gzip, hashlib, json, re

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'public'
man=json.loads((P/'content-manifest.json').read_text())
cat=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
bid='ss-r4-l3-b'
url=man['books'][bid]['url']
original_path=P/url
chapters=json.loads(gzip.decompress(original_path.read_bytes()))
chapter=chapters[0]
assert chapter['id']=='ss-r4-l3-b-1'
old=chapter['paragraphs'][3]
assert old['en'].startswith('The square outside was busy with various acts.'), "Source has changed: do not overwrite manual editing"
assert old['zh'].startswith('廣場上的表演十分多樣。'), "Source translation has changed"

replacement_en="""Outside the theatre, the festival square was crowded with various performers. A jazz trio practiced beside a wooden hut that served as a ticket booth. Nearby, a small circus troupe unloaded ropes while a child in a fairy costume chased a magician wearing a fancy purple hat. The child cheered when a coin vanished. "A miracle!" she cried. Mara wished the missing lines could return as easily. She held a cup of berry tea and tried to tame the shake in her hands. The volunteer had told her the thermos held a pint; now it was nearly empty, like the patience she had brought to rehearsal. A heater clicked beneath the booth. Theo bent to secure its loose screw, then pointed to the new festival program. Beneath Mara's name was a statement that the revised script had her approval. It was not merely an advertising error. It made her name look like a deed authorizing the transfer of her own words. A jet crossed above the roof as the band began another chorus. The announcer asked the crowd to stay for a political speech, and music threatened to spin into an argument. Mara would not rob the other artists of their opening night, but she would not quit asking who had changed the program. She photographed the false statement before the stage manager gave the signal to begin. "We can correct it without accusing anyone yet," Theo said. For the first time that evening, Mara knew exactly what evidence to keep."""
replacement_zh="""劇院外的節慶廣場擠滿了各式表演者。一支爵士三重奏在兼作售票亭的小木屋旁練習。附近的小馬戲團正卸下繩索，一個穿仙子服的孩子追著戴華麗紫帽的魔術師跑。硬幣消失時，孩子歡呼：「奇蹟！」瑪拉真希望被刪的台詞也能這麼容易回來。她捧著莓果茶，試著壓住雙手的顫抖。志工說保溫壺原有一品脫的茶，如今幾乎見底，像她帶來排練的耐心。售票亭下的暖爐喀噠一響；提歐彎腰鎖緊一顆鬆動的螺絲，隨即指向新印的節目單。瑪拉的名字下竟寫著「修訂版已獲作者同意」。那不只是宣傳上的錯誤，而像一紙契據，冒用她的姓名把作品轉讓出去。噴射機掠過屋頂，樂團又唱起副歌。主持人請觀眾留下聽一場政治演說，現場的音樂眼看就要變成爭論。瑪拉不願奪走其他藝術家的首演夜，卻也不打算放棄追問誰改了節目單。舞台監督發出開演訊號前，她先拍下那句不實文字。「現在有證據了，不必急著指控任何人。」提歐說。那晚第一次，瑪拉知道該保存什麼。"""
chapter['paragraphs'][3]={'en':replacement_en,'zh':replacement_zh}
chapter['questions'][0]['explanation']="第 1 段指出：Every line spoken by the mother character had vanished from the new copies. 因此被刪除的是母親角色的所有台詞。"
chapter['questions'][1]['explanation']="第 8 段指出：On the back of the deleted page somebody had written, ASK HER FIRST. 因此答案是 ASK HER FIRST。"
words=lambda t: re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",t)
def present(text,word):return bool(re.search(r'(?<![a-z])'+re.escape(word.lower())+r'(?![a-z])',text.lower()))
chapter_text=' '.join(p['en'] for p in chapter['paragraphs'])
missing=[w['word'] for w in chapter['words'] if not present(chapter_text,w['word'])]
assert not missing,missing
assert len(words(chapter_text))>=500,len(words(chapter_text))
assert len(chapter['words'])>=20
assert len(chapter['questions'])>=2
assert all(bool(p['en'].strip() and p['zh'].strip()) for p in chapter['paragraphs'])
assert chapter['questions'][0]['answer']==1 and chapter['questions'][1]['answer']==2
assert 'Every line spoken by the mother character had vanished from the new copies.' in chapter['paragraphs'][0]['en']
assert 'On the back of the deleted page somebody had written, ASK HER FIRST.' in chapter['paragraphs'][7]['en']
payload=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
new_url='./books/'+bid+'-'+hashlib.sha256(payload).hexdigest()[:12]+'.bin'
(P/new_url).write_bytes(payload)
man['books'][bid]['url']=new_url
meta=next(b for b in cat if b['id']==bid)
meta['chapters'][0]['wordCount']=len(words(chapter_text))
meta['learningReviewRequired']=True
meta['importNote']='25 章已上架；第 1 章一段英中場景已精修，2 題增加原文解釋；其餘章節及全書情節仍待逐段校訂。'
(P/'content-manifest.json').write_text(json.dumps(man,separators=(',',':'))+'\n')
(P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n')
log={
 'scope':'Only chapter 1, paragraph 4, and the two Chapter 1 quiz explanations, not a book certification.',
 'book':bid,'chapter':chapter['id'],'englishWordsBefore':len(words(' '.join(p['en'] if i!=3 else old['en'] for i,p in enumerate(chapter['paragraphs'])))),
 'englishWordsAfter':len(words(chapter_text)),'targetWordsStillPresent':len(chapter['words']),
 'missingTargetWords':missing,'quizAnswersReviewed':[
  {'number':1,'answer':'The mother character’s','sourceParagraph':1,'support':'Every line spoken by the mother character had vanished from the new copies.'},
  {'number':2,'answer':'ASK HER FIRST','sourceParagraph':8,'support':'On the back of the deleted page somebody had written, ASK HER FIRST.'}
 ],
 'bilingualParagraphsRevised':[4],'wholeBookPlotAndTranslationCertified':False,
 'newBookResource':new_url
}
(ROOT/'verification/r4-l3-b-ch01-bilingual-edit.json').write_text(json.dumps(log,ensure_ascii=False,indent=2)+'\n')
print('BILINGUAL_EDIT',json.dumps(log,ensure_ascii=False))
