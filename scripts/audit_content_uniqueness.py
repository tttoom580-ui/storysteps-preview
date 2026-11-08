from pathlib import Path
import json,gzip,re,hashlib,collections,itertools
R=Path(__file__).resolve().parents[1];cat=json.loads((R/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'));manifest=json.loads((R/'public/content-manifest.json').read_text())
def norm(s):return ''.join(re.findall(r'\w',s.casefold()))
def digest(s):return hashlib.sha256(norm(s).encode()).hexdigest()
titles=collections.defaultdict(list);books=collections.defaultdict(list);chapters=collections.defaultdict(list);paragraphs=collections.defaultdict(list);shingles={};summary=[]
for b in cat:
 titles[norm(b['zh'])].append(b['id']);cs=json.loads(gzip.decompress((R/'public'/manifest['books'][b['id']]['url']).read_bytes()));en=' '.join(p['en'] for c in cs for p in c['paragraphs']);zh=''.join(p['zh'] for c in cs for p in c['paragraphs']);books[digest(en)].append(b['id']);books['zh:'+digest(zh)].append(b['id']);tokens=re.findall(r"[a-z]+(?:['’][a-z]+)*",en.casefold());shingles[b['id']]={tuple(tokens[i:i+7]) for i in range(len(tokens)-6)}
 for c in cs:
  for lang in ['en','zh']:
   chapters[lang+':'+digest(' '.join(p[lang] for p in c['paragraphs']))].append({'book':b['id'],'chapter':c['id']})
  for i,p in enumerate(c['paragraphs']):
   if len(p['en'].split())>=15:paragraphs[digest(p['en'])].append({'book':b['id'],'chapter':c['id'],'paragraph':i})
 summary.append({'id':b['id'],'title':b['zh'],'chapters':len(cs),'englishWords':len(tokens)})
pairs=[]
for a,b in itertools.combinations(shingles,2):
 sa,sb=shingles[a],shingles[b];n=len(sa&sb);pairs.append({'a':a,'b':b,'jaccard':round(n/len(sa|sb),5),'sharedFractionOfShorter':round(n/min(len(sa),len(sb)),5),'sharedSevenWordPhrases':n})
report={'books':len(cat),'chapters':sum(b['chapters'] for b in summary),'duplicateTitles':[v for v in titles.values() if len(v)>1],'duplicateBooks':[v for v in books.values() if len(v)>1],'duplicateChapters':[v for v in chapters.values() if len(v)>1],'reusedLongParagraphs':[v for v in paragraphs.values() if len(v)>1],'mostSimilarPairs':sorted(pairs,key=lambda x:x['sharedFractionOfShorter'],reverse=True)[:15],'method':'Case/punctuation-insensitive title and English/Chinese full-text SHA256; chapter hashes; English paragraphs >=15 words; seven-word shingle overlap across all book pairs. Similarity screening cannot establish originality or exclude all paraphrased plots.','catalog':summary}
(R/'verification/content-uniqueness-20261108.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['catalog','mostSimilarPairs']},ensure_ascii=False));print('Highest shared fraction',report['mostSimilarPairs'][0]['sharedFractionOfShorter']);assert not any(report[k] for k in ['duplicateTitles','duplicateBooks','duplicateChapters','reusedLongParagraphs']);assert all(p['sharedFractionOfShorter']<.05 for p in report['mostSimilarPairs'])
