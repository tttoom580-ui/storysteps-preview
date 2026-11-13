# StorySteps 全站深入校訂：實際執行進度（2026-11-14）

## 這輪已經實際編輯並提交

作品：《被改掉的那句話》（ss-r4-l3-b，25 章），只改經過原始文稿核對的部分：

| 已驗證章節 | 範圍 | 英文詞數前→後 | 目標詞 | 已核實的測驗 | 證據 |
|---|---|---:|---:|---:|---|
| 第 1 章 | 第 4 段英文與中文、兩題解釋 | 536→627 | 20/20 保留 | 2 題 | verification/r4-l3-b-ch01-bilingual-edit.json |
| 第 2 章 | 第 4 段英文與中文、兩題解釋 | 553→614 | 20/20 保留 | 2 題 | verification/r4-l3-b-ch02-bilingual-edit.json |

這些修訂將原先為塞入目標詞而堆疊的景物與事件，改成與劇本版本證據、權限與日期有關的連貫行動。兩章均已與原稿中的正確答案交叉核對，也通過 `audit_story_release.py` 的全站 82 本、2,050 章結構稽核。**這是 2 章內的局部修訂，並不等於完整校訂兩章每一個字，更不等於 25 章終稿。**

## 82 本全面校訂仍未完成

最新全庫掃描（`verification/editorial-triage-20261114.json`）：
- 82 本、2,050 章，所有章節都通過 500 英文詞、20 目標詞、兩道題目的硬性門檻。
- 12,310 組英中段落沒有完成逐段語義核對；啟發式翻譯長度檢查沒有發現明顯漏譯，不能排除錯譯或語意偏移。
- 4,100 道測驗中，3,317 題缺少規定格式、可用程式核驗的原文證據；其中這一輪**人工核對了 4 題**（並留下章節／段落證據），但仍不等於全面語意驗證完成。
- 《萬味渡口》仍有 62 組跨章重用英文長句，需整體情節性改寫。
- 全書文學／翻譯／角色連續性認證：0 本。未將任何一本虛標為「全文已校訂」。

## 後續校訂門檻

任何一本小說只有在 25 章的英語文字、自然度、故事時間軸及角色、全體英中段落逐段語意、詞表和全體測驗都核准且留有對照紀錄後，才能把 `learningReviewRequired` 改為 false 並顯示「全文已校訂」。不能僅根據自動重複句計數、字數或 2 題格式改標。

## 連結

- 公開校訂進度：https://tttoom580-ui.github.io/storysteps-preview/editorial-progress.html
- 全站稽核：https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/editorial-triage-20261114.json
- 首章修訂：https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/r4-l3-b-ch01-bilingual-edit.json
- 第二章修訂：https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/r4-l3-b-ch02-bilingual-edit.json
- GitHub Pages：https://tttoom580-ui.github.io/storysteps-preview/
