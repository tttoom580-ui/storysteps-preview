"""Validate and import six user-supplied StorySteps bilingual manuscripts.
Mechanical validation only; this does not certify language or literary quality.
Idempotent against an already imported source to protect subsequent human edits.
"""
from collections import defaultdict
from pathlib import Path
import gzip, hashlib, json, re, statistics

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "public"
SOURCE = ROOT / "incoming" / "batch15"
SPECS = [
    ('1b', 'ss-r15-l1-b', '鈴果村的百變遊戲日', 'The Many Ways to Play in Bellberry Village', '1B', '溫暖動物奇幻', '跑得快才算贏嗎？羊駝妮拉和穿山甲米洛想設計一場大家都能參加的遊戲日。', '跑得快才算贏嗎？羊駝妮拉和穿山甲米洛想設計一場大家都能參加的遊戲日。'),
    ('2b', 'ss-r15-l2-b', '借一本到明天', 'One More Book for Tomorrow', '2B', '成年校園戀愛', '舊閱覽館即將關閉，兩個大學生想用一場二手書交換節留下它。', '舊閱覽館即將關閉，兩個大學生想用一場二手書交換節留下它。'),
    ('3b', 'ss-r15-l3-b', '裂痕也能盛住光', 'The Light Inside the Cracks', '3B', '成年慢熱戀愛', '林安接手山城陶藝工坊，想做出第一件能署自己名字的作品。', '林安接手山城陶藝工坊，想做出第一件能署自己名字的作品。'),
    ('4b', 'ss-r15-l4-b', '1997，青潭泳池的第六條水道', 'The Sixth Lane at Qingtan Pool', '4B', '年代女性成長', '前游泳選手返鄉接手公共泳池，第六條水道卻成了爭議的起點。', '前游泳選手返鄉接手公共泳池，第六條水道卻成了爭議的起點。'),
    ('5b', 'ss-r15-l5-b', '不販售的黎明：夜幕劇團', 'Dawn Is Not for Sale: The Night Curtain Theatre', '5B', '雙男主奇幻冒險', '五座城鎮失去了真正的早晨，兩名劇團夥伴循著鏡陣追查原因。', '五座城鎮失去了真正的早晨，兩名劇團夥伴循著鏡陣追查原因。'),
    ('6a', 'ss-r15-l6-a', '惡女館長，不肯把歷史賣給王室', 'The Curator Who Would Not Sell the Past', '6A', '穿書權謀懸疑', '修復師穿成被控竊盜的館長，失蹤的潮星儀牽出王室博物館的入藏疑雲。', '修復師穿成被控竊盜的館長，失蹤的潮星儀牽出王室博物館的入藏疑雲。'),
]
LEVELS = ["1000以下", "1000–2000", "2000–3000", "3000–4000", "4000–5000", "5000–6000", "6000–7000"]
WC = re.compile(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*")
CLEAN = lambda s: re.sub(r"[*" + chr(96) + r"]", "", s).strip()
QHEAD = re.compile(r"(?m)^\s*(?:\*\*(?:Q)?0?([12])\.\s*(.*?)\*\*|([12])\.\s*\*\*(.*?)\*\*)\s*$")
OPTIONS = re.compile(r"(?m)^\s*(?:-\s*)?([ABC])\.\s*(.*?)\s*$")
ANSWER = re.compile(r"(?m)\*\*(?:正解|答案)[：:]\s*([ABC])[。．.]?\s*(?:繁中解析[：:]\s*)?\*\*\s*(.*?)\s*$")

def count(s):
    return len(WC.findall(s))

def present(s, phrase):
    s = s.casefold().replace("’", "'")
    phrase = phrase.casefold().replace("’", "'")
    return bool(re.search(r"(?<![a-z])" + re.escape(phrase) + r"(?![a-z])", s))

def parse(source_text, code, bid):
    parts = re.split(r"(?m)^## CHAPTER\s+", source_text)
    if len(parts) != 26:
        raise ValueError(f"{bid}: expected 25 chapter headings, got {len(parts)-1}")
    chapters, metadata, ids, seen = [], [], [], defaultdict(set)
    level = int(code[0])
    for i, part in enumerate(parts[1:], 1):
        cols = part.splitlines()[0].split("｜")
        if len(cols) != 3 or int(cols[0]) != i:
            raise ValueError(f"{bid} chapter {i}: invalid heading")
        body = part.split("### 正文與翻譯", 1)[1].split("### 本章新目標詞", 1)[0]
        pairs = re.findall(r"\*\*EN\*\*\s*(.*?)\*\*繁中\*\*\s*(.*?)(?=\*\*EN\*\*|\Z)", body, re.S)
        if not pairs or len(pairs) != body.count("**EN**") or len(pairs) != body.count("**繁中**"):
            raise ValueError(f"{bid} chapter {i}: unmatched bilingual paragraphs")
        paragraphs = [{"en": CLEAN(en), "zh": CLEAN(zh)} for en, zh in pairs]
        if any(not p["en"] or not p["zh"] for p in paragraphs):
            raise ValueError(f"{bid} chapter {i}: blank paragraph")
        english = " ".join(p["en"] for p in paragraphs)
        words_in_chapter = count(english)
        if words_in_chapter < 500:
            raise ValueError(f"{bid} chapter {i}: only {words_in_chapter} English words")
        vocab_block = part.split("### 本章新目標詞", 1)[1].split("### 理解測驗", 1)[0]
        word_list = []
        for row in vocab_block.splitlines():
            if not re.match(r"^\|\s*"+chr(96)+r"?L[1-7]-", row):
                continue
            cells = [CLEAN(x) for x in row.split("|")[1:-1]]
            if len(cells) < 6:
                raise ValueError(f"{bid} chapter {i}: malformed vocabulary row")
            entry, original, pos, form, meaning, evidence = cells[:6]
            if not form or not meaning or not present(english, form):
                raise ValueError(f"{bid} chapter {i}: absent/empty target {entry} {form!r}")
            word_list.append(dict(entryId=entry, original=original, word=form, pos=pos,
                                  meaning=meaning, referenceLevel=level, source="上傳原稿語境詞表"))
            ids.append(entry)
        if len(word_list) != (21 if i == 25 else 20):
            raise ValueError(f"{bid} chapter {i}: wrong target count {len(word_list)}")
        quiz = part.split("### 理解測驗", 1)[1].split("\n---", 1)[0]
        quiz = re.sub(r"(?m)^([12]\. [^*\n].*?)\s*$", r"**\1**", quiz)
        quiz = re.sub(r"(答案[：:][ABC]\*\*)[｜|]", r"\1 ", quiz)
        hits = list(QHEAD.finditer(quiz))
        if len(hits) != 2:
            raise ValueError(f"{bid} chapter {i}: expected two question headings, got {len(hits)}")
        questions = []
        for j, h in enumerate(hits):
            question = CLEAN(h.group(2) or h.group(4))
            rest = quiz[h.end():(hits[j+1].start() if j+1 < len(hits) else len(quiz))]
            options = OPTIONS.findall(rest)
            answer = ANSWER.search(rest)
            if [letter for letter, _ in options] != ["A", "B", "C"] or not answer:
                raise ValueError(f"{bid} chapter {i}: invalid options or answer")
            opts = [CLEAN(value) for _, value in options]
            if len(set(x.casefold() for x in opts)) != 3:
                raise ValueError(f"{bid} chapter {i}: duplicate options")
            questions.append(dict(question=question, options=opts,
                                  answer="ABC".index(answer.group(1)),
                                  explanation=CLEAN(answer.group(2))))
        if any(not q["question"] or not q["explanation"] for q in questions):
            raise ValueError(f"{bid} chapter {i}: blank quiz text")
        cid = f"{bid}-{i}"
        chapters.append(dict(id=cid, title=CLEAN(cols[1]), zh=CLEAN(cols[2]),
                             paragraphs=paragraphs, words=word_list, questions=questions))
        metadata.append(dict(id=cid, title=CLEAN(cols[1]), zh=CLEAN(cols[2]),
                             number=i, available=True, wordCount=words_in_chapter))
        for para in paragraphs:
            for sentence in re.split(r"(?<=[.!?])\s+", para["en"]):
                if count(sentence) >= 12:
                    key = " ".join(re.findall(r"[a-z]+(?:['’][a-z]+)*", sentence.casefold()))
                    seen[key].add(i)
    if len(ids) != 501 or len(set(ids)) != 501:
        raise ValueError(f"{bid}: expected 501 unique source vocabulary IDs")
    if any(not x.startswith(f"L{level}-") for x in ids):
        raise ValueError(f"{bid}: inconsistent source vocabulary level")
    return chapters, metadata, sum(len(c["paragraphs"]) for c in chapters), sum(len(x) > 1 for x in seen.values())

def main():
    catalog_path = PUB / "catalog.js"
    manifest_path = PUB / "content-manifest.json"
    catalog = json.loads(catalog_path.read_text().split("=", 1)[1].rstrip(";\n"))
    manifest = json.loads(manifest_path.read_text())
    previews_path = ROOT / "app/story-previews.json"
    guide_path = ROOT / "app/reading-guide.json"
    samples_path = ROOT / "app/reading-guide-samples.json"
    previews = json.loads(previews_path.read_text())
    guide = json.loads(guide_path.read_text())
    samples = json.loads(samples_path.read_text())
    report_path = ROOT / "verification/import-batch15.json"
    old_report = json.loads(report_path.read_text()) if report_path.exists() else {}
    old_sources = {r["id"]: r for r in old_report.get("results", [])}
    results = []
    for key, bid, zh, en_title, code, genre, hook, desc in SPECS:
        source_path = SOURCE / (key + ".md")
        source = source_path.read_text(encoding="utf-8")
        source_sha = hashlib.sha256(source.encode("utf-8")).hexdigest()
        existing = next((b for b in catalog if b["id"] == bid), None)
        if existing:
            if existing["zh"] != zh or old_sources.get(bid, {}).get("sourceSha256") != source_sha:
                raise ValueError(f"{bid}: existing book conflict, refusing overwrite")
            results.append(old_sources[bid])
            print(f"ALREADY_IMPORTED {bid}")
            continue
        if any(b["zh"] == zh for b in catalog):
            raise ValueError(f"{bid}: duplicate book title")
        chapters, metadata, pairs, repeats = parse(source, code, bid)
        payload = gzip.compress(json.dumps(chapters, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), mtime=0)
        packsha = hashlib.sha256(payload).hexdigest()
        filename = f"{bid}-{packsha[:12]}.bin"
        (PUB / "books" / filename).write_bytes(payload)
        manifest["books"][bid] = dict(url="./books/"+filename, chapters=25)
        level = int(code[0])
        catalog.append(dict(id=bid, title=en_title, zh=zh, level=LEVELS[level-1],
                            vocabularyRange=code[1], genre=genre, tags=["新作", genre],
                            desc=desc, hook=hook, color="#73618c", cover=f"./covers/{bid}.webp", chapters=metadata,
                            vocabularySummary=dict(referenceLevel=level, uniqueTargets=501, perChapter=20),
                            learningReviewRequired=True, readable=True,
                            importNote="完整25章原稿已匯入並通過結構檢查；未經逐章內容終校。"))
        previews[bid] = dict(hook=hook, intro=desc)
        guide.setdefault("books", {})[bid] = dict(sample=" ".join(chapters[0]["paragraphs"][0]["en"].split()[:65])+"…")
        samples.setdefault("books", {})[bid] = dict(sample=" ".join(chapters[0]["paragraphs"][0]["en"].split()[:65])+"…")
        for chapter in chapters:
            cid = chapter["id"]
            previews.setdefault("chapters", {})[cid] = chapter["paragraphs"][0]["zh"][:160]
            lengths = [count(s) for s in re.split(r"(?<=[.!?])\s+", " ".join(p["en"] for p in chapter["paragraphs"])) if s.strip()]
            guide.setdefault("chapters", {})[cid] = dict(meanSentence=round(statistics.mean(lengths), 1),
                      maxSentence=max(lengths), lastScene=chapter["paragraphs"][-1]["zh"][:100])
        row = dict(id=bid, title=zh, source=str(source_path.relative_to(ROOT)), sourceSha256=source_sha,
                   chapters=25, questions=50, targetEntries=501, bilingualPairs=pairs,
                   minWords=min(m["wordCount"] for m in metadata), maxWords=max(m["wordCount"] for m in metadata),
                   repeatedLongSentenceTypes=repeats, payloadSha256=packsha,
                   editoriallyCertified=False)
        results.append(row)
        print("PARSED", json.dumps(row, ensure_ascii=False))
    if len(results) != len(SPECS):
        raise ValueError("Import results do not contain all six books")
    catalog_path.write_text("window.__STORYSTEPS_CATALOG="+json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))+";\n")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))+"\n")
    previews_path.write_text(json.dumps(previews, ensure_ascii=False, indent=2)+"\n")
    guide_path.write_text(json.dumps(guide, ensure_ascii=False, separators=(",", ":"))+"\n")
    samples_path.write_text(json.dumps(samples, ensure_ascii=False, separators=(",", ":"))+"\n")
    report_path.write_text(json.dumps(dict(books=len(results), chapters=150,
                    method="Mechanical structure, word counts, glossary exact forms and quiz shape; no claim of semantic/literary approval.",
                    results=results), ensure_ascii=False, indent=2)+"\n")
    print("BATCH15_IMPORT", json.dumps(dict(books=len(results), catalogTotal=len(catalog), chapters=len(catalog)*25), ensure_ascii=False))

if __name__ == "__main__":
    main()
