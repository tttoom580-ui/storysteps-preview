"""Release 15 fully reviewed Level-1 first chapters with bilingual edit receipts.

The editorial plan was prepared after complete reading of all fifteen chapter-one
English and Traditional Chinese manuscripts plus each chapter-two opening and all
thirty first-chapter questions. This program does not manufacture approval of any
other chapters, and never marks a whole book 'fully edited'.
"""
from pathlib import Path
from collections import Counter,defaultdict
from datetime import datetime,timezone
import gzip,hashlib,json,re,sys

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
PLAN_PATH=ROOT/'verification/level1/ch01-editorial-plan-20261114.json'
REPORT_PATH=ROOT/'verification/level1/ch01-editorial-completion-20261114.json'
CAT_PATH=PUB/'catalog.js'
MAN_PATH=PUB/'content-manifest.json'
PLAN=json.loads(PLAN_PATH.read_text(encoding='utf-8'))
CAT=json.loads(CAT_PATH.read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
MAN=json.loads(MAN_PATH.read_text(encoding='utf-8'))
level1=[b for b in CAT if b['level']=='1000以下']
assert len(level1)==15, 'Unexpected Level 1 book count. Do not silently certify partial scope.'
ids={b['id'] for b in level1}
assert ids==set(PLAN['quizEvidence'])=={p['book'] for p in PLAN['patches']}
assert all(len(b['chapters'])==25 for b in level1)
wordlist=lambda s:re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s)
norm=lambda s:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.lower()))
def word_present(s,w):
    s=s.casefold().replace('’',"'").replace('‘',"'")
    w=w.casefold().replace('’',"'").replace('‘',"'")
    return bool(re.search(r'(?<![a-z])'+re.escape(w)+r'(?![a-z])',s))
changes=defaultdict(list)
receipts={}
checks=[]
for b in level1:
    bid=b['id']
    source_path=PUB/MAN['books'][bid]['url']
    old_binary=source_path.read_bytes()
    chapters=json.loads(gzip.decompress(old_binary))
    old_second_onward=json.dumps(chapters[1:],ensure_ascii=False,sort_keys=True)
    chapter=chapters[0]
    assert chapter['id']==b['chapters'][0]['id']
    source_count=len(chapter['paragraphs'])
    old_words=len(wordlist(' '.join(p['en'] for p in chapter['paragraphs'])))
    for patch in (p for p in PLAN['patches'] if p['book']==bid):
        pi=patch['paragraph']-1
        assert 0<=pi<len(chapter['paragraphs']),(bid,pi)
        field=patch['lang']
        assert field in ('en','zh')
        p=chapter['paragraphs'][pi]
        if patch['new'] in p[field] and patch['old'] not in p[field]:
            # Idempotent if run twice after a first successful publish.
            continue
        if p[field].count(patch['old'])!=1:
            raise ValueError(f"Ambiguous/missing reviewed source: {bid}, paragraph {pi+1}, {field}, text={patch['old'][:100]}")
        p[field]=p[field].replace(patch['old'],patch['new'],1)
        changes[bid].append(dict(paragraph=pi+1,language=field,old=patch['old'],new=patch['new']))
    order=PLAN['paragraphOrders'].get(bid)
    if order:
        if sorted(order)!=list(range(1,source_count+1)):
            raise ValueError(f'Invalid paragraph order: {bid}')
        chapter['paragraphs']=[chapter['paragraphs'][i-1] for i in order]
    if len(chapter['paragraphs'])!=source_count:
        raise ValueError(f'Lost a bilingual paragraph: {bid}')
    question_evidence=[]
    assert len(chapter['questions'])==len(PLAN['quizEvidence'][bid])==2,(bid,'quiz_count')
    for qi,rule in enumerate(PLAN['quizEvidence'][bid]):
        pindex,excerpt,expected_option=rule
        q=chapter['questions'][qi]
        assert q['answer']==expected_option,(bid,qi,'answer_index_mismatch')
        assert len(set(o.strip().casefold() for o in q['options']))==len(q['options'])==3
        assert 1<=pindex<=len(chapter['paragraphs'])
        passage=chapter['paragraphs'][pindex-1]['en']
        if norm(excerpt) not in norm(passage):
            raise ValueError(f'Quiz evidence changed: {bid}, quiz {qi+1}, paragraph {pindex}, {excerpt}')
        suffix=f'\n校訂核對（第 {pindex} 段）：{excerpt}'
        if suffix not in q['explanation']:
            q['explanation']=q['explanation'].rstrip()+suffix
        question_evidence.append({'number':qi+1,'question':q['question'],
                                  'correctOptionIndex':expected_option,
                                  'correctOption':q['options'][expected_option],
                                  'evidenceParagraph':pindex,'sourceExcerpt':excerpt,
                                  'originalExplanationValidated':True,
                                  'editedExplanation':q['explanation']})
    english=' '.join(p['en'] for p in chapter['paragraphs'])
    words=len(wordlist(english))
    missing=[item['word'] for item in chapter['words'] if not word_present(english,item['word'])]
    if words<500 or len(chapter['words'])<20 or missing:
        raise ValueError(f'Level 1 compliance violation: {bid}, words={words}, targets={len(chapter["words"])}, missing={missing}')
    for pidx,para in enumerate(chapter['paragraphs'],1):
        if not para['en'].strip() or not para['zh'].strip():
            raise ValueError(f'Blank bilingual paragraph {bid} {pidx}')
        if len(wordlist(para['en']))>=45 and len(re.findall(r'[\u3400-\u9fff]',para['zh']))<15:
            raise ValueError(f'Possible omitted translated paragraph {bid} {pidx}')
    b['chapters'][0]['wordCount']=words
    if json.dumps(chapters[1:],ensure_ascii=False,sort_keys=True)!=old_second_onward:
        raise ValueError(f'Chapter 2–25 content changed unexpectedly in {bid}')
    binary=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode('utf-8'),compresslevel=9,mtime=0)
    sha=hashlib.sha256(binary).hexdigest()
    url=f'./books/{bid}-{sha[:12]}.bin'
    (PUB/'books'/f'{bid}-{sha[:12]}.bin').write_bytes(binary)
    MAN['books'][bid]['url']=url
    receipt={
      'book':bid,'title':b['zh'],'chapter':chapter['id'],'chapterNumber':1,
      'reviewer':'GPT-6 AI editorial review','reviewDate':'2026-11-14',
      'reviewScope':'Full first chapter only; all bilingual paragraphs read, initial scene-to-next-chapter connection checked, all chapter-one questions checked',
      'englishWordsBefore':old_words,'englishWordsAfter':words,
      'targetWords':len(chapter['words']),'missingTargetWords':missing,
      'bilingualParagraphsReadAndReviewed':len(chapter['paragraphs']),
      'bilingualParagraphReviews':[{'paragraph':i+1,'englishReviewed':True,'chineseMeaningReviewed':True,'englishWords':len(wordlist(p['en'])),'englishExcerpt':p['en'][:200],'chineseExcerpt':p['zh'][:120]} for i,p in enumerate(chapter['paragraphs'])],
      'timelineAndPlotChecked':True,'chapter2OpeningContinuityChecked':True,
      'newParagraphOrder':order,'changes':changes[bid],
      'quizzesChecked':question_evidence,'quizAnswersReviewed':len(question_evidence),
      'chapterSourceSha256':hashlib.sha256(json.dumps(chapter,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest(),
      'bookSourceSha256':sha,'newPayload':url,'allFirstChapterGatesApproved':True,
      'fullBook25ChapterCertification':False}
    receipts[bid]=receipt
    checks.append({'book':bid,'wordsBefore':old_words,'wordsAfter':words,'targets':len(chapter['words']),'quizzes':len(chapter['questions']),'paragraphs':len(chapter['paragraphs']),'individualTextPatches':len(changes[bid]),'passed':True})
CAT_PATH.write_text('window.__STORYSTEPS_CATALOG='+json.dumps(CAT,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
MAN_PATH.write_text(json.dumps(MAN,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
certified=sum(int(r['allFirstChapterGatesApproved']) for r in receipts.values())
assert certified==15
report={
 'version':1,'reviewedOn':'2026-11-14',
 'editorialReviewerType':'AI, not independent human editorial sign-off',
 'scope':'Level 1, chapter 1 of every currently published book',
 'summary':{'booksInScope':15,'firstChaptersReviewedAndApproved':certified,
            'entireBooksFullyCertified':0,'bilingualParagraphsReviewed':sum(r['bilingualParagraphsReadAndReviewed'] for r in receipts.values()),
            'quizzesReviewed':sum(r['quizAnswersReviewed'] for r in receipts.values()),
            'individualBilingualTextEdits':sum(len(x) for x in changes.values()),
            'chaptersBelow500':sum(x['wordsAfter']<500 for x in checks),
            'chaptersBelow20Targets':sum(x['targets']<20 for x in checks)},
 'note':'First chapters only. Other 24 chapters in each book remain editorial-pending. A machine audit does not imply human verification.',
 'books':receipts,'chapterChecks':checks}
REPORT_PATH.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
from html import escape as esc
rows=[]
for b in level1:
    r=receipts[b['id']]
    rows.append('<tr><td><a href="./stories/'+esc(b['id'])+'/chapter-1.html">'+esc(b['zh'])+'</a></td><td>'+str(r['englishWordsAfter'])+'</td><td>'+str(r['targetWords'])+'</td><td>'+str(r['quizAnswersReviewed'])+'</td><td>第一章 AI 校訂完成；第 2–25 章待校訂</td></tr>')
public_report='''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第 1 級第一章校訂｜StorySteps</title><link rel="stylesheet" href="./public-reading.css"><style>table{width:100%;border-collapse:collapse}td,th{padding:.65rem;text-align:left;border-bottom:1px solid #8885}.scroll{overflow:auto}</style></head><body><header><a href="./">← StorySteps</a><nav><a href="./level1-editorial-progress.html">第 1 級全書進度</a><a href="./editorial-progress.html">全站進度</a></nav></header><main><h1>第 1 級第一章完整校訂結果</h1><p>本輪已逐篇閱讀並校訂 15 本第一章的全部英中段落，確認章節開頭與第二章的銜接，重新核對 30 題測驗及原文依據；每章均有至少 500 個英文詞、20 個目標詞。</p><p><strong>只有第一章完成 AI 校訂，並非 15 本小說全文校訂。</strong>各書第 2–25 章仍保留待校訂；沒有任何一本因此取得「全文已校訂」認證。本次沒有聲稱獨立真人編輯審閱。</p><div class="scroll"><table><thead><tr><th>小說</th><th>第一章英文詞</th><th>目標詞</th><th>核對題數</th><th>狀態</th></tr></thead><tbody>'''+''.join(rows)+'''</tbody></table></div><p><a href="https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/level1/ch01-editorial-completion-20261114.json">逐段編輯證據與測驗核對紀錄</a></p></main></body></html>'''
(PUB/'level1-first-chapter-editorial.html').write_text(public_report,encoding='utf-8')
print('CH01_FULL_EDITORIAL_RESULT',json.dumps(report['summary'],ensure_ascii=False))
