"""Register the November 19 reading previews without packaging private chapters."""
import gzip
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
public = root / 'public'
catalog_file = public / 'catalog.js'
manifest_file = public / 'content-manifest.json'
records = [record for source in sorted((root / 'config').glob('batch*-books.json'))
           for record in json.loads(source.read_text())]
catalog = json.loads(catalog_file.read_text().split('=', 1)[1].rstrip(';\n'))
manifest = json.loads(manifest_file.read_text())
known = {book['id']: book for book in catalog}
titles = {book['zh'] for book in catalog}

for record in records:
    book = record['book']
    book_id = book['id']
    cover = book.get('cover')
    if cover and not (public / cover).is_file():
        raise ValueError(f'Missing book cover: {book_id}')
    if book_id in known:
        current = known[book_id]
        if current['zh'] != book['zh'] or book_id not in manifest['books']:
            raise ValueError(f'Existing record conflicts with import: {book_id}')
        if cover and not current.get('cover'):
            current['cover'] = cover
        continue
    if book['zh'] in titles:
        raise ValueError(f'Duplicate book title: {book["zh"]}')
    entry = record['manifest']
    payload = public / entry['url']
    preview = json.loads(gzip.decompress(payload.read_bytes()))
    if len(preview) != entry['chapters'] or len(preview) + entry['privateChapters'] != len(book['chapters']):
        raise ValueError(f'Invalid preview length: {book_id}')
    if [chapter['id'] for chapter in preview] != [chapter['id'] for chapter in book['chapters'][:len(preview)]]:
        raise ValueError(f'Invalid preview chapter IDs: {book_id}')
    catalog.append(book)
    manifest['books'][book_id] = entry
    known[book_id] = book
    titles.add(book['zh'])

catalog_file.write_text('window.__STORYSTEPS_CATALOG=' + json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + ';\n')
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
