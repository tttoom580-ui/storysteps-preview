# StorySteps 第三階段：增加回訪率（2026-11-13）

本次在原本的 GitHub Pages 專案直接修改並部署，不購買外部服務、不搬遷網站、不增加讀者追蹤器。此報告將「功能已寫入」和「實際瀏覽器驗證」分開。

## 已新增

1. **章末錯題本**（`app/engagement.tsx`）：章末測驗保存成功後記錄答錯的題目，按照本機複習結果安排 1、3、7 日複習；答錯 10 分鐘後重試。顯示題目、答案與原有解釋，並提供回到章節的入口。限制 500 題，驗證資料結構，儲存失敗時提醒；目前僅儲存在本機瀏覽器，沒有新增雲端同步。
2. **閱讀推薦**：根據本機已完成的章節、收藏、上次閱讀、題材及自行設定的級距推薦三本可讀作品；尚未閱讀者使用級距起點，並略降仍待校訂作品的推薦優先度。不宣稱為機器學習或正式能力分級。
3. **書城試讀**：短篇英文節錄按書城篩選結果顯示，可讀第一章、查看中文書介或換一本。另增加「仍需校訂」與「無待校訂標記」篩選；後者不等於專家核可的完成校訂。
4. **七日閱讀摘要**：依本機已完成的章節計算七日完成數、完成章節的天數及累計讀過的書。不是全站活躍人數與真實留存率。
5. 手機版配套 CSS、錯題卡片操作狀態與閱讀中心的匿名同步文案更新。

## 隱私與限制

- 新增功能不蒐集真名、電郵、地理位置；沒有新增分析追蹤端點或廣告 Cookie。
- 錯題本採 `storysteps-review-mistakes-v1` 本機資料，未納入現行雲端備份/跨裝置同步；換裝置需重新建立錯題紀錄，清除瀏覽器資料會消失。
- 錯題仍以當時的測驗題目與解析為準，原稿更新後需重新確認內容。
- 本輪提供的「我的七日閱讀摘要」不能替代真正的留存率、廣告收益或完成率分析。
- Google 獎勵廣告與使用者個資分析仍維持既有設定，沒有因為增加回訪率而擅自啟用。

## 驗證與測試方式

- `npm run build` 仍包含全站小說結構、公開頁面與 Vite 打包。
- `verification/browser-smoke.mjs` 新增 desktop / iPhone 13 尺寸模擬：錯題答對、原題解析顯示、切換下一題、三分鐘試讀、校訂篩選，並保留舊有同步、深色模式及小說段落翻譯測試。
- `verification/sync-api-smoke.mjs` 會使用臨時帳戶檢查 Cloudflare D1 真實 API 建立、讀寫、修訂衝突、刪除及撤銷。
- 物理 Android/iPhone、弱網實測、真實用戶七日回訪提升並未完成，也不應宣稱已證明提升留存率。

## 原始碼與測試

- 網站：https://tttoom580-ui.github.io/storysteps-preview/
- 新增功能：https://github.com/tttoom580-ui/storysteps-preview/blob/main/app/engagement.tsx
- 桌面／手機測試：https://github.com/tttoom580-ui/storysteps-preview/blob/main/verification/browser-smoke.mjs
- GitHub Actions：https://github.com/tttoom580-ui/storysteps-preview/actions/workflows/build-site.yml
