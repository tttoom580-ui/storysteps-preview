"""Build small offline dictionary shards for actual story vocabulary plus common headwords.
Run with Python and opencc-python-reimplemented, using --csv /path/to/ecdict.csv.
The generated JSON and upstream MIT notice are committed, so deployment needs no download.
"""
from pathlib import Path
from collections import Counter
import argparse,csv,gzip,hashlib,json,re
from opencc import OpenCC

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--csv',required=True)
args=parser.parse_args()
source=Path(args.csv)
converter=OpenCC('s2twp')
tokens=Counter()
needed=set()
manifest=json.loads((ROOT/'public/content-manifest.json').read_text())
for entry in manifest['books'].values():
 for chapter in json.loads(gzip.decompress((ROOT/'public'/entry['url']).read_bytes())):
  for paragraph in chapter['paragraphs']:
   tokens.update(word.lower().replace('’',"'") for word in re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*",paragraph['en']))
  for word in chapter['words']:
   needed.add(word['word'].lower().replace('’',"'"))
rows={}
with source.open(newline='',encoding='utf-8-sig') as stream:
 for row in csv.DictReader(stream):
  word=row['word'].strip().lower()
  if re.fullmatch(r"[a-z]+(?:['-][a-z]+)*",word) and row['translation']:
   rows.setdefault(word,row)
keep=set(tokens)|needed
# Cover everyday lookups as well as current prose without shipping the entire upstream CSV.
keep.update(word for word,row in rows.items() if 0<int(row['bnc'] or 0)<=6000)
for word in list(keep):
 row=rows.get(word)
 if row:
  for item in (row.get('exchange') or '').split('/'):
   if item.startswith('0:'):keep.add(item[2:].lower())
entries={}
for word in sorted(keep):
 row=rows.get(word)
 if not row:continue
 translation=converter.convert(row['translation'].replace('\\n','\n')).strip()
 original=next((item[2:].lower() for item in row['exchange'].split('/') if item.startswith('0:')),None)
 # Upstream inflection-only entries should show the headword's definitions.
 if original in rows and original!=word and re.search(r'的(?:過去|複數|現在分詞|第三人稱|比較級|最高階|最高級)',translation):
  translation=converter.convert(rows[original]['translation'].replace('\\n','\n')).strip()
 entries[word]={'meaning':translation}
 if original and original!=word:entries[word]['original']=original
# Index explicit upstream inflections, keeping independent dictionary senses when present.
for word,row in rows.items():
 if word not in keep:continue
 for item in row['exchange'].split('/'):
  if ':' not in item:continue
  kind,form=item.split(':',1);form=form.lower()
  if kind in {'p','d','i','3','r','t','s'} and form in tokens and form not in entries and word in entries:
   entries[form]={**entries[word],'original':word}
out=ROOT/'public/dictionary'
out.mkdir(exist_ok=True)
for initial in 'abcdefghijklmnopqrstuvwxyz':
 shard={word:data for word,data in entries.items() if word.startswith(initial)}
 (out/(initial+'.json')).write_text(json.dumps(shard,ensure_ascii=False,separators=(',',':'))+'\n')
report={'source':'https://github.com/skywind3000/ECDICT','license':'MIT','sourceCsvSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'conversion':'OpenCC s2twp','entries':len(entries),'proseWordTypes':len(tokens),'directCoveredTypes':sum(w in entries for w in tokens),'directCoverageByOccurrence':round(sum(n for w,n in tokens.items() if w in entries)/tokens.total()*100,2),'remainingExamples':[(word,count) for word,count in tokens.most_common() if word not in entries][:30]}
(ROOT/'verification/dictionary-expansion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
