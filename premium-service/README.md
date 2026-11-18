# StorySteps 閱讀通行證

公開站發布 `docs/`。`npm run build` 只在發布目錄保留免費正文及導讀。付款服務的 D1 已匯入 87 本的第 11–25 章。原有公開 GitHub 儲存庫曾發布完整版，來源目錄與歷史版本仍可取得。正式販售前，將新正文移至私有來源，清除公用部署的舊檔，並確認販售範圍與既有公開副本的處理方式。

Cloudflare Worker 為 `storysteps-premium`，綁定 `storysteps-premium` D1 為 `DB`。請在 Cloudflare Dashboard 的 Worker 設定填入藍新 `MERCHANT_ID`、`HASH_KEY`、`HASH_IV`，以及已完成寄件網域驗證的 Resend `RESEND_API_KEY` 和 `EMAIL_FROM`。密鑰使用 Secret 欄位。現有 `ACTIVATION_SECRET` 必須跨版保留，變更後舊的未兌換開通碼將失效。其餘設定為 `APP_ORIGIN`、`APP_URL`、`SERVICE_URL`、`PAYMENT_ENV` 和 `SALES_ENABLED`。

## Google 登入

1. 在 Google Auth Platform 建立網站用戶端，使用外部使用者類型。在「已授權的 JavaScript 來源」加入拾頁網站的來源（例如 `https://tttoom580-ui.github.io`，無路徑）。先用測試使用者確認，對外開放時依 Google 控制台設定發布。
2. 在通行證 D1 執行 `google.sql`。新資料庫先執行 `schema.sql`。將 `GOOGLE_CLIENT_ID` 設為該網站用戶端 ID，部署 `worker.mjs` 和 `google.mjs`。
3. Google 模式要求讀者登入後下單。後端在下單時將帳號綁到訂單，收到並驗證藍新的付款通知後才可讀付費章節。登入識別以 Google 帳號的穩定識別碼為準。已有的開通碼流程仍可處理舊訂單。

`SALES_ENABLED=false` 時仍可測試 Google 登入。藍新商店與付費書目準備完成前保持此設定。


先以藍新測試商店在獨立的測試 Worker 和資料庫驗證交易、通知、寄信、兌換及退款。正式商店的通知路徑為 `/api/newebpay/notify`，瀏覽器返回頁只用來顯示通行證。首版限定國內信用卡一次付清。正式環境完成驗收後，將正式 Worker 的 `PAYMENT_ENV` 設為 `production`，再開啟 `SALES_ENABLED`。暫停新訂單時只需關閉 `SALES_ENABLED`，已結帳的通知仍可處理。

通行證綁定帳號金鑰。同一訂單只能綁定一個帳號，同一帳號重試會回傳原權限。請提醒讀者私下保存跨裝置金鑰。若退款，在藍新確認完成後，依訂單編號更新 `premium_orders.revoked_at` 為當下毫秒時間；私有章節會立即拒絕已撤銷的訂單。寄信失敗的訂單每五分鐘重試。必要時可依 `paid_at`、`mailed_at` 查閱，避免在工作日誌輸出電郵或金鑰。

更新正文時，在私有作者工作區執行 `npm run build`，再用 `python3 scripts/package_reading_access.py --private-dir .premium-private` 匯出私有 SQL。先匯入書本資料，最後匯入 `publish-catalog.sql`。付款時的書目會隨訂單保存，日後新增小說不會添加到既有訂單。
