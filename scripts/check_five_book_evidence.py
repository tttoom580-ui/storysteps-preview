"""Release guard for the 125 full bilingual AI-review receipts.

This is an integrity/evidence checker, not an automated semantic editor.
The chapter-by-chapter editorial assessment belongs to the signed GPT-6 reviewer.
"""
from pathlib import Path
import gzip, hashlib, json, re

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
OFFER=json.loads((ROOT/'config/reader-offer.json').read_text())
CATALOG=json.loads((PUB/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
MANIFEST=json.loads((PUB/'content-manifest.json').read_text())
LEDGER=json.loads((ROOT/'verification/editorial-approvals.json').read_text())
NOTES=json.loads((ROOT/'verification/five-book-editorial/ai-readthrough-notes-20261114.json').read_text())
IDS=OFFER['freeBookIds'][:5]
CERTS=LEDGER['certifiedBooks']
active=[bid for bid in IDS if bid in CERTS]
if not active:
    print('FIVE_BOOK_EVIDENCE certified=0 (pre-certification manuscript stage)')
    raise SystemExit(0)
assert len(active)==5, 'Five-book review must release all five or none'
assert NOTES['bookIds']==IDS
books={b['id']:b for b in CATALOG}
count=0
questions=0
paragraphs=0
for bid in IDS:
    b=books[bid];cert=CERTS[bid]
    raw=(PUB/MANIFEST['books'][bid]['url']).resolve().read_bytes()
    assert hashlib.sha256(raw).hexdigest()==cert['bookSourceSha256'],bid
    chapters=json.loads(gzip.decompress(raw))
    assert len(chapters)==25 and len(cert['chapters'])==25
    for ci,chapter in enumerate(chapters):
        cid=chapter['id'];receipt=cert['chapters'][cid]
        sourcehash=hashlib.sha256(json.dumps(chapter,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest()
        assert receipt['sourceChapterSha256']==sourcehash,cid
        f=ROOT/receipt['evidencePath']
        assert f.is_file() and f.resolve().is_relative_to((ROOT/'verification').resolve())
        evidence=json.loads(f.read_text())
        assert evidence['sourceChapterSha256']==sourcehash
        assert evidence['chapter']==ci+1 and evidence['book']==bid
        assert evidence['reviewerType']=='AI, not external independent human'
        assert evidence['plotAndTimelineReview']['chapterSpecificFinding']==NOTES['chapterNotes'][bid][ci]
        assert evidence['plotAndTimelineReview']['passed']
        assert evidence['englishAndBilingualProofreading']['passed']
        paras=evidence['englishAndBilingualProofreading']['paragraphs']
        assert len(paras)==len(chapter['paragraphs'])==receipt['bilingualParagraphsReviewed']
        for ip,p in enumerate(paras):
            assert p['en']==chapter['paragraphs'][ip]['en']
            assert p['zh']==chapter['paragraphs'][ip]['zh']
            assert hashlib.sha256(p['en'].encode()).hexdigest()==p['englishSha256']
            assert hashlib.sha256(p['zh'].encode()).hexdigest()==p['chineseSha256']
        words=evidence['targetVocabularyReview']
        assert words['passed']
        assert len(words['targets'])==len(chapter['words'])>=20
        assert words['englishWordCount']>=500
        assert all(x['appearsInSource'] and x['word']==chapter['words'][k]['word'] for k,x in enumerate(words['targets']))
        qa=evidence['quizEvidence']
        assert len(qa)==len(chapter['questions'])==receipt['quizAnswersReviewed']
        for qi,q in enumerate(qa):
            original=chapter['questions'][qi]
            assert q['question']==original['question']
            assert q['options']==original['options'] and q['correctAnswerIndex']==original['answer']
            assert q['correctAnswerText']==original['options'][original['answer']]
            assert q['existingAnswerExplanation']==original['explanation']
            assert q['readAgainstEntireBilingualChapter'] is True
            assert q['sourceParagraphCandidates']
            for candidate in q['sourceParagraphCandidates']:
                idx=candidate['paragraph']-1
                assert 0<=idx<len(chapter['paragraphs'])
                assert candidate['english']==chapter['paragraphs'][idx]['en']
                assert candidate['chinese']==chapter['paragraphs'][idx]['zh']
        count+=1;questions+=len(qa);paragraphs+=len(paras)
assert count==125 and questions==250
print(f'FIVE_BOOK_EVIDENCE certified=5 chapters={count} paragraphs={paragraphs} quiz_answers={questions} source_hashes=valid')
