"""Import the forty user supplied fourth-batch manuscripts with honest draft labels.

All source manuscripts remain in incoming/batch19. The eight Level 5 manuscripts
are short drafts; their chapter lengths and editorial status are never inflated.
"""
import gzip
import hashlib
import json
import math
import random
import re
import statistics
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / 'public'
SRC = ROOT / 'incoming' / 'batch19'
LEVELS = ['1000以下', '1000–2000', '2000–3000', '3000–4000', '4000–5000', '5000–6000']
WORD = re.compile(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*")
HEADING = re.compile(r'(?mi)^## (?:CHAPTER|Chapter) (\d{1,2})｜([^｜\n]+)(?:｜([^\n]+))?\s*$')
PAIR = re.compile(r'(?ms)^\*\*EN(?:\s+\d+)?\*\*\s*(.*?)^\*\*繁中(?:\s+\d+)?\*\*\s*(.*?)(?=^\*\*EN(?:\s+\d+)?\*\*|\Z)')
CAT = PUB / 'catalog.js'
MAN = PUB / 'content-manifest.json'

def clean(s):
    return re.sub(r'\*\*|(?<!\w)\*(?!\s)|`', '', s).strip()

def parse_questions(block):
    headings = list(re.finditer(r'(?m)^(?:\*\*Q?(\d+)\.\s*([^\n*]+)\*\*|(\d+)\.\s*\*\*([^\n*]+)\*\*|\*\*Q?(\d+)\.\s*([^\n*]+)\*\*)\s*$', block))
    out = []
    for j, h in enumerate(headings):
        q = next((v for v in (h[2], h[4], h[6]) if v), '')
        piece = block[h.end():headings[j+1].start() if j+1 < len(headings) else len(block)]
        options = re.findall(r'(?m)^\s*(?:-\s*)?([ABC])\.\s*(.*?)\s*$', piece)
        answer = re.search(r'\*\*(?:Answer|答案|正解)\s*[：:]\s*([ABC])(?:[.。．]|\s*\w*解析[：:]|\s*)', piece, re.I)
        if len(options) == 3 and [k for k,_ in options] == list('ABC') and answer:
            explanation = clean(piece[answer.end():].split('\n---',1)[0].strip(' ｜|*\n'))
            if explanation.startswith('繁中解析：') or explanation.startswith('解析：'):
                explanation = explanation.split('：',1)[1].strip()
            out.append(dict(question=clean(q), options=[clean(v) for _,v in options], answer='ABC'.index(answer[1]), explanation=explanation or '請依據本章故事內容判斷。'))
    return out

def parse(path):
    code, title_zh = path.stem.split('_',1)
    title_zh = re.sub(r'_(?:完整|全|25章).*$', '', title_zh).replace('_', '：')
    text = path.read_text(encoding='utf-8-sig')
    heads = list(HEADING.finditer(text))
    if len(heads) != 25 or [int(h[1]) for h in heads] != list(range(1,26)):
        raise ValueError(f'{path.name}: expected numbered 25 chapters; got {len(heads)}')
    preface = text[:heads[0].start()]
    title_en = next((clean(x) for x in [re.search(r'^\*\*English title:\*\*\s*(.+)$',preface,re.M),re.search(r'^\*\*英文書名：\*\*\s*(.+)$',preface,re.M)] if x for x in [x[1]]), None)
    if not title_en:
        italic = re.search(r'^\*([^*\n]*[A-Za-z][^*\n]*)\*$',preface,re.M)
        if italic: title_en=italic[1].strip()
    if not title_en:
        lines = [clean(v) for v in preface.splitlines() if v.startswith('# ') or (v.startswith('**') and v.endswith('**'))]
        title_en = next((v.removeprefix('# ').strip() for v in lines if re.search(r'[A-Za-z]{3}',v) and not re.search(r'Level|StorySteps|第四批|25章',v)), heads[0][2])
    premise = re.search(r'\*\*(?:故事簡介|故事說明|English premise)[：:]\*\*\s*(.+)',preface)
    desc = clean(premise[1])[:175] if premise else f'{title_zh}：完整 25 章英中對照故事。'
    bid = f'ss-r19-l{code.lower().replace("-", "")}'
    chapters, metadata, word_counts, quiz_counts = [], [], [], []
    for idx, h in enumerate(heads):
        part = text[h.end():heads[idx+1].start() if idx+1 < 25 else len(text)]
        body = part.split('### 正文與翻譯',1)[-1]
        body = re.split(r'(?m)^### |^\*\*本章實際英文正文詞數',body,maxsplit=1)[0]
        pairs = PAIR.findall(body)
        if not pairs:
            raise ValueError(f'{bid} chapter {idx+1}: missing bilingual prose')
        paras = [dict(en=clean(en), zh=clean(zh)) for en,zh in pairs]
        if any(not p['en'] or not p['zh'] for p in paras):
            raise ValueError(f'{bid} chapter {idx+1}: blank prose')
        n = len(WORD.findall(' '.join(p['en'] for p in paras)))
        word_counts.append(n)
        wordblock = re.split(r'(?m)^### (?:本章新目標詞|本章配詞表)[^\n]*',part,maxsplit=1)
        wordblock = re.split(r'(?m)^### 理解測驗',wordblock[1],maxsplit=1)[0] if len(wordblock)>1 else ''
        words = []
        for line in wordblock.splitlines():
            if not re.match(r'^\|\s*`?L[1-6]-\d+',line): continue
            cells = [clean(c) for c in line.split('|')[1:-1]]
            if len(cells) < 5: continue
            words.append(dict(entryId=cells[0], original=cells[1], pos=cells[2], word=cells[3], meaning=cells[4], referenceLevel=int(code[0]), source='第四批上傳原稿'))
        quizblock = re.split(r'(?m)^### 理解測驗[^\n]*',part,maxsplit=1)
        qs = parse_questions((quizblock[1] if len(quizblock)>1 else part).split('\n---',1)[0])
        quiz_counts.append(len(qs))
        cid = f'{bid}-{idx+1}'
        chapters.append(dict(id=cid,title=clean(h[2]),zh=clean(h[3] or h[2]),paragraphs=paras,words=words,questions=qs))
        metadata.append(dict(id=cid,title=clean(h[2]),zh=clean(h[3] or h[2]),number=idx+1,available=True,wordCount=n))
    return dict(id=bid,code=code,zh=title_zh,title=title_en,desc=desc,chapters=chapters,metadata=metadata,wordCounts=word_counts,quizCounts=quiz_counts,source=str(path.relative_to(ROOT)))

def cover(book):
    """Draw an individual illustrated cover; fixed seed makes rebuilds deterministic."""
    bid, title, code = book['id'], book['zh'], book['code']
    palette = {1:('#142c47','#89d6e0','#fbd77b'),3:('#172e40','#96caba','#eec68c'),4:('#261b39','#e8859f','#fed18b'),5:('#172435','#90adc6','#f5b877'),6:('#171e35','#96a9db','#deb5ed')}
    bg, light, gold = palette[int(code[0])]
    rng = random.Random(int(hashlib.sha256(bid.encode()).hexdigest()[:14],16))
    im = Image.new('RGB',(900,1350),bg)
    d = ImageDraw.Draw(im,'RGBA')
    for i in range(55):
        x,y=rng.randrange(900),rng.randrange(150,960)
        rr=rng.randrange(1,4)
        d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=(255,255,255,rng.randrange(30,115)))
    d.ellipse((125,175,775,825),outline=light,width=4)
    d.ellipse((185,235,715,765),outline=gold,width=2)
    # One clear, title-specific illustration made from a different collection of geometric forms.
    motif = rng.randrange(8)
    x,y=450,500
    if motif in (0,1):
        for a in range(7):
            rr=60+a*34
            d.arc((x-rr,y-rr,x+rr,y+rr),a*25,290+a*17,fill=light,width=5)
        d.ellipse((x-72,y-72,x+72,y+72),fill=gold)
    elif motif in (2,3):
        for i in range(8):
            a=i*math.pi/4+rng.random()*.15
            p=(x+240*math.cos(a),y+240*math.sin(a))
            d.line((x,y,*p),fill=light,width=9)
            d.ellipse((p[0]-22,p[1]-22,p[0]+22,p[1]+22),fill=gold)
        d.ellipse((x-95,y-95,x+95,y+95),fill=bg,outline=gold,width=12)
    elif motif in (4,5):
        for i in range(7):
            off=i*28
            d.polygon([(x,y-210+off),(x+210-off,y),(x,y+210-off),(x-210+off,y)],outline=light if i%2 else gold,width=5)
    else:
        for i in range(8):
            yy=300+i*46
            d.arc((190,yy,710,yy+290),10+i*12,175+i*5,fill=gold if i%2 else light,width=6)
        d.ellipse((x-65,y-65,x+65,y+65),fill=gold)
    # Additional title symbols distinguish covers even when the geometric family repeats.
    symbols = '✦◉◇✳✣✶⊕◈'
    font_symbol=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',92)
    d.text((450,490),symbols[rng.randrange(len(symbols))],font=font_symbol,fill=bg,anchor='mm')
    d.rounded_rectangle((58,842,842,1277),radius=16,fill=(12,21,36,245),outline=light,width=2)
    font_brand=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',30)
    font_title=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',58)
    font_small=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',26)
    d.text((89,882),'拾頁  STORYSTEPS',font=font_brand,fill=light)
    # Wrap CJK by rendered pixel width to protect long titles.
    rows=['']
    for ch in title:
        if d.textlength(rows[-1]+ch,font=font_title)>715: rows.append('')
        rows[-1]+=ch
    if len(rows)>3:
        font_title=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',48)
        rows=['']
        for ch in title:
            if d.textlength(rows[-1]+ch,font=font_title)>715: rows.append('')
            rows[-1]+=ch
    for i,row in enumerate(rows):d.text((90,953+i*72),row,font=font_title,fill='white')
    d.text((91,1220),f'LEVEL {code[0]}  ·  {code[1]}  /  25 CHAPTERS',font=font_small,fill=gold)
    out=PUB/'covers'/f'{bid}.webp'
    im.save(out,'WEBP',quality=87,method=6)
    return out

def main():
    sources=sorted(SRC.glob('*.md'))
    if len(sources)!=40:raise ValueError(f'expected 40 sources, found {len(sources)}')
    books=[parse(p) for p in sources]
    cat=json.loads(CAT.read_text().split('=',1)[1].rstrip(';\n'))
    manifest=json.loads(MAN.read_text())
    previews_path=ROOT/'app/story-previews.json';guide_path=ROOT/'app/reading-guide.json'
    previews=json.loads(previews_path.read_text());guide=json.loads(guide_path.read_text())
    report=[]
    existing={b['id'] for b in cat}
    for b in books:
        bid=b['id']
        if bid in existing:
            if not any(v['id']==bid and v['zh']==b['zh'] for v in cat):raise ValueError(f'conflicting ID {bid}')
            continue
        if any(v['zh']==b['zh'] for v in cat):raise ValueError(f'duplicate title {b["zh"]}')
        path=cover(b)
        raw=gzip.compress(json.dumps(b['chapters'],ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
        digest=hashlib.sha256(raw).hexdigest()
        payload=PUB/'books'/f'{bid}-{digest[:12]}.bin';payload.write_bytes(raw)
        manifest['books'][bid]=dict(url='./books/'+payload.name,chapters=25)
        draft=b['code'].startswith('5')
        note=('雙語精簡故事初稿；第 2–25 章未達每章 500 詞，配詞未全部融入正文，閱讀題待校訂。' if draft else
              '25 章英中對照教學初稿；尚待人工語言、翻譯與情節校訂。')
        genre=('雙語精簡稿・待擴寫' if draft else '雙語教學初稿')
        cat.append(dict(id=bid,title=b['title'],zh=b['zh'],level=LEVELS[int(b['code'][0])-1],vocabularyRange=b['code'][1],genre=genre,tags=['第四批',genre],desc=b['desc'],hook=b['desc'],color='#26364b',cover='./covers/'+path.name,chapters=b['metadata'],vocabularySummary=dict(referenceLevel=int(b['code'][0]),uniqueTargets=len({w['entryId'] for c in b['chapters'] for w in c['words']}),perChapter=20),learningReviewRequired=True,readable=True,importNote=note,manuscriptStatus='abridged_draft' if draft else 'teaching_draft'))
        previews[bid]=dict(hook=b['desc'],intro=note+' '+b['desc'])
        guide.setdefault('books',{})[bid]=dict(sample=' '.join(b['chapters'][0]['paragraphs'][0]['en'].split()[:65])+'…')
        for c in b['chapters']:
            previews.setdefault('chapters',{})[c['id']]=c['paragraphs'][0]['zh'][:160]
            english=' '.join(p['en'] for p in c['paragraphs'])
            lengths=[len(WORD.findall(s)) for s in re.split(r'(?<=[.!?])\s+',english) if s.strip()]
            guide.setdefault('chapters',{})[c['id']]=dict(meanSentence=round(statistics.mean(lengths),1),maxSentence=max(lengths),lastScene=c['paragraphs'][-1]['zh'][:100])
        report.append(dict(id=bid,title=b['zh'],source=b['source'],chapters=25,minWords=min(b['wordCounts']),maxWords=max(b['wordCounts']),questions=sum(b['quizCounts']),cover=str(path.relative_to(ROOT)),coverBytes=path.stat().st_size,status='待擴寫精簡稿' if draft else '待人工校訂教學初稿',payloadSha256=digest))
    CAT.write_text('window.__STORYSTEPS_CATALOG='+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n')
    MAN.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    previews_path.write_text(json.dumps(previews,ensure_ascii=False,indent=2)+'\n')
    guide_path.write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':'))+'\n')
    (ROOT/'verification/import-batch19.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'imported {len(report)} books, {25*len(report)} chapters, {len(report)} unique covers; catalog={len(cat)}')

if __name__=='__main__':main()
