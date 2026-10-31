# DRIFTER｜會員已簽署契約查閱 — 安全整合紀錄（2026-11-01）

## 狀態

此功能**只存在於 feature/member-contract-archive-20261101 分支**，並未合併至 `main`，也未更新正在使用的 Apps Script Web App 正式部署。不得向會員宣稱已上線。

## 背景

2026-11-01 實際核對：`Body Check` 對測試會員沒有紀錄；`服務紀錄` 有 2 筆已完成，但 `會員端公開核准` 均為 FALSE，因此 Body Passport 出現空白狀態符合資料庫。既有測試契約已簽署且生效，不應再次列入待簽清單。測試契約的付款方式標示「系統驗收測試（無實際收款）」；切勿當成真實收款。

## 已準備變更（尚未部署）

- `member-contract.html`：新增「查閱我的已簽署契約」按鈕，以現有 LIFF 取得的 LINE ID Token 透過 POST 安全查閱；保留原先簽署以及 Body Passport 入口。
- `MemberContractWorkflow.gs`：新增 `drifterMc27Archive_(p)`，呼叫既有 LINE Verify/會員綁定檢查，限該會員本人查閱已簽署、已生效契約，核對電子簽署紀錄與契約 SHA-256，從簽約時的快照載入全文，不直接開放 Google Drive 檔案權限。以 HTML 轉義避免內容注入。測試付款記錄附上「無實際收款」提示。
- `drifterMc27HandlePost_`：新增 `memberContractArchive` 分流，保留既有 `Open`、`Sign` 分流不變。

## 正式整合前必要核對

1. **勿直接以 GitHub 版 MemberContractWorkflow.gs 覆蓋現在 GAS 的正式檔**：現有 GAS 可能有更新的整合修正（P1/P2/P3）；必須對現行檔進行差異比對後，僅加入上述函式及分流。
2. 在原本的 Apps Script `doPost(e)` 對契約操作的路由，將：
   `/^memberContract(Open|Sign)$/`
   改為：
   `/^memberContract(Open|Sign|Archive)$/`
   否則新請求不會走到 `drifterMc27HandlePost_`。
3. 確認所有契約路由都只透過 POST 與有效 LINE ID Token 執行；不得接受來自 URL 的 `memberId`、`contractId` 或其他客戶 ID 作為授權依據。
4. 逐項驗證：a. 已綁定本人可讀自己的已簽約全文；b. 未綁定 LINE、其他會員 LINE Token 無法查閱；c. 只有未簽約者無完整簽署資料可讀；d. 在 UI 不顯示其他會員資料；e. 原待簽/簽署/付款/堂數流程功能不受影響。
5. 完成現有 GAS 版本備份、安全審查和上述驗收後，由工作室確認才將對應前端提交合併至 `main` 並部署 GAS 新版本。

## 沒有變更的項目

未修改原資料庫、簽署紀錄、實收金額、付款狀態、堂數帳本、既有 LINE 綁定流程或 AppSheet。
