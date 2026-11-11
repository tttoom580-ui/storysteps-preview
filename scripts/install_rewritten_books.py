"""Install the eleven individually revised manuscript assets after full validation.

Use --check-only to inspect ready assets without changing the live-source manifest.
The baseline is the committed first review, not the temporary trimming experiment.
"""
from pathlib import Path
from collections import defaultdict
import argparse,gzip,hashlib,json,re,subprocess

R=Path(__file__).resolve().parents[1];P=R/'public';D=R/'verification/rewrite-11/final'
BASE='69f3f36e5224e42bf5923e3ff1c313e6b357dfc6'
BOOKS=['import-unbowed-city','ss-r5-l1-b','ss-r5-l5-b','ss-r5-l4-a','ss-r4-l3-b','ss-r3-l2-a','ss-r3-l5-a','ss-r6-l6-b','ss-r7-l4-a','ss-r7-l6-a','ss-r8-l6-b']
wc=lambda s:len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s))
norm=lambda s:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.casefold()))
has=lambda s,w:bool(re.search(r'(?<![a-z])'+re.escape(w.casefold())+r'(?![a-z])',s.casefold()))
read_git=lambda p:subprocess.check_output(['git','show',BASE+':'+p],cwd=R,text=True)
manifest=json.loads(read_git('public/content-manifest.json'))
catalog=json.loads(read_git('public/catalog.js').split('=',1)[1].rstrip(';\n'))

def validate(bid,cs,old):
    issues=[];sentence_chapters=defaultdict(set);counts=[];changed=[]
    if len(cs)!=25 or [c['id'] for c in cs]!=[c['id'] for c in old]:return {'book':bid,'errors':['chapter IDs/order/count changed']}
    for c,prev in zip(cs,old):
        cid=c['id'];text=' '.join(p['en'] for p in c['paragraphs']);n=wc(text);counts.append(n)
        if c['paragraphs']!=prev['paragraphs']:changed.append(cid)
        if n<500:issues.append([cid,'below_500',n])
        if len(c['words'])<20 or len({w['word'].casefold() for w in c['words']})!=len(c['words']):issues.append([cid,'target_count_or_duplicates'])
        # The rewrite must teach the same assigned terms and keep word identities stable.
        key=lambda w:(w.get('entryId'),w['word'].casefold(),w.get('original'))
        if sorted(map(key,c['words']),key=str)!=sorted(map(key,prev['words']),key=str):issues.append([cid,'assigned_target_list_changed'])
        for w in c['words']:
            if not w.get('meaning','').strip():issues.append([cid,'blank_meaning',w['word']])
            if not has(text,w['word']):issues.append([cid,'target_absent',w['word']])
        if len(c['questions'])!=2:issues.append([cid,'quiz_count'])
        for qi,q in enumerate(c['questions']):
            if len(q['options'])!=3 or len(set(x.strip().casefold() for x in q['options']))!=3 or not isinstance(q['answer'],int) or not 0<=q['answer']<3 or not q.get('question') or not q.get('explanation'):issues.append([cid,'invalid_quiz',qi+1]);continue
            if '原文證據：' in q['explanation']:
                evidence=q['explanation'].split('原文證據：',1)[1].split('\n本段對照：')[0]
                mt=re.search(r'第 (\d+) 段',q['question'])
                if not mt or int(mt[1])>len(c['paragraphs']):issues.append([cid,'invalid_evidence_paragraph',qi+1]);continue
                pi=int(mt[1])-1
                if norm(evidence) not in norm(c['paragraphs'][pi]['en']) or not has(c['paragraphs'][pi]['en'],q['options'][q['answer']]):issues.append([cid,'unsupported_quoted_answer',qi+1])
        if not c['paragraphs']:issues.append([cid,'no_prose'])
        for pi,p in enumerate(c['paragraphs']):
            if not p.get('en','').strip() or not p.get('zh','').strip():issues.append([cid,'unpaired_translation',pi+1]);continue
            if re.search(r'\bTODO\b|\bTBD\b|lorem ipsum|\[insert[^\]]*\]',p['en'],re.I):issues.append([cid,'placeholder',pi+1])
            # A very short translation beside a long English paragraph needs inspection.
            if wc(p['en'])>=40 and len(re.findall(r'[\u3400-\u9fff]',p['zh']))<wc(p['en'])*0.65:issues.append([cid,'translation_suspiciously_short',pi+1])
            for s in re.split(r'(?<=[.!?])\s+',p['en']):
                if wc(s)>=12:sentence_chapters[norm(s)].add(cid)
    reused=[{'sentence':s,'chapters':sorted(v)} for s,v in sentence_chapters.items() if len(v)>1]
    if reused:issues.append(['cross_chapter_sentence_reuse',reused])
    return dict(book=bid,chapters=25,chaptersRevised=len(changed),changedChapterIds=changed,englishWords=sum(counts),minimumChapterWords=min(counts),maximumChapterWords=max(counts),questions=sum(len(c['questions']) for c in cs),targetEntries=sum(len(c['words']) for c in cs),repeatedLongSentencePatterns=len(reused),errors=issues)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check-only',action='store_true');args=ap.parse_args();ready=[];data={};missing=[]
    for bid in BOOKS:
        f=D/(bid+'.json')
        if not f.exists():missing.append(bid);continue
        cs=json.loads(f.read_text());old=json.loads(gzip.decompress((P/manifest['books'][bid]['url']).read_bytes()))
        row=validate(bid,cs,old);ready.append(row);data[bid]=cs
    print(json.dumps({'ready':len(ready),'missing':missing,'books':ready},ensure_ascii=False,indent=2))
    if args.check_only:return
    assert not missing,missing
    assert all(not r['errors'] for r in ready),[r for r in ready if r['errors']]
    for b in catalog:
        if b['id'] not in data:continue
        cs=data[b['id']]
        for c,meta in zip(cs,b['chapters']):
            n=wc(' '.join(p['en'] for p in c['paragraphs']));meta['wordCount']=n
            if 'wordCount'in c:c['wordCount']=n
        raw=gzip.compress(json.dumps(cs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
        filename=b['id']+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin'
        (P/'books'/filename).write_bytes(raw);manifest['books'][b['id']]['url']='./books/'+filename
    (P/'content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
    (P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
    report=dict(updated='2026-11-10',baselineCommit=BASE,scope='All 275 chapters of the eleven flagged books revised as bilingual manuscript assets. Word counts, assigned targets, pairing, quiz structure, quoted answer evidence and same-book exact long sentence reuse checked. These checks do not certify every stylistic judgment or independent originality.',summary=dict(books=11,chapters=275,chaptersRevised=sum(r['chaptersRevised'] for r in ready),englishWords=sum(r['englishWords'] for r in ready),questions=sum(r['questions'] for r in ready),minimumChapterWords=min(r['minimumChapterWords'] for r in ready),repeatedLongSentencePatterns=0),books=ready)
    (R/'verification/rewrite-11/final-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('INSTALLED:',json.dumps(report['summary']))

if __name__=='__main__':main()
