# 拾頁上線與社群設定

更新：2026-11-17。這是可直接使用的文案與操作清單；尚未代為修改或發布 IG、Threads。

## 統一品牌

兩個平台顯示名稱：**拾頁 StorySteps｜讀故事學英文**

帳號名稱候選：`storysteps.tw`（需在平台確認可用性）。頭像統一使用網站紫色書頁圖示；不要使用讀者可愛動物頭像充當品牌 Logo。

自介：

> 把英文讀成故事 📖
> 分級小說 × 點字查詞 × 英中對照
> 12 本全本免費，其餘前 10 章試讀
> 從你想追的第一章開始 ↓

首頁實際上架數會自動更新，目前 105 本。社群可用「百本英文小說」，不要再寫「全站免費」或「全部校訂完成」。分級是參考大考中心詞表的本站安排，非官方認證、非官方 A／B 分冊。

## 個人檔案連結

- IG： https://tttoom580-ui.github.io/storysteps-preview/?utm_source=instagram&utm_medium=social&utm_campaign=launch
- Threads： https://tttoom580-ui.github.io/storysteps-preview/?utm_source=threads&utm_medium=social&utm_campaign=launch
- 懸疑推薦直接閱讀： https://tttoom580-ui.github.io/storysteps-preview/?book=import-rain-bell&chapter=import-rain-bell-1&utm_source=threads&utm_medium=social&utm_campaign=free_books
- 療癒推薦直接閱讀： https://tttoom580-ui.github.io/storysteps-preview/?book=ss-r2-l1-b&chapter=ss-r2-l1-b-1&utm_source=instagram&utm_medium=social&utm_campaign=free_books

每篇推薦直接連該書第一章。複製閱讀器的「本章連結」後，依發文平台加入以上 UTM；不要把私人帳號、Email 或同步金鑰放進追蹤參數。

## 三則置頂內容

1. 品牌介紹：「不只記住單字的中文，更要讀懂它在故事裡的意思。」附網站閱讀畫面及免費範圍。
2. 操作示範：選書 → 點字看意思 → 返回原文 → 收藏複習。使用短錄影，不宣稱保證提高學測成績。
3. 免費書推薦：雨來之前的鐘聲／獸人村的第一間早餐店；各一句看點，直接連第一章。

## 分析啟用與驗證

Cloudflare 頁面流量與效能統計已在原網站配置。本次新增的 GA4 閱讀事件尚未上傳：需要站主 GA4 資料串流的 `G-...` Measurement ID，填入 `config/analytics.json`，完成對應隱私告知後才設 `enabled: true`。並在 GA4 關閉 Enhanced Measurement，避免自動送出含私人參數的完整網址；不要設定 user_id 或額外自動事件。讀者仍須到頁尾「網站與隱私」明確同意；研究同意與分析同意互不取代。撤回會停止後續上傳，不代表刪除先前已送出的資料。

修改啟用狀態時，同步修改 `scripts/build_public_pages.py` 內隱私與分析說明，不要保留「尚未連接」文案。未取得 Measurement ID 前，不可聲稱已收到閱讀成效數據。

事件：visit（造訪）、book_open（作品介紹）、chapter_start（正文載入成功）、chapter_end（章末導覽進入畫面）、chapter_complete（測驗送出並保存成功）、next_chapter（按下一章）、word_lookup（查詞操作）、word_save（收藏保存成功）、pass_view（方案瀏覽）。不在前端紀錄 purchase，將來只能以伺服器核實付款結果為準。

來源僅接受 instagram / threads / facebook / youtube；活動僅接受 launch / daily_reading / free_books。其他值歸 direct / none，避免任意參數或個資進入分析。

先觀察：各來源開始閱讀比例、同一書同一章的章末到達比例、下一章點擊比例。GA4 啟用後以同意讀者的 session 作分母；事件數會受重讀影響，不能直接當唯一讀者數。章末到達不等於看完、測驗完成不等於學會；數據也不能代表未同意的所有訪客。

本機驗證：網址加 `analytics_debug=1`，在 sessionStorage 的 `storysteps-analytics-debug` 查看最多 100 筆事件；關閉分頁即失效，不會送給站主。執行 `node verification/launch-flow-smoke.mjs` 驗證直接進入章節、查詞位置、來源與事件；Linux 可加 `CHROMIUM_PATH=/usr/bin/chromium`。

## 開賣前仍須完成

目前通行證未開賣。規劃 NT$100 一次付款，涵蓋購買時清單內的試讀書後續章節、不含未來新書。使用期限仍須站主定案，網站不擅自承諾永久。

需完成付款成功回呼驗章與金額核對、重複通知防重、帳號綁定／兌換、私有正文權限、跨裝置還原，以及真實測試訂單、客服與退款說明後，才打開結帳。這次沒有宣稱金流已串接或代替站主寄出開通碼。
