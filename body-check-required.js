/* DRIFTER: single/first Body Check always visible, server version must be confirmed before submit.
 * Existing LINE member, calendar, promo code, and time logic are unchanged. */
/* DRIFTER Body Check required BEFORE booking; activate only after GAS accepts body_check_json. */
(function () {
  'use strict';
  var form=document.getElementById('bookingForm');
  var type=document.getElementById('customer_type');
  var submit=document.getElementById('submitBtn');
  if(!form||!type||!submit)return;
  var VERSION='BC-SAFETY-2026-10';
  var escapes={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  function esc(x){return String(x).replace(/[&<>"']/g,function(c){return escapes[c];});}
  function choices(key,items){
    return '<div class="drbc-options">'+items.map(function(v){return '<label><input type="checkbox" name="'+key+'" value="'+esc(v)+'">'+esc(v)+'</label>';}).join('')+'</div>';
  }
  function select(key,label,items){
    return '<label>'+label+'<select name="'+key+'"><option value="">請選擇／選填</option>'+items.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('')+'</select></label>';
  }
  var scores=Array.from({length:11},function(_,i){return String(i);});
  var root=document.createElement('section');root.id='drifterBodyCheckRequired';root.hidden=true;
  root.innerHTML=
    '<h2>Body Check｜預約前必填</h2><p class="drbc-help">單次與第一次體驗須先完成本次身體狀況問卷，才能確認預約。</p>'+
    '<fieldset><legend>01｜本次服務需求</legend><p>希望改善的感受 *</p>'+
    choices('improvements',['放鬆與疲勞恢復','工作久坐緊繃','運動後恢復','特定部位不適','其他'])+
    '<p>主要關注部位 *（請選擇 1～3 個部位，60 分鐘不提供全身施作）</p>'+choices('parts',['頸部','肩部','上背','下背','臀部','髖部','大腿','膝部','小腿','足部','手臂','其他'])+
    select('side','左右側',['左側','右側','雙側','不適用'])+
    '<p>目前的感受</p>'+choices('sensations',['活動度受限','緊繃','痠痛','刺痛','疼痛','疲勞','其他'])+'</fieldset>'+
    '<fieldset><legend>02｜程度及近期變化</legend>'+
    select('symptomScore','不適程度（0–10）',scores)+select('tensionScore','緊繃程度（0–10）',scores)+
    select('fatigueScore','疲勞程度（0–10）',scores)+
    select('started','大約從何時開始',['今天','1-7天','1-4週','超過1個月','長期反覆'])+
    select('trend','近期變化',['改善','差不多','加重','反覆'])+'</fieldset>'+
    '<fieldset><legend>03｜生活與活動（選填）</legend>'+
    '<label>日常工作／姿勢<textarea name="work" maxlength="300"></textarea></label>'+
    '<label>近七日運動／活動量<textarea name="activity" maxlength="300"></textarea></label>'+
    '<label>睡眠與恢復<textarea name="sleep" maxlength="200"></textarea></label></fieldset>'+
    '<fieldset><legend>04｜安全與偏好</legend>'+
    select('acute','最近兩週是否有急性傷害或明顯腫脹？ *',['沒有','有','不確定'])+
    '<p class="drbc-help">如有受傷、刺痛、疼痛、腫脹或醫療人員交代的限制，請主動告知；本服務不提供醫療診斷。</p>'+
    '<label>醫療人員交代的施作限制<textarea name="medicalLimit" maxlength="500"></textarea></label>'+
    '<label>其他需要先溝通的健康狀況<textarea name="otherHealth" maxlength="500"></textarea></label>'+
    '<label>不希望碰觸的部位<textarea name="avoid" maxlength="300"></textarea></label>'+
    select('pressure','力道偏好',['輕柔','適中','較有感','請現場溝通'])+
    '<label>其他想告訴按摩師的事<textarea name="notes" maxlength="500"></textarea></label></fieldset>'+
    '<fieldset><legend>05｜告知與如實填寫</legend>'+
    '<p class="drbc-help">蒐集者：DRIFTER 運動按摩工作室。目的：預約管理、服務前需求了解、安全溝通與必要聯絡。資料類別：聯絡資料、預約資料及本次自願提供之服務安全資訊。僅由授權人員及必要雲端服務提供者在相關範圍處理；保存至服務、必要後續聯繫及爭議處理所需期間，法令另有要求者從其規定。可透過 LINE 官方帳號行使個資法所定查詢、更正、停止使用、刪除等權利，依法有例外者除外。</p>'+
    '<label class="drbc-ack"><input type="checkbox" name="privacyConsent">我已閱讀個資蒐集告知，同意本次服務必要的資料處理。</label>'+
    '<label class="drbc-ack"><input type="checkbox" name="healthConsent">我同意提供與本次施作安全有關的必要身體資訊。</label>'+
    '<p class="drbc-help"><strong>請依實際身體狀況如實填寫。</strong>如有近期受傷、疼痛、刺痛、腫脹及醫療人員告知之限制，請主動告知；若預約後身體狀況有變化，請於服務前通知工作室。工作室得因資料不足或安全疑慮要求補充、調整或暫緩施作。相關責任依法認定，本聲明不免除工作室依法應負之責任。</p>'+
    '<label class="drbc-ack"><input type="checkbox" name="truthConsent">我已閱讀聲明，確認所填資訊為目前所知的真實情況，並同意於情況改變時主動告知。</label></fieldset>'+
    '<p id="drifterBodyCheckRequiredError" class="drbc-error" role="alert"></p>';
  var css=document.createElement('style');
  css.textContent='#drifterBodyCheckRequired{margin-top:25px;padding-top:15px;border-top:2px solid #ddd}#drifterBodyCheckRequired fieldset{border:1px solid #ddd;border-radius:12px;padding:14px;margin:15px 0}#drifterBodyCheckRequired legend{font-weight:bold;padding:0 6px}#drifterBodyCheckRequired h2{text-align:center;font-size:20px}#drifterBodyCheckRequired label{font-size:14px;line-height:1.5}#drifterBodyCheckRequired .drbc-options{display:flex;flex-wrap:wrap;gap:8px}#drifterBodyCheckRequired .drbc-options label{border:1px solid #ddd;padding:8px;border-radius:10px;display:flex;gap:7px;align-items:center;margin:0}#drifterBodyCheckRequired input[type=checkbox]{width:18px;height:18px;flex:none;accent-color:#111}#drifterBodyCheckRequired .drbc-ack{display:flex;gap:10px;align-items:flex-start;margin:14px 0}#drifterBodyCheckRequired .drbc-help{color:#555;font-size:13px;line-height:1.75}#drifterBodyCheckRequired .drbc-error{color:#bb1323;font-size:14px}#drifterBodyCheckRequired[hidden]{display:none}';
  document.head.appendChild(css);form.insertBefore(root,submit);
  var backendReady=false;
  var backendMessage='正在核對最新預約服務…';
  var backendStatus=document.createElement('p');
  backendStatus.id='drbcBackendStatus';
  backendStatus.setAttribute('role','status');
  backendStatus.style.cssText='font-size:13px;padding:10px 12px;border-radius:8px;background:#f5f5f5;color:#555;margin:12px 0';
  backendStatus.textContent=backendMessage;
  root.insertBefore(backendStatus,root.children[1]||null);
  function setBackendStatus(message,ok){
    backendMessage=message;
    backendStatus.textContent=message;
    backendStatus.style.background=ok?'#ecf9f0':'#fff5ed';
    backendStatus.style.color=ok?'#186b38':'#8d400f';
  }
  function probeBackend(action,allowRetry){
    var cb='drifterBCProbe_'+Math.random().toString(36).slice(2);
    var tag=document.createElement('script');
    var finished=false;
    var timeout=setTimeout(function(){finish(null);},7000);
    function finish(payload){
      if(finished)return;
      finished=true;
      clearTimeout(timeout);
      try{delete window[cb]}catch(e){window[cb]=void 0}
      if(tag.parentNode)tag.parentNode.removeChild(tag);
      if(payload && payload.ok===true && payload.version==='2026-10-27-REQUIRED-ONEFILE'){
        backendReady=true;
        setBackendStatus('已連接正式預約系統，請完成 Body Check 後確認預約。',true);
      }else if(allowRetry){
        probeBackend('firstExperienceEligibility',false);
      }else{
        var version=payload&&payload.version?String(payload.version):'無法取得版本回應';
        setBackendStatus('預約後端尚未確認已更新（'+version+'）。請暫勿送出，聯絡工作室確認部署版本。',false);
      }
    }
    window[cb]=finish;
    tag.onerror=function(){finish(null);};
    tag.src=BACKEND_URL+'?action='+encodeURIComponent(action)+'&callback='+encodeURIComponent(cb)+'&ts='+Date.now();
    document.head.appendChild(tag);
  }
  probeBackend('health',true);

  var hidden=document.createElement('input');hidden.type='hidden';hidden.name='body_check_json';form.appendChild(hidden);
  function single(){return type.value==='單次'||type.value==='第一次體驗';}
  function sync(){root.hidden=!single();if(root.hidden)hidden.value='';}
  document.querySelectorAll('.type-btn').forEach(function(b){b.addEventListener('click',sync);});
  document.getElementById('phone').addEventListener('input',function(){setTimeout(sync,0);});
  function syncPartsLimit(){
    var selected=root.querySelectorAll('input[name="parts"]:checked').length;
    root.querySelectorAll('input[name="parts"]').forEach(function(box){
      box.disabled=selected>=3 && !box.checked;
    });
  }
  root.addEventListener('change',function(e){
    if(e.target && e.target.name==='parts')syncPartsLimit();
  });
  syncPartsLimit();
  function all(k){return Array.from(root.querySelectorAll('[name="'+k+'"]:checked')).map(function(n){return n.value;});}
  function val(k){var x=root.querySelector('[name="'+k+'"]');return x?x.value:'';}
  function yes(k){return !!root.querySelector('[name="'+k+'"]:checked');}
  form.addEventListener('submit',function(e){
    sync();if(!single())return;
    var d={improvements:all('improvements'),parts:all('parts'),side:val('side'),sensations:all('sensations'),
      symptomScore:val('symptomScore'),tensionScore:val('tensionScore'),fatigueScore:val('fatigueScore'),
      started:val('started'),trend:val('trend'),work:val('work'),activity:val('activity'),sleep:val('sleep'),
      acute:val('acute'),medicalLimit:val('medicalLimit'),otherHealth:val('otherHealth'),avoid:val('avoid'),
      pressure:val('pressure'),notes:val('notes'),privacyConsent:yes('privacyConsent'),
      healthConsent:yes('healthConsent'),truthConsent:yes('truthConsent'),declarationVersion:VERSION};
    var error='';
    if(!d.improvements.length)error='請完成本次服務需求。';
    else if(d.parts.length<1 || d.parts.length>3)error='請選擇 1～3 個主要關注部位。';
    else if(!d.acute)error='請回答最近兩週是否有急性傷害或明顯腫脹。';
    else if(!d.privacyConsent||!d.healthConsent||!d.truthConsent)error='請閱讀並勾選三項必要確認。';
    else if(!backendReady)error='預約系統目前尚未確認新版必填功能。'+backendMessage;
    root.querySelector('#drifterBodyCheckRequiredError').textContent=error;
    if(error){e.preventDefault();e.stopImmediatePropagation();submit.disabled=false;submit.textContent='確認預約';root.scrollIntoView({block:'start',behavior:'smooth'});return;}
    hidden.value=JSON.stringify(d);
  },true);
  sync();
})();
