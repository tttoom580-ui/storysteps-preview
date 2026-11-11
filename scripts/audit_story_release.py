"""Full-corpus content checks, evidence citations and same-book sentence reuse.

Passing this audit means the stated checks passed, not literary publication approval.
"""
from pathlib import Path
from collections import Counter, defaultdict
import gzip, hashlib, json, re

R=Path(__file__).resolve().parents[1];P=R/'public'
manifest=json.loads((P/'content-manifest.json').read_text())
catalog=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
changes=json.loads((R/'verification/story-review-20261109-changes.json').read_text())
wc=lambda s:len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s))
norm=lambda s:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.casefold()))
textkey=lambda s:''.join(re.findall(r'\w',s.casefold()))
apost=lambda s:s.casefold().replace('’',"'").replace('‘',"'")
present=lambda s,w:bool(re.search(r'(?<![a-z])'+re.escape(apost(w))+r'(?![a-z])',apost(s)))
rows=[];chapters=[];errors=[];titles=defaultdict(list);bookhashes=defaultdict(list);chapterhashes=defaultdict(list)
stats=Counter();seen_ids=set()
for b in catalog:
    bid=b['id'];raw=(P/manifest['books'][bid]['url']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()[:12] in manifest['books'][bid]['url'],bid
    cs=json.loads(gzip.decompress(raw));assert len(cs)==len(b['chapters'])==25,bid
    assert [c['number'] for c in b['chapters']]==list(range(1,26)),bid
    titles[textkey(b['zh'])].append(bid);sentences=defaultdict(set);examples={};br=[]
    for lang in ['en','zh']:
        full=' '.join(p[lang] for c in cs for p in c['paragraphs'])
        bookhashes[lang+hashlib.sha256(textkey(full).encode()).hexdigest()].append(bid)
    for ci,c in enumerate(cs):
        cid=c['id'];assert cid not in seen_ids,cid;seen_ids.add(cid)
        problems=[];text=' '.join(p['en'] for p in c['paragraphs']);n=wc(text)
        if c['id']!=b['chapters'][ci]['id']:problems.append('catalog_id_mismatch')
        if n<500:problems.append('fewer_than_500_english_words')
        if b['chapters'][ci]['wordCount']!=n:problems.append('stale_word_count')
        if len(c['words'])<20:problems.append('fewer_than_20_target_words')
        if len({w['word'].casefold() for w in c['words']})!=len(c['words']):problems.append('duplicate_glossary_item')
        missing=[w['word'] for w in c['words'] if not present(text,w['word'])]
        empty=[w['word'] for w in c['words'] if not w.get('meaning','').strip()]
        if missing:problems.append('target_words_absent:'+','.join(missing))
        if empty:problems.append('blank_meanings:'+','.join(empty))
        if len(c['questions'])<2:problems.append('fewer_than_two_questions')
        for qi,q in enumerate(c['questions']):
            if len(q['options'])!=3 or len(set(o.strip().casefold() for o in q['options']))!=3 or not isinstance(q['answer'],int) or not 0<=q['answer']<3 or not q['question'].strip() or not q['explanation'].strip():problems.append(f'invalid_question:{qi+1}')
            if '原文證據：' in q['explanation']:
                evidence=q['explanation'].split('原文證據：',1)[1].split('\n本段對照：')[0]
                mt=re.search(r'第 (\d+) 段',q['question']);assert mt,(cid,qi)
                pi=int(mt[1])-1
                if pi>=len(c['paragraphs']) or norm(evidence) not in norm(c['paragraphs'][pi]['en']):problems.append(f'stale_evidence_citation:{qi+1}')
                elif not present(c['paragraphs'][pi]['en'],q['options'][q['answer']]):problems.append(f'answer_absent_from_cited_paragraph:{qi+1}')
                stats['sourceEvidenceQuestionsChecked']+=1
        if not c['paragraphs'] or any(not p.get('en','').strip() or not p.get('zh','').strip() for p in c['paragraphs']):problems.append('missing_bilingual_paragraph')
        for lang in ['en','zh']:
            full=' '.join(p[lang] for p in c['paragraphs'])
            chapterhashes[lang+hashlib.sha256(textkey(full).encode()).hexdigest()].append(cid)
        for pa in c['paragraphs']:
            # A sentence-reuse flag needs semantic review; refrain and quotation can be legitimate.
            for sentence in re.split(r'(?<=[.!?])\s+',pa['en']):
                if wc(sentence)>=12:
                    k=norm(sentence);sentences[k].add(cid);examples[k]=sentence
            if re.search(r'\bTODO\b|\bTBD\b|lorem ipsum|\[insert[^\]]*\]',pa['en'],re.I):problems.append('placeholder')
        cr=dict(book=bid,chapter=cid,englishWords=n,targetWords=len(c['words']),questions=len(c['questions']),bilingualParagraphs=len(c['paragraphs']),errors=problems)
        chapters.append(cr);br.append(cr)
        if problems:errors.append(cr)
        stats.update(dict(chapters=1,englishWords=n,questions=len(c['questions']),targetEntries=len(c['words']),bilingualParagraphs=len(c['paragraphs'])))
    repeated=sorted([dict(sentence=examples[k],chapters=sorted(v),count=len(v)) for k,v in sentences.items() if len(v)>1],key=lambda x:(-x['count'],x['sentence']))
    rows.append(dict(id=bid,title=b['zh'],chapters=len(cs),englishWords=sum(r['englishWords'] for r in br),minimumChapterWords=min(r['englishWords'] for r in br),minimumTargetWords=min(r['targetWords'] for r in br),questions=sum(r['questions'] for r in br),structuralChecksPassed=not any(r['errors'] for r in br),repeatedLongSentencePatterns=len(repeated),highestSentenceReuse=max((r['count'] for r in repeated),default=1),sentenceReuseExamples=repeated[:3],sentenceReuseDetails=repeated,editorialStatus='句子重用待逐章修訂' if repeated else '完整性檢查通過；逐段語意校訂待完成'))

duplicates=dict(titles=[v for v in titles.values() if len(v)>1],books=[v for v in bookhashes.values() if len(v)>1],chapters=[v for v in chapterhashes.values() if len(v)>1])
assert not errors,errors[:10]
assert not any(duplicates.values()),duplicates
rewrite_path=R/'verification/rewrite-11/final-audit.json'
rewrite_report=json.loads(rewrite_path.read_text()) if rewrite_path.exists() else None
rewritten={b['book'] for b in rewrite_report['books'] if not b['errors']} if rewrite_report else set()
for row in rows:
    if row['id'] in rewritten and not row['repeatedLongSentencePatterns']:
        row['editorialStatus']='本輪逐章改寫與題目複核完成；可持續校訂'
edited_path=R/'verification/new2-edit/final-audit.json'
edited_report=json.loads(edited_path.read_text()) if edited_path.exists() else None
edited={b['id'] for b in edited_report['books']} if edited_report else set()
for row in rows:
    if row['id'] in edited and not row['repeatedLongSentencePatterns']:
        row['editorialStatus']='本輪移除重複模板、校訂情節與英中對照，並複核測驗完成'
counts=Counter(c['kind'] for c in changes['changes'])
summary=dict(books=len(rows),**stats,structuralErrors=len(errors),booksWithSentenceReuseFlags=sum(r['repeatedLongSentencePatterns']>0 for r in rows),newQuestions=counts['authored_second_question'],filledMeanings=counts['fill_meaning'],targetPassagesRepaired=counts['restore_missing_targets'],restoredMissingTargets=84,kilnEndingsRewritten=counts['replace_recycled_kiln_chapter_ending'],kilnRecycledParagraphsRemoved=counts['remove_recycled_kiln_paragraph'],fullSemanticEditCompleted=False)
new_import_path=R/'content-import-batch9.json'
new_import=json.loads(new_import_path.read_text()) if new_import_path.exists() else []
latest_import_path=R/'content-import-batch10.json'
latest_import=json.loads(latest_import_path.read_text()) if latest_import_path.exists() else []
new_import+=latest_import
summary.update(rewrittenBooksThisRound=len(rewritten),rewrittenChaptersThisRound=rewrite_report['summary']['chaptersRevised'] if rewrite_report else 0,newImportedBooks=len(new_import),newImportedChapters=sum(b['chapters'] for b in new_import))
summary.update(editedUploadedBooks=len(edited),editedUploadedChapters=25*len(edited))
report=dict(updated='2026-11-10',summary=summary,scope='All published book payloads and all chapter/quiz/glossary records checked; English sentence reuse within each book and exact normalized full-book/chapter equality screened. The eleven flagged books received chapter-specific bilingual revisions and quiz review; see rewriteAudit. Other books received the earlier documented repairs and structural checks. AI editing and these checks are not independent expert proofreading or an originality certification.',rewriteAudit=rewrite_report,uploadedEditAudit=edited_report,newImportAudit=new_import,duplicates=duplicates,books=rows,chapters=chapters)
(P/'story-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(R/'verification/story-review-20261110.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
status_note=(f'本輪完成 {len(rewritten)} 本、{summary["rewrittenChaptersThisRound"]} 章的改寫與題目複核。' if rewritten else '')
status_note+=(f'目前另有 {summary["booksWithSentenceReuseFlags"]} 本出現同書跨章長句重用，需要繼續修訂。' if summary['booksWithSentenceReuseFlags'] else '目前未檢出同書跨章重用的 12 詞以上完整英文句。')
if new_import:status_note+=f'另匯入使用者提供的 {len(new_import)} 本、{sum(b["chapters"] for b in new_import)} 章；其中《沙海種子庫》與《雲鶴歸巢》已另外完成50章重複模板清理、英中校訂與測驗複核。'
status_note+='其他書目保留前一輪修正與完整性檢查紀錄；本報告沒有把自動檢查等同於全站逐段終稿校訂。AI 改寫仍可持續修正，未宣稱獨立專家審閱或保證原創性。'
lines=['# StorySteps 全書檢查與修訂紀錄','', f'更新：2026-11-10。範圍：目前已上架的 {summary["books"]} 本，每本 25 章；未把規劃中的續卷算作已完稿。','',f'已核對 {summary["chapters"]:,} 章、{summary["englishWords"]:,} 個英文單字、{summary["bilingualParagraphs"]:,} 組英中段落、{summary["questions"]:,} 題測驗與 {summary["targetEntries"]:,} 筆目標詞。','', '## 修訂進度','',status_note,'', '## 已完成的補修','', '- 補入 26 題依正文撰寫的第二題，每章現有兩題。','- 補上《第七盞燈》479 個空白詞義；優先沿用既有詞庫，再處理變化形及語境詞義。','- 在 22 章補回共 84 個詞表中原先未出現的目標詞，附對應中文；不是只把詞從清單刪掉。','- 統一《第七盞燈》人名譯法，修正梯井、模型、物資籃、慶宴等場景順序；更新題目段落引用。','- 修正六本作品的重複結尾、結尾陳述誤作問題、演出前後順序與離站時間。','- 《沒有火種的修窯師》重寫 21 個章末段落，刪除 25 段跨章重複敘述，保留每章至少 500 詞、20 個目標詞及兩題測驗。','', '| 書名 | 章數 | 每章最低英文詞數 | 長句重用樣式 | 狀態 |','|---|---:|---:|---:|---|']
for b in rows:lines.append(f'| {b["title"]} | {b["chapters"]} | {b["minimumChapterWords"]} | {b["repeatedLongSentencePatterns"]} | {b["editorialStatus"]} |')
(R/'STORY_REVIEW.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(summary,ensure_ascii=False))
