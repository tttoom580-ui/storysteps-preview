"""Publish discovery excerpts and chapter recaps only for freely readable chapters."""
import gzip
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
offer=json.loads((root/'config/reader-offer.json').read_text())
catalog=json.loads((root/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
free=set(offer['freeBookIds'])
full_free=free-set(offer['freeAccess']['previewOnlyBookIds'])
manifest=json.loads((root/'public/content-manifest.json').read_text())
visible={chapter['id'] for book in catalog for chapter in book['chapters']
         if book['id'] in full_free or chapter['number']<=offer['previewChapters']}
for name in ('story-previews','reading-guide'):
    data=json.loads((root/f'app/{name}.json').read_text())
    data['chapters']={key:value for key,value in data['chapters'].items() if key in visible}
    if name=='story-previews':
        for book in catalog:
            book_id=book['id']
            entry=manifest['books'][book_id]
            if book_id not in free and not entry.get('privateChapters'):
                continue
            resource=root/'public'/entry['url']
            chapters=json.loads(gzip.decompress(resource.read_bytes()))
            if entry.get('privateChapters'):
                data[book_id]={'hook':book['hook'],'intro':book['desc']}
            for chapter in chapters if entry.get('privateChapters') else chapters[:1]:
                opening=chapter['paragraphs'][0]['zh']
                data['chapters'][chapter['id']]=''.join(re.findall(r'.*?[。！？](?:[」”])?|.+$',opening)[:3])
    (root/f'app/public-{name}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
