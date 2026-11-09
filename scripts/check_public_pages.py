from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote
import json,xml.etree.ElementTree as ET,gzip
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'docs';N=len(json.loads((D/'catalog.js').read_text().split('=',1)[1].rstrip(';\n')));BASE='https://tttoom580-ui.github.io/storysteps-preview/'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.text=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ('a','img','script','link'):
   x=a.get('href') or a.get('src')
   if x:self.links.append(x)
 def handle_data(self,data):self.text.append(data)
files=list((D/'stories').rglob('*.html'))+[D/x for x in ['index.html','library.html','about.html','privacy.html','contact.html','editorial.html']];broken=[]
for p in files:
 s=p.read_text();v=Page();v.feed(s);assert '<title>' in s and 'rel="canonical"' in s and '<h1>' in s,p
 for link in v.links:
  if not link.startswith(BASE):continue
  path=unquote(urlparse(link).path.removeprefix('/storysteps-preview/'));dest=D/path
  if path and not (dest.exists() or (dest/'index.html').exists()):broken.append((str(p.relative_to(D)),link))
assert not broken,broken[:10]
sm=ET.parse(D/'sitemap.xml');locs=[x.text for x in sm.findall('.//{*}loc')];assert len(locs)==N*6+6 and len(set(locs))==N*6+6
assert len(list((D/'stories').rglob('chapter-*.html')))==N*5
assert all('pagead2.googlesyndication.com' not in (D/x).read_text() for x in ['privacy.html','contact.html','about.html','editorial.html'])
cat=json.loads((D/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'));assert len(cat)==N and all(b.get('cover') for b in cat)
m=json.loads((D/'content-manifest.json').read_text())
for b in cat:
 assert (D/b['cover']).stat().st_size>10000;Image.open(D/b['cover']).verify();cs=json.loads(gzip.decompress((D/m['books'][b['id']]['url']).read_bytes()));assert len(cs)==25
print(f'PASS: {N*6+6} public pages; {N*5} static bilingual chapters; {N} covers and full manuscripts; all internal destinations exist; informational pages have no advertising script.')
