"""Stage 2 diagnostic: prints only selected excerpts; does not modify manuscripts."""
from pathlib import Path
from collections import Counter,defaultdict
import json,gzip,re
R=Path(__file__).resolve().parents[1];P=R/'public'
m=json.loads((P/'content-manifest.json').read_text())
wc=lambda s:len(re.findall(r"[A-Za-z]+(?:['’-][A-Za-z]+)*",s))
norm=lambda s:' '.join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.lower()))
for bid in ('ss-r10-l5-b','ss-r10-l6-a'):
 cs=json.loads(gzip.decompress((P/m['books'][bid]['url']).read_bytes()))
 occurrences=defaultdict(set)
 for i,c in enumerate(cs):
  for p in c['paragraphs']:
   for sentence in re.split(r'(?<=[.!?])\s+',p['en']):
    if wc(sentence)>=12:occurrences[norm(sentence)].add(i)
 repeated={k:v for k,v in occurrences.items() if len(v)>1}
 print('BOOK',bid,'patterns',len(repeated))
 for i,c in enumerate(cs):
  repeat_total=0
  overlap_paras=[]
  for j,p in enumerate(c['paragraphs']):
   seen=[s for s in re.split(r'(?<=[.!?])\s+',p['en']) if wc(s)>=12 and norm(s) in repeated]
   repeat_total+=sum(wc(s) for s in seen)
   if seen:overlap_paras.append({'paragraph':j+1,'count':len(seen),'en':p['en'][:170],'zh':p['zh'][:75]})
  print('CHAPTER',json.dumps({'id':c['id'],'title':c['title'],'zh':c.get('zh'),'words':wc(' '.join(p['en'] for p in c['paragraphs'])),'repeatWords':repeat_total,'paragraphs':len(c['paragraphs']),'repeatParagraphs':overlap_paras[:3]},ensure_ascii=False))
 for num in [1,2,3,6,9,17,25]:
  c=cs[num-1]
  print('SCENE',json.dumps({'id':c['id'],'title':c['title'],'paragraphs':[{'i':j+1,'en':p['en'][:320],'zh':p['zh'][:190]} for j,p in enumerate(c['paragraphs'][:3])]},ensure_ascii=False))

 for c in cs:
  if bid!='ss-r10-l5-b':continue
  print('FERRY_CORE',json.dumps({'id':c['id'],'title':c['title'],'cores':[{'i':i+1,'en':p['en'][:500],'zh':p['zh'][:190]} for i,p in enumerate(c['paragraphs']) if i in (2,4,5)]},ensure_ascii=False))

for bid in ('ss-r10-l5-b','ss-r10-l6-a'):
 cs=json.loads(gzip.decompress((P/m['books'][bid]['url']).read_bytes()))
 spans=defaultdict(set)
 for c in cs:
  for p in c['paragraphs']:
   for sentence in re.split(r'(?<=[.!?])\s+',p['en']):
    if wc(sentence)>=12:spans[norm(sentence)].add(c['id'])
 repeated={s for s,v in spans.items() if len(v)>1}
 for c in cs[:4]:
  for i,p in enumerate(c['paragraphs']):
   ens=re.split(r'(?<=[.!?])\s+',p['en']);zh=[x for x in re.split(r'(?<=[。！？])',p['zh']) if x.strip()]
   indices=[k for k,t in enumerate(ens) if norm(t) in repeated and wc(t)>=12]
   print('ALIGN',json.dumps({'chapter':c['id'],'p':i+1,'enSents':len(ens),'zhSents':len(zh),'firstRepeat':min(indices) if indices else None,'repeats':len(indices),'enEnd':ens[-1][:80],'zhEnd':zh[-1][-100:]},ensure_ascii=False))
