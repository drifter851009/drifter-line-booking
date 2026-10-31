/**
 * DRIFTER｜Member Contract LIFF identity readiness / development preview
 *
 * NOT a membership authorization service.
 * - The browser may prepare a LINE ID token after LIFF sign-in.
 * - This script does NOT transmit, save, print, or display the token.
 * - Real membership authorization MUST happen on the server after verifying
 *   the raw ID token with LINE, matching the existing binding to the member,
 *   and checking the assigned pending contract.
 * - No signing, contract issue, or payment activation is implemented here.
 */
(() => {
  'use strict';

  const LIFF_ID = '2011856045-PfCKIOb3';
  const APPROVED_ORIGIN = 'https://drifter851009.github.io';
  const APPROVED_PATH_PREFIX = '/drifter-line-booking/';
  const START_BUTTON_ID = 'lineAuthCheck';
  const STATUS_ID = 'lineAuthStatus';
  const DETAIL_ID = 'lineAuthDetail';

  const button = document.getElementById(START_BUTTON_ID);
  const status = document.getElementById(STATUS_ID);
  const detail = document.getElementById(DETAIL_ID);
  if (!button || !status || !detail) return;

  let busy = false;

  function show(title, message, state) {
    status.textContent = title;
    detail.textContent = message;
    status.dataset.state = state || 'pending';
  }

  function isExpectedOrigin() {
    return window.location.protocol === 'https:' &&
      window.location.origin === APPROVED_ORIGIN &&
      window.location.pathname.startsWith(APPROVED_PATH_PREFIX);
  }

  function isSafeBrowserContext() {
    return window.isSecureContext === true && isExpectedOrigin();
  }

  async function start() {
    if (busy) return;
    if (!isSafeBrowserContext()) {
      show(
        '此預覽環境不可執行 LINE 登入',
        '此功能只能於確認的 DRIFTER HTTPS LIFF 頁面測試。請勿將 GitHub 原始檔或外部鏡像當成正式簽署入口。',
        'blocked'
      );
      return;
    }

    if (typeof window.liff === 'undefined') {
      show('LINE 登入元件無法載入', '請在 LINE LIFF 入口重新開啟；尚未進行身分驗證。', 'blocked');
      return;
    }

    busy = true;
    button.disabled = true;
    show('正在初始化 LINE 登入', '這只會檢查 LINE 的登入憑證，不會核准會員契約。');

    try {
      await window.liff.init({ liffId: LIFF_ID });
      if (!window.liff.isLoggedIn()) {
        show('需要 LINE 登入', '即將開啟 LINE 登入畫面；登入後仍需由後端核驗會員身分。');
        window.liff.login({
          redirectUri: window.location.origin + window.location.pathname
        });
        return;
      }

      // Never derive membership from getProfile(), getDecodedIDToken(),
      // a query parameter, or a browser-supplied member number.
      const idToken = window.liff.getIDToken();
      if (typeof idToken !== 'string' || idToken.split('.').length !== 3) {
        throw new Error('missing_id_token');
      }

      // Token is intentionally not persisted. Future production code will
      // send it directly via HTTPS to a secured backend for LINE verification.
      show(
        'LINE 登入憑證已取得（尚未驗證會員身分）',
        '下一步需由 GAS 向 LINE 驗證此憑證、核對既有會員綁定，以及檢查本人待簽契約。目前未傳送任何憑證，也無法簽署。',
        'ready'
      );
      button.textContent = '重新檢查 LINE 登入';
    } catch (_error) {
      // Do not log the token or the SDK error object: logs may include details.
      show(
        'LINE 登入準備失敗',
        '請由 DRIFTER LINE 官方帳號的 LIFF 入口重新開啟；正式契約仍不可簽署。',
        'blocked'
      );
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  button.addEventListener('click', start);
  if (!isExpectedOrigin()) {
    show('開發預覽：LINE 登入尚未啟用', 'GitHub 程式預覽不會登入 LINE；正式串接需要先經過後端會員身分比對。');
    button.disabled = true;
  } else {
    show('尚未檢查 LINE 登入', '可在授權的 LIFF 網址手動檢查登入；登入狀態不等於會員契約簽署資格。');
  }
})();
