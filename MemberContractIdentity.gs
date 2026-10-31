/**
 * DRIFTER｜STEP 12N-5C-3
 * Body Passport 電子契約｜會員身分比對（唯讀預備版）
 *
 * 依現有 MemberBinding.gs：
 * - 會員主檔 A 欄：會員編號
 * - G 欄：會員狀態（啟用）
 * - P 欄：LINE User ID 原值（非 SHA-256）
 * - Q 欄：會員端查閱狀態（啟用）
 *
 * 僅提供內部預檢與後端內部使用的身分解析函式。
 * 不修改任何工作表、不核發契約、不建立 QR、不開通堂數。
 * 不要將這些函式掛到公開 doGet / doPost。
 */

/** 只確認程式依賴與工作表結構，不需要真實 ID Token。 */
function drifterMemberContractIdentityPreflight() {
  if (typeof CONFIG === 'undefined' ||
      !CONFIG.SPREADSHEET_ID ||
      !CONFIG.MEMBER_SHEET) {
    throw new Error('尚未設定 CONFIG.SPREADSHEET_ID 或 CONFIG.MEMBER_SHEET。');
  }
  if (typeof verifyLineIdToken_ !== 'function') {
    throw new Error('缺少既有的 LINE 後端 ID Token 驗證函式。');
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var members = ss.getSheetByName(CONFIG.MEMBER_SHEET);
  if (!members || members.getLastColumn() < 17) {
    throw new Error('會員主檔不存在或欄位不足。');
  }

  var h = members.getRange(1, 1, 1, 17).getDisplayValues()[0];
  var expected = [
    [0, '會員編號'],
    [6, '會員狀態'],
    [15, '會員端LINE綁定ID'],
    [16, '會員端查閱狀態']
  ];
  expected.forEach(function (item) {
    if (String(h[item[0]] || '').trim() !== item[1]) {
      throw new Error('會員主檔欄位不符：' + item[1]);
    }
  });

  var contracts = ss.getSheetByName('會員契約主檔');
  if (!contracts) {
    throw new Error('找不到會員契約主檔。');
  }
  var ch = contracts.getRange(1, 1, 1, contracts.getLastColumn())
    .getDisplayValues()[0].map(function (v) { return String(v).trim(); });
  ['契約編號','會員編號','契約版本','契約文件SHA256',
   '契約狀態','簽署期限UTC'].forEach(function (title) {
    if (ch.indexOf(title) < 0 || ch.lastIndexOf(title) !== ch.indexOf(title)) {
      throw new Error('會員契約主檔欄位缺漏或重複：' + title);
    }
  });

  // 這裡只驗證程式與資料表，不宣稱已驗證任何 LINE 會員。
  return '契約身分預檢通過：欄位及驗證函式存在；未進行會員登入或簽署。';
}

/**
 * 後端內部工具：由已驗證的原始 LINE ID Token 對應會員。
 *
 * 只允許其他授權 GAS 內部函式直接呼叫。
 * 不要把此函式當作公開 API 或直接回傳 memberId 給前端。
 * 後續正式使用前，仍須檢查 verifyLineIdToken_ 是否確實向
 * LINE 官方驗證簽章、aud/client_id、iss 及 exp。
 */
function drifterMc2027ResolveBoundMember_(rawIdToken) {
  var token = String(rawIdToken || '').trim();
  if (!token || token.length > 6000) {
    throw new Error('LINE 身分核驗未通過。');
  }

  drifterMemberContractIdentityPreflight();

  var profile = verifyLineIdToken_(token);
  var lineId = String(profile && profile.sub || '').trim();
  if (!/^U[0-9a-f]{32}$/i.test(lineId)) {
    throw new Error('LINE 身分核驗未通過。');
  }

  var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    .getSheetByName(CONFIG.MEMBER_SHEET);
  var last = sheet.getLastRow();
  if (last < 2) {
    throw new Error('此帳號尚未獲得契約查閱授權。');
  }

  var values = sheet.getRange(2, 1, last - 1, 17).getDisplayValues();
  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][15] || '').trim() === lineId) {
      matches.push(values[i]);
    }
  }

  if (matches.length !== 1 ||
      String(matches[0][6] || '').trim() !== '啟用' ||
      String(matches[0][16] || '').trim() !== '啟用' ||
      !String(matches[0][0] || '').trim()) {
    throw new Error('此帳號尚未獲得契約查閱授權。');
  }

  // 僅返回給 GAS 內部程式；不寫入試算表、不回傳到網頁。
  return {memberId: String(matches[0][0]).trim()};
}
