"""Evidence-first editorial triage for every StorySteps volume.

Does not edit creative prose or certify translations; checks mechanical requirements,
paragraph alignment anomalies, repeated paragraphs and basic story continuity indicators.
"""
from pathlib import Path
from collections import Counter,defaultdict
from itertools import tee
import gzip,hashlib,json,re,statistics

ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'public';OUT=ROOT/'verification'
cat=json.loads((PUB/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
man=json.loads((PUB/'content-manifest.json').read_text())
en_words=lambda s:re.findall(r"[A-Za-z]+(?:['’-][A-Za-z]+)*",s)
norm=lambda s:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.lower()))
han=lambda s:len(re.findall(r'[\u3400-\u9fff]',s))
sentences=lambda s:re.split(r'(?<=[.!?])\s+',s)
all_book_report=[];all_chapters=[];issues=Counter()
all_en_paras=defaultdict(list)
for b in cat:
 bid=b['id'];chapters=json.loads(gzip.decompress((PUB/man['books'][bid]['url']).read_bytes()))
 repeated=defaultdict(set);repeated_zh=defaultdict(set)
 perbook=[]
 for ci,c in enumerate(chapters):
  en=' '.join(p['en'] for p in c['paragraphs'])
  paragraph_lengths=[(len(en_words(p['en'])),han(p['zh'])) for p in c['paragraphs']]
  chapter_issues=[]
  if len(en_words(en))<500:chapter_issues.append('english_word_count_under_500')
  if len(c['words'])<20:chapter_issues.append('under_20_target_words')
  if len(c['questions'])<2:chapter_issues.append('missing_2_questions')
  for pi,p in enumerate(c['paragraphs']):
   e,z=paragraph_lengths[pi]
   if e>=45 and z<15:chapter_issues.append('possible_omitted_chinese_translation:p'+str(pi+1))
   if e>=60 and z/e<0.45:chapter_issues.append('possible_short_chinese_translation:p'+str(pi+1))
   if z>=180 and e<30:chapter_issues.append('possible_extra_chinese_translation:p'+str(pi+1))
   en_key=norm(p['en'])
   if len(en_words(p['en']))>=35:all_en_paras[en_key].append((bid,c['id'],pi+1))
   if len(re.findall(r'\S',p['en']))>0 and re.search(r'(?:\b(?:the|and|of)\b\s+){5}',p['en'],re.I):chapter_issues.append('awkward_repeated_fillers:p'+str(pi+1))
   for sentence in sentences(p['en']):
    if len(en_words(sentence))>=12:repeated[norm(sentence)].add(c['id'])
   for segment in re.split(r'(?<=[。！？])',p['zh']):
    if han(segment)>=22:repeated_zh[re.sub(r'\s+','',segment)].add(c['id'])
  for qi,q in enumerate(c['questions']):
   if q['answer'] not in range(len(q['options'])):chapter_issues.append('invalid_quiz_index:'+str(qi+1))
   if not q['explanation'].strip():chapter_issues.append('blank_quiz_explanation:'+str(qi+1))
   if '原文證據：' not in q['explanation']:chapter_issues.append('quiz_needs_semantic_answer_review:'+str(qi+1))
  row={'id':c['id'],'number':ci+1,'title':c['zh'],'words':len(en_words(en)),'targetWords':len(c['words']),'quizCount':len(c['questions']),'bilingualParagraphs':len(c['paragraphs']),'issues':chapter_issues}
  all_chapters.append({'book':bid,**row})
  perbook.append(row)
  issues.update(chapter_issues)
 repeated_count=sum(len(ids)>1 for ids in repeated.values())
 zh_repeats=sum(len(ids)>1 for ids in repeated_zh.values())
 first=chapters[0];mid=chapters[12];end=chapters[-1]
 def snippet(c):
  return {'chapter':chapters.index(c)+1,'zh':c['zh'],'openingEnglish':c['paragraphs'][0]['en'][:620],
          'openingChinese':c['paragraphs'][0]['zh'][:230],
          'closingEnglish':c['paragraphs'][-1]['en'][-440:],
          'closingChinese':c['paragraphs'][-1]['zh'][-190:]}
 all_book_report.append({'id':bid,'name':b['zh'],'genre':b['genre'],'level':b['level'],
    'hook':b.get('hook',''),'description':b.get('desc',''),
    'editorialLabel':b.get('learningReviewRequired',False),
    'chapterCount':len(chapters),'minWords':min(r['words'] for r in perbook),
    'minTargetWords':min(r['targetWords'] for r in perbook),
    'quizzes':sum(r['quizCount'] for r in perbook),
    'enCrossChapterSentenceReuse':repeated_count,'zhCrossChapterSentenceReuse':zh_repeats,
    'chapterIssueCounts':dict(Counter(s.split(':')[0] for r in perbook for s in r['issues'])),
    'flaggedChapters':sum(bool(r['issues']) for r in perbook),'sample':{'beginning':snippet(first),'middle':snippet(mid),'ending':snippet(end)},
    'structuralGate':all(not any(not x.startswith('quiz_needs_semantic_answer_review') for x in r['issues']) for r in perbook),
    'translationAndPlotApproved':False,
    'editorialCertificate':'NOT_CERTIFIED'})
duplicates={str(k):v for k,v in all_en_paras.items() if len({bid for bid,_,_ in v})>=2}
summary={'totalBooks':len(cat),'totalChapters':len(all_chapters),'chaptersUnder500':sum(r['words']<500 for r in all_chapters),
 'chaptersUnder20Targets':sum(r['targetWords']<20 for r in all_chapters),'chaptersUnder2Quizzes':sum(r['quizCount']<2 for r in all_chapters),
 'chaptersWithBilingualHeuristicFlags':sum(any('chinese_translation' in x for x in r['issues']) for r in all_chapters),
 'quizzesWithoutExplicitSourceEvidence':sum(sum(x.startswith('quiz_needs_semantic_answer_review') for x in r['issues']) for r in all_chapters),
 'booksWithRepeatedEnglishLongSentence':sum(r['enCrossChapterSentenceReuse']>0 for r in all_book_report),
 'booksWithRepeatedChineseSentence':sum(r['zhCrossChapterSentenceReuse']>0 for r in all_book_report),
 'fullHumanSemanticApprovalCount':0,
 'sharedExactEnglishParagraphPatternsAcrossBooks':len(duplicates)}
report={'version':'2026-11-14','description':'Full machine screening, NOT sentence-by-sentence editorial approval. Translation length anomalies are candidate flags, not proof of mistranslation. Quiz semantic review required for all items without explicit source citations.','summary':summary,'books':all_book_report,'chapters':all_chapters,'crossBookDuplicateParagraphs':list(duplicates.items())[:100]}
(OUT/'editorial-triage-20261114.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('EDITORIAL_TRIAGE_SUMMARY',json.dumps(summary,ensure_ascii=False))
for b in all_book_report:
 print('BOOK_TRIAGE',json.dumps({'id':b['id'],'name':b['name'],'repeats':b['enCrossChapterSentenceReuse'],'zhRepeats':b['zhCrossChapterSentenceReuse'],'issues':b['chapterIssueCounts'],'chapterTitles': [c['title'] for c in all_chapters if c['book']==b['id']][:3]},ensure_ascii=False))
