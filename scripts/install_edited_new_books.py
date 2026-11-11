"""Install the two edited uploaded manuscripts after import_batch9.py.

The final bilingual JSON files are the canonical edited source; uploaded originals
and their hashes remain unchanged. Reimporting the originals requires rerunning this.
"""
from pathlib import Path
from collections import defaultdict
import gzip,hashlib,json,re,statistics

R=Path(__file__).resolve().parents[1];P=R/'public';D=R/'verification/new2-edit/final'
IDS=['ss-r9-l5-a','ss-r9-l5-b']
wc=lambda s:len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s))
norm=lambda s:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.casefold()))
apost=lambda s:s.casefold().replace('’',"'").replace('‘',"'")
has=lambda s,w:bool(re.search(r'(?<![a-z])'+re.escape(apost(w))+r'(?![a-z])',apost(s)))

def main():
    cat=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
    manifest=json.loads((P/'content-manifest.json').read_text())
    previews=json.loads((R/'app/story-previews.json').read_text())
    guide=json.loads((R/'app/reading-guide.json').read_text())
    rows=[]
    for bid in IDS:
        source=D/(bid+'.json');cs=json.loads(source.read_text())
        original_file={'ss-r9-l5-a':'ss-r9-l5-a-964ba19e9cd8.bin','ss-r9-l5-b':'ss-r9-l5-b-49520d75be68.bin'}[bid]
        original=json.loads(gzip.decompress((P/'books'/original_file).read_bytes()))
        meta=next(b for b in cat if b['id']==bid)
        assert len(cs)==25 and [c['id'] for c in cs]==[c['id'] for c in original],bid
        sentences=defaultdict(set);counts=[]
        for c,old,cm in zip(cs,original,meta['chapters']):
            assert c['words']==old['words'],(c['id'],'changed prescribed terms')
            text=' '.join(p['en'] for p in c['paragraphs']);n=wc(text);counts.append(n)
            assert n>=500,(c['id'],n)
            assert len(c['words'])>=20 and len({apost(w['word']) for w in c['words']})==len(c['words'])
            assert all(has(text,w['word']) and w['meaning'] for w in c['words']),c['id']
            assert all(p['en'].strip() and p['zh'].strip() for p in c['paragraphs'])
            assert len(c['questions'])==2 and c['questions']==old['questions'],c['id']
            for q in c['questions']:
                assert len(set(q['options']))==3 and 0<=q['answer']<3 and q['explanation']
                if bid.endswith('-a'):assert norm(q['options'][q['answer']]) in norm(text),(c['id'],'answer unsupported')
            for p in c['paragraphs']:
                for sentence in re.split(r'(?<=[.!?])\s+',p['en']):
                    if wc(sentence)>=12:sentences[norm(sentence)].add(c['id'])
            cm['wordCount']=n
            previews['chapters'][c['id']]=c['paragraphs'][0]['zh']
            lengths=[wc(s) for s in re.split(r'[.!?]+\s+',text) if s.strip()]
            guide['chapters'][c['id']]=dict(meanSentence=round(statistics.mean(lengths),1),maxSentence=max(lengths),lastScene=c['paragraphs'][-1]['zh'])
        repeated=[dict(sentence=s,chapters=sorted(v)) for s,v in sentences.items() if len(v)>1]
        assert not repeated,(bid,repeated)
        raw=gzip.compress(json.dumps(cs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
        filename=bid+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.bin';(P/'books'/filename).write_bytes(raw)
        manifest['books'][bid]['url']='./books/'+filename
        meta['importNote']='完整25章雙語校訂稿；已移除跨章重複模板、核對原配詞及測驗，並修正情節銜接。'
        guide['books'][bid]['sample']=' '.join(cs[0]['paragraphs'][0]['en'].split()[:65])+'…'
        rows.append(dict(id=bid,title=meta['zh'],chapters=25,englishWords=sum(counts),minimumChapterWords=min(counts),maximumChapterWords=max(counts),questions=50,targetEntries=sum(len(c['words']) for c in cs),repeatedLongSentencePatterns=0,finalSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),chapterWordCounts=counts))
    report=dict(updated='2026-11-10',scope='Two supplied manuscripts edited as paired bilingual prose. Seed Vault: repeated frames removed, 25 chapter-specific scenes authored, timeline and finale repaired. Cloud Cranes: all 100 repeated paragraph tails removed, eleven continuity/language fixes. Prescribed words and original quiz records retained; all 100 answers reviewed against remaining prose.',books=rows)
    (R/'verification/new2-edit/final-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    imports=json.loads((R/'content-import-batch9.json').read_text())
    for row in imports:
        edited=next((x for x in rows if x['id']==row['id']),None)
        if edited:
            row.setdefault('sourceRepeatedLongSentencePatterns',row['repeatedLongSentencePatterns'])
            row['repeatedLongSentencePatterns']=0;row['editorialRevision']=edited
            row.setdefault('sourceMinEnglishWords',row['minEnglishWords']);row.setdefault('sourceMaxEnglishWords',row['maxEnglishWords'])
            row['minEnglishWords']=edited['minimumChapterWords'];row['maxEnglishWords']=edited['maximumChapterWords']
            if 'repeatedSentences' in row:row['sourceRepeatedSentences']=row.pop('repeatedSentences')
    (R/'content-import-batch9.json').write_text(json.dumps(imports,ensure_ascii=False,indent=2)+'\n')
    (P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n')
    (P/'content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
    (R/'app/story-previews.json').write_text(json.dumps(previews,ensure_ascii=False,indent=2)+'\n')
    (R/'app/reading-guide.json').write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps(rows,ensure_ascii=False))

if __name__=='__main__':main()
