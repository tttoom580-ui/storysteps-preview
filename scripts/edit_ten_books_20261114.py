"""Scoped editorial work: 10 selected StorySteps books, without false full-book signoff.

Applies hand-reviewed bilingual replacements against exact source excerpts, corrects
two first-chapter quizzes, and audits every chapter of the 10-book set. Changes are
bound to SHA-256 payloads; unreviewed chapters are left completely unchanged.
The audit does NOT claim that grammatical, translation or plot issues elsewhere
have passed semantic review.
"""
from pathlib import Path
from collections import defaultdict, Counter
import hashlib, gzip, json, re, sys

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
PLAN_PATH=ROOT/'verification/ten-book-editorial/curated-repairs-20261114.json'
RESULT=ROOT/'verification/ten-book-editorial/ten-book-progress-20261114.json'
CAT_PATH=PUBLIC/'catalog.js'
MANIFEST_PATH=PUBLIC/'content-manifest.json'
CERT_PATH=ROOT/'verification/editorial-approvals.json'

plan=json.loads(PLAN_PATH.read_text(encoding='utf-8'))
offer=json.loads((ROOT/'config/reader-offer.json').read_text(encoding='utf-8'))
catalog=json.loads(CAT_PATH.read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
manifest=json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
certified=json.loads(CERT_PATH.read_text(encoding='utf-8')).get('certifiedBooks',{})
ids=plan['bookIds']
assert ids==offer['freeBookIds'] and len(ids)==len(set(ids))==10, 'Must review the actual chosen ten books'
assert not any(bid in certified for bid in ids), 'Do not invalidate an existing book certificate'
books={b['id']:b for b in catalog}
assert all(bid in books and bid in manifest['books'] for bid in ids)

words=lambda text:re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",text)
norm=lambda text:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",text.casefold()))
def target_in(text, word):
    text=text.lower().replace('’',"'").replace('‘',"'")
    word=word.lower().replace('’',"'").replace('‘',"'")
    return bool(re.search(r'(?<![a-z])'+re.escape(word)+r'(?![a-z])',text))
def chapter_hash(c):
    return hashlib.sha256(json.dumps(c,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest()
def same(old, new, target, desc):
    if old in target:
        if target.count(old)!=1:raise ValueError(f'Not exactly one original excerpt in {desc}')
        return target.replace(old,new,1),True
    if new in target:
        return target,False
    raise ValueError(f'Reviewed excerpt missing from original manuscript: {desc}\nWanted: {old[:140]}\nFound: {target[:140]}')

applied=[]
quiz_edits=[]
reports=[]
chapters_scanned=[]
new_manifest=dict(manifest)
for bid in ids:
    b=books[bid]
    raw_path=(PUBLIC/manifest['books'][bid]['url']).resolve()
    if not raw_path.is_relative_to(PUBLIC.resolve()):raise ValueError('Manifest path escapes public dir')
    binary=raw_path.read_bytes()
    ch=json.loads(gzip.decompress(binary))
    assert len(ch)==len(b['chapters'])==25
    before=[chapter_hash(c) for c in ch]
    edits_for_book=[p for p in plan['changes'] if p['book']==bid]
    quiz_for_book=[p for p in plan['quizChanges'] if p['book']==bid]
    touched=set()
    for p in edits_for_book:
        number=p['chapter']
        assert 1<=number<=25
        chapter=ch[number-1]
        section=p['paragraph']-1
        assert 0<=section<len(chapter['paragraphs'])
        paragraph=chapter['paragraphs'][section]
        eng,english_changed=same(p['oldEn'],p['newEn'],paragraph['en'],f'{bid} chapter {number} paragraph {section+1} EN')
        zh,chinese_changed=same(p['oldZh'],p['newZh'],paragraph['zh'],f'{bid} chapter {number} paragraph {section+1} ZH')
        if english_changed!=chinese_changed:
            raise ValueError(f'Language edits out of sync: {bid} chapter {number}')
        paragraph['en'],paragraph['zh']=eng,zh
        if english_changed:
            touched.add(number)
        applied.append({'book':bid,'chapter':number,'paragraph':section+1,
                        'reason':p['problem'],'appliedNow':english_changed,
                        'englishBefore':p['oldEn'],'englishAfter':p['newEn'],
                        'chineseBefore':p['oldZh'],'chineseAfter':p['newZh']})
    for q in quiz_for_book:
        number=q['chapter']
        chapter=ch[number-1]
        question=chapter['questions'][q['question']-1]
        if question['question']==q['newQuestion']:
            assert question['options']==q['newOptions']
            continue
        assert question['question']==q['oldQuestion'],(bid,number,'question modified unexpectedly')
        assert question['options']==q['oldOptions'],(bid,number,'question choices modified unexpectedly')
        if q.get('oldExplanation'):
            assert q['oldExplanation'] in question['explanation'],(bid,number,'quiz explanation unexpected')
        question['question']=q['newQuestion']
        question['options']=q['newOptions']
        question['explanation']=q['newExplanation']
        if not ('原文證據' in question['explanation']):raise ValueError('Missing quiz source evidence')
        evidence=question['explanation'].split('原文證據（第 ',1)[1]
        i=int(evidence.split(' 段）',1)[0])
        snippet=evidence.split('：',1)[1].rstrip('.')
        assert norm(snippet) in norm(chapter['paragraphs'][i-1]['en']),('Quiz citation no longer in source',bid)
        touched.add(number)
        quiz_edits.append({'book':bid,'chapter':number,'question':q['question'],'before':q['oldQuestion'],'after':q['newQuestion']})
    for i,c in enumerate(ch):
        assert c['id']==b['chapters'][i]['id']
        text=' '.join(p['en'] for p in c['paragraphs'])
        wc=len(words(text))
        if wc<500:raise ValueError(f'{bid} chapter {i+1}: only {wc} English words')
        if len(c['words'])<20:raise ValueError(f'{bid} chapter {i+1}: only {len(c["words"])} target words')
        missing=[w['word'] for w in c['words'] if not target_in(text,w['word'])]
        if missing:raise ValueError(f'{bid} chapter {i+1}: missing target words {missing}')
        if len(c['questions'])<2:raise ValueError(f'{bid} chapter {i+1}: too few quizzes')
        for q in c['questions']:
            if not 0<=q['answer']<len(q['options']) or len(q['options'])!=3 or len(set(o.strip().casefold() for o in q['options']))!=3:
                raise ValueError(f'{bid} chapter {i+1}: invalid quiz')
        if any(not p['en'].strip() or not p['zh'].strip() for p in c['paragraphs']):
            raise ValueError(f'{bid} chapter {i+1}: blank bilingual paragraph')
        # Recalculate authoritative words for edited chapters; preserve other metadata.
        b['chapters'][i]['wordCount']=wc
        if i+1 not in touched and chapter_hash(c)!=before[i]:
            raise ValueError(f'Unreviewed chapter silently changed: {bid} chapter {i+1}')
        chapters_scanned.append({'book':bid,'chapter':i+1,'englishWords':wc,'targetWords':len(c['words']),
            'quizCount':len(c['questions']),'bilingualParagraphs':len(c['paragraphs']),
            'semanticGatesApproved':False,'modifiedThisPass':i+1 in touched})
    repeats=defaultdict(set)
    snippets={}
    for i,c in enumerate(ch):
        for p in c['paragraphs']:
            for sent in re.split(r'(?<=[.!?])\s+',p['en']):
                if len(words(sent))>=12:
                    key=norm(sent)
                    if key:
                        repeats[key].add(i+1)
                        snippets[key]=sent
    cross=[{'sentence':snippets[k],'chapters':sorted(v),'occurrences':len(v)} for k,v in repeats.items() if len(v)>1]
    cross.sort(key=lambda r:(-r['occurrences'],r['sentence']))
    old_binary_sha=hashlib.sha256(binary).hexdigest()
    updated_binary=gzip.compress(json.dumps(ch,ensure_ascii=False,separators=(',',':')).encode('utf-8'),compresslevel=9,mtime=0)
    new_sha=hashlib.sha256(updated_binary).hexdigest()
    if old_binary_sha!=new_sha:
        new_name=f'{bid}-{new_sha[:12]}.bin'
        (PUBLIC/'books'/new_name).write_bytes(updated_binary)
        new_manifest['books'][bid]['url']='./books/'+new_name
    reports.append({'id':bid,'title':b['zh'],'chapters':25,'chaptersModifiedThisPass':sorted(touched),
        'sourceBeforeSha256':old_binary_sha,'sourceAfterSha256':new_sha,
        'bilingualPatchGroups':len(edits_for_book),'quizzesCorrected':len(quiz_for_book),
        'minimumEnglishWords':min(len(words(' '.join(p['en'] for p in c['paragraphs']))) for c in ch),
        'minimumTargetWords':min(len(c['words']) for c in ch),
        'crossChapterRepeatedLongSentences':len(cross),
        'reuseCandidates':cross[:50], 'wholeBookFiveGateApproved':False,
        'remainingWork':'逐章劇情與跨章差異、逐段英文與英中語意、全部測驗答案人工語意核對'})
CAT_PATH.write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
MANIFEST_PATH.write_text(json.dumps(new_manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
summary={'booksInScope':10,'chaptersStructurallyChecked':len(chapters_scanned),
         'bilingualEditsAppliedNow':sum(int(x['appliedNow']) for x in applied),
         'bilingualPatchGroupsDocumented':len(applied),'quizzesRevisedNow':len(quiz_edits),
         'totalTargetWordsChecked':sum(c['targetWords'] for c in chapters_scanned),
         'totalQuizzesStructurallyChecked':sum(c['quizCount'] for c in chapters_scanned),
         'chaptersManuallyTouchedThisPass':sum(len(b['chaptersModifiedThisPass']) for b in reports),
         'booksWithCrossChapterReuseCandidates':sum(b['crossChapterRepeatedLongSentences']>0 for b in reports),
         'wholeBooksFullyEdited':0}
audit={'date':plan['reviewDate'],'editor':plan['reviewer'],'scope':'10 selected books, all 250 chapters mechanically screened; targeted AI-edited passages and two quizzes revised and source-bound.',
       'warning':'No whole book has passed the five complete editorial gates. Mechanical word/target/quiz checks are not proof of English fluency, plot continuity, bilingual correctness, or answer truth.',
       'summary':summary,'books':reports,'changes':applied,'quizChanges':quiz_edits,'chapterStructuralChecks':chapters_scanned}
RESULT.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
md=['# StorySteps 十本免費作品校訂進度','','本輪工作：十本共 250 章執行結構與跨章長句掃描；針對讀過的具體問題進行英中對照修訂與測驗修正。**這不是十本全文校訂完成。**','','## 五關完成標準','','1. 各章情節與跨章雷同人工審核','2. 全文自然英文、角色與時間線逐段修正','3. 全文英中語意逐段核對','4. 各章至少 500 詞、20 目標詞；所有測驗答案核實','5. 25 章全部通過，並保留可檢驗證據後才更新「全文已校訂」','','## 本輪檢查','','- 結構掃描：250 章','- 已執行英中片段改寫：'+str(summary['bilingualEditsAppliedNow'])+' 組','- 已修正測驗題：'+str(summary['quizzesRevisedNow'])+' 題','- 完整通過五關的書籍：0 本','','| 書名 | 英文最短章詞數 | 重用長句待審 | 本輪修改章節 | 整本五關 |','|---|---:|---:|---|---|']
for b in reports:
    md.append(f"| {b['title']} | {b['minimumEnglishWords']} | {b['crossChapterRepeatedLongSentences']} | {', '.join(map(str,b['chaptersModifiedThisPass'])) or '—'} | 未完成 |")
md.extend(['','完整稽核與每處修訂證據：[ten-book-progress-20261114.json](ten-book-progress-20261114.json)','', '請勿將「結構檢查通過」當作完整文學校訂認證。'])
(ROOT/'verification/ten-book-editorial/README.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print('TEN_BOOK_EDITORIAL',json.dumps(summary,ensure_ascii=False))
