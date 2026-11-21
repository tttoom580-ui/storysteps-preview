# 拾頁 StorySteps｜GitHub Actions → Cloudflare Pages 自動部署

更新：2026-11-21

## 目前架構

- GitHub 專案：`tttoom580-ui/storysteps-preview`（`main`）。
- Cloudflare 帳號：在 Cloudflare 中登入持有 `storysteps` Pages 專案的帳號。
- Cloudflare Pages **專案名稱**：`storysteps`（**不是** `storysteps-5ef`）。
- 正式網站：<https://storysteps-5ef.pages.dev/>。
- GitHub Actions：`.github/workflows/build-site.yml`。
- 這是現有 **Direct Upload** Pages 專案；無法改成原生 Git 整合，所以使用 GitHub Actions + Wrangler 保留正式網址。

## 必須完成的一次性憑證設定

目前工作流程已支援自動建置、檢查、產生靜態頁與 Wrangler 部署；若 GitHub 尚未設定 Cloudflare API token，部署步驟會明確失敗（不再假裝成功）。

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **API Tokens** → **Create Token** → **Custom Token**。
2. 命名，例如 `storysteps-github-pages-deploy`。權限選 **Account → Cloudflare Pages → Edit**；Account Resources 限定為網站所在的 Cloudflare Account。
3. 建立並複製 API Token，**不要**貼進聊天、程式碼或 README。
4. 開啟 [這個 GitHub 儲存庫的 Actions Secrets 設定](https://github.com/tttoom580-ui/storysteps-preview/settings/secrets/actions) → **New repository secret**：
   - Name：`CLOUDFLARE_PAGES_API_TOKEN`
   - Secret：貼上剛才產生的 API Token
5. 儲存。工作流程已內建正確的 `CLOUDFLARE_ACCOUNT_ID`，**不需**再建立另一個 Secret。

## 第一次部署／測試

1. 開啟 [Actions 工作流程](https://github.com/tttoom580-ui/storysteps-preview/actions/workflows/build-site.yml)。
2. 選 **Run workflow** → branch `main` → **Run workflow**。
3. 確認建置、驗證與 `Deploy verified site to Cloudflare Pages` 都成功。
4. 到 [Cloudflare Pages 正式站](https://storysteps-5ef.pages.dev/) 驗證最新書庫，再到 Cloudflare Dashboard 檢查 `storysteps` 的 Production deployment 是最新提交。
5. 驗證書庫是否為 **239 本**；其中 **24 本公開 25 章**、**215 本公開 12 章**；圖片能讀取；未付費章節沒有被公開上傳。

日後把來源程式或書籍推送至 `main`（如 `app/`、`public/`、`config/`、`scripts/`），會自動執行：建置 → 驗證 → 更新 `docs/` → Cloudflare Pages。只修改一般 Markdown 文件不一定會重新部署，因為 workflow 使用路徑篩選。

## 故障排查

- **缺 Secret**：Actions 顯示 `Cloudflare Pages deployment is blocked`；依上述步驟建立正確名稱的 Secret。
- **403/Authentication error**：重查 Token 的 Account Cloudflare Pages Edit 權限、帳號範圍，必要時重新產生 Token 並更換 GitHub Secret。
- **建置/測試失敗**：不會進行正式站部署；先檢查 Actions 當次的失敗步驟。
- **Wrangler 找不到專案**：確認 Pages project name 為 `storysteps`；網站子網域 `storysteps-5ef.pages.dev` 並非 project name。
- **舊版仍顯示**：先看 Cloudflare Dashboard 的 Production deployment 更新時間，再用無痕模式檢查快取。
- **務必不要**把 API Token 寫入 repository 或公開網址、貼在聊天訊息中。

備註：這項設定只涵蓋**前端 Cloudflare Pages 靜態站**；`storysteps-premium` Worker、D1、Google OAuth 與會員金流需要獨立部署、授權及驗證。
