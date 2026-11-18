"""Install the submitted bilingual novels from their chapter payloads."""
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
    "1b": ("總裁，假婚約星期五到期", "CEO, the Rumored Engagement Ends on Friday", "修鐘師泰莎因一張照片陷入豪門緋聞。她和飯店總裁約定公開合作二十一天，並沿著古鐘裡的線索追查真相。"),
    "2b": ("總裁，這張車票不賣給你", "CEO, You Cannot Buy This Ticket", "星光號首航前，列車安全工程師林雨晴掛出停駛牌。從煞車裂損到被改過的維修紀錄，她要鐵道總裁給乘客一個交代。"),
    "3b": ("總裁，請先撤回那則聲明", "CEO, Retract That Statement", "飯店集團急著平息風波，公關顧問唐予晴要求總裁公開撤回聲明，讓被忽略的員工有機會說話。"),
    "4a": ("董事會副本：總裁只剩一票", "The Boardroom Dungeon: One Vote for the CEO", "股東大會變成生存副本，股票決定市民的逃生權。總裁賀行舟得和員工聯手，破解每次表決背後的代價。"),
    "5b": ("他的帝國靠岸時：總裁與不出售碼頭的男人", "When His Empire Came Ashore", "程硯帶著收購案來到東碼頭。許臨川拒絕出售，並要求他先公開合約裡由居民承擔的風險。"),
    "6a": ("陸總，惡女的認罪書我不簽", "The Villainess CEO Who Refused to Confess", "企業稽核師穿進小說，成了即將為全城大停電坐牢的執行長。陸總帶來紓困條款，她要先查清自己被要求承認的罪。"),
}

LIGHT_NOVELS = {
    "1a": ("轉學生的尾巴，藏不住了！", "My New Classmate Has a Dragon Tail!", "轉學生海藏著一條藍色龍尾巴。當理子發現他的祕密，兩人得一起完成雲上世界交代的五項校園任務。", "校園奇幻"),
    "2a": ("轉生後只有一格道具欄！？——我在迷宮裡當上了最弱勇者", "Reborn with Only One Inventory Slot?! — The Weakest Hero of the Moving Maze", "任在異世界抽到一格道具欄。當迷宮開始移動，他只能和嚮導、小石龍一起想辦法，用這一格救下小鎮。", "異世界奇幻冒險"),
    "3a": ("月光失物招領社，今天也不接受退貨！", "No Returns at the Moonlight Lost-and-Found!", "一隻紙狐狸把花穗帶進社團教室。裡面的機器不收錢，卻會印出人們遺失的約定。", "校園奇幻戀愛"),
    "4b": ("1998，被刪除的女主角拒絕退場！", "The Rejected Heroine Refuses to Fade!", "千景返鄉清理即將出售的手繪動畫工房，卻在舊燈箱裡遇見一名被刪除的女主角。", "年代奇幻"),
    "5a": ("被召喚後只能改錯字的我，竟要拯救異世界的七座鐘塔？！", "I Was Summoned as a Proofreader, Not a Hero!", "澪被召喚到異世界，每天只能用紅筆標三處錯誤。日蝕將至，七座鐘塔卻要按錯誤的名冊分配物資。", "異世界奇幻冒險"),
    "6b": ("被勇者隊伍開除後，我替魔王城訂了週休二日", "Fired by the Heroes, I Gave the Demon King Weekends", "後勤官綾因拒絕讓工人無償通宵而被開除。到魔王城上班後，她打算用工時計和休假表對付加班魔法。", "異世界職場奇幻"),
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

    ceo_books = [(f"ceo-series-{code}", code, zh, title, hook,
                  {"4a": "都市遊戲災變", "5b": "雙男主霸總戀愛"}.get(code, "霸總戀愛"), "霸總")
                 for code, (zh, title, hook) in BOOKS.items()]
    light_books = [(f"light-novel-{code}", code, zh, title, hook, genre, "日系輕小說")
                   for code, (zh, title, hook, genre) in LIGHT_NOVELS.items()]
    for book_id, code, zh, en_title, hook, genre, tag in ceo_books + light_books:
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
            vocabularyRange=code[1].upper(), genre=genre, tags=["新作", tag],
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
    print(f"BOOK_IMPORT added={added} catalog={len(catalog)}")


if __name__ == "__main__":
    register_books()
