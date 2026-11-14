"""Conservative, evidence-first Level 1 editorial sweep.

Read every published Level 1 volume directly from the manifest, validate all
chapters/paragraphs/words/questions, and apply only five manually specified
bilingual prose corrections. No machine test asserts semantic editorial approval.
"""
from pathlib import Path
from collections import Counter, defaultdict
import gzip, hashlib, html, json, re
from datetime import date

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/"public"
OUT=ROOT/"verification/level1"
OUT.mkdir(parents=True,exist_ok=True)
CAT_PATH=PUB/"catalog.js"
MAN_PATH=PUB/"content-manifest.json"
CAT=json.loads(CAT_PATH.read_text(encoding="utf-8").split("=",1)[1].rstrip(";\n"))
MAN=json.loads(MAN_PATH.read_text(encoding="utf-8"))
LEVEL=[b for b in CAT if b["level"]=="1000以下"]
assert len(LEVEL)==15, f"Level 1 count changed: {len(LEVEL)}; review scope before re-running"
assert all(len(b["chapters"])==25 for b in LEVEL)
EN_WORDS=lambda s:re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*",s)
norm=lambda s:" ".join(re.findall(r"[a-z]+(?:['’][a-z]+)*",s.casefold()))
han=lambda s:len(re.findall(r"[\u3400-\u9fff]",s))
def target_present(txt,word):
    txt=txt.lower().replace("’","'").replace("‘","'")
    word=word.lower().replace("’","'").replace("‘","'")
    return bool(re.search(r"(?<![a-z])"+re.escape(word)+r"(?![a-z])",txt))

# Each pair below was drafted after reading the original first chapter's English
# AND Traditional Chinese paragraph. Only the exact cited fragment may change.
REVISIONS=[
dict(book="ss-r5-l1-b",chapter=1,paragraph=1,reason="Connect incidental vocabulary (bug, quiet place) to the accessibility goal instead of unrelated scenery",
old_en="A small bug rested on the wall while Sela watched the fair from a quiet place.",
new_en="A small bug crawled along the empty wall of the hall. Sela wondered whether this corner could become a quiet place for neighbors who needed a break.",
old_zh="塞拉在安靜處看節慶時，一隻小蟲停在牆上。",
new_zh="一隻小蟲沿著廳堂空白的牆面慢慢爬行。塞拉想，也許這個角落能成為需要休息的鄰居暫時避開喧鬧的地方。"),
dict(book="ss-r4-l1-b",chapter=1,paragraph=1,reason="Remove an inexplicable reaction and make the warning sign causally connected to bridge damage",
old_en="A little bug went into the crack. Nia did not laugh. She took a camera from her bag and made a picture.",
new_en="A little bug slipped through the crack. Nia knelt to look more closely; the gap was wider than she had thought. Worried that the board was splitting, she took a camera from her bag and photographed the damage.",
old_zh="一隻小蟲鑽進裂縫。妮亞沒有笑，她從袋子裡拿出相機拍了照片。",
new_zh="一隻小蟲鑽進裂縫。妮亞蹲下來仔細查看，發現裂縫比想像中更寬。她擔心木板正在裂開，便從袋子裡拿出相機，拍下損壞的地方。"),
dict(book="ss-r7-l1-b",chapter=1,paragraph=1,reason="Make the insect observation part of the seasonal mystery, not a disconnected target-word insertion",
old_en="A small bug moved across the window. She opened it and listened, but there were no bird calls.",
new_en="A small bug crept along the cold window. Tavi wondered why it had appeared so early. She opened the window and listened for the birds that usually returned before spring, but heard none.",
old_zh="一隻小蟲爬過窗戶。她打開窗戶聽，卻聽不見鳥叫聲。",
new_zh="一隻小蟲沿著冰冷的窗戶緩緩爬行。塔薇不明白牠為何這麼早就出現。她打開窗戶，想聽聽通常在春天前回來的鳥兒，卻一聲鳥鳴也沒聽見。"),
dict(book="ss-r10-l1-a",chapter=1,paragraph=1,reason="Resolve location/time jump from walking down the street back to breakfast outside the apartment",
old_en="At 7 a.m., Nia walked along Red Brick Street with a heavy bag on her shoulder. She was early for her new job.",
new_en="At 7 a.m., Nia stood outside her apartment on Red Brick Street, her heavy teaching bag resting beside the breakfast table. She was early for her first class and had plenty of time to prepare.",
old_zh="早上七點，妮雅背著沉重的袋子走過紅磚街。她提早出門，準備迎接新工作。",
new_zh="早上七點，妮雅站在紅磚街的公寓外，沉重的教學袋放在早餐桌旁。距離第一堂課還有充裕的時間。"),
dict(book="ss-r10-l1-a",chapter=1,paragraph=1,reason="Continue the same breakfast scene before she departs",
old_en="She stopped for breakfast at a small table outside her apartment.",
new_en="Before leaving, she sat down to finish her breakfast.",
old_zh="她先在公寓外的小桌旁吃早餐",
new_zh="出發前，她坐下來吃完早餐"),
dict(book="ss-r6-l1-a",chapter=1,paragraph=-1,reason="Fix contradictory statement: first chapter starts with one name; teammates and helpers later arrive",
old_en="Tess had come expecting a full team and found only one person. She went home with a smaller hope, but it was a real one.",
new_en="Tess had arrived with only her own name on the list. Now Ben had written the next meeting time, and June was still smiling by the door. They did not have seven players yet, but she no longer had to make the plan alone.",
old_zh="泰絲原以為可以找到整支隊伍，結果只遇到一個人。她帶著較小的希望回家，但那份希望是真實的。",
new_zh="泰絲來時，名單上只有她自己的名字。如今班已寫下下次集合時間，瓊還在門邊微笑。他們還湊不滿七位球員，但她終於不必獨自籌畫了。"),
dict(book="ss-r2-l1-b",chapter=1,paragraph=1,reason="Replace unnatural imagery with sensory details related to the planned breakfast shop",
old_en="She could already see warm bread by the window and friends at one long table.",
new_en="She could almost smell warm bread cooling by the window and hear friends talking around one long table.",
old_zh="她彷彿已看見窗邊的溫麵包，以及圍著長桌坐下的朋友。",
new_zh="她彷彿聞到窗邊麵包出爐的香氣，也聽見朋友們圍著長桌聊天。"),
]
for r in REVISIONS:
    assert r["book"] in {b["id"] for b in LEVEL}
changes=[];blocked=[];books=[];chapters_summary=[];total=Counter()
revisions_by_book=defaultdict(list)
for r in REVISIONS:revisions_by_book[r["book"]].append(r)
for book in LEVEL:
    bid=book["id"]
    manifest_entry=MAN["books"][bid]
    source_path=PUB/manifest_entry["url"]
    source=json.loads(gzip.decompress(source_path.read_bytes()))
    assert len(source)==25,(bid,len(source))
    local_changes=[]
    for edit in revisions_by_book[bid]:
        chapter=source[edit["chapter"]-1]
        pi=edit["paragraph"]-1 if edit["paragraph"]>0 else edit["paragraph"]
        p=chapter["paragraphs"][pi]
        old_match=(edit["old_en"] in p["en"] and edit["old_zh"] in p["zh"])
        new_match=(edit["new_en"] in p["en"] and edit["new_zh"] in p["zh"])
        if new_match:
            continue
        if not old_match:
            blocked.append({"book":bid,"chapter":chapter["id"],"paragraph":pi+1,"reason":"Source fragments differ from reviewed draft"})
            continue
        previous=(p["en"],p["zh"])
        p["en"]=p["en"].replace(edit["old_en"],edit["new_en"],1)
        p["zh"]=p["zh"].replace(edit["old_zh"],edit["new_zh"],1)
        # Don't publish changes that invalidate any previously cited test evidence.
        stale=False
        for q in chapter["questions"]:
            if "原文證據：" in q.get("explanation",""):
                evidence=q["explanation"].split("原文證據：",1)[1].split("\n本段對照：")[0]
                match=re.search(r"第 (\d+) 段",q["question"])
                if match and int(match[1])-1==pi and norm(evidence) not in norm(p["en"]):
                    stale=True
        if stale:
            p["en"],p["zh"]=previous
            blocked.append({"book":bid,"chapter":chapter["id"],"paragraph":pi+1,"reason":"Existing question evidence would be invalidated; edit not published"})
            continue
        book["chapters"][edit["chapter"]-1]["wordCount"]=len(EN_WORDS(" ".join(qp["en"] for qp in chapter["paragraphs"])))
        local_changes.append({"book":bid,"chapter":chapter["id"],"paragraph":pi+1,"reason":edit["reason"],
                              "before":{ "en":edit["old_en"],"zh":edit["old_zh"] },
                              "after":{ "en":edit["new_en"],"zh":edit["new_zh"] },
                              "status":"BILINGUAL_PROSE_REVISED_REQUIRES_WHOLE_CHAPTER_REVIEW"})
    if local_changes:
        data=json.dumps(source,ensure_ascii=False,separators=(",",":")).encode("utf-8")
        binary=gzip.compress(data,compresslevel=9,mtime=0)
        digest=hashlib.sha256(binary).hexdigest()[:12]
        new_url=f"./books/{bid}-{digest}.bin"
        (PUB/"books"/f"{bid}-{digest}.bin").write_bytes(binary)
        MAN["books"][bid]["url"]=new_url
        local_changes[0]["newPayload"]=new_url
        changes+=local_changes
    repeated=defaultdict(set)
    book_summary={"id":bid,"title":book["zh"],"chapters":len(source),"revisedPassages":len(local_changes),
                  "minWords":None,"minTargets":None,"uncitedQuizzes":0,"crossChapterSentencePatterns":0,
                  "chaptersWithPossibleTranslationLengthAnomaly":0,"chaptersWithUnverifiedQuizAnswers":0,"chapterReports":[]}
    for idx,chapter in enumerate(source):
        txt=" ".join(p["en"] for p in chapter["paragraphs"])
        wc=len(EN_WORDS(txt))
        targets=len(chapter["words"])
        missing=[w["word"] for w in chapter["words"] if not target_present(txt,w["word"])]
        short_translation=[]
        for pi,p in enumerate(chapter["paragraphs"],1):
            e=len(EN_WORDS(p["en"]));z=han(p["zh"])
            if (e>=45 and z<15) or (e>=60 and z/e<0.45):
                short_translation.append(pi)
            for sentence in re.split(r"(?<=[.!?])\s+",p["en"]):
                if len(EN_WORDS(sentence))>=12:
                    repeated[norm(sentence)].add(chapter["id"])
        invalid=[]
        unverified=[]
        for qi,q in enumerate(chapter["questions"],1):
            if not isinstance(q.get("answer"),int) or not 0<=q["answer"]<len(q["options"]):
                invalid.append(qi)
            if "原文證據：" not in q.get("explanation",""):
                unverified.append(qi)
        issues=[]
        if wc<500:issues.append("under_500_words")
        if targets<20:issues.append("under_20_targets")
        if missing:issues.append("targets_missing_in_prose")
        if invalid:issues.append("invalid_question_index")
        if short_translation:issues.append("translation_length_review_candidate")
        row={"id":chapter["id"],"number":idx+1,"title":chapter["zh"],"englishWords":wc,
             "targetCount":targets,"missingTargetWords":missing,"bilingualParagraphs":len(chapter["paragraphs"]),
             "quizCount":len(chapter["questions"]),"quizzesWithoutOriginalEvidence":unverified,
             "possibleShortChineseTranslationParagraphs":short_translation,
             "issues":issues,"allGatesApproved":False,
             "sceneOpeningEn":chapter["paragraphs"][0]["en"][:400],
             "sceneClosingEn":chapter["paragraphs"][-1]["en"][-380:]}
        book_summary["chapterReports"].append(row)
        chapters_summary.append({"book":bid,**{k:v for k,v in row.items() if k not in ("sceneOpeningEn","sceneClosingEn")}})
        total.update(chapters=1,englishWords=wc,targets=targets,quizzes=len(chapter["questions"]),
                     bilingualParagraphs=len(chapter["paragraphs"]),quizEvidencePending=len(unverified),
                     questionableTranslationLength=bool(short_translation))
        book_summary["uncitedQuizzes"]+=len(unverified)
        book_summary["minWords"]=min(book_summary["minWords"] or wc,wc)
        book_summary["minTargets"]=min(book_summary["minTargets"] or targets,targets)
        book_summary["chaptersWithPossibleTranslationLengthAnomaly"]+=bool(short_translation)
        book_summary["chaptersWithUnverifiedQuizAnswers"]+=bool(unverified)
    book_summary["crossChapterSentencePatterns"]=sum(len(ids)>1 for ids in repeated.values())
    books.append(book_summary)
if blocked:
    # Conservative: blocked passages are recorded; other safe edits can still publish.
    print("LEVEL1_EDIT_BLOCKS",json.dumps(blocked,ensure_ascii=False))
summary={"level":1,"books":len(books),"chapters":total["chapters"],"englishWords":total["englishWords"],
         "bilingualParagraphs":total["bilingualParagraphs"],"targetEntries":total["targets"],
         "quizzes":total["quizzes"],"uncitedQuizzes":total["quizEvidencePending"],
         "chaptersWithPossibleTranslationLengthAnomaly":total["questionableTranslationLength"],
         "booksWithRepeated12WordSentence":sum(b["crossChapterSentencePatterns"]>0 for b in books),
         "chaptersUnder500":sum(x["englishWords"]<500 for x in chapters_summary),
         "chaptersUnder20":sum(x["targetCount"]<20 for x in chapters_summary),
         "chaptersWithMissingTargets":sum(bool(x["missingTargetWords"]) for x in chapters_summary),
         "bilingualPassagesRevised":len(changes),"editsSkipped":len(blocked),"fullyCertifiedBooks":0}
report={"generated":"2026-11-14","scope":"Every published level-1 chapter screened; only manually specified bilingual changes applied. Machine screening is NOT scene-by-scene or paragraph-by-paragraph semantic certification.",
        "summary":summary,"books":books,"changes":changes,"blockedChanges":blocked}
(OUT/"level1-review-20261114.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
MAN_PATH.write_text(json.dumps(MAN,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
CAT_PATH.write_text("window.__STORYSTEPS_CATALOG="+json.dumps(CAT,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
from html import escape as esc
rows="".join("<tr><td>"+esc(b["title"])+"</td><td>"+str(b["minWords"])+"</td><td>"+
             str(b["revisedPassages"])+"</td><td>"+str(b["uncitedQuizzes"])+
             "</td><td>逐章／逐段語意驗收未完成</td></tr>" for b in books)
page=f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第 1 級校訂進度｜StorySteps</title><link rel="stylesheet" href="./public-reading.css"><style>table{{width:100%;border-collapse:collapse}}td,th{{padding:.7em;border-bottom:1px solid #8886;text-align:left}}.scroll{{overflow:auto}}</style></head><body><header><a href="./">← StorySteps 首頁</a><nav><a href="./editorial-progress.html">全站校訂進度</a></nav></header><main><h1>第 1 級｜15 本小說校訂紀錄</h1><p><strong>本次已掃描 375 章，實際雙語段落修訂 {len(changes)} 處；全文五關通過 0 本。</strong></p><p>章節字數、詞彙及測驗結構均有逐章機械檢查；英中語義、角色與事件時間線、答案正確性仍需逐段審閱，不應將本報告當成正式文學校訂認證。</p><div class="scroll"><table><thead><tr><th>作品</th><th>最短章英文詞</th><th>本輪局部修訂</th><th>尚缺明確原文證據的題目</th><th>驗收狀態</th></tr></thead><tbody>{rows}</tbody></table></div><p>校訂證據：<a href="https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/level1/level1-review-20261114.json">逐章稽核與修訂紀錄</a></p></main></body></html>'''
(PUB/"level1-editorial-progress.html").write_text(page,encoding="utf-8")
print("LEVEL1_EDITORIAL_REPORT",json.dumps(summary,ensure_ascii=False))
