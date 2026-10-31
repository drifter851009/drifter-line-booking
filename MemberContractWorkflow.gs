/**
 * DRIFTER｜2027 會員電子契約：正式功能程式
 * 此檔應放入既有「DRIFTER｜LINE預約橋接」GAS 專案。
 * 不建立另一個 GAS 專案；不改動既有 LINE 預約與綁定函式。
 *
 * 整合入口：
 * - AppSheet 核發：drifterMc27IssueFromAppSheet(requestId)
 * - 現有 doPost：if(/^memberContract(Open|Sign)$/.test(String(e.parameter.action||'')))
 *                  return drifterMc27HandlePost_(e);
 * - 現有 health JSONP：將 drifterMc27Health_() 的兩個欄位併入 JSON 回應。
 *
 * 重要：法律版契約全文與版本確認前，以下設定維持 false/空字串。
 * 這是正式開發中的啟用門檻，不是另一套測試系統。
 */
const DRIFTER_MC27 = {
  enabled: false,
  approvedVersion: '',
  approvedText: '',
  lineChannelId: '2011856045',
  liffUrl: 'https://liff.line.me/2011856045-PfCKIOb3/member-contract.html',
  qrUrl: 'https://drifter851009.github.io/drifter-line-booking/staff-contract-qr.html',
  sheetContracts: '會員契約主檔',
  sheetRequests: '會員契約核發申請',
  sheetSignatures: '會員電子簽署紀錄',
  sheetActivation: '會員方案開通紀錄',
  sheetPackages: '堂數方案',
  timezone: 'Asia/Taipei',
  plan: {
    BASIC_10_2_2027: {name:'基礎保養｜10+2 堂',price:15000,paid:10,bonus:2,total:12,months:18},
    ADVANCED_20_5_2027: {name:'進階保養｜20+5 堂',price:25000,paid:20,bonus:5,total:25,months:24}
  }
};

function drifterMc27Enabled_(){
  return DRIFTER_MC27.enabled === true &&
    /^DRIFTER-MEMBER-2027-V[0-9.]+$/.test(DRIFTER_MC27.approvedVersion) &&
    String(DRIFTER_MC27.approvedText||'').trim().length >= 1000;
}
function drifterMc27Health_(){
  return {
    memberContractPortalVersion:'MC-PORTAL-2027-01',
    memberContractPortalEnabled:drifterMc27Enabled_()
  };
}
function drifterMc27RequireEnabled_(){
  if(!drifterMc27Enabled_())throw Error('正式會員契約尚未開放，待核准契約全文與版本');
}
function drifterMc27SS_(){
  if(typeof CONFIG==='undefined'||!CONFIG.SPREADSHEET_ID)throw Error('缺少既有試算表設定');
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}
function drifterMc27Table_(ss,name){
  var sheet=ss.getSheetByName(name);
  if(!sheet)throw Error('找不到工作表：'+name);
  var heads=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0].map(function(x){return String(x).trim();});
  var idx={};
  heads.forEach(function(h,i){if(!h||idx[h]!==undefined)throw Error('工作表欄名為空或重複：'+name+'/'+h);idx[h]=i;});
  return {sheet:sheet,heads:heads,idx:idx};
}
function drifterMc27RequireColumns_(tab,keys){
  keys.forEach(function(k){if(tab.idx[k]===undefined)throw Error('工作表缺少欄位：'+k);});
}
function drifterMc27Objects_(tab){
  var last=tab.sheet.getLastRow();
  if(last<2)return [];
  var rows=tab.sheet.getRange(2,1,last-1,tab.heads.length).getDisplayValues();
  return rows.map(function(c,n){
    var data={_row:n+2};
    tab.heads.forEach(function(h,i){data[h]=String(c[i]||'').trim();});
    return data;
  }).filter(function(x){return tab.heads.some(function(h){return x[h]!=='';});});
}
function drifterMc27Row_(tab,obj){
  return tab.heads.map(function(h){return Object.prototype.hasOwnProperty.call(obj,h)?obj[h]:'';});
}
function drifterMc27Set_(tab,row,updates){
  Object.keys(updates).forEach(function(h){
    if(tab.idx[h]===undefined)throw Error('欄位不存在：'+h);
    tab.sheet.getRange(row,tab.idx[h]+1).setValue(updates[h]);
  });
}
function drifterMc27One_(arr,prop,val){
  var found=arr.filter(function(x){return x[prop]===val;});
  if(found.length>1)throw Error('資料主鍵重複：'+prop);
  return found[0]||null;
}
function drifterMc27Hex_(text){
  var dig=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8);
  return dig.map(function(b){return ('0'+(b<0?b+256:b).toString(16)).slice(-2);}).join('');
}
function drifterMc27Utc_(){return new Date().toISOString();}
function drifterMc27Escape_(x){
  return String(x===null||x===undefined?'':x).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function drifterMc27Lock_(fn){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))throw Error('目前有人正在處理契約，請稍後重試');
  try{return fn();}finally{lock.releaseLock();}
}
function drifterMc27Member_(ss,memberId){
  var tab=drifterMc27Table_(ss,CONFIG.MEMBER_SHEET);
  drifterMc27RequireColumns_(tab,['會員編號','姓名','會員狀態','會員端LINE綁定ID','會員端查閱狀態']);
  var m=drifterMc27One_(drifterMc27Objects_(tab),'會員編號',memberId);
  if(!m)throw Error('會員資料不存在');
  return m;
}
function drifterMc27Snapshot_(c,m){
  var lines=[
    'DRIFTER 運動按摩工作室｜會員方案電子契約',
    '契約版本：'+c['契約版本'],
    '契約編號：'+c['契約編號'],
    '會員編號：'+c['會員編號'],
    '會員姓名：'+m['姓名'],
    '契約類型：'+c['契約類型'],
    '方案名稱：'+c['方案名稱'],
    '實付金額（新台幣）：'+c['實付金額'],
    '付費堂數：'+c['付費堂數'],
    '贈送堂數：'+c['贈送堂數'],
    '總服務堂數：'+c['總堂數'],
    '方案效期（月）：'+c['方案效期月數'],
    '生效日：依正式條款與付款確認結果認定',
    '正式審定契約全文：',
    DRIFTER_MC27.approvedText
  ];
  return lines.join('\n');
}
function drifterMc27ValidateContract_(ss,c,m,reqs){
  if(!c||c['會員編號']!==m['會員編號'])throw Error('無法取得本人契約');
  if(c['契約狀態']!=='待簽署'||c['簽署完成UTC'])throw Error('契約目前不可簽署');
  if(c['契約版本']!==DRIFTER_MC27.approvedVersion)throw Error('契約版本尚未核准');
  var exp=Date.parse(c['簽署期限UTC']);
  if(!Number.isFinite(exp)||exp<=Date.now())throw Error('契約簽署期限已過');
  var r=drifterMc27One_(reqs,'核發申請ID',c['簽約申請ID']);
  if(!r||r['會員編號']!==m['會員編號']||r['契約編號']!==c['契約編號']||
    r['契約版本']!==c['契約版本']||r['處理狀態']!=='已核發'||
    Date.parse(r['簽署期限UTC'])!==exp)throw Error('契約申請關聯不一致');
  var p=DRIFTER_MC27.plan[r['方案代碼']];
  if(!p)throw Error('方案代碼無效');
  var cols=['實付金額','付費堂數','贈送堂數','總堂數','方案效期月數'];
  [p.price,p.paid,p.bonus,p.total,p.months].forEach(function(v,i){
    if(Number(String(c[cols[i]]).replace(/,/g,''))!==v)throw Error('契約方案金額或堂數不符');
  });
  if(c['方案名稱']!==p.name)throw Error('契約方案名稱不符');
  var snapshot=drifterMc27Snapshot_(c,m);
  if(drifterMc27Hex_(snapshot)!==c['契約文件SHA256'])throw Error('契約原文完整性驗證失敗');
  return {contract:c,request:r,plan:p,snapshot:snapshot};
}
function drifterMc27VerifyLine_(token){
  token=String(token||'').trim();
  if(token.length<30||token.length>6000)throw Error('LINE 身分驗證失敗');
  var res=UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify',{
    method:'post',payload:{id_token:token,client_id:DRIFTER_MC27.lineChannelId},
    muteHttpExceptions:true,followRedirects:false
  });
  if(res.getResponseCode()!==200)throw Error('LINE 身分驗證失敗');
  var a;
  try{a=JSON.parse(res.getContentText());}catch(_){throw Error('LINE 身分驗證失敗');}
  if(a.iss!=='https://access.line.me'||String(a.aud)!==DRIFTER_MC27.lineChannelId||
    !/^U[0-9a-f]{32}$/i.test(String(a.sub||''))||
    !Number.isFinite(Number(a.exp))||Number(a.exp)*1000<=Date.now()){
    throw Error('LINE 身分驗證失敗');
  }
  return String(a.sub);
}
function drifterMc27MemberFromToken_(ss,token){
  var lineId=drifterMc27VerifyLine_(token);
  var tab=drifterMc27Table_(ss,CONFIG.MEMBER_SHEET);
  drifterMc27RequireColumns_(tab,['會員編號','姓名','會員狀態','會員端LINE綁定ID','會員端查閱狀態']);
  var found=drifterMc27Objects_(tab).filter(function(r){return r['會員端LINE綁定ID']===lineId;});
  if(found.length!==1||found[0]['會員狀態']!=='啟用'||found[0]['會員端查閱狀態']!=='啟用')
    throw Error('此 LINE 帳號尚未獲得本人契約查閱權限');
  return {member:found[0],lineId:lineId};
}
function drifterMc27Pending_(ss,member){
  var ct=drifterMc27Table_(ss,DRIFTER_MC27.sheetContracts);
  var rt=drifterMc27Table_(ss,DRIFTER_MC27.sheetRequests);
  var candidates=drifterMc27Objects_(ct).filter(function(c){
    return c['會員編號']===member['會員編號']&&c['契約狀態']==='待簽署';
  });
  if(candidates.length===0)throw Error('目前沒有待簽署的會員契約');
  if(candidates.length!==1)throw Error('待簽署契約重複，請聯絡工作室');
  var c=candidates[0];
  var all=drifterMc27Objects_(ct);
  if(!c['契約編號']||all.filter(function(x){return x['契約編號']===c['契約編號'];}).length!==1)
    throw Error('契約編號異常');
  return {validated:drifterMc27ValidateContract_(ss,c,member,drifterMc27Objects_(rt)),table:ct};
}
/** AppSheet 呼叫：新增申請後由本函式直接核發正式契約。 */
function drifterMc27IssueFromAppSheet(requestId){
  drifterMc27RequireEnabled_();
  requestId=String(requestId||'').trim();
  if(!/^[0-9A-Za-z_-]{5,128}$/.test(requestId))throw Error('核發申請 ID 無效');
  return drifterMc27Lock_(function(){
    var ss=drifterMc27SS_(),rt=drifterMc27Table_(ss,DRIFTER_MC27.sheetRequests),
        ct=drifterMc27Table_(ss,DRIFTER_MC27.sheetContracts);
    var r=drifterMc27One_(drifterMc27Objects_(rt),'核發申請ID',requestId);
    if(!r)throw Error('找不到核發申請');
    if(r['處理狀態']==='已取消'||r['處理狀態']==='已拒絕')throw Error('申請已取消或拒絕');
    var linked=drifterMc27Objects_(ct).filter(function(c){return c['簽約申請ID']===requestId;});
    if(linked.length>1)throw Error('該申請已有重複契約');
    if(linked.length===1){
      if(r['契約編號']&&r['契約編號']!==linked[0]['契約編號'])throw Error('申請關聯不一致');
      if(r['處理狀態']!=='已核發')drifterMc27Set_(rt,r._row,{
        '處理狀態':'已核發','契約編號':linked[0]['契約編號'],
        '契約版本':linked[0]['契約版本'],'簽署期限UTC':linked[0]['簽署期限UTC'],
        '會員端簽署入口':DRIFTER_MC27.liffUrl,'工作室QR顯示網址':DRIFTER_MC27.qrUrl,
        '處理訊息':'契約已核發','處理時間UTC':drifterMc27Utc_()
      });
      return linked[0]['契約編號'];
    }
    if(r['處理狀態']!=='待核發')throw Error('此申請狀態不可核發');
    if(r['契約類型']!=='新購'&&r['契約類型']!=='續購')throw Error('契約類型無效');
    var p=DRIFTER_MC27.plan[r['方案代碼']];
    if(!p)throw Error('方案代碼無效');
    var m=drifterMc27Member_(ss,r['會員編號']);
    if(!m['姓名'])throw Error('會員姓名缺漏');
    if(m['會員狀態']!=='啟用')throw Error('會員狀態尚未啟用');
    var created=drifterMc27Utc_();
    var exp=new Date(Date.now()+7*86400000).toISOString();
    var id='MC27-'+Utilities.formatDate(new Date(),DRIFTER_MC27.timezone,'yyyyMMdd')+'-'+Utilities.getUuid().slice(0,8).toUpperCase();
    var c={
      '契約編號':id,'會員編號':m['會員編號'],'契約類型':r['契約類型'],
      '方案名稱':p.name,'實付金額':p.price,'付費堂數':p.paid,
      '贈送堂數':p.bonus,'總堂數':p.total,'每堂平均價值':p.price/p.total,
      '方案效期月數':p.months,'契約版本':DRIFTER_MC27.approvedVersion,
      '簽約申請ID':requestId,'契約狀態':'待簽署','簽署期限UTC':exp,
      '付款狀態':'待付款','核發人員':r['核發申請人'],
      '建立UTC':created,'更新UTC':created
    };
    c['契約文件SHA256']=drifterMc27Hex_(drifterMc27Snapshot_(c,m));
    ct.sheet.appendRow(drifterMc27Row_(ct,c));
    drifterMc27Set_(rt,r._row,{
      '處理狀態':'已核發','契約編號':id,
      '契約版本':c['契約版本'],'簽署期限UTC':exp,
      '會員端簽署入口':DRIFTER_MC27.liffUrl,'工作室QR顯示網址':DRIFTER_MC27.qrUrl,
      '處理訊息':'契約已核發；待 LINE 本人簽署','處理時間UTC':drifterMc27Utc_()
    });
    return id;
  });
}
function drifterMc27Page_(body){
  return HtmlService.createHtmlOutput('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="referrer" content="no-referrer"><title>DRIFTER｜會員電子契約</title>'+
    '<style>body{max-width:720px;margin:auto;background:#f2efea;color:#201e1b;padding:22px;font:15px/1.8 -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif}'+
    'main{background:white;padding:26px;border-radius:15px;border:1px solid #ded5c8}h1{font-size:27px}'+
    'pre{white-space:pre-wrap;word-break:break-word;font:13px/1.9 -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif;background:#faf8f4;border:1px solid #e2dcd3;padding:18px;border-radius:9px;max-height:65vh;overflow:auto}'+
    '.check{display:block;margin:14px 0;padding:12px;border:1px solid #e1dbd2;border-radius:8px}input[type=text]{width:100%;padding:12px;font-size:16px;box-sizing:border-box}'+
    'button{border:0;border-radius:9px;padding:14px;background:#222;color:white;font-size:15px;font-weight:700;width:100%;margin-top:18px}'+
    '.muted{color:#736e67;font-size:13px}.warn{color:#8b471e}button:disabled{background:#aaa}'+
    '</style></head><body><main><h1>DRIFTER｜會員電子契約</h1>'+body+'</main></body></html>')
    .setTitle('DRIFTER｜會員電子契約');
}
function drifterMc27Error_(msg){
  return drifterMc27Page_('<h2>目前無法完成此操作</h2><p class="warn">'+drifterMc27Escape_(msg)+'</p>'+
    '<p class="muted">請由 DRIFTER 官方 LINE 重新開啟，或聯絡工作室。既有預約與會員堂數不受影響。</p>');
}
function drifterMc27Review_(p){
  var ss=drifterMc27SS_(),verified=drifterMc27MemberFromToken_(ss,p.id_token);
  var x=drifterMc27Pending_(ss,verified.member).validated,c=x.contract;
  var nonce=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  var now=drifterMc27Utc_();
  var state={memberId:verified.member['會員編號'],contractId:c['契約編號'],
    hash:c['契約文件SHA256'],reviewUTC:now};
  CacheService.getScriptCache().put('mc27:'+nonce,JSON.stringify(state),1200);
  var fields=[
    ['確認方案','我已核對本次購買方案與實付金額'],
    ['確認總堂數','我已核對付費堂數、贈送堂數與總堂數'],
    ['確認效期','我已知悉本方案期限與起算條件'],
    ['確認服務內容','我已閱讀運動按摩服務與堂數使用規則'],
    ['確認退費規則','我已完整閱讀契約中的終止及退費約定'],
    ['同意電子文件','我同意以電子文件及電子簽署方式締約'],
    ['確認個資告知','我已閱讀完整個資告知事項']
  ];
  var checks=fields.map(function(x){
    return '<label class="check"><input type="checkbox" required name="'+drifterMc27Escape_(x[0])+
      '" value="yes"> '+drifterMc27Escape_(x[1])+'</label>';
  }).join('');
  var body='<p>會員：<strong>'+drifterMc27Escape_(verified.member['姓名'])+
    '</strong>　契約編號：'+drifterMc27Escape_(c['契約編號'])+'</p>'+
    '<p class="muted">契約版本 '+drifterMc27Escape_(c['契約版本'])+
    '｜簽署期限 '+drifterMc27Escape_(c['簽署期限UTC'])+'</p>'+
    '<h2>請完整閱讀本次契約</h2><pre>'+drifterMc27Escape_(x.snapshot)+'</pre>'+
    '<p class="muted">契約原文 SHA-256：'+drifterMc27Escape_(c['契約文件SHA256'])+'</p>'+
    '<form method="POST" action="https://script.google.com/macros/s/AKfycbwVJ_6J2b54Jmy8o8rdvSVtXREyNbiGfKVHtyAPD0qoSYJnfPT8JOY0_WwHSZeQQMUZmA/exec">'+
    '<input type="hidden" name="action" value="memberContractSign">'+
    '<input type="hidden" name="id_token" value="'+drifterMc27Escape_(p.id_token)+'">'+
    '<input type="hidden" name="contract_id" value="'+drifterMc27Escape_(c['契約編號'])+'">'+
    '<input type="hidden" name="nonce" value="'+drifterMc27Escape_(nonce)+'">'+
    checks+
    '<label class="check">本人簽署姓名（請輸入會員實名）<input type="text" required name="signature_name" maxlength="80" autocomplete="name"></label>'+
    '<p class="muted">按下送出後，系統才會建立本人電子簽署紀錄；付款確認與方案開通為另外的作業。</p>'+
    '<button type="submit">我已閱讀並確認，送出電子簽署</button></form>';
  return drifterMc27Page_(body);
}
function drifterMc27Sign_(p){
  var result=drifterMc27Lock_(function(){
    var ss=drifterMc27SS_();
    var verified=drifterMc27MemberFromToken_(ss,p.id_token);
    var member=verified.member,nonce=String(p.nonce||'');
    if(!/^[0-9a-f]{64}$/i.test(nonce))throw Error('簽署驗證資料無效');
    var stateRaw=CacheService.getScriptCache().get('mc27:'+nonce);
    if(!stateRaw)throw Error('簽署頁面已逾時，請重新開啟契約');
    var state=JSON.parse(stateRaw);
    if(state.memberId!==member['會員編號']||state.contractId!==String(p.contract_id||''))
      throw Error('簽署身份與契約不一致');
    var record=drifterMc27Pending_(ss,member).validated,c=record.contract;
    if(c['契約編號']!==state.contractId||c['契約文件SHA256']!==state.hash)
      throw Error('契約版本或文件內容已有變更');
    if(String(p.signature_name||'').trim()!==member['姓名'])
      throw Error('電子簽署姓名與會員資料不一致');
    var required=['確認方案','確認總堂數','確認效期','確認服務內容','確認退費規則','同意電子文件','確認個資告知'];
    if(required.some(function(k){return p[k]!=='yes';}))throw Error('尚有契約確認項目未完成');
    var st=drifterMc27Table_(ss,DRIFTER_MC27.sheetSignatures);
    if(drifterMc27Objects_(st).some(function(r){return r['契約編號']===c['契約編號']&&r['簽署結果']==='完成';}))
      throw Error('此契約已有電子簽署紀錄，請勿重複簽署');
    var signed=drifterMc27Utc_();
    var copy='<html><head><meta charset="utf-8"><title>DRIFTER 契約副本</title></head><body><h1>DRIFTER 會員電子契約副本</h1>'+
      '<p>本人電子簽署姓名：'+drifterMc27Escape_(member['姓名'])+'</p>'+
      '<p>電子簽署 UTC：'+drifterMc27Escape_(signed)+'</p>'+
      '<p>契約 SHA-256：'+drifterMc27Escape_(c['契約文件SHA256'])+'</p>'+
      '<pre style="white-space:pre-wrap">'+drifterMc27Escape_(record.snapshot)+'</pre></body></html>';
    var file=DriveApp.createFile('DRIFTER-'+c['契約編號']+'-signed.html',copy,MimeType.HTML);
    var receipt=file.getUrl();
    var auditHash=drifterMc27Hex_([c['契約編號'],c['契約文件SHA256'],
      verified.lineId,nonce,signed,member['姓名']].join('|'));
    var id='SIG-'+Utilities.getUuid();
    var log={
      '簽署紀錄ID':id,'契約編號':c['契約編號'],'會員編號':member['會員編號'],
      '契約版本':c['契約版本'],'契約文件SHA256':c['契約文件SHA256'],
      '會員LINE識別摘要SHA256':drifterMc27Hex_(verified.lineId),
      '身分核驗方式':'LINE ID Token（LINE 官方 Verify API）',
      '身分核驗UTC':signed,'契約審閱開始UTC':state.reviewUTC,
      '確認方案':'是','確認總堂數':'是','確認效期':'是',
      '確認服務內容':'是','確認退費規則':'是','同意電子文件':'是',
      '確認個資告知':'是','勾選詳細JSON':JSON.stringify({agreed:required}),
      '簽署姓名':member['姓名'],'簽署完成UTC':signed,'簽署結果':'完成',
      '電子契約副本網址':receipt,'簽署驗證摘要SHA256':auditHash,'建立UTC':signed
    };
    st.sheet.appendRow(drifterMc27Row_(st,log));
    var ct=drifterMc27Table_(ss,DRIFTER_MC27.sheetContracts);
    drifterMc27Set_(ct,c._row,{
      '契約狀態':'已簽署','簽署完成UTC':signed,
      '電子契約副本網址':receipt,'更新UTC':signed
    });
    CacheService.getScriptCache().remove('mc27:'+nonce);
    return {name:member['姓名'],id:c['契約編號'],snapshot:record.snapshot,utc:signed};
  });
  return drifterMc27Page_('<h2>電子簽署已完成</h2>'+
    '<p>會員：'+drifterMc27Escape_(result.name)+'</p>'+
    '<p>契約編號：'+drifterMc27Escape_(result.id)+'</p>'+
    '<p>簽署 UTC：'+drifterMc27Escape_(result.utc)+'</p>'+
    '<p>下一步由工作室確認付款。付款確認前，不會自動開通會員堂數。</p>'+
    '<h3>契約內容副本</h3><pre>'+drifterMc27Escape_(result.snapshot)+'</pre>'+
    '<p class="muted">可使用瀏覽器「列印／儲存為 PDF」保存此頁。</p>');
}
function drifterMc27HandlePost_(e){
  try{
    drifterMc27RequireEnabled_();
    var p=(e&&e.parameter)||{};
    if(p.action==='memberContractOpen')return drifterMc27Review_(p);
    if(p.action==='memberContractSign')return drifterMc27Sign_(p);
    return drifterMc27Error_('不支援的契約操作');
  }catch(err){
    console.error('MemberContract error: '+String(err&&err.message||err));
    return drifterMc27Error_(String(err&&err.message||'目前無法完成操作'));
  }
}

/**
 * DRIFTER｜2027 會員方案開通（正式作業函式）
 * 僅在契約已簽署 + 工作室付款狀態已確認後開通。
 * 不提供 doGet/doPost 公開操作；由 AppSheet 付款確認 Bot 呼叫。
 * 依賴 MemberContractWorkflow.gs 的 DRIFTER_MC27 與 drifterMc27* 工具函式。
 */
function drifterMc27ActivateFromPayment(contractId){
  drifterMc27RequireEnabled_();
  contractId=String(contractId||'').trim();
  if(!/^MC27-[0-9]{8}-[A-Z0-9-]{8,20}$/.test(contractId))
    throw Error('契約編號無效');
  return drifterMc27Lock_(function(){
    var ss=drifterMc27SS_();
    var ct=drifterMc27Table_(ss,DRIFTER_MC27.sheetContracts);
    var contract=drifterMc27One_(drifterMc27Objects_(ct),'契約編號',contractId);
    if(!contract)throw Error('契約不存在');
    var m=drifterMc27Member_(ss,contract['會員編號']);
    if(m['會員狀態']!=='啟用')throw Error('會員尚未啟用');
    var rt=drifterMc27Table_(ss,DRIFTER_MC27.sheetRequests);
    var req=drifterMc27One_(drifterMc27Objects_(rt),'核發申請ID',contract['簽約申請ID']);
    if(!req||req['會員編號']!==contract['會員編號']||
      req['契約編號']!==contractId||req['契約版本']!==contract['契約版本']||
      req['處理狀態']!=='已核發')throw Error('契約與核發申請不一致');
    if(contract['契約版本']!==DRIFTER_MC27.approvedVersion)throw Error('契約版本未核准');
    var plan=DRIFTER_MC27.plan[req['方案代碼']];
    if(!plan||contract['方案名稱']!==plan.name)throw Error('方案不存在或方案名稱不一致');
    var numeric={'實付金額':plan.price,'付費堂數':plan.paid,'贈送堂數':plan.bonus,
      '總堂數':plan.total,'方案效期月數':plan.months};
    Object.keys(numeric).forEach(function(k){
      if(Number(String(contract[k]||'').replace(/[,，]/g,''))!==numeric[k])
        throw Error('契約方案數值不一致：'+k);
    });
    if(drifterMc27Hex_(drifterMc27Snapshot_(contract,m))!==contract['契約文件SHA256'])
      throw Error('契約文件雜湊不一致');
    if(contract['付款狀態']!=='已確認'||!contract['付款確認UTC']||
      !Number.isFinite(Date.parse(contract['付款確認UTC']))||!contract['付款方式'])
      throw Error('付款尚未由工作室確認');
    if(!contract['簽署完成UTC']||!Number.isFinite(Date.parse(contract['簽署完成UTC'])))
      throw Error('尚未完成有效電子簽署');
    var st=drifterMc27Table_(ss,DRIFTER_MC27.sheetSignatures);
    var signatures=drifterMc27Objects_(st).filter(function(x){
      return x['契約編號']===contractId&&x['簽署結果']==='完成';
    });
    if(signatures.length!==1||signatures[0]['會員編號']!==m['會員編號']||
       signatures[0]['契約版本']!==contract['契約版本']||
       signatures[0]['契約文件SHA256']!==contract['契約文件SHA256']||
       signatures[0]['簽署完成UTC']!==contract['簽署完成UTC'])
      throw Error('電子簽署紀錄無法驗證');
    var packageId='DR27-'+contractId;
    var existingPackageId=String(contract['堂數方案編號']||'').trim();
    if(existingPackageId&&existingPackageId!==packageId)
      throw Error('契約既有方案編號不一致');
    if(contract['契約狀態']!=='已簽署'&&contract['契約狀態']!=='已生效')
      throw Error('契約狀態不允許開通');

    var packageTab=drifterMc27Table_(ss,DRIFTER_MC27.sheetPackages);
    var activationTab=drifterMc27Table_(ss,DRIFTER_MC27.sheetActivation);
    var packageRows=drifterMc27Objects_(packageTab);
    var already=drifterMc27One_(packageRows,'方案編號',packageId);
    var activationRows=drifterMc27Objects_(activationTab);
    var activation=drifterMc27One_(activationRows,'開通防重鍵',contractId);
    var start=Utilities.formatDate(new Date(contract['付款確認UTC']),
      DRIFTER_MC27.timezone,'yyyy-MM-dd');
    var end=drifterMc27AddMonths_(start,plan.months);
    if(already){
      if(already['會員編號']!==m['會員編號']||
         Number(String(already['總堂數']||'').replace(/,/g,''))!==plan.total||
         Number(String(already['實收金額']||'').replace(/,/g,''))!==plan.price)
        throw Error('既有堂數方案資料不一致，不可重複開通');
    }else{
      if(contract['契約狀態']==='已生效')
        throw Error('契約已生效但找不到堂數方案，需人工處理');
      var pkg={
        '方案編號':packageId,'會員編號':m['會員編號'],'方案名稱':plan.name,
        '購買日期':start,'總堂數':plan.total,'已使用堂數':0,
        '剩餘堂數':plan.total,'實收金額':plan.price,'方案狀態':'啟用',
        '到期日':end,'備註':'電子契約 '+contractId,
        '建立時間':drifterMc27Utc_(),'方案原價':plan.price,
        '合作折抵':0,'付款方式':contract['付款方式']
      };
      packageTab.sheet.appendRow(drifterMc27Row_(packageTab,pkg));
    }
    if(activation && (activation['契約編號']!==contractId||
        activation['會員編號']!==m['會員編號']||
        activation['堂數方案編號']!==packageId))
      throw Error('既有開通紀錄不一致');
    var now=drifterMc27Utc_();
    if(!activation){
      var act={
        '開通紀錄ID':'ACT-'+Utilities.getUuid(),'契約編號':contractId,
        '會員編號':m['會員編號'],'契約版本':contract['契約版本'],
        '方案名稱':plan.name,'方案實付金額':plan.price,
        '付費堂數':plan.paid,'贈送堂數':plan.bonus,'總堂數':plan.total,
        '有效月數':plan.months,'契約簽署狀態':'已簽署',
        '付款確認狀態':'已確認','付款確認UTC':contract['付款確認UTC'],
        '付款方式':contract['付款方式'],'方案啟用狀態':'已開通',
        '開通時間UTC':now,'方案生效日':start,'方案到期日':end,
        '堂數方案編號':packageId,'開通防重鍵':contractId,
        '任務執行結果':'成功','建立UTC':now,'更新UTC':now
      };
      activationTab.sheet.appendRow(drifterMc27Row_(activationTab,act));
    }
    if(contract['契約狀態']!=='已生效'||!existingPackageId){
      drifterMc27Set_(ct,contract._row,{
        '契約狀態':'已生效','方案生效日':start,'方案到期日':end,
        '堂數方案編號':packageId,'更新UTC':now
      });
    }
    return packageId;
  });
}
/** 以本地年月日計算到期日；月底自動限制到目標月份的最後一日。 */
function drifterMc27AddMonths_(localDate,months){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate)||!Number.isInteger(months)||months<1||months>120)
    throw Error('方案日期或月份無效');
  var p=localDate.split('-').map(Number),y=p[0],m=p[1]-1,d=p[2];
  var first=new Date(Date.UTC(y,m+months,1));
  var last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return Utilities.formatDate(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),
    Math.min(d,last))),'UTC','yyyy-MM-dd');
}
