"""Validate and import five user-supplied StorySteps bilingual manuscripts.
Mechanical validation only; this does not certify language or literary quality.
Idempotent against an already imported source to protect subsequent human edits.
"""
from collections import defaultdict
from pathlib import Path
import gzip, hashlib, json, re, statistics

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "public"
SOURCE = ROOT / "incoming" / "batch12"
SPECS = [
    ("1b_theatre", "ss-r12-l1-b", "潮汐劇場的安靜掌聲", "The Quiet Applause at Tide Theater", "1B", "溫暖動物奇幻",
     "海邊劇場想重新開幕，但舞台安全、海潮與育雛鳥類都需要被尊重。",
     "水獺瑟娜與夥伴合作，把破舊海邊劇場變成安全、無障礙而安靜的社區演出空間。"),
    ("2a_starletter", "ss-r12-l2-a", "星光送不到的第七封信", "The Seventh Letter Beyond the Stars", "2A", "奇幻冒險",
     "七村訊號中斷，最遠的村莊卻從地圖上消失了。",
     "山谷信使梅與觀星學徒安循著舊地圖、燈光訊號與信件，重新建立七個村莊的聯絡。"),
    ("3a_glasswall", "ss-r12-l3-a", "玻璃海牆的第三聲", "The Third Knock Beyond the Glass", "3A", "規則懸疑",
     "水下中心的三聲敲擊究竟是鬼影，還是有人在求救？",
     "設備調查員戴寧追查失蹤觀測員，從海牆的異響和壓力紀錄重建事件真相。"),
    ("5a_gate", "ss-r12-l5-a", "潮汐之城：第十三道閘門", "The Thirteenth Gate of Saltglass", "5A", "工程懸疑",
     "第十三道閘門保護的是城市，還是把危險轉嫁給低地居民？",
     "鹽鏡城水工繪圖師艾拉發現，第十三道閘門可能阻斷低地街區最後的退水通道。"),
    ("6b_library", "ss-r12-l6-b", "山路盡頭，還有未還的書", "Beyond the Last Library Stop", "6B", "成年職場戀愛",
     "一本被漏算的借書紀錄，可能讓山區流動圖書車繼續上路。",
     "流動圖書館主任沈予晴與道路工程師許承岳重逢，共同追查漏算的借閱量與山路安全。"),
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
    report_path = ROOT / "verification/import-batch12.json"
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
                            desc=desc, hook=hook, color="#73618c", chapters=metadata,
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
        raise ValueError("Import results do not contain all five books")
    catalog_path.write_text("window.__STORYSTEPS_CATALOG="+json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))+";\n")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))+"\n")
    previews_path.write_text(json.dumps(previews, ensure_ascii=False, indent=2)+"\n")
    guide_path.write_text(json.dumps(guide, ensure_ascii=False, separators=(",", ":"))+"\n")
    samples_path.write_text(json.dumps(samples, ensure_ascii=False, separators=(",", ":"))+"\n")
    report_path.write_text(json.dumps(dict(books=len(results), chapters=125,
                    method="Mechanical structure, word counts, glossary exact forms and quiz shape; no claim of semantic/literary approval.",
                    results=results), ensure_ascii=False, indent=2)+"\n")
    print("BATCH12_IMPORT", json.dumps(dict(books=len(results), catalogTotal=len(catalog), chapters=len(catalog)*25), ensure_ascii=False))

if __name__ == "__main__":
    main()
