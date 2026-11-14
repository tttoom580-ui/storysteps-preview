"""Apply verified bilingual editorial patches, re-audit all 250 next-batch chapters.

Nothing in this script sets whole-book certification flags. A concrete passage
is changed only when both the English and Chinese original fragments match once.
Rerunning is safe and records previously applied changes.
"""
from pathlib import Path
from collections import defaultdict
import gzip,hashlib,json,re

ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'public'
PATCHES=ROOT/'verification/next-ten-editorial/pending-patches.json'
MAN=PUB/'content-manifest.json';CAT=PUB/'catalog.js'
scope=json.loads((ROOT/'verification/next-ten-editorial/scope-20261114.json').read_text())
patches=json.loads(PATCHES.read_text(encoding='utf-8'))['patches']
catalog=json.loads(CAT.read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
manifest=json.loads(MAN.read_text(encoding='utf-8'))
books={b['id']:b for b in catalog}
cert=json.loads((ROOT/'verification/editorial-approvals.json').read_text())['certifiedBooks']
assert not set(scope['bookIds']) & set(cert)
assert all(p['book'] in scope['bookIds'] for p in patches)
words=lambda s:re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s)
def present(s,w):
 s=s.lower().replace('’',"'");w=w.lower().replace('’',"'")
 return bool(re.search(r'(?<![a-z])'+re.escape(w)+r'(?![a-z])',s))
work=defaultdict(list)
for p in patches:work[p['book']].append(p)
allrecs=[]
for bid,changes in work.items():
 path=(PUB/manifest['books'][bid]['url']).resolve()
 assert path.is_relative_to(PUB.resolve())
 original=path.read_bytes()
 chapters=json.loads(gzip.decompress(original))
 assert len(chapters)==25
 changed=False
 edited=set()
 for p in changes:
  ci=p['chapter']-1;pi=p['paragraph']-1
  assert 0<=ci<25 and 0<=pi<len(chapters[ci]['paragraphs'])
  para=chapters[ci]['paragraphs'][pi]
  updates={}
  applied=[]
  for field,key in [('en','english'),('zh','chinese')]:
   value=para[field]
   for old,new in p[key]:
    if value.count(old)==1:
     value=value.replace(old,new,1);applied.append(True)
    elif new in value and old not in value:
     applied.append(False)
    else:
     raise ValueError(f"Unexpected manuscript source: {bid} chapter={ci+1} paragraph={pi+1} {field}: {old[:100]}")
   updates[field]=value
  if any(applied) and not all(applied):
   raise ValueError(f'Bilingual patch state differs: {bid}/{ci+1}/{pi+1}')
  if any(applied):changed=True
  para.update(updates)
  edited.add(ci)
  allrecs.append({'book':bid,'chapter':ci+1,'paragraph':pi+1,
     'reason':p['reason'],'changesAppliedNow':any(applied),
     'englishBeforeAfter':p['english'],'chineseBeforeAfter':p['chinese']})
 for ci in edited:
  ch=chapters[ci]
  english=' '.join(p['en'] for p in ch['paragraphs'])
  wc=len(words(english))
  missing=[w['word'] for w in ch['words'] if not present(english,w['word'])]
  if wc<500 or len(ch['words'])<20 or missing:
   raise ValueError(f'{bid}: c{ci+1}: words {wc} target-count {len(ch["words"])} missing {missing}')
  if len(ch['questions'])<2 or any(not p['en'] or not p['zh'] for p in ch['paragraphs']):
   raise ValueError('Blank bilingual paragraph or missing questions')
  books[bid]['chapters'][ci]['wordCount']=wc
 if changed:
  binary=gzip.compress(json.dumps(chapters,ensure_ascii=False,separators=(',',':')).encode('utf-8'),compresslevel=9,mtime=0)
  sha=hashlib.sha256(binary).hexdigest()
  filename=f'{bid}-{sha[:12]}.bin'
  (PUB/'books'/filename).write_bytes(binary)
  manifest['books'][bid]['url']='./books/'+filename
CAT.write_text('window.__STORYSTEPS_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
MAN.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
summary={'scopeBooks':len(scope['bookIds']),'patchGroupsRecorded':len(patches),
 'patchGroupsAppliedThisRun':sum(r['changesAppliedNow'] for r in allrecs),
 'chaptersWithDocumentedRepairs':len({(r['book'],r['chapter']) for r in allrecs}),
 'wholeBooksCertifiedByScript':0}
ledger={'schemaVersion':1,'summary':summary,'changes':allrecs,
 'notice':'This ledger records actual precise bilingual corrections. It is NOT 25-chapter signoff.'}
(ROOT/'verification/next-ten-editorial/patch-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('NEXT_TEN_PATCHES',json.dumps(summary,ensure_ascii=False))
