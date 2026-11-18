"""Install the submitted bilingual CEO novels from their chapter payloads."""
import gzip
import hashlib
import json
import re
import statistics

from import_batch15 import LEVELS, PUB, ROOT, count

BOOKS = {
    "1a": ("冷面總裁，請先問我", "The Cold CEO Who Learned to Ask", "服裝設計師諾拉收到冷面總裁的提案。她願意合作，但每個關乎她的決定，都要先問她。"),
    "2a": ("總裁先生，請先排隊", "Mr. CEO, Please Take a Number", "設計師米拉拿著四十二號訪客牌走進北星集團，要保住老市場的公共通道。"),
    "3a": ("總裁，這份合約我不簽", "The Contract I Refused to Sign", "一份改建合約擺在艾薇面前。簽字之前，她想先找到被擱置的原始檢查報告。"),
    "4b": ("1999，總裁的心動不在合約裡", "Love Was Never in the Contract", "1999 年，知夏當場叫停香水發表會。她遇上願意聽她說完的總裁，也要守住自己的研究紀錄。"),
    "5a": ("總裁的合約，買不到我的名字", "The CEO Cannot Buy My Name", "慈善秀上，一棠翻開衣領，亮出親手繡下的縮寫。接下來的每一份合作，她都要保住設計署名。"),
    "6b": ("裴總，這份婚約不在收購清單裡", "The CEO Cannot Buy My Yes", "以寧拒絕在收購意向書上簽名。她要求留下會議紀錄，也要自己決定婚約和品牌的未來。"),
}


def register_books():
    catalog_path = PUB / "catalog.js"
    catalog = json.loads(catalog_path.read_text().split("=", 1)[1].rstrip(";\n"))
    manifest_path = PUB / "content-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    app = ROOT / "app"
    previews_path = app / "story-previews.json"
    guide_path = app / "reading-guide.json"
    samples_path = app / "reading-guide-samples.json"
    previews = json.loads(previews_path.read_text())
    guide = json.loads(guide_path.read_text())
    samples = json.loads(samples_path.read_text())
    registered = {book["id"] for book in catalog}
    added = 0

    for code, (zh, en_title, hook) in BOOKS.items():
        book_id = f"ceo-series-{code}"
        if book_id in registered:
            continue
        matches = list((PUB / "books").glob(f"{book_id}-*.bin"))
        if len(matches) != 1 or any(book["zh"] == zh for book in catalog):
            raise ValueError(f"{book_id}: expected one payload and a new title")
        payload = matches[0].read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        if matches[0].name != f"{book_id}-{digest[:12]}.bin":
            raise ValueError(f"{book_id}: payload digest mismatch")
        chapters = json.loads(gzip.decompress(payload))
        level = int(code[0])
        if len(chapters) != 25:
            raise ValueError(f"{book_id}: expected 25 chapters")

        metadata = []
        for index, chapter in enumerate(chapters, 1):
            chapter_id = chapter["id"]
            paragraphs = chapter["paragraphs"]
            prose = " ".join(para["en"] for para in paragraphs)
            metadata.append(dict(id=chapter_id, title=chapter["title"], zh=chapter["zh"],
                                 number=index, available=True, wordCount=count(prose)))
            previews.setdefault("chapters", {})[chapter_id] = paragraphs[0]["zh"][:160]
            lengths = [count(s) for s in re.split(r"(?<=[.!?])\s+", prose) if s.strip()]
            guide.setdefault("chapters", {})[chapter_id] = dict(meanSentence=round(statistics.mean(lengths), 1),
                maxSentence=max(lengths), lastScene=paragraphs[-1]["zh"][:100])

        manifest["books"][book_id] = dict(url="./books/" + matches[0].name, chapters=25)
        catalog.append(dict(id=book_id, title=en_title, zh=zh, level=LEVELS[level-1],
            vocabularyRange=code[1].upper(), genre="霸總戀愛", tags=["新作", "霸總戀愛"],
            desc=hook, hook=hook, color="#73618c", cover=f"./covers/{book_id}.webp", chapters=metadata,
            vocabularySummary=dict(referenceLevel=level, uniqueTargets=501, perChapter=20),
            learningReviewRequired=True, readable=True,
            importNote="完整 25 章英中對照與原稿語境詞表已匯入，已核對章節結構與目標詞正文形式。"))
        previews[book_id] = dict(hook=hook, intro=hook)
        sample = " ".join(chapters[0]["paragraphs"][0]["en"].split()[:65]) + "…"
        guide.setdefault("books", {})[book_id] = dict(sample=sample)
        samples.setdefault("books", {})[book_id] = dict(sample=sample)
        added += 1

    if added:
        catalog_path.write_text("window.__STORYSTEPS_CATALOG=" +
            json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n")
        previews_path.write_text(json.dumps(previews, ensure_ascii=False, indent=2) + "\n")
        for path, data in ((manifest_path, manifest), (guide_path, guide), (samples_path, samples)):
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"CEO_SERIES added={added} catalog={len(catalog)}")


if __name__ == "__main__":
    register_books()
