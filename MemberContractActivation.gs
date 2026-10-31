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