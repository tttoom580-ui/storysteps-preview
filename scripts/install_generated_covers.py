import json,hashlib,sys
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1];mapping=json.loads(sys.stdin.read());c=json.loads((R/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'));report=[]
for b in c:
 if b['id'] not in mapping:continue
 p=Path(mapping[b['id']]);im=Image.open(p);im.load();assert im.width<im.height and im.width>=768,(b['id'],im.size)
 name=b['id']+'-20261108.webp';dest=R/'public/covers'/name
 im.convert('RGB').save(dest,'WEBP',quality=85,method=6)
 b['cover']='./covers/'+name
 report.append({'id':b['id'],'title':b['zh'],'url':b['cover'],'dimensions':[im.width,im.height],'bytes':dest.stat().st_size,'sourceSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
assert len(report)==15 and all(b.get('cover') for b in c)
(R/'public/catalog.js').write_text('window.__STORYSTEPS_CATALOG='+json.dumps(c,ensure_ascii=False,separators=(',',':'))+';\n');(R/'asset-source/cover-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Installed',len(report),'covers;',sum(r['bytes'] for r in report),'bytes total')
