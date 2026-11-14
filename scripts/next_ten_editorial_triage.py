"""Evidence-based structural triage for the NEXT ten StorySteps books.

This scans all 250 source chapters and flags issues for semantic editors.
Passing mechanical checks MUST NOT automatically approve any chapter, because
source-to-translation equivalence, narrative coherence, and question truth
require actual reading.
"""
from pathlib import Path
from collections import defaultdict,Counter
from datetime import datetime
import gzip,hashlib,json,re,sys

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
SCOPE=ROOT/'verification/next-ten-editorial/scope-20261114.json'
scope=json.loads(SCOPE.read_text(encoding='utf-8'))
catalog=json.loads((PUB/'catalog.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
manifest=json.loads((PUB/'content-manifest.json').read_text(encoding='utf-8'))
already=json.loads((ROOT/'verification/editorial-approvals.json').read_text(encoding='utf-8')).get('certifiedBooks',{})
ids=scope['bookIds']
assert len(ids)==len(set(ids))==10
# Previously approved chapters may be re-audited read-only, but an audit must
# never revoke, rewrite, or silently renew their editorial approval.
books={b['id']:b for b in catalog}
assert all(x in books and x in manifest['books'] for x in ids)
words=lambda s:re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s)
def contains(s,w):
 s=s.casefold().replace('’',"'")
 w=w.casefold().replace('’',"'")
 return bool(re.search(r'(?<![a-z])'+re.escape(w)+r'(?![a-z])',s))
def norm(s):
 return ' '.join(re.findall(r'[a-z]+',s.lower()))

overview=[]
by_chapter=[]
issues=[]
for bid in ids:
 b=books[bid]
 path=(PUB/manifest['books'][bid]['url']).resolve()
 assert path.is_relative_to(PUB.resolve())
 payload=path.read_bytes()
 chapters=json.loads(gzip.decompress(payload))
 assert len(chapters)==len(b['chapters'])==25,(bid,len(chapters))
 repeated=defaultdict(set)
 samples={}
 for i,c in enumerate(chapters):
  number=i+1
  title=c.get('title','')
  paras=c.get('paragraphs',[])
  english=' '.join(p.get('en','') for p in paras)
  zh=''.join(p.get('zh','') for p in paras)
  wc=len(words(english))
  missed=[w['word'] for w in c['words'] if not contains(english,w['word'])]
  quiz=c.get('questions',[])
  badquiz=[j+1 for j,q in enumerate(quiz) if not isinstance(q.get('answer'),int) or not 0<=q['answer']<len(q.get('options',[])) or len(q.get('options',[]))!=3]
  explicit=sum(bool(re.search(r'原文證據|校訂核對|evidence|根據第\s*\d+\s*段',q.get('explanation',''),re.I)) for q in quiz)
  for p in paras:
   for sentence in re.split(r'(?<=[.!?])\s+(?=[A-Z“"])',p.get('en','')):
    if len(words(sentence))>=12:
     key=norm(sentence)
     repeated[key].add(number)
     samples[key]=sentence
  if wc<500 or len(c['words'])<20 or missed or len(quiz)<2 or badquiz:
   issues.append({'book':bid,'chapter':number,'kind':'structure_failure',
       'englishWords':wc,'targets':len(c['words']),'missingTargets':missed,'badQuizzes':badquiz})
  for j,p in enumerate(paras):
   if not p.get('en','').strip() or not p.get('zh','').strip():
    issues.append({'book':bid,'chapter':number,'kind':'empty_parallel_paragraph','paragraph':j+1})
  enchars=sum(len(p.get('en','')) for p in paras)
  zhchars=sum(len(p.get('zh','')) for p in paras)
  by_chapter.append({'book':bid,'chapter':number,'title':title,
   'id':c['id'],'sourceSha256':hashlib.sha256(json.dumps(c,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest(),
   'englishWords':wc,'targetWords':len(c['words']),'missingTargets':missed,
   'bilingualParagraphs':len(paras),'quizCount':len(quiz),'quizWithExplicitEvidence':explicit,
   'translationChars':zhchars,'englishChars':enchars,
   'translationToEnglishCharRatio':round(zhchars/max(1,enchars),2),
   'mechanicalGatePassed':wc>=500 and len(c['words'])>=20 and not missed and len(quiz)>=2 and not badquiz,
   'plotGateApproved':False,'englishStyleGateApproved':False,'bilingualMeaningGateApproved':False,'quizMeaningGateApproved':False})
 longRepeats=[{'sentence':samples[k],'chapters':sorted(v),'chapterCount':len(v)} for k,v in repeated.items() if len(v)>1]
 longRepeats.sort(key=lambda v:(-v['chapterCount'],v['sentence']))
 for r in longRepeats:
  issues.append({'book':bid,'kind':'cross_chapter_sentence_repeat',**r})
 summary={
 'id':bid,'title':b['zh'],'chapters':len(chapters),
 'sourceBookSha256':hashlib.sha256(payload).hexdigest(),
 'chapterMinimumEnglishWords':min(len(words(' '.join(p['en'] for p in c['paragraphs']))) for c in chapters),
 'chaptersWithStructuralFailures':sum(x['book']==bid and x['kind']=='structure_failure' for x in issues),
 'crossChapterRepeatedLongSentenceTypes':len(longRepeats),
 'paragraphPairs':sum(len(c['paragraphs']) for c in chapters),
 'quizQuestions':sum(len(c['questions']) for c in chapters),
 'explicitEvidenceInQuizExplanations':sum(sum(bool(re.search(r'原文證據|校訂核對|evidence',q.get('explanation',''),re.I)) for q in c['questions']) for c in chapters),
 'substantiveEditorialApproved':bid in already}
 overview.append(summary)
tot={'books':len(ids),'chapters':len(by_chapter),'paragraphPairs':sum(x['paragraphPairs'] for x in overview),
 'quizQuestions':sum(x['quizQuestions'] for x in overview),
 'missingQuizEvidenceLabels':sum(x['quizQuestions']-x['explicitEvidenceInQuizExplanations'] for x in overview),
 'repeatedLongSentenceTypes':sum(x['crossChapterRepeatedLongSentenceTypes'] for x in overview),
 'booksFullyApprovedThisTriage':0,
 'chaptersBelow500':sum(c['englishWords']<500 for c in by_chapter),
 'chaptersMissingTargetWords':sum(bool(c['missingTargets']) for c in by_chapter)}
output={'schemaVersion':1,'scope':ids,'reviewType':'mechanical triage, NOT full bilingual reading','summary':tot,
 'books':overview,'chapters':by_chapter,'issues':issues}
outpath=ROOT/'verification/next-ten-editorial/triage-20261114.json'
outpath.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
md=['# StorySteps 第二批十本：250 章編輯驗收前問題清單','','**此報告為規格與重複檢查，不能替代英文全文、中文翻譯、劇情及測驗的 AI 編輯審閱。**',
 f"選定 {tot['books']} 本，掃描 {tot['chapters']} 章、{tot['paragraphPairs']} 組英中段落、{tot['quizQuestions']} 題。",
 f"缺明確原文依據標記 {tot['missingQuizEvidenceLabels']} 題（不表示答案必然錯）；跨章重複長句 {tot['repeatedLongSentenceTypes']} 類。",
 '','| 書名 | 最少英文詞 | 跨章相同長句種類 | 英中段落 | 測驗有原文依據標記 | 全文簽核 |',
 '|---|---:|---:|---:|---:|---|']
for b in overview:
 md.append(f"| {b['title']} | {b['chapterMinimumEnglishWords']} | {b['crossChapterRepeatedLongSentenceTypes']} | {b['paragraphPairs']} | {b['explicitEvidenceInQuizExplanations']}/{b['quizQuestions']} | 待完成 |")
md.extend(['','沒有整本小說因為通過自動規格檢查而被授予全文校訂認證。','檢視逐章錯誤與來源 Hash：[triage-20261114.json](triage-20261114.json)'])
(ROOT/'verification/next-ten-editorial/README.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print('NEXT_TEN_TRIAGE',json.dumps(tot,ensure_ascii=False))
