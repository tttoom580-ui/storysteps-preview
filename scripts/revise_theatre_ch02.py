"""Second targeted, evidence-backed bilingual narrative edit.

Replaces the vocabulary-list scene in chapter 2 with a scene about the two
conflicting markings and preserves all mandated vocabulary and quiz answers.
"""
from pathlib import Path
import gzip,hashlib,json,re
R=Path(__file__).resolve().parents[1];P=R/'public';bid='ss-r4-l3-b'
man=json.loads((P/'content-manifest.json').read_text());cat=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
chapters=json.loads(gzip.decompress((P/man['books'][bid]['url']).read_bytes()))
chapter=chapters[1];assert chapter['id']=='ss-r4-l3-b-2'
old=chapter['paragraphs'][3]
assert old['en'].startswith('The office wall carried posters from a decade of festivals.'),'Edited upstream; no overwrite'
assert old['zh'].startswith('牆上掛著十年來的音樂節海報。'),'Translation edited upstream; no overwrite'
en="""June opened the theatre's archive room. Posters from a decade of festivals covered one wall: a painted beast from a children's show, a bowling fundraiser that once paid for stage lights, and a faded photograph of an expressive professor conducting a student choir. The current budget was smaller. June showed Mara a repair kit with only two tools and a permit for the festival stage; both had been signed by the same office that produced the black-square pages. Mara drew the geography of the venue on a sheet of paper. The sponsor controlled one entrance, not the whole square. A tired passenger from the late ferry had complained that a man in a necktie tried to cut the line at that gate. He had been drunk, and his shouting had begun to frighten the volunteer checking tickets. The clerk had refused to let him through. It would be greedy, Mara thought, to call that disorder proof that the sponsor had altered the script. She felt regret about her earlier accusation. A strip of lace caught on a folder, and June gently freed it before turning the page. The file revealed a visible date: Friday, not Saturday. Their retired professor, now a voter on the independent arts board, had watched rehearsals during the previous semester. He advised them not to risk confusing the blue-pencil marks about personal privacy with the later black squares about the river gate. Two edits might demand two different explanations."""
zh="""君打開劇院的檔案室。一整面牆貼著十年來的藝術節海報：兒童劇裡畫出的野獸、曾為舞台燈光募款的保齡球活動，以及一位表情生動的教授指揮學生合唱團的褪色照片。今年的預算縮水了。君拿給瑪拉看只有兩件工具的修理組，以及藝術節舞台的許可證；兩份文件都由列印黑方塊版本的辦公室簽署。瑪拉在紙上畫出場地的地理配置。贊助商控制的只是一處入口，不是整個廣場。一名搭末班渡輪來的疲憊乘客曾投訴，一個打領帶的男人想在那道入口插隊。他喝醉了，大吼大叫，開始嚇到負責驗票的志工；職員不准他進去。瑪拉心想，如果只憑這場混亂就斷定贊助商竄改劇本，未免太貪心、太武斷。她後悔先前急著指控。文件夾勾住了一條蕾絲飾邊，君輕輕把它解開才翻頁。檔案顯示清楚可見的日期：星期五，而不是星期六。那位退休教授現在是獨立藝術委員會的投票成員，上一學期還曾旁聽排練。他提醒她們，別冒險把涉及個人隱私的藍鉛筆記號與後來涉及水閘的黑方塊混為一談。兩種修改，也許需要兩套不同的解釋。"""
chapter['paragraphs'][3]={'en':en,'zh':zh}
chapter['questions'][0]['explanation']="第 1 段明確寫道：The blue dots appeared only beside personal details from interviews. 因此藍點主要標記訪談中的個人細節。"
chapter['questions'][1]['explanation']="第 3 段寫道：The black-square pages were made late on Saturday. 因此黑方塊版本是在星期六深夜列印。"
words=lambda s:re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s)
whole=' '.join(p['en'] for p in chapter['paragraphs'])
missing=[w['word'] for w in chapter['words'] if not re.search(r'(?<![A-Za-z])'+re.escape(w['word'])+r'(?![A-Za-z])',whole,re.I)]
assert not missing,missing
assert len(words(whole))>=500,len(words(whole))
assert len(chapter['words'])>=20 and len(chapter['questions'])==2
assert chapter['questions'][0]['answer']==2 and chapter['questions'][1]['answer']==0
assert 'The blue dots appeared only beside personal details from interviews' in chapter['paragraphs'][0]['en']
assert 'The black-square pages were made late on Saturday' in chapter['paragraphs'][2]['en']
raw=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
url='./books/'+bid+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin'
(P/url).write_bytes(raw)
man['books'][bid]['url']=url
b=next(b for b in cat if b['id']==bid)
b['chapters'][1]['wordCount']=len(words(whole))
b['learningReviewRequired']=True
b['importNote']='25 章已上架；第 1～2 章部分英中場景已精修、合計 4 題經原文核對；全書其餘英中及情節仍待校訂。'
(P/'content-manifest.json').write_text(json.dumps(man,separators=(',',':'))+'\n')
(P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n')
report={'book':bid,'chapter':chapter['id'],'rewrittenParagraph':4,'wordsBefore':len(words(' '.join(old['en'] if i==3 else p['en'] for i,p in enumerate(chapter['paragraphs'])))),'wordsAfter':len(words(whole)),'targetWords':len(chapter['words']),'missingTargetWords':missing,'questionsVerified':2,'quizEvidenceParagraphs':[1,3],'remainingBookCertification':False,'newResource':url}
(R/'verification/r4-l3-b-ch02-bilingual-edit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('BILINGUAL_CH2',json.dumps(report,ensure_ascii=False))
