/**
 * DRIFTER | STEP 12N-5C-4
 * Read-only contract association. Draft versions remain disabled.
 * Keep this helper internal; do not register an HTTP action.
 */
const DRIFTER_MCP_LOOKUP = {
  allowedVersions: [],
  contractSheet: '會員契約主檔',
  requestSheet: '會員契約核發申請',
  plans: {
    BASIC_10_2_2027: [15000,10,2,12,18],
    ADVANCED_20_5_2027: [25000,20,5,25,24]
  }
};

function drifterMcpLookupTable_(ss,name,keys){
  var sheet=ss.getSheetByName(name);
  if(!sheet || !sheet.getLastColumn()) throw Error('工作表不存在：'+name);
  var heads=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  var at={};
  keys.forEach(function(k){
    if(heads.indexOf(k)<0 || heads.lastIndexOf(k)!==heads.indexOf(k)) throw Error('欄位缺漏或重複：'+k);
    at[k]=heads.indexOf(k);
  });
  var rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getDisplayValues():[];
  return rows.map(function(row){
    var o={};keys.forEach(function(k){o[k]=String(row[at[k]]||'').trim()});return o;
  });
}
function drifterMcpLookupCheck_(memberId,contracts,requests,versions,now){
  var pending=contracts.filter(function(c){
    return c['會員編號']===memberId && c['契約狀態']==='待簽署';
  });
  if(!pending.length)return null;
  if(pending.length!==1)throw Error('會員有多筆待簽契約');
  var c=pending[0],rid=c['簽約申請ID'],cid=c['契約編號'];
  if(!cid || !rid || contracts.filter(function(x){return x['契約編號']===cid}).length!==1)throw Error('契約編號重複或缺漏');
  if(versions.indexOf(c['契約版本'])<0)throw Error('契約版本尚未核准');
  if(!/^[a-f0-9]{64}$/i.test(c['契約文件SHA256']))throw Error('契約雜湊不完整');
  if(c['簽署完成UTC'])throw Error('契約已簽署');
  var expiry=Date.parse(c['簽署期限UTC']);
  if(!Number.isFinite(expiry)||expiry<=now)throw Error('簽署期限無效或已過期');
  var rs=requests.filter(function(r){return r['核發申請ID']===rid});
  if(rs.length!==1)throw Error('核發申請不存在或重複');
  var r=rs[0];
  if(r['會員編號']!==memberId || r['契約編號']!==cid ||
     r['契約版本']!==c['契約版本'] || r['處理狀態']!=='已核發' ||
     Date.parse(r['簽署期限UTC'])!==expiry)throw Error('契約與核發申請不一致');
  var plan=DRIFTER_MCP_LOOKUP.plans[r['方案代碼']];
  if(!plan)throw Error('方案代碼不在清單');
  var fields=['實付金額','付費堂數','贈送堂數','總堂數','方案效期月數'];
  fields.forEach(function(k,i){
    var v=String(c[k]||'').replace(/[,，]/g,'');
    if(!/^\d+$/.test(v)||Number(v)!==plan[i])throw Error('方案數值不一致：'+k);
  });
  if(!c['方案名稱'])throw Error('方案名稱缺漏');
  return {contractId:cid,memberId:memberId,requestId:rid,
    version:c['契約版本'],planCode:r['方案代碼'],
    expiryUTC:c['簽署期限UTC']};
}
function drifterMemberContractPendingPreflight(){
  if(typeof CONFIG==='undefined'||!CONFIG.SPREADSHEET_ID)throw Error('缺少工作表設定');
  if(typeof drifterMc2027ResolveBoundMember_!=='function')throw Error('會員身分模組未就緒');
  var ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  drifterMcpLookupTable_(ss,DRIFTER_MCP_LOOKUP.contractSheet,
    ['契約編號','會員編號','方案名稱','實付金額','付費堂數','贈送堂數',
     '總堂數','方案效期月數','契約版本','契約文件SHA256','簽約申請ID',
     '契約狀態','簽署期限UTC','簽署完成UTC']);
  drifterMcpLookupTable_(ss,DRIFTER_MCP_LOOKUP.requestSheet,
    ['核發申請ID','會員編號','方案代碼','處理狀態','契約編號',
     '契約版本','簽署期限UTC']);
  if(DRIFTER_MCP_LOOKUP.allowedVersions.length)throw Error('開發階段不得啟用正式簽署');
  return '待簽契約預檢通過；正式簽署尚未啟用。';
}
/** Integration remains disabled until verified membership is connected. */
function drifterMcpLookupForVerifiedMember_(){
  throw Error('會員身分及契約授權尚未完成正式串接');
}
function drifterMemberContractPendingSelfTest(){
  var version='TEST-ONLY',expiry='2027-01-03T00:00:00.000Z';
  var c={'契約編號':'C-TEST','會員編號':'M-TEST','方案名稱':'測試方案',
    '實付金額':'15000','付費堂數':'10','贈送堂數':'2','總堂數':'12',
    '方案效期月數':'18','契約版本':version,'契約文件SHA256':'a'.repeat(64),
    '簽約申請ID':'R-TEST','契約狀態':'待簽署','簽署期限UTC':expiry,'簽署完成UTC':''};
  var r={'核發申請ID':'R-TEST','會員編號':'M-TEST',
    '方案代碼':'BASIC_10_2_2027','處理狀態':'已核發','契約編號':'C-TEST',
    '契約版本':version,'簽署期限UTC':expiry};
  var t=Date.parse('2027-01-01T00:00:00.000Z');
  if(!drifterMcpLookupCheck_('M-TEST',[c],[r],[version],t))throw Error('正例測試失敗');
  if(drifterMcpLookupCheck_('OTHER',[c],[r],[version],t)!==null)throw Error('跨會員測試失敗');
  var rejected=false;
  try{drifterMcpLookupCheck_('M-TEST',[c],[r],[],t)}catch(_){rejected=true}
  if(!rejected)throw Error('契約版本拒絕測試失敗');
  return '合成資料測試通過；沒有讀取或寫入真實會員紀錄。';
}
