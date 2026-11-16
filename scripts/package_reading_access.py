"""Remove paid prose from Pages and optionally export SQL for a private D1."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public'
DIST = ROOT / 'docs'


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def sql_text(value):
    return "'" + value.replace("'", "''") + "'"


def package(private_dir):
    offer = json.loads((ROOT / 'config/reader-offer.json').read_text())
    free_books = set(offer['freeBookIds'])
    catalog = json.loads((SOURCE / 'catalog.js').read_text().split('=', 1)[1].rstrip(';\n'))
    active = {book['id'] for book in catalog if book.get('readable', True)}
    source_manifest = json.loads((SOURCE / 'content-manifest.json').read_text())
    assert set(source_manifest['books']) == active
    if private_dir:
        private_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    public_urls = set()
    paid_books = []
    for book_id, entry in source_manifest['books'].items():
        path = SOURCE / entry['url']
        chapters = json.loads(gzip.decompress(path.read_bytes()))
        limit = 25 if book_id in free_books else offer['previewChapters']
        private = entry.pop('privateChapters', 0)
        assert (len(chapters),private) in {(25,0),(limit,25-limit)}, book_id
        data = gzip.compress(compact(chapters[:limit]).encode(), mtime=0)
        url = 'books/' + book_id + '-' + hashlib.sha256(data).hexdigest()[:12] + '.bin'
        (DIST / url).write_bytes(data)
        public_urls.add(url)
        entry.update(url=url)
        for key in ('chapters', 'bytes'):
            if key in entry:
                entry[key] = limit if key == 'chapters' else len(data)
        if limit < 25:
            paid_books.append(book_id)
            if private_dir and not private:
                rows = []
                for chapter in chapters[limit:]:
                    values = ','.join(map(sql_text, (book_id, chapter['id'], compact(chapter))))
                    rows.append('INSERT INTO premium_chapters(book,id,body) VALUES (' + values +
                                ') ON CONFLICT(book,id) DO UPDATE SET body=excluded.body;')
                (private_dir / f'book-{book_id}.sql').write_text('\n'.join(rows) + '\n')
    for path in (DIST / 'books').iterdir():
        if path.is_file() and path.relative_to(DIST).as_posix() not in public_urls:
            path.unlink()
    (DIST / 'content-manifest.json').write_text(compact(source_manifest) + '\n')
    if private_dir:
        values = ','.join((sql_text(compact(sorted(paid_books))), str(offer['premium']['priceTwd']),
                           str(25 - offer['previewChapters'])))
        (private_dir / 'publish-catalog.sql').write_text(
            'INSERT INTO premium_catalog(id, books, amount, paid_chapters) VALUES (1,' + values +
            ') ON CONFLICT(id) DO UPDATE SET books=excluded.books,amount=excluded.amount,paid_chapters=excluded.paid_chapters;\n')
    print(f'Pages package contains free prose only. {len(paid_books)} books have private chapters.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--private-dir', type=Path, help='Private SQL export directory, outside docs/')
    args = parser.parse_args()
    if args.private_dir and args.private_dir.resolve().is_relative_to(DIST.resolve()):
        parser.error('Private export must be outside docs/')
    package(args.private_dir)
