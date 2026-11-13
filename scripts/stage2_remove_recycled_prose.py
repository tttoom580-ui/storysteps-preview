"""Conservative, bilingual duplicate prose cleanup for the two flagged books.

Works on source gzip manuscripts, NOT publication HTML. Removes a recycled sentence only
when it recurs in another chapter and when a chapter still passes its lexical/quiz
checks. A failed chapter is left exactly as it was and reported as pending.
It is not a substitute for semantic editing or third-party proofing.
"""
from pathlib import Path
from collections import defaultdict
import gzip,hashlib,json,re

R=Path(__file__).resolve().parents[1]
P=R/'public'
OUT=R/'verification/stage2-20261113.json'
BOOKS=['ss-r10-l5-b','ss-r10-l6-a']
manifest=json.loads((P/'content-manifest.json').read_text())
catalog=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
wc=lambda s:len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s))
norm=lambda s:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.casefold()))
normalize_zh=lambda s:re.sub(r'\s+','',s)
english_sentences=lambda s:re.split(r'(?<=[.!?])\s+',s)
chinese_sentences=lambda s:[x for x in re.split(r'(?<=[。！？])',s) if x.strip()]
valid_word=lambda text,w:bool(re.search(r'(?<![a-z])'+re.escape(w.casefold().replace('’',"'"))+r'(?![a-z])',text.casefold().replace('’',"'")))

def checks(ch,baseline):
    errors=[]
    text=' '.join(p['en'] for p in ch['paragraphs'])
    if wc(text)<500:errors.append('under_500_words')
    for w in ch['words']:
        if not valid_word(text,w['word']):errors.append('target_word_missing:'+w['word'])
    for i,q in enumerate(ch['questions']):
        explanation=q.get('explanation','')
        if '原文證據：' in explanation:
            evidence=explanation.split('原文證據：',1)[1].split('\n本段對照：')[0]
            m=re.search(r'第 (\d+) 段',q['question'])
            if not m or int(m[1])>len(ch['paragraphs']) or norm(evidence) not in norm(ch['paragraphs'][int(m[1])-1]['en']):
                errors.append('quiz_evidence_displaced:'+str(i+1))
            elif not valid_word(ch['paragraphs'][int(m[1])-1]['en'],q['options'][q['answer']]):
                errors.append('quiz_answer_displaced:'+str(i+1))
    if [w['entryId'] for w in ch['words']]!=[w['entryId'] for w in baseline['words']]:
        errors.append('target_ids_changed')
    if len(ch['paragraphs'])!=len(baseline['paragraphs']):errors.append('paragraph_count_changed')
    if any(not p['en'].strip() or not p['zh'].strip() for p in ch['paragraphs']):errors.append('blank_bilingual')
    return errors

def repeated_by_chapter(chs,lang):
    occurrence=defaultdict(set)
    for c in chs:
        for p in c['paragraphs']:
            seq=english_sentences(p[lang]) if lang=='en' else chinese_sentences(p[lang])
            for s in seq:
                if (wc(s)>=12 if lang=='en' else len(re.findall(r'[\u3400-\u9fff]',s))>=18):
                    occurrence[norm(s) if lang=='en' else normalize_zh(s)].add(c['id'])
    return {s for s,ids in occurrence.items() if len(ids)>1}

def count_reused(chs):
    return len(repeated_by_chapter(chs,'en'))

def apply_book(bid):
    old_url=manifest['books'][bid]['url']
    old=json.loads(gzip.decompress((P/old_url).read_bytes()))
    repeated_en=repeated_by_chapter(old,'en')
    repeated_zh=repeated_by_chapter(old,'zh')
    seen_en=set();seen_zh=set()
    output=[]
    report=[]
    for number,original in enumerate(old,1):
        candidate=json.loads(json.dumps(original,ensure_ascii=False))
        removed_en=0;removed_zh=0
        for p in candidate['paragraphs']:
            es=english_sentences(p['en'])
            zs=chinese_sentences(p['zh'])
            retained_en=[];retained_zh=[]
            for sentence in es:
                k=norm(sentence)
                if k in repeated_en and k in seen_en and wc(sentence)>=12:
                    removed_en+=wc(sentence)
                else:retained_en.append(sentence)
            for sentence in zs:
                k=normalize_zh(sentence)
                if k in repeated_zh and k in seen_zh and len(k)>=18:
                    removed_zh+=len(k)
                else:retained_zh.append(sentence)
            p['en']=' '.join(retained_en).strip()
            p['zh']=''.join(retained_zh).strip()
        issues=checks(candidate,original)
        # Protect unbalanced edits. Exact EN/ZH sentence reuse may have different
        # punctuation, but neither language may lose all evidence of its scene.
        if removed_en>0 and removed_zh==0:issues.append('bilingual_mismatch_no_zh_removed')
        if removed_zh>0 and removed_en==0:issues.append('bilingual_mismatch_no_en_removed')
        accepted=bool(removed_en or removed_zh) and not issues
        final=candidate if accepted else original
        output.append(final)
        for p in final['paragraphs']:
            for s in english_sentences(p['en']):seen_en.add(norm(s))
            for s in chinese_sentences(p['zh']):seen_zh.add(normalize_zh(s))
        report.append(dict(id=original['id'],accepted=accepted,englishWordsBefore=wc(' '.join(p['en'] for p in original['paragraphs'])),englishWordsAfter=wc(' '.join(p['en'] for p in final['paragraphs'])),removedRecycledEnglishWords=removed_en if accepted else 0,removedRecycledChineseCharacters=removed_zh if accepted else 0,issues=issues))
    after=count_reused(output)
    changed=sum(row['accepted'] for row in report)
    if changed:
        raw=gzip.compress(json.dumps(output,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
        filename=bid+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin'
        (P/'books'/filename).write_bytes(raw)
        manifest['books'][bid]['url']='./books/'+filename
        meta=next(b for b in catalog if b['id']==bid)
        for c,m in zip(output,meta['chapters']):
            m['wordCount']=wc(' '.join(p['en'] for p in c['paragraphs']))
        meta['sentenceReusePatterns']=after
        meta['learningReviewRequired']=True
        meta['importNote']=f'本輪移除 {changed} 章的部分跨章重複敘述並檢查原配詞與測驗格式；仍有 {after} 組跨章長句重用，且未完成全文語意校訂。'
    return dict(id=bid,changedChapters=changed,repeatedPatternsBefore=len(repeated_en),repeatedPatternsAfter=after,chapters=report)

def main():
    result=[apply_book(b) for b in BOOKS]
    (P/'content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
    (P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
    summary=dict(changedBooks=sum(r['changedChapters']>0 for r in result),changedChapters=sum(r['changedChapters'] for r in result),repetitionsBefore=sum(r['repeatedPatternsBefore'] for r in result),repetitionsAfter=sum(r['repeatedPatternsAfter'] for r in result),fullSemanticEditCompleted=False)
    OUT.write_text(json.dumps({'date':'2026-11-13','scope':'Conservative exact long-sentence bilingual cleanup; failed chapters unchanged; excludes complete narrative/translation proofreading','summary':summary,'books':result},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'stage2':summary,'books':[{'id':x['id'],'changedChapters':x['changedChapters'],'before':x['repeatedPatternsBefore'],'after':x['repeatedPatternsAfter'],'pending':[{y['id']:y['issues']} for y in x['chapters'] if y['issues']][:5]} for x in result]},ensure_ascii=False))
if __name__=='__main__':main()
