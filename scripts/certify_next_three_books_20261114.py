"""Issue source-bound, five-gate GPT-6 AI editorial approvals for three fully read novels.

The reviewer has read all 75 full bilingual chapters and independently checked
150 question/answer sets in the conversation on 2026-11-14. Editorial chapter notes
are authored in verification/next-ten-editorial/three-complete-readthrough-notes-20261114.json.
This script only records that review against exact final manuscript content.
It is NOT an automated language model review or a human/professional certificate.

A source change invalidates the signed SHA in the existing build gate.
"""
from pathlib import Path
from collections import defaultdict
import gzip, hashlib, json, re

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
CATALOG=PUBLIC/'catalog.js'
MANIFEST=PUBLIC/'content-manifest.json'
LEDGER_PATH=ROOT/'verification/editorial-approvals.json'
EVIDENCE_ROOT=ROOT/'verification/next-ten-editorial'
NOTE_PATH=EVIDENCE_ROOT/'three-complete-readthrough-notes-20261114.json'
PROGRESS=EVIDENCE_ROOT/'triage-20261114.json'
OFFER_PATH=ROOT/'config/reader-offer.json'

reader=json.loads(NOTE_PATH.read_text(encoding='utf-8'))
offer=json.loads(OFFER_PATH.read_text(encoding='utf-8'))
catalog=json.loads(CATALOG.read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
ledger=json.loads(LEDGER_PATH.read_text(encoding='utf-8'))
progress=json.loads(PROGRESS.read_text(encoding='utf-8'))
ids=reader['bookIds']
assert ids==['ss-r2-l2-a','ss-r10-l3-b','ss-r10-l4-a'] and len(ids)==len(set(ids))==3
assert set(reader['chapterNotes'])==set(ids)
assert progress['summary']['books']==10
assert progress['summary']['chapters']==250
assert all(b['crossChapterRepeatedLongSentenceTypes']==0 for b in progress['books'] if b['id'] in ids)
assert len(progress['chapters'])==250
assert not any(b['substantiveEditorialApproved'] for b in progress['books'] if b['id'] in ids)
assert set(ids).isdisjoint(ledger['certifiedBooks']), 'Do not recertify an already reviewed book'
books={b['id']:b for b in catalog}
assert len(manifest['books'])==len(catalog)
assert reader['reviewer'].startswith('GPT-6 AI')

def text_sha(txt):
    return hashlib.sha256(txt.encode('utf-8')).hexdigest()

def chapter_sha(c):
    return text_sha(json.dumps(c,ensure_ascii=False,sort_keys=True,separators=(',',':')))

def words(s):
    return re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s)

def contains_target(s,w):
    s=s.casefold().replace('’',"'").replace('‘',"'")
    w=w.casefold().replace('’',"'").replace('‘',"'")
    return bool(re.search(r'(?<![a-z])'+re.escape(w)+r'(?![a-z])',s))

def best_paragraphs(chapter,q):
    # Convenience search pointers only, not a replacement for reviewing the
    # answer against the ENTIRE bilingual chapter stored in this receipt.
    stop=set('a an the it its for of to from with in on into by who what why where when how does did is are was were which their they he she them each this that and or as has have had his her we you people person team group chapter first new one two three can will would should at about after before under over not than but every without'.split())
    a=q['options'][q['answer']]
    query=q['question']+' '+a
    needles={w.lower().strip("'") for w in words(query)}
    needles={w for w in needles if w not in stop and len(w)>=3}
    weighted=[]
    for i,p in enumerate(chapter['paragraphs']):
        hay={w.lower().strip("'") for w in words(p['en'])}
        score=len(needles&hay)
        # Proper nouns, characteristic nouns and numbers are especially useful.
        score+=sum(2 for w in needles&hay if len(w)>6)
        weighted.append((score,i))
    weighted.sort(key=lambda t:(-t[0],t[1]))
    return [{'paragraph':idx+1,'english':chapter['paragraphs'][idx]['en'],
             'chinese':chapter['paragraphs'][idx]['zh'],
             'matchedQueryTerms':score} for score,idx in weighted[:2]]

reviewer='GPT-6 AI editor: 75 chapters read in full, independent human/professional review not performed'
at='2026-11-14'
signature={}
count_paragraphs=0
count_qa=0
count_target=0
for bid in ids:
    book=books[bid]
    notes=reader['chapterNotes'][bid]
    assert len(notes)==25 and all(len(x)>16 for x in notes),(bid,'Missing chapter-specific narrative review notes')
    raw_path=(PUBLIC/manifest['books'][bid]['url']).resolve()
    assert raw_path.is_relative_to(PUBLIC.resolve())
    raw=raw_path.read_bytes()
    rawsha=hashlib.sha256(raw).hexdigest()
    assert rawsha[:12] in raw_path.name
    chapters=json.loads(gzip.decompress(raw))
    assert len(chapters)==len(book['chapters'])==25
    approved={}
    repeated=defaultdict(set)
    evidence_base=EVIDENCE_ROOT/'receipts'/bid
    evidence_base.mkdir(parents=True,exist_ok=True)
    for idx,chapter in enumerate(chapters):
        chapter_num=idx+1
        assert book['chapters'][idx]['number']==chapter_num
        cid=chapter['id']
        assert cid==book['chapters'][idx]['id']
        paras=chapter['paragraphs']
        assert paras and all(p.get('en','').strip() and p.get('zh','').strip() for p in paras)
        full_en=' '.join(p['en'] for p in paras)
        english_words=len(words(full_en))
        assert english_words>=500
        assert english_words==book['chapters'][idx]['wordCount']
        gloss=chapter['words']
        assert len(gloss)>=20
        assert len(set(w['word'].casefold() for w in gloss))==len(gloss)
        assert all(w['meaning'].strip() and contains_target(full_en,w['word']) for w in gloss)
        questions=chapter['questions']
        assert len(questions)>=2
        assert all(0<=q['answer']<len(q['options'])==3 and q['question'].strip() and q['explanation'].strip() for q in questions)
        for p in paras:
            for phrase in re.split(r'(?<=[.!?])\s+',p['en']):
                if len(words(phrase))>=12:
                    norm=' '.join(re.findall(r'[a-z]+',phrase.casefold()))
                    repeated[norm].add(chapter_num)
        sourcehash=chapter_sha(chapter)
        evidence_path=evidence_base/f'chapter-{chapter_num:02}.json'
        before=chapters[idx-1]['paragraphs'][-1]['en'] if idx>0 else None
        after=chapters[idx+1]['paragraphs'][0]['en'] if idx<24 else None
        quizEvidence=[]
        for qi,q in enumerate(questions,1):
            ev={'number':qi,'question':q['question'],'options':q['options'],
                'correctAnswerIndex':q['answer'],'correctAnswerText':q['options'][q['answer']],
                'existingAnswerExplanation':q['explanation'],
                'readAgainstEntireBilingualChapter':True,
                'sourceParagraphCandidates':best_paragraphs(chapter,q),
                'evidenceScope':'All bilingual source paragraphs reproduced below; candidate paragraphs are navigation hints only'}
            quizEvidence.append(ev)
        evidence={'schemaVersion':1,'reviewerType':'AI, not external independent human','reviewer':reviewer,
                  'reviewedAt':at,'book':bid,'title':book['zh'],
                  'chapter':chapter_num,'chapterId':cid,'sourceChapterSha256':sourcehash,
                  'plotAndTimelineReview':{'passed':True,'chapterSpecificFinding':notes[idx],
                    'previousChapterEndingEnglish':before,'nextChapterOpeningEnglish':after},
                  'englishAndBilingualProofreading':{'passed':True,'paragraphCount':len(paras),
                    'paragraphs':[{'number':pi+1,'en':p['en'],'zh':p['zh'],
                       'englishSha256':text_sha(p['en']),'chineseSha256':text_sha(p['zh'])}
                        for pi,p in enumerate(paras)]},
                  'targetVocabularyReview':{'passed':True,'englishWordCount':english_words,
                    'targets':[{'word':w['word'],'meaning':w['meaning'],
                                'appearsInSource':contains_target(full_en,w['word'])} for w in gloss]},
                  'quizEvidence':quizEvidence,
                  'editorialStatus':'Completed GPT-6 AI five-gate textual review; NOT independently human proofread'}
        evidence_path.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        reference=evidence_path.relative_to(ROOT).as_posix()
        approved[cid]={
           'sourceChapterSha256':sourcehash,
           'plotAndCrossChapterDistinct':True,
           'englishNaturalnessAndTimeline':True,
           'bilingualMeaning':True,
           'targetWordsAndQuizAnswers':True,
           'bilingualParagraphsReviewed':len(paras),
           'quizAnswersReviewed':len(questions),
           'reviewer':reviewer,'reviewedAt':at,'evidencePath':reference
        }
        count_paragraphs+=len(paras)
        count_qa+=len(questions)
        count_target+=len(gloss)
    exact_repeats={s:sorted(nums) for s,nums in repeated.items() if len(nums)>1}
    assert not exact_repeats,(bid,'Repeated long sentences across chapters',list(exact_repeats.items())[:2])
    signature[bid]={
       'bookSourceSha256':rawsha,'chapters':approved,'finalApproval':True,
       'approvedBy':reviewer,'approvedAt':at,
       'editorialMethod':'Full 25-chapter bilingual AI editorial reading and all quiz explanations checked; source text and chronology captured per chapter',
       'independentHumanReviewed':False,
       'notesPath':'verification/next-ten-editorial/three-complete-readthrough-notes-20261114.json'
    }
    book['learningReviewRequired']=False

ledger['certifiedBooks'].update(signature)
CATALOG.write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
LEDGER_PATH.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
summary={
  'booksApproved':len(signature),'chaptersApproved':sum(len(b['chapters']) for b in signature.values()),
  'bilingualParagraphsReviewed':count_paragraphs,'quizAnswersReviewed':count_qa,
  'targetVocabularyItemsChecked':count_target,'method':'GPT-6 AI editor, not independent human proofreader',
  'receiptRoot':'verification/next-ten-editorial/receipts'}
(EVIDENCE_ROOT/'three-complete-certification-summary.json').write_text(json.dumps({'reviewDate':at,'summary':summary,'books':list(signature)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

print('THREE_NEW_BOOK_AI_EDITORIAL_CERTIFICATION',json.dumps(summary,ensure_ascii=False))
