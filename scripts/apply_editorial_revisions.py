"""Apply reviewed chapter prose while preserving concurrently added quizzes on old chapters."""
from pathlib import Path
import json,gzip,hashlib,re
R=Path(__file__).resolve().parents[1];D=R/'verification/editorial-revisions'
def wc(c):return len(re.findall(r"[A-Za-z]+(?:[’'-][A-Za-z]+)*",' '.join(p['en'] for p in c['paragraphs'])))
def main():
 m=json.loads((R/'public/content-manifest.json').read_text());groups={}
 for b in ['ss-r7-l1-b','ss-r7-l2-a','ss-r7-l3-a']:
  groups[b]={c['id']:c for c in json.loads((D/(b+'.json')).read_text())}
 for x in json.loads((D/'short-revised.json').read_text()):groups.setdefault(x['book'],{})[x['chapter']['id']]=x['chapter']
 applied=[]
 for b,revs in groups.items():
  path=R/'public'/m['books'][b]['url'];chs=json.loads(gzip.decompress(path.read_bytes()))
  for i,c in enumerate(chs):
   if c['id'] not in revs:continue
   rev=revs[c['id']]
   assert [w['entryId'] for w in c['words']]==[w['entryId'] for w in rev['words']],c['id']
   if b=='import-seventh-light':
    # Quiz agent authored from original narrative. Preserve its questions; newly expanded scenes do not replace existing events.
    c['paragraphs']=rev['paragraphs']
   else:chs[i]=rev;c=rev
   assert wc(c)>=500,(c['id'],wc(c));applied.append({'id':c['id'],'englishWords':wc(c)})
  raw=gzip.compress(json.dumps(chs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);fn=f'{b}-{hashlib.sha256(raw).hexdigest()[:12]}.bin';(R/'public/books'/fn).write_bytes(raw);m['books'][b]['url']='./books/'+fn
 (R/'public/content-manifest.json').write_text(json.dumps(m,separators=(',',':'))+'\n');(D/'applied.json').write_text(json.dumps(applied,ensure_ascii=False,indent=2)+'\n');print(json.dumps(applied))
if __name__=='__main__':main()
