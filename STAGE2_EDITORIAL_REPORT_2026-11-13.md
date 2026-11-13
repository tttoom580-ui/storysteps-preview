# StorySteps 第二階段：小說品質修訂與驗收報告

日期：2026-11-13（臺灣時間）

## 本輪實際修訂

- 《星曆失落的十七分鐘》：更新 20 / 25 章；同一本書跨章重用的 **12 個英文詞以上完整句**，由 49 組降至 **0 組**。前五章原先的敘事保留，後 20 章移除可驗證的重複模板句。本輪不能宣稱全部文學、語意及中文翻譯已由人類編輯審閱。
- 《萬味渡口：與你煮一碗回家的湯》：僅安全更新第 6、11、16、21 章；62 組跨章長句樣式仍存在。其他 20 個候選章節的自動刪重會讓英文正文低於每章 500 詞，因此拒絕發布該刪除結果；保留既有正文，等待逐章重寫而不是灌水。
- 兩本合計已修動 **24 章**，移除英文跨章重複文字合計 **4,364 詞**，對應重複中文約 **7,428 字元**。只刪除可驗證的重複句，不更動原有配詞 ID、章節 ID、題目結構或其他 80 本內容。
- 主要修訂程式：`scripts/stage2_remove_recycled_prose.py`，逐章接受/拒絕及字數紀錄：`verification/stage2-20261113.json`。

## 全站自動稽核

使用既有 `scripts/audit_story_release.py`、`scripts/audit_launch.py`、`scripts/audit_content_uniqueness.py` 核對：
- **82 本、2,050 章、4,100 題、41,078 筆目標詞、12,310 組英中段落**。
- 最終英文詞數 **1,310,717**；全站結構錯誤 **0**。
- 有跨章 12 詞以上完整句重用旗標的書本：**2 → 1**。
- 有原文段落證據可機械比對的題目 **783 題**完成核對；其餘題目仍須逐題語意複核，不能假設都答對。
- 中文翻譯是否自然、是否有細微語意偏移、原創性、章節邏輯與戲劇張力，不能由結構測試完全保證。

## 尚未完成

1. 《萬味渡口》25 章需要較大規模的**情節性改寫與重新雙語翻譯**，現有跨章重複 62 組不應用機械刪字硬清。
2. 其他 **67 本**仍需要逐段情節、英文自然度、繁中翻譯、級距及測驗答案等語意校訂；既有 11 本曾進行章節改寫、2 本已有重複模板清理紀錄，也不應宣稱所有書已獲專家終稿認證。
3. 更細緻的跨書雷同與改寫式相似度、同章重複、人物名稱/事件連續性、題目「答案在正文中」需要深入編輯覆核。
4. 本輪沒有變更正式獎勵廣告或使用收費工具；保留 GitHub Pages 及 Cloudflare 免費部署架構。

## 證據與更新連結

- 公開網站：https://tttoom580-ui.github.io/storysteps-preview/
- 原始碼：https://github.com/tttoom580-ui/storysteps-preview
- 修稿報告 JSON：https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/stage2-20261113.json
- 全站結構報告：https://github.com/tttoom580-ui/storysteps-preview/blob/main/public/story-review.json
- 完整內容修訂工作流程：https://github.com/tttoom580-ui/storysteps-preview/actions/runs/43455501076
- GitHub Pages 已成功部署修訂後的兩本 gzip 書稿資源（並確認 `docs/books` 及 `docs/content-manifest.json` 更新）。
