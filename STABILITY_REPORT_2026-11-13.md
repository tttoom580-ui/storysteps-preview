# StorySteps 第一階段穩定化驗證紀錄

更新：2026-11-13（臺灣時間）。本階段保留 GitHub Pages、Cloudflare Workers / D1 免費方案，不搬遷或覆蓋小說資料。

## 已處理

1. 修正手機底部導覽「閱讀」與桌面「閱讀中心」測試選擇器不同而造成的逾時。修正測試過程的預覽程序清理。
2. Chromium 在桌面（1365px）及 iPhone 13 模擬尺寸測試：打開閱讀中心、切換深色模式、利用假同步 API 模擬跨裝置合併，再開啟實際壓縮小說第 1 章、展開中文並檢查手機水平溢出。
3. Cloudflare 真正的同步 Worker / D1 API 測試：健康檢查、建立臨時金鑰、寫入、衝突 409、讀回、刪除、撤銷金鑰。測試使用可刪除的臨時資料，不使用讀者資料。
4. 同步金鑰必須先驗證成功才會保存在瀏覽器；資料未改變時不再重複向資料庫寫入相同快照。
5. 首頁不再把約 949KB 的閱讀指引及約 951KB 的故事預覽全數嵌入主程式。分割為資源檔並按功能載入。首頁讀書建議另使用約 32KB 節錄資料。
6. 改善 GitHub Actions 部署可靠性：重試推送衝突、讀取最新 main 重建、瀏覽器實測通過後才發布、輸出 docs/release.json 版本註記。

## 實測結果

- 最新完整 Actions 驗證：https://github.com/tttoom580-ui/storysteps-preview/actions/runs/43451111847
- Desktop/mobile browser smoke: PASS。
- Cloudflare Worker + D1 真實 API smoke: PASS。
- Build: PASS，原有內容結構稽核 82 本／2,050 章；未發現結構錯誤。
- 主要 JavaScript 單檔：之前約 2,271.9KB（gzip 約 910.6KB），目前約 419.1KB（gzip 約 145.6KB）；這是檔案大小，不是 LCP 或頁面載入時間數據。
- 網站仍是公開 GitHub Pages： https://tttoom580-ui.github.io/storysteps-preview/ 。

## 仍需處理、不能宣稱已驗證

- 本輪測試的手機尺寸使用 Chromium 模擬，不是真實 iOS Safari、Android Chrome、LINE 內建瀏覽器、硬體觸控或下載目錄測試。
- 尚未量測正式環境 Core Web Vitals（LCP/INP/CLS）、不同電信網路與低階手機的實際速度。
- 雲端讀寫真實 API 已通過生命週期測試，但完整多使用者併發、網路中斷復原、金鑰外洩與資料安全性仍需安全審閱。這是匿名同步金鑰，不是 Google 登入，亦非端到端加密。
- 小說結構驗證通過不等於全文語意校訂完成。兩本重複句待修，其他作品亦需審閱。
- 正式獎勵廣告仍未啟用，沒有虛構廣告觀看或收入。
