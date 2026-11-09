"""Record complete mechanical checks without claiming human editorial approval."""
from pathlib import Path
import json,gzip,re,collections
R=Path(__file__).resolve().parents[1];cat=json.loads((R/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'));m=json.loads((R/'public/content-manifest.json').read_text());rows=[];stats=collections.Counter()
for b in cat:
 cs=json.loads(gzip.decompress((R/'public'/m['books'][b['id']]['url']).read_bytes()))
 for c in cs:
  text=' '.join(p['en'] for p in c['paragraphs']);wc=len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",text));issues=[]
  assert c['paragraphs'] and all(p.get('en') and p.get('zh') for p in c['paragraphs']),(b['id'],c['id'],'missing bilingual prose')
  if wc<500:issues.append('underPlanned500Words')
  if not c['questions']:issues.append('noComprehensionQuestions')
  for q in c['questions']:
   assert len(q['options'])==3 and isinstance(q['answer'],int) and 0<=q['answer']<3 and q['question'] and q['explanation'],(c['id'],'invalid quiz')
   assert len(set(o.strip().casefold() for o in q['options']))==3,(c['id'],'duplicate options')
  stats.update(issues);rows.append({'book':b['id'],'chapter':c['id'],'englishWords':wc,'bilingualParagraphs':len(c['paragraphs']),'targetWords':len(c['words']),'questions':len(c['questions']),'reviewNeeded':issues,'humanEditorialStatus':'not_verified'})
  next(x for x in b['chapters'] if x['id']==c['id'])['wordCount']=wc
summary={'books':len(cat),'chapters':len(rows),'bilingualParagraphs':sum(r['bilingualParagraphs'] for r in rows),'questions':sum(r['questions'] for r in rows),'chapterFlags':dict(stats),'humanEditorialStatus':'not_completed','checks':'All chapter payloads, bilingual pairing, word counts, quiz shape, unique options; separate uniqueness audit. Does not validate factual correctness, naturalness, plot continuity, translation fidelity or all quiz answers.'}
(R/'verification/editorial-structure-20261108.json').write_text(json.dumps({'summary':summary,'chapters':rows},ensure_ascii=False,indent=2)+'\n');(R/'public/catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n');print(json.dumps(summary,ensure_ascii=False))
