"""Prepare the already published StorySteps build for Cloudflare Pages."""
import argparse
import gzip
import json
import re
import shutil
from pathlib import Path

OLD_SITE = 'https://tttoom580-ui.github.io/storysteps-preview/'
ROUTES = ('contact', 'library', 'plans', 'privacy')

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('target', type=Path, help='A new directory for the Pages deployment')
parser.add_argument('--site', required=True, help='Production Pages hostname')
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9-]+\.pages\.dev', args.site):
    parser.error('Expected a pages.dev hostname')

source = Path(__file__).resolve().parents[1] / 'docs'
target = args.target.resolve()
if target.is_relative_to(source) or source.is_relative_to(target) or target.exists():
    parser.error('Choose a new output directory outside docs')
base_url = 'https://' + args.site + '/'
manifest = json.loads((source / 'content-manifest.json').read_text())['books']
reader_offer = json.loads((source.parent / 'config/reader-offer.json').read_text())
free_books = set(reader_offer['freeBookIds'])
full_free = free_books - set(reader_offer['freeAccess']['previewOnlyBookIds'])
for book_id, book in manifest.items():
    chapter_limit = 25 if book_id in full_free else reader_offer['previewChapters']
    chapters = json.loads(gzip.decompress((source / book['url']).read_bytes()))
    if len(chapters) != chapter_limit or len(chapters) != book['chapters']:
        raise ValueError(f'Unexpected public chapter count for {book_id}')
    chapter_files = list((source / 'stories' / book_id).glob('chapter-*.html'))
    expected_files = {f'chapter-{number}.html' for number in range(1, chapter_limit + 1)}
    if {path.name for path in chapter_files} != expected_files:
        raise ValueError(f'Unexpected public reading pages for {book_id}')
for route in ROUTES:
    if not (source / f'{route}.html').is_file():
        raise ValueError(f'Missing public page: {route}')

shutil.copytree(source, target, ignore=shutil.ignore_patterns('.nojekyll', 'CNAME'))
# Pages serves clean HTML routes; use them for links, sitemaps and canonical URLs.
for path in target.rglob('*'):
    if path.is_file() and path.suffix in {'.html', '.xml', '.txt', '.json'}:
        before = path.read_text(encoding='utf-8')
        after = before.replace(OLD_SITE, base_url)
        after = re.sub(re.escape(base_url) + r'([^"\s<>?#]*?)index\.html(?=["\s<>?#]|$)',
                       lambda match: base_url + match[1], after)
        after = re.sub(re.escape(base_url) + r'([^"\s<>?#]+)\.html(?=["\s<>?#]|$)',
                       lambda match: base_url + match[1], after)
        if after != before:
            path.write_text(after, encoding='utf-8')

# Explicit 404 keeps unknown URLs from falling through to the app home.
if not (target / '404.html').exists():
    (target / '404.html').write_text(
        '<!doctype html><html lang="zh-Hant"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>找不到頁面｜拾頁 StorySteps</title><link rel="stylesheet" href="/public-reading.css">'
        '<main><h1>找不到這個頁面</h1><p><a href="/">返回拾頁首頁</a></p>'
        '<p><a href="/library">瀏覽書城</a></p></main></html>\n',
        encoding='utf-8',
    )
print(f'Prepared {len(manifest)} public books for {base_url}')
