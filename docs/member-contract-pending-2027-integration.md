# DRIFTER｜2027 會員契約唯讀入口・整合規格

狀態：**開發分支，未正式上線**。本分支不可直接視為完成電子契約簽署系統。

## 已實作
- \`member-contract.html\`：LINE LIFF 會員「待簽契約唯讀查閱」入口。
- 沿用既有 LIFF ID 與 GAS 表單 POST 模式，ID Token 僅放 POST body，不放 URL。
- 健康檢查需同時符合 \`ok===true\`、\`memberContractPendingVersion==='MC-PENDING-2027-01'\`、\`memberContractReadOnlyEnabled===true\` 才啟用查閱按鈕。
- 未建立會員簽名、付費、開通、核發、跨會員查詢或修改資料的前端行為。
- 版本不符、未部署、LINE 驗證失敗時，一律關閉按鈕。
- 無需變更目前 \`member-bind.html\`、\`member-passport.html\` 與既有預約頁。

## 待整合：GAS（不能以本分支代替）
1. GAS \`doPost\` 新增獨立路由 \`action=memberContractPending\`，只做已授權會員待簽契約唯讀查詢。**這部分目前未實作在本分支，請勿誤認已串通。**
2. GAS 伺服器端驗證 LINE \`id_token\`（不能信任前端驗證結果），並以經驗證 LINE user ID 精確比對已啟用會員的 \`會員端LINE綁定ID\`。
3. GAS 僅接受後端查得的會員編號，不能接受前端提交會員編號、契約編號、方案價格或 SHA-256 後做越權讀取。
4. 只選取 \`會員契約主檔\` 中該會員 \`契約狀態=待簽署\` 的唯一一筆。逐項確認申請紀錄、期限、合約版本白名單、文件 SHA-256、身份/付款狀態和關聯的一致性。重複、過期、無效與未核准版本一律拒絕。
5. 內容需在 GAS 端 HTML escape，且不得輸出其他會員敏感資料、原始 LINE ID Token 或工作室內部備註。
6. \`doGet?action=health\` 的 JSONP 回應僅在伺服器唯讀端點與檢查完成後，才回傳 \`memberContractPendingVersion='MC-PENDING-2027-01'\` 與 \`memberContractReadOnlyEnabled=true\`。健康旗標只控制 UI，**不是伺服器端授權**。
7. 契約簽名、付款確認、\`堂數方案\` 啟用及 Body Passport 開通仍獨立關閉，不應由待簽查詢觸發。

## 驗收案例（只在隔離測試資料執行）
| 情境 | 預期 |
|---|---|
| 後端版本旗標未開啟 | 頁面只顯示未啟用、按鈕禁用 |
| 沒有 LINE ID Token / Token 無效 | 拒絕 |
| LINE 未綁定或會員停用 | 拒絕 |
| 綁定有效但無待簽契約 | 顯示無待簽契約 |
| 同一會員有多筆待簽契約 | 拒絕並記錄待人工處理 |
| 契約超過期限、版本未核准、hash 缺漏 | 拒絕 |
| 契約已簽、已作廢、申請 ID 不一致 | 拒絕 |
| 正常唯讀查詢 | 僅顯示本人核准的契約內容 |
| 反覆查詢 | 不新增簽署、付款、方案或堂數紀錄 |
| 既有預約、會員綁定與 Body Passport | 無回歸故障 |

## 正式啟用門檻
- 電子契約版本與退費條款完成法律審查。
- GAS 路由授權、唯一性檢查、資料脫敏與版本控制完成。
- AppSheet 申請 Bot 與後端狀態回填通過隔離測試。
- 不得將本 feature 分支 merge 至公開 Pages 來源，直到上述條件完成。

此文件僅作開發核對，不代表法律合規結論。