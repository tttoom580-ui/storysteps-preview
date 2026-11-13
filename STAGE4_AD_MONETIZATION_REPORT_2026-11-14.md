# StorySteps 第四階段：廣告營收安全準備與驗收

更新日期：2026-11-14（臺灣時間）

## 已實際處理

1. **Google AdSense 識別與 ads.txt：** 保留原有 `ca-pub-9154967510584289` 驗證中繼資料；公開專案及同帳號的 GitHub Pages 根站儲存庫均有 `ads.txt`，內容為 `google.com, pub-9154967510584289, DIRECT, f08c47fec0942fa0`。這不等於 AdSense 已審核通過。
2. **防止未明確同意即載入廣告：** 移除互動首頁 `index.html` 原本的自動 AdSense SDK；公開靜態頁生成器預設不輸出 Google 廣告追蹤腳本。保留驗證中繼資料。展示廣告由 `display-ad-config.json` 決定，預設 disabled，只有實際有效的廣告單元、明確啟用與讀者選擇允許時才會載入。
3. **安全獎勵廣告入口：** `rewarded-config.json` 仍為 `enabled: false`、`adUnitPath: ""`，不捏造廣告單元。程式只有在讀者主動點擊後才嘗試載入 Google Publisher Tag SDK。若廣告空白、不支援、逾時、提早關閉或沒有 `rewardedSlotGranted` 事件，絕不將其當成「已獲得廣告獎勵」。
4. **維持免費備案：** 即使日後廣告正式啟用，也會提供「不觀看廣告，免費解鎖 4 章」，不強迫點擊廣告。當設定檔或網路失敗時保留免廣告解鎖。支援前 5 章直接讀，其餘以 4 章為一組。
5. **避免重複授權：** 連續點擊廣告按鈕時鎖定該次操作；重複的同一書／同一 4 章區段不會增加第二筆本機解鎖紀錄。程式事件只記錄本機操作，不代表已收到平台可計費驗證。伺服器端防作弊、平台伺服器簽章與經營者收益核對仍未建立。
6. **隱私政策：** 更新廣告開關、同意與資料流向說明，避免把已存在的驗證碼誤稱為廣告收入或正式核准。
7. **無額外付費：** 使用 GitHub Pages、既有 Workers/D1 免費方案及原本程式碼，不新增付費服務。

## 已驗證

- 以 `verification/ad-policy-smoke.mjs` 檢查預設未啟用廣告、不在首頁預載 SDK、5+4 章區段和重複授權不增加紀錄。
- 以 `verification/browser-smoke.mjs` 在桌面及 iPhone 13 模擬尺寸檢查：沒有廣告時解鎖第 6–9 章、同一組只有一筆紀錄、後續章節可讀、沒有無同意向 Google 廣告 SDK 發送載入請求。
- 既有小說、深色模式、同步與 Cloudflare D1 API 測試也保留。
- GitHub Actions 成功記錄：https://github.com/tttoom580-ui/storysteps-preview/actions/runs/43464672003

## 明確未完成（非程式碼自動測試可代替）

- **Google AdSense 網站審核狀態、付款與正式廣告單元：** 未取得可確認的 Google 帳戶審核結果，無法宣稱有收入、填入真實獎勵廣告單元或啟用廣告。
- **AdSense Offerwall / Google Ad Manager：** 請從對應 Google 廣告管理帳戶完成資格審核、內容存取設定、廣告單元和隱私政策檢核；兩者不可假設相同。
- **未成年人與地區同意：** 現有簡單按鈕不是所有司法管轄區都適用的認證同意管理平台（CMP）；正式啟用前應查核平台政策、年齡限制及應用地區。
- **真實觀看驗證和營收：** 本輪測試未投放真廣告、未計算廣告收益；客戶端事件和本機進度不能作為可計費憑證。
- **實機測試：** 真實 iOS Safari、Android Chrome、LINE 內建瀏覽器，以及阻擋廣告與弱網情況需要後續測試。

## 入口

- 公開網站：https://tttoom580-ui.github.io/storysteps-preview/
- 原始碼：https://github.com/tttoom580-ui/storysteps-preview
- 獎勵廣告配置：https://github.com/tttoom580-ui/storysteps-preview/blob/main/public/rewarded-config.json
- 展示廣告配置：https://github.com/tttoom580-ui/storysteps-preview/blob/main/public/display-ad-config.json
- 免費解鎖與獎勵 SDK：https://github.com/tttoom580-ui/storysteps-preview/blob/main/app/reading-access.ts
- 前端廣告入口：https://github.com/tttoom580-ui/storysteps-preview/blob/main/app/rewarded.tsx
- 測試：https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/ad-policy-smoke.mjs
