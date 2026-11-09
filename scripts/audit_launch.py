"""Audit actual payload availability and conservative exact-form vocabulary coverage."""
from pathlib import Path
import json, gzip, re, collections, hashlib
R=Path(__file__).resolve().parents[1]
P=R/'public'
catalog=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
manifest=json.loads((P/'content-manifest.json').read_text())
reference=json.loads((R/'reference/ceec-reference.json').read_text())
forms={}
for entry in reference['entries']:
    for form in re.findall(r"[a-z]+(?:[-'][a-z]+)*",entry['entry'].lower()):
        if len(form)>1 or form in ['a','i']:
            forms[form]=min(forms.get(form,99),entry['level'])
out=[]
for b in catalog:
    entry=manifest['books'].get(b['id'])
    chapters=json.loads(gzip.decompress((P/entry['url']).read_bytes())) if entry else []
    ready=len(chapters)==25 and len(b['chapters'])==25 and all(c.get('available') for c in b['chapters']) and {c['id'] for c in chapters}=={c['id'] for c in b['chapters']} and all(c.get('paragraphs') and all(p.get('en') and p.get('zh') for p in c['paragraphs']) for c in chapters)
    b['readable']=ready
    ref=b.get('vocabularySummary',{}).get('referenceLevel') or min(6,['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000','6000–7000'].index(b['level'])+1)
    counts=collections.Counter(); types=collections.Counter(); total=0; unknown=collections.Counter(); chapter_counts=[]
    for c in chapters:
        tokens=re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*",' '.join(p['en'] for p in c['paragraphs']))
        tokens=[t.lower().replace('’',"'") for t in tokens]
        chapter_counts.append(len(tokens)); total+=len(tokens)
        for t in tokens:
            level=forms.get(t)
            key='within' if level and level<=ref else 'above' if level else 'unmatched'
            counts[key]+=1; types[t]+=1
            if key=='unmatched':unknown[t]+=1
    coverage={'referenceLevel':ref,'tokens':total,'within':counts['within'],'above':counts['above'],'unmatched':counts['unmatched'],
        'exactCoverage':round(100*counts['within']/total,1) if total else 0,
        'typeCoverage':round(100*sum(forms.get(t,99)<=ref for t in types)/len(types),1) if types else 0,
        'unmatchedExamples':[w for w,n in unknown.most_common(12)]}
    b['coverage']=coverage
    out.append({'id':b['id'],'title':b['zh'],'readable':ready,'chapters':len(chapters),'minWords':min(chapter_counts,default=0),
        'payloadSha256':hashlib.sha256((P/entry['url']).read_bytes()).hexdigest() if entry else None,**coverage})
(P/'catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
report={'generated':'2026-11-09','method':'English prose tokens only; case-insensitive exact surface form against reference levels 1–6; no stemming, name removal or guessed levels. Unmatched includes names and inflections, not automatically advanced vocabulary. This is not a CEFR/age assessment. Level 7 uses level-6 baseline for comparison, not official level-7 certification.',
    'reference':reference['url'],'books':out,'summary':{'readableBooks':sum(b['readable'] for b in out),'chapters':sum(b['chapters'] for b in out),'upcomingBooks':sum(not b['readable'] for b in out)}}
(P/'vocabulary-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(R/'verification/launch-audit-20261109.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report['summary']))
