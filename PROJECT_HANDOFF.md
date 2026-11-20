# 拾頁 StorySteps 專案接手說明

更新：2026-11-20。這份文件用於換 ChatGPT 帳號、換工作環境或交給其他開發者。

## 正式資產與擁有權

- 正式站：https://storysteps-5ef.pages.dev/
- 網站程式與公開試讀資料：https://github.com/tttoom580-ui/storysteps-preview ，main 分支。
- 舊預覽：https://tttoom580-ui.github.io/storysteps-preview/
- 私人專案與完整稿件：https://github.com/tttoom580-ui/storysteps 。請授予新工具存取私人 repository 的權限。
- Cloudflare Pages 專案：storysteps。正式子網域為 storysteps-5ef.pages.dev。
- 後端 Worker：storysteps-premium；API：https://storysteps-premium.tttoom580-storysteps.workers.dev
- 請保留原 GitHub、Cloudflare、Google OAuth 專案和金流商店的帳號存取。更換 ChatGPT 帳號本身不必遷移這些外部資產。
- 金流商店：拾頁 StorySteps；藍新曾因使用 GitHub 網頁拒絕申請。pages.dev 網域是否獲接受仍須由藍新確認，沒有核准保證。
- 不在文件、對話或程式庫中存放 token、OAuth secret、使用者個資或付款密鑰。現有秘密留在 Cloudflare/GitHub 的 secrets。

## 書稿備份位置

完整稿件位於私人 repository 的獨立分支，不在 main，也不在公開網站原始碼。

| 分支 | 內容 |
| --- | --- |
| manuscripts/2026-11-19 | 第一批16本，400章完整 reader payload |
| manuscripts/2026-11-19-levels-3-6 | 第二批32本，800章完整 reader payload |
| manuscripts/2026-11-20 | 本次24本，600章完整 reader payload 與拆冊稿件 |

每個分支內的同名 manuscripts 日期目錄包含 manifest.json。`.bin` 是 gzip 壓縮的 UTF-8 JSON 章節陣列，含完整25章、中英段落、詞彙和測驗；本次另附 `.md.gz`，為拆冊並正規化測驗格式後的 Markdown。解壓可用 Python gzip.decompress。

2026-11-20 匯入：1A-5～8、1B-5～8、3A-5～8、3B-5～8、4A-5～8、4B-5～8。16本合訂本重複附件已去重，3A-1～4、3B-1～4已在上一批上架。新書ID以 ss-r18- 開頭。

## 目前產品規則

- 書目199本，每本25章，共4975章書目紀錄；其中本次新增600章。
- 目前12本完整免費，其餘187本公開前12章，後13章不隨公開網站打包。
- 本次24本皆使用前12章試讀；完整25章已入私人備份，並非全部25章已公開可讀。
- 方案頁目前為 NT$100 買斷的預告，尚未開賣；SALES_ENABLED=false。實際使用期限、開通方式、退款方式、正式客服資料需先定案，不能擅自開啟收款。
- AB 是專案的配詞安排，非官方分冊；目標詞彙級距不是正文所有用字的上限。
- 新書的結構、雙語段落、配詞出現、測驗格式已機械檢查。許多原稿有跨章模板與重複句，不代表完成語意、翻譯、故事或答案精修；維持 learningReviewRequired=true。
- 本次未提供圖像封面，新書沿用網站的預設書卡外觀；之後可補獨立封面。
- 已有查詞、生字本、單字意思/拼字小遊戲與複習排程。不要為新增內容移除既有功能。

## 程式結構與匯入

- app/：React 網頁、閱讀器、單字遊戲。app/vocabulary-game.tsx 與 css 是單字遊戲。
- public/catalog.js：完整書目與25章標題/字數等 metadata。
- public/content-manifest.json：可公開讀取的章節包索引。
- public/books/*.bin：公開 gzip JSON 章節包。新書僅12章。
- config/batch*-books.json：可重現的新增書目紀錄。scripts/import_batch16.py 會依序讀取所有批次設定。
- scripts/import_batch15.py：原稿結構與配詞驗證 parser。完整原稿勿放進公開 repository。
- config/reader-offer.json：免費/試讀與方案設定。config/topics.json：題材分類。
- premium-service/：Cloudflare Worker 程式。product-books.mjs 是事件紀錄所接受的書籍/章節ID清單，新增書後須同步部署。
- verification/import-batch18.json：本次新書驗收摘要，含重複句警示。
- scripts/package_reading_access.py：移除公開包內的付費章節。
- docs/：產生後的靜態網頁。避免手改產生檔；先改來源，再重建。

本機重建（Node22以上、Python3）：

```sh
npm ci
npm run build
node verification/offer-smoke.mjs
node verification/premium-api-smoke.mjs
python3 scripts/prepare_cloudflare_pages.py ../storysteps-pages --site storysteps-5ef.pages.dev
```

prepared output 路徑須為尚不存在的目錄。此工具會調整正式網址、生成404與Cloudflare標頭。部署前驗證新書的第1、12章可讀，第13章未出現在公開檔案裡。

## 部署狀態與待接通事項

- Pages 目前為直接上傳專案，Git 整合曾失敗。正式站曾使用已連接的 Cloudflare 工具取得短期 upload-token，將靜態資產上傳，再用 manifest 建立 deployment。
- 常規部署可用 `wrangler pages deploy ../storysteps-pages --project-name storysteps --branch main`，需具 Pages Edit 的 Cloudflare 憑證。不要把憑證寫進專案。
- .github/workflows/build-site.yml 會建置、驗證並回寫 docs，最後有部署 Pages 的步驟。
- 自動部署尚缺 GitHub repository secret `CLOUDFLARE_PAGES_API_TOKEN`。先在 Cloudflare 建立限此帳號 Pages Edit 的 token，再放到 storysteps-preview 的 Actions secrets。現有連接權限無法代建 Account API token，因此尚未完全接通；缺 token 時工作流程會跳過 Pages 部署。
- Worker 更新需保留既有 secret_text、plain_text、D1 bindings，尤其 SALES_ENABLED=false。不要以空設定覆蓋正式設定。
- Google登入的 Pages 網域載入/CORS已處理，但 Google Console 的 Authorized JavaScript origins 仍須確認包含 https://storysteps-5ef.pages.dev，並用真實帳號完成跨裝置登入驗收。
- Worker APP_ORIGIN/APP_URL 仍有舊 GitHub 站值；額外 CORS origin 已含 Pages。涉及 Google Drive callback 的返回網址仍需進一步核對。勿宣稱新網域全部登入路徑已驗收。
- 訂單、閱讀進度等資料在 Cloudflare 資源/使用者裝置內，不會靠複製 ChatGPT 對話搬走。遷移 Cloudflare 帳號需另做 D1 備份和資源遷移，本次沒有做此項遷移。

## 換 ChatGPT 帳號操作

1. 保留 GitHub、Cloudflare、Google 等原帳號的登入與復原方式。
2. 在新 ChatGPT 帳號重新連接 GitHub、Cloudflare，授權上列公開與私人 repository。
3. 建立新對話/專案，貼上此文件的GitHub網址，要求先讀取再操作。
4. 如要保留舊討論，於舊帳號「設定 → 資料控制 → 匯出資料」備份，再把 conversations.json 作為參考提供給新對話；上傳不會重建原本的側邊欄或自動轉移記憶、檔案與權限。
5. ChatGPT Plus 訂閱不能轉帳號；若要換帳號付費，需管理舊帳號訂閱，再於新帳號另訂閱。

給新帳號的接手提示：

> 這是我的拾頁 StorySteps 專案。請先閱讀 https://github.com/tttoom580-ui/storysteps-preview/blob/main/PROJECT_HANDOFF.md ，再讀取 main 最新程式碼與私人稿件分支。正式站為 https://storysteps-5ef.pages.dev/ 。保留目前功能、試讀和未開賣設定，修改前先核對最新部署與GitHub狀態。完整稿件在 tttoom580-ui/storysteps 的 manuscripts 分支，不要將付費章節發布到公開 repo。請依我接下來的需求修改並驗證，最後更新接手文件。
